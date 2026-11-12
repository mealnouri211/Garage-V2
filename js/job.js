/* Job tracker: progress bar, time left, stage timeline, updates feed, approvals and the live bay camera. */
(() => {
  const HW = window.HW;
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const isNew = params.get('new') === '1';
  let job = null, lastSig = '', lastStatus = null, stopCam = () => {};

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pname = (i) => { const p = HW.findProduct(i.pid); return p ? HW.L(p.name) : i.pid; };
  const sig = () => JSON.stringify([job, HW.lang, HW.user && HW.user.id]);

  function metaHtml(pr) {
    const j = job, st = j.status;
    if (st === 'cancelled') return `<div class="meta"><small>${HW.t('status')}</small><b>${HW.t('st_cancelled')}</b></div>`;
    if (st === 'delivered') return `<div class="meta"><small>${HW.t('st_delivered')}</small><b>${HW.fmtWhen(j.deliveredAt)}</b></div>`;
    if (st === 'ready') return `<div class="meta"><small>${HW.t('ready_since')}</small><b>${HW.fmtWhen(j.readyAt)}</b></div><div class="meta"><small>${HW.t('open_until')}</small><b>${String(HW.CONFIG.workHours.end).padStart(2, '0')}:00</b></div>`;
    if (st === 'booked') return `<div class="meta"><small>${HW.t('appointment')}</small><b>${HW.fmtWhen(j.startFrom)}</b></div><div class="meta"><small>${HW.t('ready_by')} (${HW.t('est')})</small><b>${HW.fmtWhen(pr.eta)}</b></div>`;
    return `<div class="meta"><small>${HW.t('time_left')}</small><b>≈ ${HW.fmtDur(pr.left)}</b></div><div class="meta"><small>${HW.t('ready_by')}</small><b>${HW.fmtWhen(pr.eta)}</b></div>`;
  }
  function closedNote() {
    if (!['received', 'in_progress', 'qc'].includes(job.status) || HW.sched.isOpenNow()) return '';
    return `<p class="closed-note">${HW.t('closed_now')} ${HW.fmtWhen(HW.sched.nextOpen(new Date()))}</p>`;
  }

  function feedText(u) {
    if (u.kind === 'status') return `${HW.t('feed_status')}: <b>${HW.t('st_' + u.status)}</b>`;
    if (u.kind === 'eta') return HW.t('feed_eta');
    if (u.kind === 'approval') return `${HW.t('feed_approval')}: <b>${esc(u.text)}</b>`;
    if (u.kind === 'approval_done') { const [t, r] = String(u.text).split('|'); return `${esc(t)} – <b>${HW.t(r === 'approved' ? 'approved' : 'declined')}</b>`; }
    return esc(u.text);
  }

  function icsDownload() {
    const d = new Date(job.startFrom), e = new Date(HW.sched.addWork(d, 30));
    const f = (x) => `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, '0')}${String(x.getDate()).padStart(2, '0')}T${String(x.getHours()).padStart(2, '0')}${String(x.getMinutes()).padStart(2, '0')}00`;
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HeroWorks//EN', 'BEGIN:VEVENT', `UID:${job.id}@heroworks`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(d)}`, `DTEND:${f(e)}`, `SUMMARY:HeroWorks – ${HW.carName(job.car, 'en')}`, 'LOCATION:HeroWorks Garage\\, Kuwait', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' })); a.download = `${job.id}.ics`; a.click();
  }

  function paint() {
    const root = HW.$('#jobRoot'); stopCam(); stopCam = () => {};
    if (!job) {
      root.innerHTML = `<div class="done"><p class="muted">${HW.t('job_none')}</p><a class="btn btn--gold" href="${HW.user ? 'account.html' : 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search)}">${HW.t(HW.user ? 'nav_track' : 'sign_in')}</a></div>`;
      return;
    }
    HW.$('#jobCrumb').textContent = job.id;
    const pr = HW.jobProgress(job), st = job.status;
    const stages = HW.STAGES.map((s, i) => {
      const idx = HW.STAGES.indexOf(st), cls = st === 'cancelled' ? '' : i < idx ? 'done' : i === idx ? 'now' : '';
      return `<li class="${cls}"><span class="dot"></span><small>${HW.t('st_' + s)}</small></li>`;
    }).join('');
    const pending = job.approvals.filter((a) => a.status === 'pending');
    const camWindow = ['received', 'in_progress', 'qc'].includes(st);
    const canWatch = job.camera && job.cameraConsent && job.bay && camWindow;
    const feed = [...job.updates].reverse();
    const wa = `https://wa.me/${HW.CONTACT.wa}?text=${encodeURIComponent(`${HW.t('wa_job')} ${job.id} – ${HW.carName(job.car, HW.lang)}`)}`;

    root.innerHTML = `
      ${isNew ? `<div class="banner banner--ok"><b>${HW.t('booked_ok')}</b> ${HW.t('booked_ok_p')}</div>` : ''}
      <div class="job-head"><div><small class="muted" dir="ltr">${job.id}</small><h2>${esc(HW.carName(job.car, HW.lang))}</h2><p class="muted">${job.items.map(pname).join(' · ')}</p></div><span class="status status--${st}">${HW.t('st_' + st)}</span></div>
      <div class="two-col">
        <div class="stack">
          <section class="panel track">
            <div class="track__top"><div class="meta meta--big"><small>${HW.t('progress')}</small><b id="pctNum">${pr.pct}%</b></div><div id="metaBox" class="track__meta">${metaHtml(pr)}</div></div>
            <div class="pbar" role="progressbar" aria-valuenow="${pr.pct}" aria-valuemin="0" aria-valuemax="100" id="pbar"><i style="width:${pr.pct}%"></i></div>
            <ol class="stepper ${st === 'cancelled' ? 'is-cancelled' : ''}">${stages}</ol>
            <p class="track__msg">${HW.t('msg_' + st)}</p>
            <div id="closedBox">${closedNote()}</div>
          </section>

          ${pending.map((a) => `
          <section class="panel approval" data-appr="${a.id}">
            <h3>${HW.t('approval_t')}</h3>
            <p><b>${esc(a.title)}</b></p>
            <p class="muted">${HW.t('extra_cost')}: <b>${HW.money(a.price)}</b>${a.extraMin ? ` · ${HW.t('extra_time')}: <b>${HW.fmtDur(a.extraMin)}</b>` : ''}</p>
            <div class="btn-row"><button class="btn btn--gold" data-decide="1">${HW.t('approve')}</button><button class="btn btn--ghost" data-decide="0">${HW.t('decline')}</button></div>
          </section>`).join('')}

          ${['booked', 'received', 'in_progress', 'qc'].includes(st) ? `
          <section class="panel">
            <div class="panel__row"><h3>${HW.t('cam_title')}</h3>
              <label class="switch"><input type="checkbox" id="camConsent" ${job.cameraConsent ? 'checked' : ''}><span></span><em>${HW.t('cam_allow')}</em></label></div>
            ${canWatch ? `<div id="camBox">${HW.camera.html(job.bay)}</div><p class="muted small">${HW.t('cam_privacy')}</p>`
              : `<p class="muted">${!job.cameraConsent ? HW.t('cam_off') : camWindow ? HW.t('cam_wait_bay') : HW.t('cam_later')}</p>`}
          </section>` : ''}

          <section class="panel">
            <h3>${HW.t('updates')}</h3>
            ${feed.length ? `<ul class="feed">${feed.map((u) => `<li class="feed__${u.kind}"><time>${HW.fmtWhen(u.at)}</time><div>${feedText(u)}${u.photo ? `<img class="feed__img" src="${esc(u.photo)}" alt="" loading="lazy" data-zoom>` : ''}</div></li>`).join('')}</ul>` : `<p class="muted">${HW.t('no_updates')}</p>`}
          </section>
        </div>

        <aside class="panel summary">
          <h3>${HW.t('details')}</h3>
          <dl class="facts">
            <div><dt>${HW.t('appointment')}</dt><dd>${HW.fmtWhen(job.startFrom)}</dd></div>
            ${job.bay ? `<div><dt>${HW.t('bay')}</dt><dd>${job.bay}</dd></div>` : ''}
            <div><dt>${HW.t('payment_l')}</dt><dd>${HW.t({ knet: 'pay_knet_v', apple: 'pay_apple_v', cash: 'pay_cash_v' }[job.payment] || 'pay_cash_v')}</dd></div>
          </dl>
          <ul class="qlist">${job.items.map((i) => `<li><span>${esc(pname(i))}${i.qty > 1 ? ` × ${i.qty}` : ''}</span><span>${HW.money(i.price)}</span></li>`).join('')}</ul>
          <div class="sum"><div class="grand"><span>${HW.t('total')}</span><span>${HW.money(job.total)}</span></div></div>
          <a class="btn btn--gold btn--block" target="_blank" rel="noopener" href="${wa}">${HW.t('wa_us')}</a>
          <a class="btn btn--ghost btn--block" href="tel:${HW.CONTACT.tel}">${HW.t('call_us')}</a>
          ${st === 'booked' ? `<button class="btn btn--ghost btn--block" id="icsBtn">${HW.t('add_calendar')}</button><button class="linklike danger" id="cancelBtn">${HW.t('cancel_booking')}</button>` : ''}
        </aside>
      </div>`;
    if (canWatch) stopCam = HW.camera.start(HW.$('#camBox'));

    root.onclick = async (e) => {
      const dec = e.target.closest('[data-decide]');
      if (dec) { const aid = dec.closest('[data-appr]').dataset.appr; try { await HW.api.decideApproval(job.id, aid, dec.dataset.decide === '1'); await reload(true); } catch (ex) { HW.toast(HW.t('err_' + (ex.code || 'generic'))); } return; }
      if (e.target.closest('#icsBtn')) { icsDownload(); return; }
      if (e.target.closest('#cancelBtn') && confirm(HW.t('cancel_confirm'))) { try { await HW.api.cancelJob(job.id); await reload(true); } catch (ex) { HW.toast(HW.t('err_' + (ex.code || 'generic'))); } return; }
      const z = e.target.closest('[data-zoom]'); if (z) zoom(z.src);
    };
    const cc = HW.$('#camConsent');
    if (cc) cc.onchange = async () => { try { await HW.api.setCameraConsent(job.id, cc.checked); await reload(true); } catch (ex) { HW.toast(HW.t('err_' + (ex.code || 'generic'))); } };
  }

  function zoom(src) {
    const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="modal__panel modal__panel--img"><button class="modal__x" aria-label="${HW.t('close')}">×</button><img src="${src}" alt=""></div>`;
    m.onclick = (e) => { if (e.target === m || e.target.closest('.modal__x')) m.remove(); };
    document.body.appendChild(m);
  }

  function tick() {
    if (!job || !document.getElementById('pctNum')) return;
    const pr = HW.jobProgress(job);
    HW.$('#pctNum').textContent = pr.pct + '%';
    HW.$('#pbar i').style.width = pr.pct + '%'; HW.$('#pbar').setAttribute('aria-valuenow', pr.pct);
    HW.$('#metaBox').innerHTML = metaHtml(pr); HW.$('#closedBox').innerHTML = closedNote();
  }

  async function reload(force) {
    job = await HW.api.getJob(id);
    if (job && lastStatus && job.status !== lastStatus) HW.toast(`${HW.t('feed_status')}: ${HW.t('st_' + job.status)}`);
    lastStatus = job ? job.status : null;
    const s = sig();
    if (force || s !== lastSig) { lastSig = s; paint(); HW.applyI18n(); }
  }

  HW.boot(() => { lastSig = ''; reload(true); });
  HW.api.onChange(() => reload(false));
  setInterval(() => { if (!document.hidden) tick(); }, 15000);
})();
