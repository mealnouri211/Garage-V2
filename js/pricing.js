/* Price-by-car engine, service durations, and working-hours scheduling.

   HOW PRICES ARE WORKED OUT
   The catalog price (js/data.js) is the price for a SMALL car (class S).
   For other classes: price = base × (1 + (multiplier − 1) × sensitivity), rounded to a tidy number.
   - multiplier  : how much a class costs compared with a small car   (CLASS_MULT below, editable in staff.html)
   - sensitivity : how much that service depends on car size          (SENS below; 0 = same price for every car)
   A fixed price for one service + one class can also be set ("override") in staff.html → Pricing.
   ALL MULTIPLIERS BELOW ARE PLACEHOLDERS – the garage must set its real prices. */
(() => {
  'use strict';
  const HW = window.HW;
  HW.findProduct = (id) => HW.PRODUCTS.find((p) => p.id === id);
  const CLASSES = ['S', 'M', 'L', 'P', 'X'];
  const DEFAULT_MULT = { S: 1, M: 1.15, L: 1.3, P: 1.45, X: 1.9 }; // GUESS
  /* How strongly each category follows car size. */
  const SENS = { wash: 1, polish: 1, thermal: 1, ppf: 1, paint: 1, wheels: 0.5, glass: 0.5, dashcam: 0, elec: 0, maint: 0 }; // GUESS

  const LS_PRICES = 'hw2_prices';
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const getMult = () => ({ ...DEFAULT_MULT, ...read('hw2_mult', {}) });
  const getOverrides = () => read(LS_PRICES, {});

  const round = (n) => (n < 100 ? Math.round(n * 2) / 2 : Math.round(n / 5) * 5);

  /* Price of a catalog item for a given car (or the listed "from" price when no car is chosen). */
  function priceFor(p, car, sel) {
    const extra = sel ? p.groups.length ? HW.unitPrice(p, sel) - p.base : 0 : 0;
    if (!car) return p.base + extra;
    const ov = getOverrides()[`${p.id}|${car.cls}`];
    if (typeof ov === 'number') return ov + extra;
    return formulaPrice(p, car.cls) + extra;
  }
  /* The price from the formula only (ignores fixed overrides). Used by the staff pricing editor. */
  function formulaPrice(p, cls, mult = getMult()) {
    const m = mult[cls] || 1, s = SENS[p.cat] ?? 0;
    if (m === 1 || s === 0) return p.base;
    return round(p.base * (1 + (m - 1) * s));
  }
  /* The crossed-out "was" price follows the same ratio so the discount % stays the same. */
  function wasFor(p, car) {
    if (!p.was) return 0;
    return p.was * (priceFor(p, car) / p.base);
  }

  /* ---- which cars each service fits ---- */
  const ORIGIN_RULES = {
    'oil-us': ['us'], 'oil-eu': ['eu'], 'oil-jp': ['jp', 'asia'],
    'brakes-eu': ['eu'], 'brakes-usjp': ['us', 'jp', 'asia'],
    'service-us': ['us'], 'service-eu': ['eu'], 'service-jp': ['jp', 'asia']
  };
  /* 'yes' fits · 'no' does not fit · 'confirm' bookable, garage will confirm compatibility · 'any' no car chosen yet */
  function fit(p, car) {
    if (!car) return 'any';
    if (ORIGIN_RULES[p.id]) return ORIGIN_RULES[p.id].includes(car.origin) ? 'yes' : 'no';
    if (p.id === 'bmw-remote') return car.makeId === 'bmw' ? 'yes' : 'no';
    if (p.id === 'bm3-license') return car.makeId === 'toyota' && /supra/i.test(car.model) ? 'yes' : 'no';
    if (p.id === 'carplay') return car.origin === 'eu' ? 'yes' : 'confirm';
    if (p.id === 'maps-ecu') return car.origin === 'eu' ? 'yes' : 'confirm';
    return 'yes';
  }

  /* ---- how long each service takes (minutes of working time, for a small car) – ALL GUESSES ---- */
  const DURATIONS = {
    'wash-basic': 30, 'wash-polish': 60, 'wash-nano': 90, 'wash-detail': 120, 'polish-hero': 300,
    'thermal-a': 150, 'thermal-b': 150, 'ppf-half': 360, 'ppf-front': 480, 'ppf-full': 1200, 'ppf-color': 1800,
    'wheels-protect': 120, 'glass-global': 60,
    'paint-calipers': 180, 'paint-wheels': 300, 'blackout-no-wheels': 240, 'blackout-wheels': 360,
    'accident-estimate': 30, 'repaint-glasurit': 2400, 'wrap-removable': 1800, 'chassis-renew': 240,
    'bm3-license': 180, 'carplay': 90, 'maps-ecu': 180, 'bmw-remote': 60, 'elec-check': 60,
    'oil-us': 45, 'oil-eu': 45, 'oil-jp': 45, 'brakes-eu': 120, 'brakes-usjp': 120, 'mech-check': 90,
    'service-us': 150, 'service-eu': 180, 'service-jp': 150, 'gear-oil': 60
  };
  const PART_INSTALL_MIN = 30; // dash cams etc.: time to fit

  function durationFor(p, car) {
    const base = p.type === 'part' ? PART_INSTALL_MIN : (DURATIONS[p.id] ?? 120);
    if (!car || p.type === 'part' || !(SENS[p.cat] > 0)) return base;
    const m = getMult()[car.cls] || 1;
    return Math.round(base * (1 + (m - 1) * 0.5) / 5) * 5;
  }

  /* ---- working-hours calendar ---- */
  const startHour = (d) => (d.getDay() === 5 ? HW.CONFIG.workHours.fridayStart : HW.CONFIG.workHours.start);
  const dayAt = (d, h) => { const x = new Date(d); x.setHours(h, 0, 0, 0); return x; };
  /* Move a moment forward to the next time the garage is open. */
  function nextOpen(d) {
    let t = new Date(d);
    for (let i = 0; i < 400; i++) {
      const open = dayAt(t, startHour(t)), close = dayAt(t, HW.CONFIG.workHours.end);
      if (t < open) return open;
      if (t < close) return t;
      t = dayAt(new Date(t.getTime() + 86400000), 0);
    }
    return t;
  }
  /* The moment when `minutes` of work, started at `from`, will be finished. Closed hours do not count. */
  function addWork(from, minutes) {
    let t = nextOpen(from), left = Math.max(0, minutes);
    for (let i = 0; i < 400 && left > 0; i++) {
      const close = dayAt(t, HW.CONFIG.workHours.end), avail = (close - t) / 60000;
      if (left <= avail) return new Date(t.getTime() + left * 60000);
      left -= avail;
      t = nextOpen(new Date(close.getTime() + 60000));
    }
    return t;
  }
  /* Minutes of working time between two moments. */
  function workBetween(a, b) {
    let from = new Date(a), to = new Date(b); if (to <= from) return 0;
    let total = 0, t = nextOpen(from);
    for (let i = 0; i < 400 && t < to; i++) {
      const close = dayAt(t, HW.CONFIG.workHours.end), end = close < to ? close : to;
      total += Math.max(0, (end - t) / 60000);
      t = nextOpen(new Date(close.getTime() + 60000));
    }
    return Math.round(total);
  }
  const isOpenNow = (d = new Date()) => { const o = nextOpen(d); return Math.abs(o - d) < 1000; };

  /* Appointment slots of a day: hourly between opening and closing. */
  function slotHours(dateStr) {
    const d = new Date(dateStr + 'T00:00:00'); const out = [];
    for (let h = startHour(d); h < HW.CONFIG.workHours.end; h++) out.push(h);
    return out;
  }

  /* Cart helpers that depend on the chosen car. */
  const itemPrice = (it, car) => priceFor(HW.findProduct(it.pid), car, it.sel) * it.qty;
  const cartDuration = (items, car) => items.reduce((s, it) => s + durationFor(HW.findProduct(it.pid), car) * (HW.findProduct(it.pid).type === 'part' ? it.qty : 1), 0);

  Object.assign(HW, {
    CLASSES, DEFAULT_MULT, SENS, getMult, getOverrides, priceFor, formulaPrice, wasFor, fit, DURATIONS, durationFor,
    sched: { addWork, workBetween, nextOpen, slotHours, startHour, isOpenNow, dayAt },
    itemPrice, cartDuration, setPricing(mult, overrides) { localStorage.setItem('hw2_mult', JSON.stringify(mult)); localStorage.setItem(LS_PRICES, JSON.stringify(overrides)); }
  });
})();
