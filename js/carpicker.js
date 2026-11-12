/* Car picker: make → model → year. Used as a pop-up (header button) and inline (quote page, chat). */
(() => {
  'use strict';
  const HW = window.HW;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const YEARS = (() => { const y = new Date().getFullYear() + 1, a = []; for (let i = y; i >= 1995; i--) a.push(i); return a; })();

  function mount(root, { onPick, onClear } = {}) {
    const st = { step: 'make', makeId: null, model: null, q: '' };
    const saved = () => (HW.user && HW.user.cars) || [];

    function listHtml() {
      const q = st.q.trim().toLowerCase();
      if (st.step === 'make') {
        const list = HW.MAKES.filter((m) => !q || `${m.en} ${m.ar}`.toLowerCase().includes(q));
        return list.length ? list.map((m) => `<button type="button" class="pk" data-make="${m.id}">${esc(HW.lang === 'ar' ? m.ar : m.en)}</button>`).join('') : `<p class="muted">${HW.t('car_none')}</p>`;
      }
      const mk = HW.findMake(st.makeId);
      const list = mk.models.filter((m) => !q || m.name.toLowerCase().includes(q));
      return list.length ? list.map((m) => `<button type="button" class="pk" data-model="${esc(m.name)}" dir="ltr">${esc(m.name)}</button>`).join('') : `<p class="muted">${HW.t('car_none')}</p>`;
    }

    function draw() {
      const mk = st.makeId && HW.findMake(st.makeId);
      let body = '';
      if (st.step === 'make' || st.step === 'model') {
        body = `
          ${st.step === 'make' && HW.car && onClear ? `<button type="button" class="pk-clear" data-clear>× ${HW.t('clear_car')}</button>` : ''}
          ${st.step === 'make' && saved().length ? `<div class="pk-saved"><small>${HW.t('my_cars')}</small><div class="chips">${saved().map((c) => `<button type="button" class="chip" data-saved="${esc(c.id)}">${esc(HW.carName(c, HW.lang))}</button>`).join('')}</div></div>` : ''}
          <div class="pk-head">${st.step === 'model' ? `<button type="button" class="pk-back" data-back>‹ ${HW.t('back')}</button><strong>${esc(HW.lang === 'ar' ? mk.ar : mk.en)}</strong>` : `<strong>${HW.t('pick_make')}</strong>`}</div>
          <input type="search" class="pk-search" placeholder="${HW.t(st.step === 'make' ? 'search_make' : 'search_model')}" value="${esc(st.q)}" autocomplete="off">
          <div class="pk-grid" id="pkList">${listHtml()}</div>
          ${st.step === 'make' ? `<button type="button" class="pk-other" data-other>${HW.t('car_other')}</button>` : `<button type="button" class="pk-other" data-other>${HW.t('model_other')}</button>`}`;
      } else if (st.step === 'year') {
        body = `
          <div class="pk-head"><button type="button" class="pk-back" data-back>‹ ${HW.t('back')}</button><strong dir="ltr">${esc(HW.lang === 'ar' ? mk.ar : mk.en)} ${esc(st.model)}</strong></div>
          <div class="field"><label for="pkYear">${HW.t('pick_year')}</label>
            <select id="pkYear"><option value="">${HW.t('year_unknown')}</option>${YEARS.map((y) => `<option value="${y}">${y}</option>`).join('')}</select></div>
          <button type="button" class="btn btn--gold btn--block" data-done>${HW.t('use_car')}</button>`;
      } else {
        body = `
          <div class="pk-head"><button type="button" class="pk-back" data-back>‹ ${HW.t('back')}</button><strong>${HW.t('car_other')}</strong></div>
          <div class="pk-form">
            <div class="field"><label for="oMake">${HW.t('f_make')}</label><input id="oMake" autocomplete="off"></div>
            <div class="field"><label for="oModel">${HW.t('f_model')}</label><input id="oModel" autocomplete="off"></div>
            <div class="field"><label for="oYear">${HW.t('pick_year')}</label><select id="oYear"><option value="">${HW.t('year_unknown')}</option>${YEARS.map((y) => `<option value="${y}">${y}</option>`).join('')}</select></div>
            <div class="field"><label>${HW.t('car_size')}</label>
              <div class="pk-sizes">${HW.CLASSES.map((c) => `<label class="pk-size"><input type="radio" name="oCls" value="${c}" ${c === 'M' ? 'checked' : ''}><span><b>${HW.L(HW.CLASS_INFO[c])}</b><small dir="ltr">${HW.CLASS_INFO[c].ex}</small></span></label>`).join('')}</div></div>
            <div class="field"><label for="oOrigin">${HW.t('car_origin')}</label>
              <select id="oOrigin">${Object.entries(HW.ORIGIN_INFO).map(([k, v]) => `<option value="${k}">${HW.L(v)}</option>`).join('')}</select></div>
            <p class="muted pk-note">${HW.t('car_other_note')}</p>
            <div class="err" id="oErr" role="alert"></div>
            <button type="button" class="btn btn--gold btn--block" data-done-custom>${HW.t('use_car')}</button>
          </div>`;
      }
      root.innerHTML = `<div class="pk-wrap">${body}</div>`;
      const s = root.querySelector('.pk-search');
      if (s) {
        s.oninput = (e) => { st.q = e.target.value; root.querySelector('#pkList').innerHTML = listHtml(); };
      }
    }

    const finish = (car) => { if (onPick) onPick(car); };
    root.onclick = (e) => {
      const t = e.target;
      const mk = t.closest('[data-make]'), md = t.closest('[data-model]'), sv = t.closest('[data-saved]');
      if (mk) { st.makeId = mk.dataset.make; st.step = 'model'; st.q = ''; draw(); const s = root.querySelector('.pk-search'); if (s && !matchMedia('(pointer:coarse)').matches) s.focus(); return; }
      if (md) { st.model = md.dataset.model; st.step = 'year'; draw(); return; }
      if (sv) { finish(saved().find((c) => c.id === sv.dataset.saved)); return; }
      if (t.closest('[data-clear]')) { onClear(); return; }
      if (t.closest('[data-back]')) { st.step = st.step === 'year' ? 'model' : 'make'; if (st.step === 'make') st.makeId = null; st.q = ''; draw(); return; }
      if (t.closest('[data-other]')) { st.step = 'other'; draw(); return; }
      if (t.closest('[data-done]')) { finish(HW.makeCar(st.makeId, st.model, root.querySelector('#pkYear').value)); return; }
      if (t.closest('[data-done-custom]')) {
        const make = root.querySelector('#oMake').value.trim(), model = root.querySelector('#oModel').value.trim();
        if (!make || !model) { root.querySelector('#oErr').textContent = HW.t('fill_all'); return; }
        const cls = root.querySelector('input[name="oCls"]:checked').value;
        finish(HW.customCar(make, model, root.querySelector('#oYear').value, cls, root.querySelector('#oOrigin').value));
      }
    };
    draw();
  }

  /* Pop-up version */
  function open({ onPick, onClear } = {}) {
    const old = document.getElementById('carModal'); if (old) old.remove();
    const m = document.createElement('div');
    m.id = 'carModal'; m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', HW.t('select_car'));
    m.innerHTML = `<div class="modal__panel"><button type="button" class="modal__x" aria-label="${HW.t('close')}">×</button><h3>${HW.t('select_car')}</h3><p class="muted">${HW.t('select_car_sub')}</p><div id="carModalBody"></div></div>`;
    document.body.appendChild(m); document.body.classList.add('modal-open');
    const close = () => { m.remove(); document.body.classList.remove('modal-open'); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('.modal__x')) close(); });
    mount(m.querySelector('#carModalBody'), { onPick: (c) => { close(); if (onPick) onPick(c); }, onClear: onClear ? () => { close(); onClear(); } : null });
  }

  Object.assign(HW, { openCarPicker: open, mountCarPicker: mount });
})();
