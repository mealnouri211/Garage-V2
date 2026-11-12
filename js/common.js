/* Shared layout (header/footer), language, cart storage and UI helpers. */
(() => {
  'use strict';
  const HW = window.HW;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }
  };
  Object.assign(HW, { $, $$, store });

  /* ---- language ---- */
  HW.lang = store.get('hw_lang', 'ar');
  HW.t = (k) => (HW.I18N[HW.lang][k] ?? k);
  HW.L = (o) => o[HW.lang];
  HW.money = (n) => `${n.toFixed(3)} ${HW.t('kd')}`;
  HW.findProduct = (id) => HW.PRODUCTS.find((p) => p.id === id);
  HW.findCat = (id) => HW.CATS.find((c) => c.id === id);
  HW.productUrl = (id) => `product.html?id=${encodeURIComponent(id)}`;

  /* ---- chosen car: every price on the site follows it ---- */
  HW.car = store.get('hw2_car', null);
  HW.user = null; // filled in by HW.boot once the account is loaded
  HW.setCar = (c) => { HW.car = c; store.set('hw2_car', c); updateCarBtn(); };
  HW.carLabel = (c = HW.car) => HW.carName(c, HW.lang);
  /* Does the price of this item depend on the car? */
  HW.varies = (p) => (HW.SENS[p.cat] ?? 0) > 0 || HW.CLASSES.some((c) => typeof HW.getOverrides()[`${p.id}|${c}`] === 'number');

  /* ---- date / time text (Latin digits, Gregorian calendar, in both languages) ---- */
  const loc = () => (HW.lang === 'ar' ? 'ar-KW-u-nu-latn-ca-gregory' : 'en-GB');
  HW.fmtTime = (d) => new Date(d).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit', hour12: false });
  HW.fmtDay = (d) => new Date(d).toLocaleDateString(loc(), { weekday: 'short', day: 'numeric', month: 'short' });
  /* "Today 16:30", "Tomorrow 10:00", or "Sun 14 Nov 10:00" */
  HW.fmtWhen = (d) => {
    d = new Date(d); const now = new Date(); const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(d) - day(now)) / 86400000);
    const t = HW.fmtTime(d);
    if (diff === 0) return `${HW.t('today')} ${t}`;
    if (diff === 1) return `${HW.t('tomorrow')} ${t}`;
    return `${HW.fmtDay(d)} ${t}`;
  };
  HW.fmtDur = (min) => {
    min = Math.max(0, Math.round(min)); const h = Math.floor(min / 60), m = min % 60;
    const H = HW.t('u_h'), M = HW.t('u_min');
    if (!h) return `${m} ${M}`;
    return m ? `${h} ${H} ${m} ${M}` : `${h} ${H}`;
  };

  /* ---- cart ---- */
  HW.cart = store.get('hw_cart', []).filter((i) => HW.PRODUCTS.some((p) => p.id === i.pid)).map((i) => ({ ...i, sel: i.sel || {} })); // drop items from older catalogs
  HW.saveCart = () => { store.set('hw_cart', HW.cart); updateCount(); };
  HW.lineTotal = (it) => HW.priceFor(HW.findProduct(it.pid), HW.car, it.sel) * it.qty;
  HW.cartTotal = () => HW.cart.reduce((s, it) => s + HW.lineTotal(it), 0);
  function updateCount() { const el = $('#cartCount'); if (el) el.textContent = HW.cart.reduce((s, i) => s + i.qty, 0); }

  /* ---- shared components ---- */
  // Image box. With no image, shows the company logo as the placeholder.
  // Pass a real image path (img) to replace it.
  HW.ph = (img, alt = '') => (img
    ? `<div class="ph"><img src="${img}" alt="${alt}" loading="lazy" decoding="async"></div>`
    : '<div class="ph"><img class="ph__logo" src="assets/logo-transparent.png" alt="" loading="lazy" decoding="async"></div>');

  // Price block. With a car chosen the price is exact for that car; without one, car-dependent prices read "from".
  HW.priceHtml = (p, label = true) => {
    const car = HW.car, fit = HW.fit(p, car);
    if (fit === 'no') return `<div class="price price--na">${HW.t('not_for_car')}</div>`;
    const was = HW.wasFor(p, car), from = !car && HW.varies(p);
    return `<div class="price">${from && label ? `<small>${HW.t('from')}</small>` : ''}${was ? `<s class="was">${HW.money(was)}</s>` : ''}${HW.money(HW.priceFor(p, car))}</div>`;
  };

  HW.cardHtml = (p) => {
    const pct = HW.discountPct(p), fit = HW.fit(p, HW.car);
    return `
    <article class="card ${fit === 'no' ? 'card--na' : ''}">
      <a class="card__media" href="${HW.productUrl(p.id)}" tabindex="-1" aria-hidden="true">${HW.ph(p.img, HW.L(p.name))}<span class="card__tag">${p.type === 'service' ? HW.t('service') : HW.t('part')}</span>${pct ? `<span class="card__off">-${pct}%</span>` : ''}</a>
      <div class="card__body">
        <h3><a href="${HW.productUrl(p.id)}">${HW.L(p.name)}</a></h3>
        <p>${HW.L(p.desc)}</p>
        ${p.badges.length ? `<div class="badges">${p.badges.map((b) => `<span>${HW.L(b)}</span>`).join('')}</div>` : ''}
        <div class="card__foot">
          ${HW.priceHtml(p)}
          <a class="btn btn--gold" href="${HW.productUrl(p.id)}">${p.type === 'service' ? HW.t('book') : HW.t('buy')}</a>
        </div>
      </div>
    </article>`;
  };

  HW.optionsText = (it) => HW.selectedOptions(HW.findProduct(it.pid), it.sel).map(({ o }) => HW.L(o.label)).join(' · ');

  let toastTimer;
  HW.toast = (msg) => {
    let el = $('#toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  };

  /* ---- layout ---- */
  function headerHtml() {
    const page = document.body.dataset.page || '';
    const link = (href, key, id) => `<a href="${href}" ${page === id ? 'class="active" aria-current="page"' : ''}>${HW.t(key)}</a>`;
    return `
    <div class="topbar"><span>${HW.t('topbar')}</span></div>
    <header class="header">
      <div class="container header__inner">
        <a href="index.html" class="brand" aria-label="HeroWorks"><img class="brand__logo" src="assets/logo.png" alt="HeroWorks" width="48" height="48"></a>
        <nav class="nav" id="nav" aria-label="Main">
          ${link('index.html', 'home', 'home')}
          ${link('shop.html', 'shop', 'shop')}
          ${link('quote.html', 'nav_quote', 'quote')}
          ${link('account.html', 'nav_track', 'account')}
          ${link('contact.html', 'nav_contact', 'contact')}
        </nav>
        <div class="header__actions">
          <a class="icon-btn" href="shop.html?focus=1" aria-label="${HW.t('search')}"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></a>
          <a class="icon-btn acct-btn ${HW.user ? 'on' : ''}" href="${HW.user ? 'account.html' : 'login.html'}" aria-label="${HW.t(HW.user ? 'my_account' : 'login')}" title="${HW.user ? HW.user.name : HW.t('login')}"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></a>
          <button class="icon-btn theme-btn" id="themeBtn" aria-label="${HW.t('theme')}" title="${HW.t('theme')}">
            <svg class="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>
            <svg class="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
          </button>
          <button class="lang-btn" id="langBtn" aria-label="Language">${HW.lang === 'ar' ? 'EN' : 'عربي'}</button>
          <a class="icon-btn cart-btn" href="cart.html" aria-label="${HW.t('cart')}"><svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg><span class="badge" id="cartCount">0</span></a>
          <button class="icon-btn menu-btn" id="menuBtn" aria-label="Menu"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
        </div>
      </div>
      ${document.body.dataset.nocar ? '' : `<div class="carbar"><div class="container carbar__inner">
        <button type="button" class="carbar__btn" id="carBtn"></button>
        <button type="button" class="carbar__clear" id="carClear" hidden aria-label="${HW.t('clear_car')}" title="${HW.t('clear_car')}">×<span>${HW.t('clear_car')}</span></button>
        <a class="carbar__quote" href="quote.html">${HW.t('get_quote')} ›</a>
      </div></div>`}
    </header>`;
  }
  const CAR_SVG = '<svg viewBox="0 0 24 24"><path d="M3 15v-3l2-5h14l2 5v3"/><path d="M3 15h18v3H3z"/><circle cx="7.5" cy="18" r="1.4"/><circle cx="16.5" cy="18" r="1.4"/></svg>';
  function updateCarBtn() {
    const b = $('#carBtn'); if (!b) return;
    const x = $('#carClear'); if (x) x.hidden = !HW.car;
    b.innerHTML = HW.car ? `${CAR_SVG}<span><small>${HW.t('your_car')}</small><b>${HW.carLabel()}</b></span><em>${HW.t('change')}</em>` : `${CAR_SVG}<span><b>${HW.t('select_car')}</b><small>${HW.t('select_car_sub')}</small></span><em>${HW.t('choose')}</em>`;
  }
  HW.updateCarBtn = updateCarBtn;
  function footerHtml() {
    const C = HW.CONTACT;
    return `
    <footer class="footer">
      <div class="container footer__grid">
        <div><img class="brand__logo" src="assets/logo.png" alt="HeroWorks" width="72" height="72"><p class="muted" style="max-width:320px">${HW.t('about_p')}</p></div>
        <div><h4>${HW.t('nav_shop')}</h4><ul>${HW.CATS.slice(0, 6).map((c) => `<li><a href="shop.html?cat=${c.id}">${HW.L(c.name)}</a></li>`).join('')}</ul></div>
        <div><h4>${HW.t('nav_contact')}</h4><ul>
          <li><a href="tel:${C.tel}" dir="ltr">${C.phone}</a></li>
          <li><a href="https://wa.me/${C.wa}" target="_blank" rel="noopener">${HW.t('wa_us')}</a></li>
          <li><a href="${C.maps}" target="_blank" rel="noopener">${HW.t('open_maps')}</a></li>
          <li><a href="contact.html">${HW.t('contact_title')}</a></li>
          <li><a href="account.html">${HW.t('nav_track')}</a></li>
          <li><a href="staff.html" class="muted">${HW.t('staff_link')}</a></li>
        </ul></div>
      </div>
      <div class="container footer__inner"><span>${HW.t('footer')}</span><span class="pay"><i>Apple Pay</i><i>K-Net</i></span></div>
    </footer>
    <div class="fab">
      <a class="call-fab" href="tel:${C.tel}" aria-label="${HW.t('call_us')}"><svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg></a>
      <a class="whatsapp" href="https://wa.me/${C.wa}" target="_blank" rel="noopener" aria-label="WhatsApp"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Z"/><path d="M9 8.5c.3 2.6 2.9 5.2 5.6 5.6l1.3-1.3-2-1-.9.7a4 4 0 0 1-2-2l.7-.9-1-2Z"/></svg></a>
    </div>`;
  }

  function applyI18n() {
    document.documentElement.lang = HW.lang;
    document.documentElement.dir = HW.lang === 'ar' ? 'rtl' : 'ltr';
    $$('[data-i18n]').forEach((el) => { el.innerHTML = HW.t(el.dataset.i18n); });
    $$('[data-i18n-ph]').forEach((el) => { el.placeholder = HW.t(el.dataset.i18nPh); });
    $$('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', HW.t(el.dataset.i18nAria)));
    const tk = document.body.dataset.title;
    document.title = (tk ? HW.t(tk) + ' | ' : '') + 'HeroWorks';
  }
  HW.applyI18n = applyI18n;

  function mountLayout() {
    $('#site-header').innerHTML = headerHtml();
    $('#site-footer').innerHTML = footerHtml();
    $('#langBtn').addEventListener('click', () => {
      HW.lang = HW.lang === 'ar' ? 'en' : 'ar'; store.set('hw_lang', HW.lang); HW.refresh();
    });
    $('#themeBtn').addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next; store.set('hw_theme', next);
      const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = next === 'light' ? '#faf8f3' : '#0a0a0b';
    });
    $('#menuBtn').addEventListener('click', () => $('#nav').classList.toggle('open'));
    const cb = $('#carBtn');
    if (cb) cb.addEventListener('click', () => HW.openCarPicker({ onPick: (c) => { HW.setCar(c); HW.refresh(); }, onClear: () => { HW.setCar(null); HW.refresh(); } }));
    const cx = $('#carClear');
    if (cx) cx.addEventListener('click', () => { HW.setCar(null); HW.refresh(); HW.toast(HW.t('car_cleared')); });
    updateCarBtn(); updateCount();
    if (HW.mountChat) HW.mountChat();
  }

  /* Each page calls HW.boot(render). render() runs now and again whenever the language changes. */
  HW.boot = (render) => {
    HW.refresh = () => { mountLayout(); render(); applyI18n(); };
    // wait for the demo data and the signed-in account, then draw the page
    Promise.all([HW.api.ready, HW.api.me()]).then(([, u]) => { HW.user = u; HW.refresh(); });
  };

  /* Pull a product + its selection state from the cart into a readable line */
  HW.lineHtml = (it, { editable = false } = {}) => {
    const p = HW.findProduct(it.pid);
    const fit = HW.fit(p, HW.car);
    const warn = fit === 'no' ? `<small class="warn">${HW.t('not_for_car')}</small>` : fit === 'confirm' ? `<small class="warn">${HW.t('confirm_fit')}</small>` : '';
    return `<div class="line" data-key="${it.key}">${HW.ph(p.img)}
      <div><h4><a href="${HW.productUrl(p.id)}">${HW.L(p.name)}</a>${it.qty > 1 && !editable ? ` × ${it.qty}` : ''}</h4><small>${HW.optionsText(it)}</small>${warn}
        ${editable && p.type === 'part' ? `<div class="qty qty--sm"><button type="button" data-q="-1" aria-label="-">−</button><span>${it.qty}</span><button type="button" data-q="1" aria-label="+">+</button></div>` : ''}</div>
      <div class="line__side"><span class="price">${HW.money(HW.lineTotal(it))}</span>${editable ? `<button class="line__rm" data-rm="${it.key}">${HW.t('remove')}</button>` : ''}</div></div>`;
  };
})();
