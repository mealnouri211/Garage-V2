/* My account: saved cars (My Garage) and every booking with its live progress. */
(() => {
  const HW = window.HW;
  let jobs = [];
  const bar = (j) => { const pr = HW.jobProgress(j); return `<div class="pbar pbar--sm" role="progressbar" aria-valuenow="${pr.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pr.pct}%"></i></div>`; };

  function jobCard(j) {
    const pr = HW.jobProgress(j), active = HW.ACTIVE.includes(j.status);
    const names = j.items.map((i) => { const p = HW.findProduct(i.pid); return p ? HW.L(p.name) : i.pid; }).join(' · ');
    return `<a class="jobcard ${active ? 'active' : ''}" href="job.html?id=${j.id}">
      <div class="jobcard__top"><b dir="ltr">${j.id}</b><span class="status status--${j.status}">${HW.t('st_' + j.status)}</span></div>
      <div class="jobcard__car">${HW.carName(j.car, HW.lang)}</div>
      <small class="muted">${names}</small>
      ${active || j.status === 'ready' ? bar(j) : ''}
      <div class="jobcard__foot"><span>${j.status === 'ready' ? HW.t('ready_now') : pr.eta ? `${HW.t('ready_by')}: <b>${HW.fmtWhen(pr.eta)}</b>` : ''}</span><span class="price">${HW.money(j.total)}</span></div>
    </a>`;
  }

  async function load() { jobs = await HW.api.listJobs(); }

  function render() {
    const root = HW.$('#accountRoot');
    if (!HW.user) { location.replace('login.html?next=account.html'); return; }
    const active = jobs.filter((j) => HW.ACTIVE.includes(j.status) || j.status === 'ready');
    const past = jobs.filter((j) => !active.includes(j));
    const cars = HW.user.cars || [];
    root.innerHTML = `
      <div class="acct-head"><div><h2>${HW.t('hello')} ${HW.user.name}</h2><small class="muted" dir="ltr">+${HW.user.phone}</small></div><button class="btn btn--ghost" id="logoutBtn">${HW.t('logout')}</button></div>
      <div class="two-col">
        <div>
          <h3>${HW.t('my_jobs')}</h3>
          ${active.length ? `<div class="jobs">${active.map(jobCard).join('')}</div>` : `<div class="panel center"><p class="muted">${HW.t('no_active')}</p><a class="btn btn--gold" href="quote.html">${HW.t('get_quote')}</a></div>`}
          ${past.length ? `<h3 class="h-gap">${HW.t('history')}</h3><div class="jobs">${past.map(jobCard).join('')}</div>` : ''}
        </div>
        <aside class="panel">
          <h3>${HW.t('my_garage')}</h3>
          ${cars.length ? `<ul class="garage">${cars.map((c) => `<li><span><b>${HW.carName(c, HW.lang)}</b></span><span><button class="linklike" data-use="${c.id}">${HW.t('use_this')}</button> <button class="linklike danger" data-rm="${c.id}">${HW.t('remove')}</button></span></li>`).join('')}</ul>` : `<p class="muted">${HW.t('no_cars')}</p>`}
          <button class="btn btn--ghost btn--block" id="addCar">${HW.t('add_car')}</button>
          <p class="muted small">${HW.t('garage_hint')}</p>
        </aside>
      </div>`;
    root.onclick = async (e) => {
      if (e.target.closest('#logoutBtn')) { await HW.api.logout(); location.href = 'index.html'; return; }
      if (e.target.closest('#addCar')) { HW.openCarPicker({ onPick: async (c) => { HW.user = await HW.api.saveCar(c); HW.setCar(c); HW.refresh(); } }); return; }
      const u = e.target.closest('[data-use]'); if (u) { HW.setCar(cars.find((c) => c.id === u.dataset.use)); HW.toast(HW.t('car_set')); HW.refresh(); return; }
      const r = e.target.closest('[data-rm]'); if (r) { HW.user = await HW.api.removeCar(r.dataset.rm); HW.refresh(); }
    };
  }

  HW.boot(() => { if (!HW.user) { location.replace('login.html?next=account.html'); return; } render(); load().then(() => { render(); HW.applyI18n(); }); });
  HW.api.onChange(() => load().then(() => { if (HW.user) { render(); HW.applyI18n(); } }));
  setInterval(() => { if (HW.user && !document.hidden) { render(); HW.applyI18n(); } }, 30000);
})();
