/* Intake assistant. A scripted (rule-based) chat that collects name, phone, car, service and timing,
   then saves a "lead" for the staff inbox and offers a WhatsApp summary. It is NOT an AI model yet:
   to make it a real AI assistant, send the messages to a server function that calls an LLM
   (never put an API key in this file) – see README-v2.md. */
(() => {
  'use strict';
  const HW = window.HW;
  if (!document.body || ['staff'].includes(document.body.dataset.page)) return;
  const KEY = 'hw2_chat';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const load = () => HW.store.get(KEY, null) || { open: false, msgs: [], step: 'start', d: { services: [] } };
  let C = load();
  const save = () => HW.store.set(KEY, C);

  const CAT_WORDS = {
    polish: /polish|بوليش|تلميع/i, wash: /wash|غسيل|غسل|تنظيف/i, thermal: /tint|thermal|insulat|عازل|تظليل|حراري/i, ppf: /ppf|film|protection|حماية|فيلم/i,
    wheels: /wheel|rim|جنط|رنج/i, glass: /glass|windshield|زجاج|شبك/i, paint: /paint|body|dent|wrap|صبغ|دهان|حدادة|رش|تغيير لون/i,
    dashcam: /dash ?cam|داش/i, elec: /electric|carplay|program|برمجة|كهرباء/i, maint: /oil|service|brake|maint|زيت|صيانة|فرامل|فحص/i
  };
  const INTENT = {
    hours: /hour|open|close|when do you|دوام|ساعات|مفتوح|تفتح|تسكر|تقفل/i,
    where: /where are|location|address|map|موقع|عنوان|وين|فين|لوكيشن/i,
    price: /price|cost|how much|quote|سعر|اسعار|أسعار|كم|تكلف/i,
    status: /track|status|my car|ready|سيارتي|جاهز|حالة|متابع/i,
    human: /human|person|agent|talk to|call me|موظف|اتصل|كلم|شخص/i,
    restart: /restart|start over|إعادة|من جديد|ابدأ/i
  };

  const push = (from, html) => { C.msgs.push({ from, html }); save(); };
  const bot = (html, chips) => { push('bot', html); C.chips = chips || null; save(); draw(); };
  const link = (href, label, blank) => `<a href="${href}" ${blank ? 'target="_blank" rel="noopener"' : ''}>${label}</a>`;
  const catName = (id) => HW.L(HW.findCat(id).name);

  function chipsFor(list) { return list.map(([k, label]) => ({ k, label })); }
  const yesNoNew = () => chipsFor([['restart', HW.t('chat_restart')]]);

  /* ---------- steps ---------- */
  function ask(step) {
    C.step = step; save();
    if (step === 'name') {
      if (HW.user) { C.d.name = HW.user.name; return ask('phone'); }
      return bot(HW.t('chat_ask_name'));
    }
    if (step === 'phone') {
      if (HW.user) { C.d.phone = HW.user.phone; return ask('car'); }
      return bot(HW.t('chat_ask_phone'));
    }
    if (step === 'car') {
      if (C.d.car) return ask('service');
      if (HW.car) return bot(`${HW.t('chat_car_is')} <b>${esc(HW.carLabel())}</b>?`, chipsFor([['car_yes', HW.t('yes')], ['car_pick', HW.t('chat_other_car')], ['car_skip', HW.t('chat_skip')]]));
      return bot(HW.t('chat_ask_car'), chipsFor([['car_pick', HW.t('select_car')], ['car_skip', HW.t('chat_skip')]]));
    }
    if (step === 'service') {
      const left = Object.keys(CAT_WORDS).filter((c) => !C.d.services.includes(c));
      const chips = left.map((c) => [`svc:${c}`, catName(c)]);
      chips.push(['svc_unsure', HW.t('chat_unsure')]);
      if (C.d.services.length) chips.unshift(['svc_done', HW.t('chat_thats_all')]);
      return bot(C.d.services.length ? HW.t('chat_more') : HW.t('chat_ask_service'), chipsFor(chips));
    }
    if (step === 'when') return bot(HW.t('chat_ask_when'), chipsFor([['when:today', HW.t('today')], ['when:tomorrow', HW.t('tomorrow')], ['when:week', HW.t('chat_week')], ['when:flex', HW.t('chat_flex')]]));
    if (step === 'notes') return bot(HW.t('chat_ask_notes'), chipsFor([['notes_none', HW.t('chat_no_notes')]]));
    if (step === 'confirm') {
      const d = C.d, svc = d.services.map(catName).join('، ') || HW.t('chat_unsure');
      return bot(`${HW.t('chat_summary')}<ul class="chat__sum"><li>${HW.t('f_name')}: <b>${esc(d.name)}</b></li><li>${HW.t('f_phone')}: <b dir="ltr">+${esc(d.phone)}</b></li><li>${HW.t('your_car')}: <b>${esc(d.car ? HW.carName(d.car, HW.lang) : '–')}</b></li><li>${HW.t('service')}: <b>${esc(svc)}</b></li><li>${HW.t('when')}: <b>${esc(d.whenLabel || '–')}</b></li>${d.notes ? `<li>${HW.t('f_notes')}: ${esc(d.notes)}</li>` : ''}</ul>`,
        chipsFor([['send', HW.t('chat_send')], ['restart', HW.t('chat_restart')]]));
    }
  }

  function estimateFor(catId) {
    const car = C.d.car; if (!car) return '';
    const list = HW.PRODUCTS.filter((p) => p.cat === catId && HW.fit(p, car) !== 'no'); if (!list.length) return '';
    const min = Math.min(...list.map((p) => HW.priceFor(p, car)));
    return ` ${HW.t('chat_from')} <b>${HW.money(min)}</b> ${HW.t('chat_for_car')}.`;
  }

  async function finish() {
    const d = C.d;
    const names = d.services.map((c) => catName(c));
    try {
      const lead = await HW.api.addLead({ name: d.name, phone: HW.api.normPhone(d.phone), car: d.car || null, carText: d.car ? HW.carName(d.car, 'en') : '', services: names, when: d.whenLabel || '', notes: d.notes || '', lang: HW.lang });
      const text = `${HW.t('wa_hello')} ${names.join(', ') || ''}\n${HW.t('f_name')}: ${d.name}\n${HW.t('your_car')}: ${d.car ? HW.carName(d.car, HW.lang) : '-'}\n${HW.t('when')}: ${d.whenLabel || '-'}`;
      C.step = 'done'; C.d = { services: [] }; save();
      bot(`${HW.t('chat_done')} <b dir="ltr">${lead.id}</b>.<br>${link(`https://wa.me/${HW.CONTACT.wa}?text=${encodeURIComponent(text)}`, HW.t('chat_wa'), true)} · ${link('quote.html', HW.t('get_quote'))}`, yesNoNew());
    } catch { bot(HW.t('err_generic')); }
  }

  function startOver() { C.msgs = []; C.step = 'start'; C.d = { services: [] }; C.chips = null; save(); hello(); }
  function hello() { push('bot', `${HW.t('chat_hello')}`); ask('name'); }

  /* ---------- reading what the visitor says ---------- */
  function detectIntent(t) {
    for (const [k, re] of Object.entries(INTENT)) if (re.test(t)) return k;
    return null;
  }
  function answerIntent(k) {
    const W = HW.CONFIG.workHours, h = `${String(W.start).padStart(2, '0')}:00–${String(W.end).padStart(2, '0')}:00 · ${HW.t('friday')} ${String(W.fridayStart).padStart(2, '0')}:00–${String(W.end).padStart(2, '0')}:00`;
    const map = {
      hours: `${HW.t('chat_hours')}: <b dir="ltr">${h}</b>`,
      where: `${HW.t('chat_where')} ${link(HW.CONTACT.maps, HW.t('open_maps'), true)}`,
      price: `${HW.t('chat_price')} ${link('quote.html', HW.t('get_quote'))}`,
      status: `${HW.t('chat_status')} ${link('account.html', HW.t('nav_track'))}`,
      human: `${HW.t('chat_human')} ${link('tel:' + HW.CONTACT.tel, HW.CONTACT.phone)} · ${link('https://wa.me/' + HW.CONTACT.wa, 'WhatsApp', true)}`
    };
    return map[k];
  }

  function onText(raw) {
    const t = raw.trim(); if (!t) return;
    push('me', esc(t));
    const k = detectIntent(t);
    if (k === 'restart') return startOver();
    if (k && !['name', 'phone', 'notes'].includes(C.step)) { push('bot', answerIntent(k)); draw(); return ask(C.step === 'done' || C.step === 'start' ? 'name' : C.step); }
    if (C.step === 'name') { C.d.name = t.slice(0, 40); return ask('phone'); }
    if (C.step === 'phone') {
      const p = HW.api.normPhone(t);
      if (p.length < 11) return bot(HW.t('chat_bad_phone'));
      C.d.phone = p; return ask('car');
    }
    if (C.step === 'service') {
      const hit = Object.keys(CAT_WORDS).filter((c) => CAT_WORDS[c].test(t) && !C.d.services.includes(c));
      if (hit.length) { C.d.services.push(...hit); push('bot', `${HW.t('chat_added')} <b>${hit.map(catName).join('، ')}</b>.${estimateFor(hit[0])}`); return ask('service'); }
      C.d.notes = (C.d.notes ? C.d.notes + ' · ' : '') + t.slice(0, 200); push('bot', HW.t('chat_noted')); return ask('when');
    }
    if (C.step === 'when') { C.d.whenLabel = t.slice(0, 60); return ask('notes'); }
    if (C.step === 'notes') { C.d.notes = t.slice(0, 300); return ask('confirm'); }
    if (C.step === 'car') { C.d.carText = t; return bot(HW.t('chat_use_picker'), chipsFor([['car_pick', HW.t('select_car')], ['car_skip', HW.t('chat_skip')]])); }
    return bot(HW.t('chat_dont_get'), chipsFor([['restart', HW.t('chat_restart')]]));
  }

  function onChip(k, label) {
    push('me', esc(label));
    if (k === 'restart') return startOver();
    if (k === 'car_yes') { C.d.car = HW.car; return ask('service'); }
    if (k === 'car_skip') { C.d.car = null; return ask('service'); }
    if (k === 'car_pick') { save(); draw(); return HW.openCarPicker({ onPick: (c) => { HW.setCar(c); C.d.car = c; push('bot', `${HW.t('chat_car_set')} <b>${esc(HW.carName(c, HW.lang))}</b>`); ask('service'); } }); }
    if (k.startsWith('svc:')) { const c = k.slice(4); C.d.services.push(c); push('bot', `${HW.t('chat_added')} <b>${catName(c)}</b>.${estimateFor(c)}`); return ask('service'); }
    if (k === 'svc_unsure' || k === 'svc_done') return ask('when');
    if (k.startsWith('when:')) { C.d.whenLabel = label; return ask('notes'); }
    if (k === 'notes_none') { C.d.notes = ''; return ask('confirm'); }
    if (k === 'send') return finish();
  }

  /* ---------- drawing ---------- */
  function draw() {
    const box = document.getElementById('chatBody'); if (!box) return;
    box.innerHTML = C.msgs.map((m) => `<div class="msg msg--${m.from}">${m.html}</div>`).join('') +
      (C.chips ? `<div class="chat__chips">${C.chips.map((c) => `<button type="button" class="chip" data-k="${esc(c.k)}">${esc(c.label)}</button>`).join('')}</div>` : '');
    box.scrollTop = box.scrollHeight;
  }

  function mount() {
    C = load();
    const old = document.getElementById('chatRoot'); if (old) old.remove();
    const el = document.createElement('div'); el.id = 'chatRoot';
    el.innerHTML = `
      <button type="button" class="chat-fab" id="chatFab" aria-label="${HW.t('chat_title')}" ${C.open ? 'hidden' : ''}><svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 10h8M8 13h5"/></svg><span>${HW.t('chat_title')}</span></button>
      <section class="chat" id="chatPanel" ${C.open ? '' : 'hidden'} role="dialog" aria-label="${HW.t('chat_title')}">
        <header><div><b>${HW.t('chat_title')}</b><small>${HW.t('chat_sub')}</small></div><button type="button" id="chatX" aria-label="${HW.t('close')}">×</button></header>
        <div class="chat__body" id="chatBody" aria-live="polite"></div>
        <form class="chat__in" id="chatForm"><input id="chatInput" autocomplete="off" placeholder="${HW.t('chat_ph')}"><button class="btn btn--gold" aria-label="${HW.t('send')}">${HW.t('send')}</button></form>
      </section>`;
    document.body.appendChild(el);
    const open = (v) => { C.open = v; save(); el.querySelector('#chatPanel').hidden = !v; el.querySelector('#chatFab').hidden = v; if (v) { if (!C.msgs.length) hello(); else draw(); setTimeout(() => el.querySelector('#chatInput').focus({ preventScroll: true }), 50); } };
    el.querySelector('#chatFab').onclick = () => open(true);
    el.querySelector('#chatX').onclick = () => open(false);
    el.querySelector('#chatForm').onsubmit = (e) => { e.preventDefault(); const i = el.querySelector('#chatInput'); const v = i.value; i.value = ''; onText(v); };
    el.querySelector('#chatBody').onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) onChip(b.dataset.k, b.textContent); };
    if (C.open) { if (!C.msgs.length) hello(); else draw(); }
  }
  HW.mountChat = mount;
})();
