/* Staff dashboard: jobs board, customer updates, approvals, leads, pricing, tools.
   DEMO PIN gate only – see README-v2.md "Going live" for real staff accounts. */
(() => {
  const HW = window.HW;
  const S = { tab: 'board', jobs: [], leads: [], open: new Set(), showDone: false, pending: false };
  const NEXT = { booked: ['received', 'btn_arrived'], received: ['in_progress', 'btn_start'], in_progress: ['qc', 'btn_qc'], qc: ['ready', 'btn_ready'], ready: ['delivered', 'btn_delivered'] };
  const PREV = { received: 'booked', in_progress: 'received', qc: 'in_progress', ready: 'qc', delivered: 'ready' };
  const COLS = ['booked', 'received', 'in_progress', 'qc', 'ready'];
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pname = (i) => { const p = HW.findProduct(i.pid); return p ? HW.L(p.name) : i.pid; };
  const err = (ex) => HW.toast(HW.t('err_' + ((ex && ex.code) || 'generic')));

  async function load() {
    if (!HW.api.staffOk()) return;
    S.jobs = await HW.api.listJobs({ all: true }); S.leads = await HW.api.listLeads();
  }
  async function act(fn) { try { await fn(); await load(); paint(); } catch (ex) { err(ex); } }

  /* ---------- WhatsApp notifications (staff taps send; message is prefilled) ---------- */
  const jobLink = (j) => new URL(`job.html?id=${j.id}`, location.href).href;
  function waLink(j, kind) {
    const ar = (j.lang || 'ar') === 'ar', car = HW.carName(j.car, ar ? 'ar' : 'en'), n = j.customer.name, L = jobLink(j);
    const M = {
      booked: ar ? `مرحباً ${n}، تذكير بموعدك لسيارتك ${car}. تفاصيل الحجز: ${L}` : `Hello ${n}, a reminder of your appointment for your ${car}. Details: ${L}`,
      received: ar ? `مرحباً ${n}، استلمنا سيارتك ${car}. تابع التقدم هنا: ${L}` : `Hello ${n}, we have received your ${car}. Follow progress here: ${L}`,
      in_progress: ar ? `بدأ العمل على سيارتك ${car}. تابع التقدم هنا: ${L}` : `Work has started on your ${car}. Follow progress here: ${L}`,
      qc: ar ? `سيارتك ${car} في مرحلة الفحص النهائي وتكاد تكون جاهزة: ${L}` : `Your ${car} is in final inspection and almost ready: ${L}`,
      ready: ar ? `سيارتك ${car} جاهزة للاستلام! ${L}` : `Your ${car} is ready for pickup! ${L}`,
      delivered: ar ? `شكراً لثقتك بهيرو ووركس! نسعد بخدمتك دائماً.` : `Thank you for choosing HeroWorks! We are always happy to help.`,
      approval: ar ? `نقترح عملاً إضافياً على سيارتك ${car}. للموافقة أو الرفض: ${L}` : `We suggest extra work on your ${car}. Approve or decline here: ${L}`
    };
    return `https://wa.me/${j.customer.phone}?text=${encodeURIComponent(M[kind] || M[j.status] || M.received)}`;
  }

  /* ---------- gate ---------- */
  function gate(root) {
    root.innerHTML = `<form class="panel gate" id="pinForm"><h2>${HW.t('staff_title')}</h2><p class="muted">${HW.t('staff_pin_p')}</p>
      <div class="field"><label for="pin">${HW.t('pin')}</label><input id="pin" type="password" inputmode="numeric" autocomplete="off" dir="ltr" autofocus></div>
      <div class="err" id="pinErr" role="alert"></div><button class="btn btn--gold btn--block">${HW.t('enter')}</button>
      ${HW.CONFIG.demoMode ? `<p class="muted small center">${HW.t('demo_pin_hint')}</p>` : ''}</form>`;
    HW.$('#pinForm').onsubmit = async (e) => {
      e.preventDefault();
      try { await HW.api.staffLogin(HW.$('#pin').value); await load(); paint(); HW.applyI18n(); } catch (ex) { HW.$('#pinErr').textContent = HW.t('err_bad_pin'); }
    };
  }

  /* ---------- board ---------- */
  const freeBay = () => { for (let n = 1; n <= HW.CONFIG.bays; n++) if (!S.jobs.some((j) => j.bay === n && ['received', 'in_progress', 'qc'].includes(j.status))) return n; return null; };

  function baysHtml() {
    return `<div class="bays">${Array.from({ length: HW.CONFIG.bays }, (_, i) => {
      const n = i + 1, j = S.jobs.find((x) => x.bay === n && ['received', 'in_progress', 'qc'].includes(x.status));
      return `<div class="bay ${j ? 'busy' : ''}"><small>${HW.t('bay')} ${n}</small><b>${j ? esc(HW.carName(j.car, HW.lang)) : HW.t('free')}</b>${j ? `<span class="muted">${j.id} · ${HW.jobProgress(j).pct}%</span>` : ''}</div>`;
    }).join('')}</div>`;
  }

  function cardHtml(j) {
    const pr = HW.jobProgress(j), open = S.open.has(j.id), nx = NEXT[j.status], pend = j.approvals.filter((a) => a.status === 'pending').length;
    const eta = pr.eta ? `${HW.t('ready_by')}: <b>${HW.fmtWhen(pr.eta)}</b>` : '';
    return `<article class="scard ${open ? 'open' : ''}" data-id="${j.id}">
      <header data-act="toggle"><div><b dir="ltr">${j.id}</b> <span class="muted">${esc(j.customer.name)}</span></div>${pend ? `<span class="pill pill--warn">${HW.t('awaiting')}</span>` : ''}</header>
      <div class="scard__car">${esc(HW.carName(j.car, HW.lang))}${j.bay ? ` <span class="tag">${HW.t('bay')} ${j.bay}</span>` : ''}</div>
      <small class="muted">${j.items.map(pname).join(' · ')}</small>
      <div class="pbar pbar--sm"><i style="width:${pr.pct}%"></i></div>
      <div class="scard__meta"><span>${j.status === 'booked' ? `${HW.t('appointment')}: <b>${HW.fmtWhen(j.startFrom)}</b>` : eta}</span><span class="price">${HW.money(j.total)}</span></div>
      <div class="btn-row">
        ${nx ? `<button class="btn btn--gold" data-act="next">${HW.t(nx[1])}</button>` : ''}
        <a class="btn btn--ghost" target="_blank" rel="noopener" href="${waLink(j)}" title="${HW.t('notify_wa')}">WhatsApp</a>
        <button class="btn btn--ghost" data-act="toggle">${open ? HW.t('close') : HW.t('manage')}</button>
      </div>
      ${open ? detailHtml(j) : ''}
    </article>`;
  }

  function detailHtml(j) {
    return `<div class="sdetail">
      <dl class="facts"><div><dt>${HW.t('customer')}</dt><dd>${esc(j.customer.name)} · <a dir="ltr" href="tel:+${j.customer.phone}">+${j.customer.phone}</a></dd></div>
        ${j.notes ? `<div><dt>${HW.t('f_notes')}</dt><dd>${esc(j.notes)}</dd></div>` : ''}</dl>
      <div class="sgroup"><label>${HW.t('bay')}</label>
        <select data-act="bay"><option value="">–</option>${Array.from({ length: HW.CONFIG.bays }, (_, i) => `<option value="${i + 1}" ${j.bay === i + 1 ? 'selected' : ''}>${HW.t('bay')} ${i + 1}</option>`).join('')}</select>
        <button class="btn btn--ghost" data-act="cam" ${j.cameraConsent ? '' : 'disabled'} title="${j.cameraConsent ? '' : HW.t('no_consent')}">${j.camera ? HW.t('cam_hide') : HW.t('cam_show')}</button></div>
      <div class="sgroup"><label>${HW.t('adjust_eta')}</label>
        <button class="btn btn--ghost" data-act="eta" data-d="-30">−30 ${HW.t('u_min')}</button><button class="btn btn--ghost" data-act="eta" data-d="30">+30 ${HW.t('u_min')}</button><button class="btn btn--ghost" data-act="eta" data-d="60">+1 ${HW.t('u_h')}</button><button class="btn btn--ghost" data-act="eta" data-d="240">+4 ${HW.t('u_h')}</button></div>
      <div class="sgroup sgroup--col"><label>${HW.t('post_update')}</label>
        <textarea rows="2" class="u-text" placeholder="${HW.t('update_ph')}"></textarea>
        <div class="btn-row"><input type="file" accept="image/*" class="u-file"><button class="btn btn--gold" data-act="update">${HW.t('send')}</button></div></div>
      <div class="sgroup sgroup--col"><label>${HW.t('ask_approval')}</label>
        <input class="a-title" placeholder="${HW.t('approval_ph')}">
        <div class="btn-row"><input class="a-price" type="number" min="0" step="0.5" placeholder="${HW.t('price_kd')}" dir="ltr"><input class="a-min" type="number" min="0" step="5" placeholder="${HW.t('extra_min_ph')}" dir="ltr"><button class="btn btn--gold" data-act="approval">${HW.t('send')}</button></div>
        ${j.approvals.map((a) => `<small class="muted">${esc(a.title)} – ${HW.money(a.price)} – <b>${HW.t(a.status === 'pending' ? 'awaiting' : a.status)}</b></small>`).join('')}</div>
      <div class="btn-row">
        <a class="btn btn--ghost" href="job.html?id=${j.id}" target="_blank">${HW.t('customer_view')}</a>
        ${PREV[j.status] ? `<button class="btn btn--ghost" data-act="prev">‹ ${HW.t('st_' + PREV[j.status])}</button>` : ''}
        ${j.status !== 'delivered' && j.status !== 'cancelled' ? `<button class="btn btn--ghost danger" data-act="cancel">${HW.t('cancel_booking')}</button>` : ''}</div>
    </div>`;
  }

  function boardHtml() {
    const active = S.jobs.filter((j) => HW.ACTIVE.includes(j.status) || j.status === 'ready');
    const today = new Date().toDateString();
    const done = S.jobs.filter((j) => j.status === 'delivered');
    const newLeads = S.leads.filter((l) => l.status === 'new').length;
    const sortBy = (a, b) => new Date(a.startFrom) - new Date(b.startFrom);
    return `
      <div class="stats">
        <div><b>${active.length}</b><small>${HW.t('stat_active')}</small></div>
        <div><b>${S.jobs.filter((j) => j.status === 'ready').length}</b><small>${HW.t('stat_ready')}</small></div>
        <div><b>${S.jobs.filter((j) => j.status === 'booked' && new Date(j.startFrom).toDateString() === today).length}</b><small>${HW.t('stat_today')}</small></div>
        <div><b>${newLeads}</b><small>${HW.t('stat_leads')}</small></div>
      </div>
      ${baysHtml()}
      <div class="board">${COLS.map((c) => {
        const list = S.jobs.filter((j) => j.status === c).sort(sortBy);
        return `<section class="col"><h4>${HW.t('st_' + c)} <span class="count">${list.length}</span></h4>${list.map(cardHtml).join('') || `<p class="muted small">${HW.t('empty_col')}</p>`}</section>`;
      }).join('')}</div>
      <button class="linklike" data-act="showdone">${S.showDone ? HW.t('hide') : HW.t('show')} ${HW.t('st_delivered')} (${done.length})</button>
      ${S.showDone ? `<div class="board board--done">${done.map(cardHtml).join('')}</div>` : ''}`;
  }

  /* ---------- leads ---------- */
  function leadsHtml() {
    if (!S.leads.length) return `<p class="muted">${HW.t('no_leads')}</p>`;
    return `<div class="leads">${S.leads.map((l) => `<article class="panel lead ${l.status === 'new' ? 'new' : ''}" data-lead="${l.id}">
      <header><b dir="ltr">${l.id}</b><time class="muted">${HW.fmtWhen(l.createdAt)}</time>${l.status === 'new' ? `<span class="pill pill--warn">${HW.t('new')}</span>` : ''}</header>
      <p><b>${esc(l.name)}</b> · <a dir="ltr" href="tel:+${l.phone}">+${l.phone}</a></p>
      <p>${esc(l.carText || '–')}${l.car ? ` <span class="tag">${l.car.cls}</span>` : ''}</p>
      <p class="muted">${(l.services || []).map(esc).join(' · ') || '–'}</p>
      <p>${HW.t('when')}: <b>${esc(l.when || '–')}</b></p>
      ${l.notes ? `<p class="muted">${esc(l.notes)}</p>` : ''}
      <div class="btn-row"><a class="btn btn--gold" target="_blank" rel="noopener" href="https://wa.me/${l.phone}?text=${encodeURIComponent((l.lang === 'en' ? `Hello ${l.name}, this is HeroWorks about your request.` : `مرحباً ${l.name}، معك هيرو ووركس بخصوص طلبك.`))}">WhatsApp</a>
        <a class="btn btn--ghost" href="tel:+${l.phone}">${HW.t('call_us')}</a>
        <button class="btn btn--ghost" data-act="lead-done">${l.status === 'new' ? HW.t('mark_done') : HW.t('reopen')}</button></div>
    </article>`).join('')}</div>`;
  }

  /* ---------- pricing ---------- */
  function pricingHtml() {
    const mult = HW.getMult(), ov = HW.getOverrides();
    return `<div class="panel"><h3>${HW.t('pr_mult')}</h3><p class="muted">${HW.t('pr_mult_p')}</p>
      <div class="mults">${HW.CLASSES.map((c) => `<div class="field"><label>${c} · ${HW.L(HW.CLASS_INFO[c])}</label><input type="number" step="0.05" min="0.5" max="5" data-mult="${c}" value="${mult[c]}" ${c === 'S' ? 'disabled' : ''} dir="ltr"></div>`).join('')}</div></div>
      <div class="panel"><h3>${HW.t('pr_over')}</h3><p class="muted">${HW.t('pr_over_p')}</p>
      <div class="tablewrap"><table class="ptable"><thead><tr><th>${HW.t('service')}</th>${HW.CLASSES.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>
        ${HW.PRODUCTS.filter((p) => p.type === 'service').map((p) => `<tr><td>${esc(HW.L(p.name))}</td>${HW.CLASSES.map((c) => { const f = HW.formulaPrice(p, c, mult), o = ov[`${p.id}|${c}`]; return `<td><input type="number" step="0.5" min="0" data-ov="${p.id}|${c}" placeholder="${f}" value="${typeof o === 'number' ? o : ''}" dir="ltr"></td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div>
      <div class="btn-row"><button class="btn btn--gold" data-act="pr-save">${HW.t('save')}</button><button class="btn btn--ghost" data-act="pr-reset">${HW.t('pr_reset')}</button></div></div>`;
  }

  /* ---------- settings ---------- */
  function settingsHtml() {
    const C = HW.CONFIG;
    return `<div class="panel"><h3>${HW.t('tools')}</h3>
      <dl class="facts"><div><dt>${HW.t('bays')}</dt><dd>${C.bays}</dd></div>
      <div><dt>${HW.t('hours')}</dt><dd dir="ltr">${C.workHours.start}:00–${C.workHours.end}:00 · ${HW.t('friday')} ${C.workHours.fridayStart}:00</dd></div>
      <div><dt>${HW.t('cameras')}</dt><dd dir="ltr">${Object.entries(C.cameraStreams).map(([k, v]) => `${k}: ${v ? '✔' : 'demo'}`).join(' · ')}</dd></div></dl>
      <p class="muted">${HW.t('set_edit')}</p>
      <div class="btn-row"><button class="btn btn--ghost" data-act="walkin">${HW.t('walk_in')}</button><button class="btn btn--ghost" data-act="export">${HW.t('export')}</button></div></div>
      <div class="panel"><h3>${HW.t('demo_tools')}</h3><p class="muted">${HW.t('demo_tools_p')}</p>
      <div class="btn-row"><button class="btn btn--ghost" data-act="reset-demo">${HW.t('reset_demo')}</button><button class="btn btn--ghost danger" data-act="wipe">${HW.t('wipe')}</button></div></div>`;
  }

  /* ---------- walk-in ---------- */
  function walkIn() {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="modal__panel"><button type="button" class="modal__x" aria-label="${HW.t('close')}">×</button><h3>${HW.t('walk_in')}</h3><div id="wiBody"></div></div>`;
    document.body.appendChild(m); document.body.classList.add('modal-open');
    const close = () => { m.remove(); document.body.classList.remove('modal-open'); };
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('.modal__x')) close(); });
    const body = m.querySelector('#wiBody');
    HW.mountCarPicker(body, { onPick: (car) => {
      const svc = HW.PRODUCTS.filter((p) => HW.fit(p, car) !== 'no');
      body.innerHTML = `<p><b>${esc(HW.carName(car, HW.lang))}</b></p>
        <div class="field"><label>${HW.t('f_name')}</label><input id="wName"></div><div class="field"><label>${HW.t('f_phone')}</label><input id="wPhone" type="tel" dir="ltr"></div>
        <div class="wi-list">${svc.map((p) => `<label class="qrow"><input type="checkbox" value="${p.id}"><span class="qrow__main"><b>${esc(HW.L(p.name))}</b></span><span class="qrow__price price">${HW.money(HW.priceFor(p, car))}</span></label>`).join('')}</div>
        <div class="err" id="wiErr"></div><button class="btn btn--gold btn--block" id="wiGo">${HW.t('create_job')}</button>`;
      body.querySelector('#wiGo').onclick = async () => {
        const ids = [...body.querySelectorAll('.wi-list input:checked')].map((i) => i.value);
        const name = body.querySelector('#wName').value.trim(), phone = body.querySelector('#wPhone').value.trim();
        if (!ids.length || !name || phone.replace(/\D/g, '').length < 8) { body.querySelector('#wiErr').textContent = HW.t('fill_all'); return; }
        const items = ids.map((id) => ({ pid: id, qty: 1, sel: {}, price: HW.priceFor(HW.findProduct(id), car) }));
        const bay = freeBay();
        await act(async () => { const j = await HW.api.createJob({ customer: { name, phone }, car, items, appointment: null, lang: HW.lang }, { walkIn: true }); if (bay) await HW.api.assignBay(j.id, bay); });
        close();
      };
    } });
  }

  /* ---------- photo helper: shrink before saving (the demo keeps data in the browser) ---------- */
  function shrink(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = rej;
      fr.onload = () => {
        const img = new Image(); img.onerror = rej;
        img.onload = () => {
          const k = Math.min(1, 900 / Math.max(img.width, img.height)); const c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.7));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  /* ---------- paint + events ---------- */
  function paint() {
    const root = HW.$('#staffRoot');
    if (!HW.api.staffOk()) { gate(root); return; }
    const tabs = [['board', 'tab_board'], ['leads', 'tab_leads'], ['pricing', 'tab_pricing'], ['settings', 'tab_settings']];
    root.innerHTML = `
      <div class="acct-head"><div><h2>${HW.t('staff_title')}</h2>${HW.CONFIG.demoMode ? `<span class="demo-pill">DEMO</span>` : ''}</div><button class="btn btn--ghost" data-act="logout">${HW.t('logout')}</button></div>
      <div class="tabs2">${tabs.map(([k, l]) => `<button class="${S.tab === k ? 'active' : ''}" data-tab="${k}">${HW.t(l)}${k === 'leads' && S.leads.some((x) => x.status === 'new') ? ' •' : ''}</button>`).join('')}</div>
      ${S.tab === 'board' ? boardHtml() : S.tab === 'leads' ? leadsHtml() : S.tab === 'pricing' ? pricingHtml() : settingsHtml()}`;
    HW.applyI18n();
  }

  async function onClick(e) {
    const tab = e.target.closest('[data-tab]'); if (tab) { S.tab = tab.dataset.tab; paint(); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    const card = a.closest('.scard'), id = card && card.dataset.id, kind = a.dataset.act;
    const job = id && S.jobs.find((j) => j.id === id);
    if (kind === 'toggle') { S.open.has(id) ? S.open.delete(id) : S.open.add(id); paint(); return; }
    if (kind === 'showdone') { S.showDone = !S.showDone; paint(); return; }
    if (kind === 'logout') { await HW.api.staffLogout(); paint(); return; }
    if (kind === 'next') {
      const to = NEXT[job.status][0];
      await act(async () => { await HW.api.setStatus(id, to); if (to === 'received' && !job.bay) { const b = freeBay(); if (b) await HW.api.assignBay(id, b); } if (to === 'in_progress' && (job.cameraConsent)) await HW.api.setCamera(id, true); });
      return;
    }
    if (kind === 'prev') { await act(() => HW.api.setStatus(id, PREV[job.status])); return; }
    if (kind === 'eta') { await act(() => HW.api.adjustEta(id, Number(a.dataset.d))); return; }
    if (kind === 'cam') { await act(() => HW.api.setCamera(id, !job.camera)); return; }
    if (kind === 'cancel') { if (confirm(HW.t('cancel_confirm'))) await act(() => HW.api.cancelJob(id)); return; }
    if (kind === 'update') {
      const text = card.querySelector('.u-text').value.trim(), f = card.querySelector('.u-file').files[0];
      if (!text && !f) return;
      await act(async () => { const photo = f ? await shrink(f) : null; await HW.api.addUpdate(id, { text, photo }); });
      HW.toast(HW.t('sent')); return;
    }
    if (kind === 'approval') {
      const title = card.querySelector('.a-title').value.trim(); if (!title) return;
      await act(() => HW.api.requestApproval(id, { title, price: card.querySelector('.a-price').value, extraMin: card.querySelector('.a-min').value }));
      HW.toast(HW.t('sent')); return;
    }
    if (kind === 'lead-done') { const l = S.leads.find((x) => x.id === a.closest('[data-lead]').dataset.lead); await act(() => HW.api.setLeadStatus(l.id, l.status === 'new' ? 'done' : 'new')); return; }
    if (kind === 'pr-save') {
      const mult = { ...HW.getMult() }; HW.$$('[data-mult]').forEach((i) => { if (!i.disabled && Number(i.value) > 0) mult[i.dataset.mult] = Number(i.value); });
      const ov = {}; HW.$$('[data-ov]').forEach((i) => { if (i.value !== '' && Number(i.value) >= 0) ov[i.dataset.ov] = Number(i.value); });
      HW.setPricing(mult, ov); HW.toast(HW.t('saved')); paint(); return;
    }
    if (kind === 'pr-reset') { if (confirm(HW.t('pr_reset_confirm'))) { HW.setPricing(HW.DEFAULT_MULT, {}); paint(); } return; }
    if (kind === 'walkin') { walkIn(); return; }
    if (kind === 'export') {
      const blob = new Blob([JSON.stringify({ jobs: S.jobs, leads: S.leads, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
      const l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = 'heroworks-export.json'; l.click(); return;
    }
    if (kind === 'reset-demo') { if (confirm(HW.t('reset_confirm'))) { await act(() => HW.api.resetDemo()); } return; }
    if (kind === 'wipe') { if (confirm(HW.t('wipe_confirm'))) { await act(() => HW.api.wipeAll()); } }
  }

  HW.boot(() => {
    const root = HW.$('#staffRoot');
    root.onclick = onClick;
    root.onchange = (e) => {
      const a = e.target.closest('[data-act="bay"]'); if (!a) return;
      const id = a.closest('.scard').dataset.id; act(() => HW.api.assignBay(id, a.value));
    };
    load().then(() => { paint(); });
    root.addEventListener('focusin', () => { S.pending = false; });
    root.addEventListener('focusout', () => { if (S.pending) { S.pending = false; load().then(paint); } });
  });
  HW.api.onChange(() => {
    const ae = document.activeElement, root = HW.$('#staffRoot');
    if (ae && root && root.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) { S.pending = true; return; }
    load().then(paint);
  });
  setInterval(() => { const ae = document.activeElement; if (!document.hidden && HW.api.staffOk() && !(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) paint(); }, 30000);
})();
