/* Checkout: account (sign in or create), one appointment for the whole visit, then a job is created and the customer
   lands on the live tracker. */
(() => {
  const HW = window.HW;
  if (!HW.cart.length) { location.replace('cart.html'); return; }
  if (!HW.car) { location.replace('cart.html'); return; }

  const S = { mode: 'register', name: '', phone: '', pw: '', date: '', time: '', usage: null, notes: '', pay: 'knet', consent: true, save: true, busy: false };
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const maxDate = () => { const d = new Date(); d.setDate(d.getDate() + HW.CONFIG.bookingDays); return ymd(d); };
  const errText = (e) => HW.t('err_' + (e && e.code ? e.code : 'generic'));
  const duration = () => HW.cartDuration(HW.cart, HW.car);

  async function loadSlots() {
    S.usage = null;
    if (!S.date) return;
    const r = await HW.api.slots(S.date); S.usage = r; render(); HW.applyI18n();
  }

  function slotsHtml() {
    if (!S.date) return `<p class="muted">${HW.t('pick_date_first')}</p>`;
    if (!S.usage) return `<p class="muted">${HW.t('loading')}</p>`;
    const now = new Date(), today = ymd(now) === S.date;
    return `<div class="slots">${HW.sched.slotHours(S.date).map((h) => {
      const label = `${pad(h)}:00`, full = (S.usage.usage[h] || 0) >= S.usage.bays, past = today && h <= now.getHours();
      return `<button type="button" class="slot ${S.time === label ? 'active' : ''}" data-time="${label}" ${full || past ? 'disabled' : ''} title="${full ? HW.t('slot_full') : ''}">${label}</button>`;
    }).join('')}</div><small class="muted">${HW.t('slot_hint')}</small>`;
  }

  function authHtml() {
    if (HW.user) return `<div class="signed"><span>${HW.t('signed_as')} <b>${HW.user.name}</b> · <span dir="ltr">+${HW.user.phone}</span></span> <a class="linklike" href="login.html?out=1&next=checkout.html">${HW.t('switch_acct')}</a></div>`;
    const reg = S.mode === 'register';
    return `
      <div class="tabs2"><button type="button" class="${reg ? 'active' : ''}" data-mode="register">${HW.t('create_account')}</button><button type="button" class="${reg ? '' : 'active'}" data-mode="login">${HW.t('have_account')}</button></div>
      ${reg ? `<div class="field"><label for="fName">${HW.t('f_name')}</label><input id="fName" autocomplete="name" value="${S.name}"></div>` : ''}
      <div class="field"><label for="fPhone">${HW.t('f_phone')}</label><input id="fPhone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" value="${S.phone}" placeholder="9XXX XXXX"></div>
      <div class="field"><label for="fPw">${HW.t('f_password')}</label><input id="fPw" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" value="${S.pw}"><small class="muted">${reg ? HW.t('pw_hint') : ''}</small></div>`;
  }

  function render() {
    const root = HW.$('#checkoutRoot'); const dur = duration();
    const ready = S.date && S.time ? HW.sched.addWork(new Date(`${S.date}T${S.time}:00`), dur) : null;
    root.innerHTML = `
      <div class="two-col">
        <form class="panel" id="checkoutForm" novalidate>
          <h3>1 · ${HW.t('your_account')}</h3>
          ${authHtml()}
          <h3 class="h-gap">2 · ${HW.t('your_car')}</h3>
          <div class="carnote"><div class="carnote__row"><span><b>${HW.carLabel()}</b></span><button type="button" class="linklike" data-pickcar>${HW.t('change')}</button></div></div>
          ${HW.car.custom ? `<small class="muted">${HW.t('estimate_note')}</small>` : ''}
          <label class="check"><input type="checkbox" id="fSave" ${S.save ? 'checked' : ''}> ${HW.t('save_car')}</label>
          <h3 class="h-gap">3 · ${HW.t('appointment')}</h3>
          <div class="field"><label for="fDate">${HW.t('choose_date')}</label><input type="date" id="fDate" min="${ymd(new Date())}" max="${maxDate()}" value="${S.date}"></div>
          ${slotsHtml()}
          ${ready ? `<div class="readyby">${HW.t('ready_by')}: <b>${HW.fmtWhen(ready)}</b></div>` : ''}
          <h3 class="h-gap">4 · ${HW.t('details')}</h3>
          <div class="field"><label for="fNotes">${HW.t('f_notes')}</label><textarea id="fNotes" rows="3">${S.notes}</textarea></div>
          <div class="field"><label>${HW.t('payment')}</label>
            <div class="pay-opts">
              <label><input type="radio" name="pay" value="knet" ${S.pay === 'knet' ? 'checked' : ''}>${HW.t('pay_knet')}</label>
              <label><input type="radio" name="pay" value="apple" ${S.pay === 'apple' ? 'checked' : ''}>${HW.t('pay_apple')}</label>
              <label><input type="radio" name="pay" value="cash" ${S.pay === 'cash' ? 'checked' : ''}>${HW.t('pay_cash')}</label>
            </div><small class="muted">${HW.t('pay_note')}</small>
          </div>
          <label class="check"><input type="checkbox" id="fConsent" ${S.consent ? 'checked' : ''}> <span>${HW.t('camera_consent')}<small class="muted">${HW.t('camera_consent_sub')}</small></span></label>
          <div class="err" id="coErr" role="alert"></div>
          <button class="btn btn--gold btn--block" type="submit" ${S.busy ? 'disabled' : ''}>${HW.t('confirm')}</button>
        </form>
        <aside class="panel summary">
          <h3>${HW.t('order_summary')}</h3>
          <div class="lines lines--compact">${HW.cart.map((it) => HW.lineHtml(it)).join('')}</div>
          <div class="sum">
            <div><span>${HW.t('est_time')}</span><span>${HW.fmtDur(dur)}</span></div>
            <div class="grand"><span>${HW.t('total')}</span><span>${HW.money(HW.cartTotal())}</span></div>
          </div>
          <a class="line__rm" href="cart.html">${HW.t('edit')}</a>
        </aside>
      </div>`;
    const f = HW.$('#checkoutForm');
    f.oninput = (e) => {
      const id = e.target.id;
      if (id === 'fName') S.name = e.target.value; else if (id === 'fPhone') S.phone = e.target.value; else if (id === 'fPw') S.pw = e.target.value;
      else if (id === 'fNotes') S.notes = e.target.value;
    };
    f.onchange = (e) => {
      const t = e.target;
      if (t.id === 'fDate') { S.date = t.value; S.time = ''; loadSlots(); render(); HW.applyI18n(); }
      else if (t.name === 'pay') S.pay = t.value;
      else if (t.id === 'fConsent') S.consent = t.checked;
      else if (t.id === 'fSave') S.save = t.checked;
    };
    f.onclick = (e) => {
      const m = e.target.closest('[data-mode]'); if (m) { S.mode = m.dataset.mode; render(); HW.applyI18n(); return; }
      const s = e.target.closest('.slot'); if (s && !s.disabled) { S.time = s.dataset.time; render(); HW.applyI18n(); return; }
      if (e.target.closest('[data-pickcar]')) HW.openCarPicker({ onPick: (c) => { HW.setCar(c); HW.refresh(); }, onClear: () => { HW.setCar(null); HW.refresh(); } });
    };
    f.onsubmit = submit;
  }

  async function submit(e) {
    e.preventDefault();
    const err = HW.$('#coErr'); err.textContent = '';
    if (S.busy) return;
    if (!S.date || !S.time) { err.textContent = HW.t('err_booking'); return; }
    if (HW.cart.some((it) => HW.fit(HW.findProduct(it.pid), HW.car) === 'no')) { err.textContent = HW.t('cart_remove_na'); return; }
    S.busy = true;
    try {
      if (!HW.user) {
        if (!S.phone.trim() || !S.pw) { S.busy = false; err.textContent = HW.t('fill_all'); return; }
        HW.user = S.mode === 'register' ? await HW.api.register({ name: S.name, phone: S.phone, password: S.pw }) : await HW.api.login({ phone: S.phone, password: S.pw });
      }
      const items = HW.cart.map((it) => ({ pid: it.pid, qty: it.qty, sel: it.sel, price: HW.lineTotal(it) }));
      const job = await HW.api.createJob({ items, car: HW.car, appointment: { date: S.date, time: S.time }, notes: S.notes, payment: S.pay, cameraConsent: S.consent, saveCar: S.save, lang: HW.lang });
      HW.cart = []; HW.saveCart();
      location.href = `job.html?id=${job.id}&new=1`;
    } catch (ex) {
      S.busy = false; err.textContent = errText(ex);
      if (ex.code === 'slot_full') { S.time = ''; loadSlots(); }
    }
  }
  HW.boot(render);
})();
