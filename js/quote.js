/* Instant quote: pick the car, tick the services, see the exact price and time, then book or send it on WhatsApp. */
(() => {
  const HW = window.HW;
  const sel = new Set((HW.store.get('hw2_quote_sel', []) || []));
  let showAll = false;

  const save = () => HW.store.set('hw2_quote_sel', [...sel]);
  const services = () => HW.PRODUCTS.filter((p) => p.type === 'service');
  const chosen = () => services().filter((p) => sel.has(p.id) && HW.fit(p, HW.car) !== 'no');

  function totals() {
    const list = chosen();
    return { list, total: list.reduce((s, p) => s + HW.priceFor(p, HW.car), 0), mins: list.reduce((s, p) => s + HW.durationFor(p, HW.car), 0) };
  }

  function waText() {
    const { list, total, mins } = totals();
    const lines = list.map((p) => `• ${HW.L(p.name)} – ${HW.money(HW.priceFor(p, HW.car))}`);
    return [`${HW.t('wa_quote_hello')}`, `${HW.t('your_car')}: ${HW.carLabel()}`, ...lines, `${HW.t('total')}: ${HW.money(total)}`, `${HW.t('est_time')}: ${HW.fmtDur(mins)}`].join('\n');
  }

  function rowHtml(p) {
    const fit = HW.fit(p, HW.car), on = sel.has(p.id), pct = HW.discountPct(p), was = HW.wasFor(p, HW.car);
    return `<label class="qrow ${on ? 'on' : ''} ${fit === 'no' ? 'na' : ''}">
      <input type="checkbox" value="${p.id}" ${on && fit !== 'no' ? 'checked' : ''} ${fit === 'no' ? 'disabled' : ''}>
      <span class="qrow__main"><b>${HW.L(p.name)}</b>
        <small>${fit === 'no' ? HW.t('not_for_car') : `${HW.t('takes')} ${HW.fmtDur(HW.durationFor(p, HW.car))}${fit === 'confirm' ? ' · ' + HW.t('confirm_fit') : ''}`}</small></span>
      <span class="qrow__price">${fit === 'no' ? '' : `${was ? `<s class="was">${HW.money(was)}</s>` : ''}<span class="price">${HW.money(HW.priceFor(p, HW.car))}</span>${pct ? `<em class="pill">-${pct}%</em>` : ''}`}</span>
      <a class="qrow__info" href="${HW.productUrl(p.id)}" aria-label="${HW.t('details_link')}" onclick="event.stopPropagation()">i</a>
    </label>`;
  }

  function render() {
    const root = HW.$('#quoteRoot');
    if (!HW.car) {
      root.innerHTML = `<div class="panel"><h3>1 · ${HW.t('select_car')}</h3><p class="muted">${HW.t('quote_need_car')}</p><div id="inlinePicker"></div></div>`;
      HW.mountCarPicker(HW.$('#inlinePicker'), { onPick: (c) => { HW.setCar(c); HW.refresh(); } });
      return;
    }
    const hidden = services().filter((p) => HW.fit(p, HW.car) === 'no').length;
    const cats = HW.CATS.filter((c) => c.type === 'service');
    const body = cats.map((c) => {
      const rows = services().filter((p) => p.cat === c.id && (showAll || HW.fit(p, HW.car) !== 'no'));
      return rows.length ? `<section class="qcat"><h4>${HW.L(c.name)}</h4>${rows.map(rowHtml).join('')}</section>` : '';
    }).join('');
    const t = totals();
    root.innerHTML = `
      <div class="two-col">
        <div>
          <div class="carnote carnote--big"><div class="carnote__row"><span>1 · <b>${HW.carLabel()}</b></span><button type="button" class="linklike" data-pickcar>${HW.t('change')}</button></div>
            ${HW.car.custom ? `<small class="muted">${HW.t('estimate_note')}</small>` : ''}</div>
          <h3 class="h-gap">2 · ${HW.t('quote_pick')}</h3>
          ${body}
          ${hidden ? `<button type="button" class="linklike" id="toggleAll">${showAll ? HW.t('hide_na') : HW.t('show_na').replace('{n}', hidden)}</button>` : ''}
        </div>
        <aside class="panel summary summary--sticky">
          <h3>3 · ${HW.t('your_quote')}</h3>
          ${t.list.length ? `<ul class="qlist">${t.list.map((p) => `<li><span>${HW.L(p.name)}</span><span>${HW.money(HW.priceFor(p, HW.car))}</span></li>`).join('')}</ul>` : `<p class="muted">${HW.t('quote_empty')}</p>`}
          <div class="sum">
            <div><span>${HW.t('est_time')}</span><span>${HW.fmtDur(t.mins)}</span></div>
            <div class="grand"><span>${HW.t('total')}</span><span>${HW.money(t.total)}</span></div>
          </div>
          <small class="muted">${HW.t('quote_note')}</small>
          <button class="btn btn--gold btn--block" id="bookBtn" ${t.list.length ? '' : 'disabled'}>${HW.t('book_these')}</button>
          <a class="btn btn--ghost btn--block ${t.list.length ? '' : 'is-off'}" id="waBtn" target="_blank" rel="noopener" href="https://wa.me/${HW.CONTACT.wa}?text=${encodeURIComponent(waText())}">${HW.t('send_quote_wa')}</a>
        </aside>
      </div>`;
    root.onclick = (e) => {
      if (e.target.closest('[data-pickcar]')) { HW.openCarPicker({ onPick: (c) => { HW.setCar(c); HW.refresh(); }, onClear: () => { HW.setCar(null); HW.refresh(); } }); return; }
      if (e.target.closest('#toggleAll')) { showAll = !showAll; HW.refresh(); return; }
      if (e.target.closest('#bookBtn')) book();
    };
    root.onchange = (e) => {
      if (e.target.matches('.qrow input')) { e.target.checked ? sel.add(e.target.value) : sel.delete(e.target.value); save(); const y = window.scrollY; HW.refresh(); window.scrollTo(0, y); }
    };
  }

  function book() {
    chosen().forEach((p) => { if (!HW.cart.some((i) => i.pid === p.id)) HW.cart.push({ key: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`, pid: p.id, sel: {}, qty: 1 }); });
    HW.saveCart(); location.href = 'checkout.html';
  }

  HW.boot(render);
})();
