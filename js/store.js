/* HW.api – the single place the app talks to "the backend".
   DRAFT 2 PILOT: this version keeps everything in this browser's localStorage so the whole workflow can be tried
   without a server (open staff.html on one tab/phone and the customer pages on another – they sync on the same device/browser).
   Every function is async and returns plain data, so a real backend (Supabase, Firebase, your own server)
   can replace this file without touching the pages. See README-v2.md → "Going live".

   SECURITY NOTE: with localStorage nothing here is truly private. Accounts, passwords (hashed) and the staff PIN
   are stored on the device itself. This is for trying the workflow, NOT for real customer data. */
(() => {
  'use strict';
  const HW = window.HW;
  const K = { users: 'hw2_users', session: 'hw2_session', jobs: 'hw2_jobs', leads: 'hw2_leads', seq: 'hw2_seq', seeded: 'hw2_seeded', staff: 'hw2_staff' };
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
  const write = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { const err = new Error('storage_full'); err.code = 'storage_full'; throw err; }
    emit();
  };
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => { try { f(); } catch { /* ignore */ } });
  window.addEventListener('storage', (e) => { if (!e.key || e.key.startsWith('hw2_')) emit(); });
  const fail = (code) => { const e = new Error(code); e.code = code; return e; };
  const nowIso = () => new Date().toISOString();
  const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const nextId = (prefix, start) => { const s = read(K.seq, {}); s[prefix] = (s[prefix] || start) + 1; write(K.seq, s); return `${prefix}-${s[prefix]}`; };

  /* ---------- phone + password helpers ---------- */
  /* 8 digits = Kuwait number. Other lengths are kept as typed (digits only). */
  const normPhone = (raw) => {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.length === 8) d = '965' + d;
    return d;
  };
  async function hashPw(pw, salt) {
    const data = new TextEncoder().encode(salt + ':' + pw);
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', data);
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 5381; for (const b of data) h = ((h * 33) ^ b) >>> 0; // fallback when crypto is unavailable (demo only)
    return 'x' + h.toString(16);
  }
  const publicUser = (u) => u && ({ id: u.id, name: u.name, phone: u.phone, cars: u.cars || [], createdAt: u.createdAt });

  /* ---------- accounts ---------- */
  async function register({ name, phone, password }) {
    phone = normPhone(phone); name = String(name || '').trim();
    if (!name || phone.length < 8) throw fail('bad_details');
    if (String(password || '').length < 6) throw fail('weak_password');
    const users = read(K.users, []);
    if (users.some((u) => u.phone === phone)) throw fail('phone_exists');
    const salt = uid('s');
    const u = { id: uid('u'), name, phone, salt, hash: await hashPw(password, salt), cars: [], createdAt: nowIso() };
    users.push(u); write(K.users, users); write(K.session, u.id);
    return publicUser(u);
  }
  async function login({ phone, password }) {
    phone = normPhone(phone);
    const u = read(K.users, []).find((x) => x.phone === phone);
    if (!u || u.hash !== await hashPw(password || '', u.salt)) throw fail('bad_login');
    write(K.session, u.id);
    return publicUser(u);
  }
  async function logout() { localStorage.removeItem(K.session); emit(); }
  async function me() { const id = read(K.session, null); return publicUser(read(K.users, []).find((u) => u.id === id)) || null; }
  async function saveCar(car) {
    const id = read(K.session, null); const users = read(K.users, []); const u = users.find((x) => x.id === id);
    if (!u) throw fail('not_logged_in');
    u.cars = (u.cars || []).filter((c) => c.id !== car.id); u.cars.unshift(car); u.cars = u.cars.slice(0, 8);
    write(K.users, users); return publicUser(u);
  }
  async function removeCar(carId) {
    const id = read(K.session, null); const users = read(K.users, []); const u = users.find((x) => x.id === id);
    if (!u) throw fail('not_logged_in');
    u.cars = (u.cars || []).filter((c) => c.id !== carId); write(K.users, users); return publicUser(u);
  }

  /* ---------- staff (demo PIN) ---------- */
  const staffOk = () => sessionStorage.getItem(K.staff) === '1';
  async function staffLogin(pin) { if (String(pin) !== String(HW.CONFIG.staffPin)) throw fail('bad_pin'); sessionStorage.setItem(K.staff, '1'); emit(); return true; }
  async function staffLogout() { sessionStorage.removeItem(K.staff); emit(); }
  const needStaff = () => { if (!staffOk()) throw fail('staff_only'); };

  /* ---------- jobs ---------- */
  const ACTIVE = ['booked', 'received', 'in_progress', 'qc'];
  const STAGES = ['booked', 'received', 'in_progress', 'qc', 'ready', 'delivered'];
  const allJobs = () => read(K.jobs, []);
  const mine = (j, u) => u && (j.userId === u.id || j.customer.phone === u.phone);

  /* Which hours of a day are full? Returns { hour: jobsUsingABay }. A job uses a bay from its appointment until its ready-by time. */
  function usage(dateStr) {
    const out = {};
    HW.sched.slotHours(dateStr).forEach((h) => {
      const at = new Date(`${dateStr}T${String(h).padStart(2, '0')}:00:00`).getTime();
      out[h] = allJobs().filter((j) => ACTIVE.includes(j.status) && new Date(j.startFrom).getTime() <= at && at < new Date(j.etaAt).getTime()).length;
    });
    return out;
  }
  async function slots(dateStr) { return { usage: usage(dateStr), bays: HW.CONFIG.bays }; }

  async function createJob(d, { walkIn = false } = {}) {
    const u = await me();
    if (walkIn) needStaff(); else if (!u) throw fail('not_logged_in');
    if (!d.items || !d.items.length) throw fail('empty');
    const car = d.car; if (!car) throw fail('no_car');
    const dur = HW.cartDuration(d.items, car);
    let appt = null;
    if (d.appointment && d.appointment.date) {
      appt = new Date(`${d.appointment.date}T${d.appointment.time || '09:00'}:00`);
      if (!walkIn) {
        const hour = appt.getHours(); const used = usage(d.appointment.date)[hour];
        if (used === undefined || used >= HW.CONFIG.bays) throw fail('slot_full');
      }
    }
    const start = appt || new Date();
    const job = {
      id: nextId('J', 1000), userId: walkIn ? null : u.id,
      customer: { name: walkIn ? d.customer.name : u.name, phone: walkIn ? normPhone(d.customer.phone) : u.phone },
      car, items: d.items.map((it) => ({ pid: it.pid, qty: it.qty, sel: it.sel || {}, price: it.price })),
      total: d.items.reduce((s, it) => s + it.price, 0), durationMin: dur,
      appointment: appt ? { date: d.appointment.date, time: d.appointment.time } : null,
      startFrom: start.toISOString(), status: walkIn ? 'received' : 'booked',
      createdAt: nowIso(), receivedAt: walkIn ? nowIso() : null, startedAt: null,
      etaAt: HW.sched.addWork(start, dur).toISOString(), readyAt: null, deliveredAt: null,
      bay: null, camera: !!d.cameraConsent, cameraConsent: !!d.cameraConsent,
      notes: d.notes || '', payment: d.payment || 'cash', lang: d.lang || 'ar', updates: [], approvals: []
    };
    job.updates.push({ id: uid('n'), at: nowIso(), kind: 'status', status: job.status });
    const jobs = allJobs(); jobs.unshift(job); write(K.jobs, jobs);
    if (!walkIn && d.saveCar) { try { await saveCar(car); } catch { /* ignore */ } }
    return job;
  }
  async function listJobs({ all = false } = {}) {
    if (all) { needStaff(); return allJobs(); }
    const u = await me(); if (!u) return [];
    return allJobs().filter((j) => mine(j, u));
  }
  async function getJob(id) {
    const j = allJobs().find((x) => x.id === id); if (!j) return null;
    if (staffOk()) return j;
    const u = await me(); return mine(j, u) ? j : null;
  }
  function mutate(id, fn, { staffOnly = true } = {}) {
    if (staffOnly) needStaff();
    const jobs = allJobs(); const j = jobs.find((x) => x.id === id); if (!j) throw fail('not_found');
    fn(j); write(K.jobs, jobs); return j;
  }
  const remainingMin = (j) => Math.max(0, j.durationMin - (j.startedAt ? HW.sched.workBetween(j.startedAt, new Date()) : 0));

  async function setStatus(id, status) {
    return mutate(id, (j) => {
      const now = new Date();
      if (j.status !== status) j.updates.push({ id: uid('n'), at: now.toISOString(), kind: 'status', status });
      j.status = status;
      if (status === 'booked') { j.receivedAt = null; j.startedAt = null; }
      if (status === 'received') { j.receivedAt = j.receivedAt || now.toISOString(); j.startedAt = null; j.etaAt = HW.sched.addWork(now, j.durationMin).toISOString(); }
      if (status === 'in_progress') { if (!j.startedAt) { j.startedAt = now.toISOString(); j.etaAt = HW.sched.addWork(now, j.durationMin).toISOString(); } j.receivedAt = j.receivedAt || now.toISOString(); }
      if (status === 'qc') j.etaAt = HW.sched.addWork(now, 20).toISOString();
      if (status === 'ready') { j.readyAt = now.toISOString(); j.etaAt = now.toISOString(); }
      if (status === 'delivered') { j.deliveredAt = now.toISOString(); j.camera = false; }
      if (status !== 'delivered') j.deliveredAt = null;
    });
  }
  async function adjustEta(id, deltaMin) {
    return mutate(id, (j) => {
      j.etaAt = HW.sched.addWork(new Date(j.etaAt) > new Date() ? j.etaAt : new Date(), 0).toISOString();
      const base = new Date(j.etaAt);
      j.etaAt = (deltaMin >= 0 ? HW.sched.addWork(base, deltaMin) : subWork(base, -deltaMin)).toISOString();
      j.updates.push({ id: uid('n'), at: nowIso(), kind: 'eta', text: String(deltaMin) });
    });
  }
  /* Walk backwards through working hours. */
  function subWork(from, minutes) {
    const { dayAt, startHour } = HW.sched, end = HW.CONFIG.workHours.end;
    let t = new Date(from), left = minutes;
    for (let i = 0; i < 800; i++) {
      const open = dayAt(t, startHour(t)), close = dayAt(t, end);
      if (t > close) t = close;
      if (t <= open) { t = dayAt(new Date(t.getTime() - 86400000), end); continue; }
      const avail = (t - open) / 60000;
      if (left <= avail) return new Date(t.getTime() - left * 60000);
      left -= avail; t = dayAt(new Date(open.getTime() - 86400000), end);
    }
    return t;
  }
  async function assignBay(id, bay) { return mutate(id, (j) => { j.bay = bay ? Number(bay) : null; }); }
  async function setCamera(id, on) { return mutate(id, (j) => { if (on && !j.cameraConsent) throw fail('no_consent'); j.camera = !!on; }); }
  /* The customer decides whether their car may be watched. Turning it off hides the camera at once. */
  async function setCameraConsent(id, on) {
    const u = await me();
    return mutate(id, (j) => { if (!mine(j, u)) throw fail('not_allowed'); j.cameraConsent = !!on; if (!on) j.camera = false; }, { staffOnly: false });
  }
  async function addUpdate(id, { text, photo }) {
    return mutate(id, (j) => { j.updates.push({ id: uid('n'), at: nowIso(), kind: photo ? 'photo' : 'note', text: text || '', photo: photo || null }); });
  }
  async function requestApproval(id, { title, price, extraMin }) {
    return mutate(id, (j) => {
      j.approvals.push({ id: uid('a'), title, price: Number(price) || 0, extraMin: Number(extraMin) || 0, status: 'pending', createdAt: nowIso(), decidedAt: null });
      j.updates.push({ id: uid('n'), at: nowIso(), kind: 'approval', text: title });
    });
  }
  /* Customers (or staff on the phone with the customer) answer an approval request. */
  async function decideApproval(jobId, approvalId, approved) {
    const u = await me();
    return mutate(jobId, (j) => {
      if (!staffOk() && !mine(j, u)) throw fail('not_allowed');
      const a = j.approvals.find((x) => x.id === approvalId); if (!a || a.status !== 'pending') throw fail('already_decided');
      a.status = approved ? 'approved' : 'declined'; a.decidedAt = nowIso();
      if (approved) {
        j.total += a.price; j.durationMin += a.extraMin;
        if (a.extraMin) j.etaAt = HW.sched.addWork(new Date(j.etaAt) > new Date() ? j.etaAt : new Date(), a.extraMin).toISOString();
      }
      j.updates.push({ id: uid('n'), at: nowIso(), kind: 'approval_done', text: `${a.title}|${approved ? 'approved' : 'declined'}` });
    }, { staffOnly: false });
  }
  async function cancelJob(id) {
    const u = await me();
    return mutate(id, (j) => {
      if (!staffOk() && !mine(j, u)) throw fail('not_allowed');
      if (j.status !== 'booked' && !staffOk()) throw fail('too_late');
      j.status = 'cancelled'; j.camera = false; j.updates.push({ id: uid('n'), at: nowIso(), kind: 'status', status: 'cancelled' });
    }, { staffOnly: false });
  }

  /* ---------- leads (from the chat assistant) ---------- */
  async function addLead(l) {
    const leads = read(K.leads, []);
    const lead = { id: nextId('L', 0), createdAt: nowIso(), status: 'new', ...l };
    leads.unshift(lead); write(K.leads, leads); return lead;
  }
  async function listLeads() { needStaff(); return read(K.leads, []); }
  async function setLeadStatus(id, status) { needStaff(); const l = read(K.leads, []); const x = l.find((y) => y.id === id); if (x) x.status = status; write(K.leads, l); }

  /* ---------- progress, as the customer sees it ---------- */
  function jobProgress(j, now = new Date()) {
    const st = j.status; let pct = 0, left = 0;
    if (st === 'cancelled') return { pct: 0, left: 0, eta: null, st };
    if (st === 'booked') { pct = 5; left = j.durationMin; }
    else if (st === 'received') { pct = 15; left = j.durationMin; }
    else if (st === 'in_progress') {
      const total = Math.max(1, HW.sched.workBetween(j.startedAt, j.etaAt)), done = HW.sched.workBetween(j.startedAt, now);
      pct = 15 + 65 * Math.min(1, done / total); left = Math.max(0, HW.sched.workBetween(now, j.etaAt));
    } else if (st === 'qc') { pct = 90; left = Math.max(0, HW.sched.workBetween(now, j.etaAt)); }
    else { pct = 100; }
    return { pct: Math.round(pct), left, eta: (st === 'ready' || st === 'delivered') ? null : new Date(j.etaAt), st };
  }

  /* ---------- demo data ---------- */
  function prevOpen(d) { // the last moment the garage was open, so demo jobs look right even at night
    const now = new Date(d);
    if (Math.abs(HW.sched.nextOpen(now) - now) < 1000) return now;
    const close = HW.sched.dayAt(now, HW.CONFIG.workHours.end);
    return now >= close ? close : HW.sched.dayAt(new Date(now.getTime() - 86400000), HW.CONFIG.workHours.end);
  }
  async function seedDemo(force = false) {
    if (!force && (!HW.CONFIG.demoMode || localStorage.getItem(K.seeded))) return false;
    ['users', 'session', 'jobs', 'leads', 'seq'].forEach((k) => localStorage.removeItem(K[k]));
    const demoUser = { id: 'u-demo', name: 'Demo Customer', phone: '96599990001', salt: 'demo', cars: [], createdAt: nowIso() };
    demoUser.hash = await hashPw('demo1234', 'demo');
    demoUser.cars = [HW.makeCar('toyota', 'Camry', 2022), HW.makeCar('toyota', 'Land Cruiser', 2023)];
    write(K.users, [demoUser]);
    const car = (mk, md, y) => HW.makeCar(mk, md, y);
    const svc = (ids, c) => ids.map((pid) => { const p = HW.findProduct(pid); return { pid, qty: 1, sel: {}, price: HW.priceFor(p, c) }; });
    const MIN = 60000, now = new Date(), anchor = prevOpen(now);
    const mkJob = (o) => {
      const items = svc(o.ids, o.car); const dur = HW.cartDuration(items, o.car);
      const j = {
        id: nextId('J', 1000), userId: o.user || null, customer: o.customer, car: o.car, items, total: items.reduce((s, i) => s + i.price, 0), durationMin: dur,
        appointment: null, startFrom: now.toISOString(), status: o.status, createdAt: new Date(now - 86400000).toISOString(), receivedAt: null, startedAt: null,
        etaAt: now.toISOString(), readyAt: null, deliveredAt: null, bay: o.bay || null, camera: !!o.camera, cameraConsent: !!o.camera, notes: '', payment: 'cash', updates: [], approvals: []
      };
      let appt;
      if (o.apptOffsetDays !== undefined) { appt = new Date(now.getTime() + o.apptOffsetDays * 86400000); appt.setHours(o.apptHour, 0, 0, 0); } else { appt = new Date(anchor.getTime() - (o.doneMin || 0) * MIN); }
      const d = `${appt.getFullYear()}-${String(appt.getMonth() + 1).padStart(2, '0')}-${String(appt.getDate()).padStart(2, '0')}`;
      j.appointment = { date: d, time: `${String(appt.getHours()).padStart(2, '0')}:00` };
      j.startFrom = appt.toISOString();
      if (o.status === 'booked') j.etaAt = HW.sched.addWork(appt, dur).toISOString();
      if (o.status === 'received') { j.receivedAt = new Date(anchor - 20 * MIN).toISOString(); j.etaAt = HW.sched.addWork(now, dur).toISOString(); }
      if (o.status === 'in_progress') {
        j.receivedAt = new Date(anchor - (o.doneMin + 30) * MIN).toISOString(); j.startedAt = subWork(anchor, o.doneMin).toISOString();
        j.etaAt = HW.sched.addWork(now, Math.max(15, dur - o.doneMin)).toISOString();
      }
      if (o.status === 'qc') { j.receivedAt = new Date(anchor - 200 * MIN).toISOString(); j.startedAt = subWork(anchor, 150).toISOString(); j.etaAt = HW.sched.addWork(now, 15).toISOString(); }
      if (o.status === 'ready') { j.receivedAt = new Date(now - 300 * MIN).toISOString(); j.readyAt = new Date(now - 25 * MIN).toISOString(); j.etaAt = j.readyAt; }
      const t0 = new Date(j.createdAt).getTime();
      j.updates.push({ id: uid('n'), at: new Date(t0).toISOString(), kind: 'status', status: 'booked' });
      if (j.receivedAt) j.updates.push({ id: uid('n'), at: j.receivedAt, kind: 'status', status: 'received' });
      if (j.startedAt) j.updates.push({ id: uid('n'), at: j.startedAt, kind: 'status', status: 'in_progress' });
      (o.extra || []).forEach((e) => j.updates.push({ id: uid('n'), at: new Date(now - e.ago * MIN).toISOString(), ...e.u }));
      if (['qc', 'ready'].includes(o.status)) j.updates.push({ id: uid('n'), at: new Date(now - 40 * MIN).toISOString(), kind: 'status', status: 'qc' });
      if (o.status === 'ready') j.updates.push({ id: uid('n'), at: j.readyAt, kind: 'status', status: 'ready' });
      (o.approvals || []).forEach((a) => j.approvals.push({ id: uid('a'), createdAt: nowIso(), decidedAt: null, status: 'pending', ...a }));
      return j;
    };
    const jobs = [
      mkJob({ user: 'u-demo', customer: { name: 'Demo Customer', phone: '96599990001' }, car: car('toyota', 'Camry', 2022), ids: ['wash-detail', 'polish-hero'], status: 'in_progress', doneMin: 150, bay: 2, camera: true,
        extra: [{ ago: 45, u: { kind: 'photo', text: 'Washing and decontamination done. Starting the polish.', photo: 'assets/categories/wash.jpg' } }],
        approvals: [{ title: 'Headlight restoration (both sides)', price: 18, extraMin: 45 }] }),
      mkJob({ user: 'u-demo', customer: { name: 'Demo Customer', phone: '96599990001' }, car: car('toyota', 'Land Cruiser', 2023), ids: ['ppf-front', 'glass-global'], status: 'booked', apptOffsetDays: 1, apptHour: 10 }),
      mkJob({ customer: { name: 'Fahad', phone: '96599990002' }, car: car('bmw', 'M3', 2021), ids: ['thermal-a'], status: 'qc', bay: 1, camera: true }),
      mkJob({ customer: { name: 'Mariam', phone: '96599990003' }, car: car('mercedes', 'G-Class', 2022), ids: ['ppf-half', 'wheels-protect'], status: 'in_progress', doneMin: 90, bay: 3, camera: true,
        extra: [{ ago: 20, u: { kind: 'note', text: 'Film is being cut and fitted to the bumper.' } }] }),
      mkJob({ customer: { name: 'Yousef', phone: '96599990004' }, car: car('mazda', 'CX-5', 2020), ids: ['oil-jp', 'mech-check'], status: 'received', bay: 4 }),
      mkJob({ customer: { name: 'Noura', phone: '96599990005' }, car: car('nissan', 'Patrol', 2021), ids: ['wash-nano'], status: 'ready' })
    ];
    write(K.jobs, jobs);
    const leads = [{ id: nextId('L', 0), createdAt: new Date(now - 30 * MIN).toISOString(), status: 'new', name: 'Abdullah', phone: '96599990006', carText: 'Hyundai Sonata 2019', car: car('hyundai', 'Sonata', 2019), services: ['Wheel Protection – Weighter'], when: 'This week', notes: 'Wants it done before the weekend.', lang: 'en' }];
    write(K.leads, leads);
    localStorage.setItem(K.seeded, '1'); emit();
    return true;
  }
  async function resetDemo() { needStaff(); localStorage.removeItem(K.seeded); localStorage.removeItem('hw2_mult'); localStorage.removeItem('hw2_prices'); await seedDemo(true); return true; }
  async function wipeAll() { needStaff(); ['users', 'session', 'jobs', 'leads', 'seq'].forEach((k) => localStorage.removeItem(K[k])); localStorage.setItem(K.seeded, '1'); emit(); }

  const SEED_READY = HW.CONFIG.demoMode ? Promise.resolve().then(() => seedDemo()) : Promise.resolve();

  HW.STAGES = STAGES; HW.ACTIVE = ACTIVE;
  HW.jobProgress = jobProgress;
  HW.api = {
    ready: SEED_READY, normPhone, onChange: (f) => { listeners.add(f); return () => listeners.delete(f); },
    register, login, logout, me, saveCar, removeCar,
    staffOk, staffLogin, staffLogout,
    slots, createJob, listJobs, getJob, setStatus, adjustEta, assignBay, setCamera, setCameraConsent, addUpdate, requestApproval, decideApproval, cancelJob,
    addLead, listLeads, setLeadStatus, seedDemo, resetDemo, wipeAll, remainingMin
  };
})();
