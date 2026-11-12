/* Sign in / create account. ?next=page.html decides where to go afterwards. ?out=1 signs out first. */
(() => {
  const HW = window.HW;
  const params = new URLSearchParams(location.search);
  const next = (params.get('next') || 'account.html').replace(/[^a-z0-9._?=&-]/gi, '') || 'account.html';
  const S = { mode: params.get('mode') === 'register' ? 'register' : 'login', name: '', phone: '', pw: '', busy: false };
  let signedOut = false;

  async function boot0() {
    if (params.get('out') && !signedOut) { await HW.api.logout(); signedOut = true; HW.user = null; }
    else if (HW.user && !params.get('out')) { location.replace(next); }
  }

  function render() {
    const reg = S.mode === 'register';
    HW.$('#loginRoot').innerHTML = `
      <form class="panel" id="authForm" novalidate>
        <div class="tabs2"><button type="button" class="${reg ? '' : 'active'}" data-mode="login">${HW.t('sign_in')}</button><button type="button" class="${reg ? 'active' : ''}" data-mode="register">${HW.t('create_account')}</button></div>
        ${reg ? `<div class="field"><label for="aName">${HW.t('f_name')}</label><input id="aName" autocomplete="name" value="${S.name}"></div>` : ''}
        <div class="field"><label for="aPhone">${HW.t('f_phone')}</label><input id="aPhone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" value="${S.phone}" placeholder="9XXX XXXX"></div>
        <div class="field"><label for="aPw">${HW.t('f_password')}</label><input id="aPw" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" value="${S.pw}"><small class="muted">${reg ? HW.t('pw_hint') : ''}</small></div>
        <div class="err" id="aErr" role="alert"></div>
        <button class="btn btn--gold btn--block" type="submit">${HW.t(reg ? 'create_account' : 'sign_in')}</button>
        <p class="muted center small">${HW.t('why_account')}</p>
        ${HW.CONFIG.demoMode ? `<div class="demo-box"><b>${HW.t('demo_account')}</b><br><span dir="ltr">9999 0001 · demo1234</span> <button type="button" class="linklike" id="fillDemo">${HW.t('fill_demo')}</button></div>` : ''}
      </form>`;
    const f = HW.$('#authForm');
    f.oninput = (e) => { const id = e.target.id; if (id === 'aName') S.name = e.target.value; if (id === 'aPhone') S.phone = e.target.value; if (id === 'aPw') S.pw = e.target.value; };
    f.onclick = (e) => {
      const m = e.target.closest('[data-mode]'); if (m) { S.mode = m.dataset.mode; render(); HW.applyI18n(); return; }
      if (e.target.closest('#fillDemo')) { S.mode = 'login'; S.phone = '99990001'; S.pw = 'demo1234'; render(); HW.applyI18n(); }
    };
    f.onsubmit = async (e) => {
      e.preventDefault(); if (S.busy) return; S.busy = true; HW.$('#aErr').textContent = '';
      try {
        if (S.mode === 'register') await HW.api.register({ name: S.name, phone: S.phone, password: S.pw });
        else await HW.api.login({ phone: S.phone, password: S.pw });
        location.href = next;
      } catch (ex) { S.busy = false; HW.$('#aErr').textContent = HW.t('err_' + (ex.code || 'generic')); }
    };
  }
  HW.boot(() => { boot0().then(() => {}); render(); });
})();
