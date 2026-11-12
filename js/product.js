/* Product page: option configurator, price for the chosen car, add to cart (or update a cart line).
   The appointment is chosen once at checkout, not here. */
(() => {
  const HW = window.HW;
  const params = new URLSearchParams(location.search);
  const p = HW.findProduct(params.get('id'));
  const editKey = params.get('edit');
  const editing = editKey ? HW.cart.find((i) => i.key === editKey && i.pid === (p && p.id)) : null;

  const st = editing
    ? { sel: JSON.parse(JSON.stringify(editing.sel)), qty: editing.qty }
    : { sel: {}, qty: 1 };
  if (p) p.groups.forEach((g) => { st.sel[g.id] = st.sel[g.id] || []; });

  function render() {
    const root = HW.$('#productRoot');
    if (!p) {
      HW.$('#crumbs').innerHTML = `<a href="index.html">${HW.t('home')}</a><span>/</span><a href="shop.html">${HW.t('shop')}</a>`;
      root.innerHTML = `<div class="done"><p class="muted">${HW.t('not_found')}</p><a class="btn btn--gold" href="shop.html">${HW.t('browse')}</a></div>`;
      return;
    }
    const cat = HW.findCat(p.cat);
    HW.$('#crumbs').innerHTML = `<a href="index.html">${HW.t('home')}</a><span>/</span><a href="shop.html">${HW.t('shop')}</a><span>/</span><a href="shop.html?cat=${cat.id}">${HW.L(cat.name)}</a><span>/</span><span>${HW.L(p.name)}</span>`;

    const groups = p.groups.map((g) => `
      <fieldset class="group">
        <legend>${HW.L(g.label)} <small>${g.required ? HW.t('required') : HW.t('optional')}</small></legend>
        <div class="opts">${g.options.map((o) => `
          <label class="opt">
            <input type="${g.type === 'radio' ? 'radio' : 'checkbox'}" name="${g.id}" value="${o.id}" ${st.sel[g.id].includes(o.id) ? 'checked' : ''}>
            <span>${HW.L(o.label)}</span>
            ${o.delta ? `<em>${o.delta > 0 ? '+' : '−'}${Math.abs(o.delta).toFixed(3)}</em>` : ''}
          </label>`).join('')}
        </div>
      </fieldset>`).join('');

    const pct = HW.discountPct(p);
    const inc = p.includes[HW.lang], notes = p.notes[HW.lang];
    const details = `
      ${inc.length ? `<section class="detail"><h3>${HW.t('includes_t')}</h3><ul class="checks">${inc.map((x) => `<li>${x}</li>`).join('')}</ul></section>` : ''}
      ${p.specs.length ? `<section class="detail"><h3>${HW.t('specs_t')}</h3><dl class="specs">${p.specs.map((x) => `<div><dt>${HW.L(x.k)}</dt><dd>${HW.L(x.v)}</dd></div>`).join('')}</dl></section>` : ''}
      ${notes.length ? `<section class="detail"><h3>${HW.t('notes_t')}</h3><ul class="notes">${notes.map((x) => `<li>${x}</li>`).join('')}</ul></section>` : ''}`;
    root.innerHTML = `
      <div class="pp">
        <div class="pp__media">${HW.ph(p.img, HW.L(p.name))}</div>
        <div class="pp__form">
          <span class="card__tag card__tag--inline">${p.type === 'service' ? HW.t('service') : HW.t('part')}</span>
          <h1>${HW.L(p.name)}</h1>
          <div class="pricebox">${HW.priceHtml(p, false)}${pct ? `<span class="pill">-${pct}% ${HW.t('off')}</span><span class="save">${HW.t('you_save')} ${HW.money(p.was - p.base)}</span>` : ''}</div>
          <p class="lead">${HW.L(p.desc)}</p>
          ${p.badges.length ? `<div class="badges">${p.badges.map((b) => `<span>${HW.L(b)}</span>`).join('')}</div>` : ''}
          ${details}
          ${groups}
          <div class="carnote" id="carNote"></div>
          <div class="err" id="cfgErr" role="alert"></div>
          <a class="btn btn--ghost btn--block" target="_blank" rel="noopener" href="https://wa.me/${HW.CONTACT.wa}?text=${encodeURIComponent(HW.t('wa_hello') + ' ' + HW.L(p.name))}">${HW.t('ask_wa')}</a>
          <div class="buybar">
            <div class="qty" ${p.type === 'service' ? 'hidden' : ''} aria-label="${HW.t('qty')}">
              <button type="button" data-q="-1" aria-label="-">−</button><span id="qtyVal">${st.qty}</span><button type="button" data-q="1" aria-label="+">+</button>
            </div>
            <div class="total"><small>${HW.t('total')}</small><strong id="cfgTotal"></strong></div>
            <button class="btn btn--gold" id="addBtn" ${HW.fit(p, HW.car) === 'no' ? 'disabled' : ''}>${editing ? HW.t('continue_booking') : HW.t('add_to_cart')}</button>
          </div>
        </div>
      </div>`;
    refresh();

    const form = HW.$('.pp__form');
    form.onchange = (e) => {
      const el = e.target;
      if (el.matches('.opts input')) {
        const g = p.groups.find((x) => x.id === el.name);
        st.sel[g.id] = g.type === 'radio' ? [el.value] : HW.$$(`input[name="${g.id}"]:checked`, form).map((i) => i.value);
        HW.$('#cfgErr').textContent = ''; refresh();
      }
    };
    form.onclick = (e) => {
      const q = e.target.closest('[data-q]');
      if (q) { st.qty = Math.min(20, Math.max(1, st.qty + Number(q.dataset.q))); refresh(); return; }
      if (e.target.closest('[data-pickcar]')) { HW.openCarPicker({ onPick: (c) => { HW.setCar(c); HW.refresh(); }, onClear: () => { HW.setCar(null); HW.refresh(); } }); return; }
      if (e.target.closest('#addBtn')) addToCart();
    };

    // related products
    const rel = HW.PRODUCTS.filter((x) => x.cat === p.cat && x.id !== p.id);
    const more = HW.PRODUCTS.filter((x) => x.type === p.type && x.cat !== p.cat && x.id !== p.id);
    const list = [...rel, ...more].slice(0, 4);
    HW.$('#relatedWrap').hidden = !list.length;
    HW.$('#relatedGrid').innerHTML = list.map(HW.cardHtml).join('');
  }

  function refresh() {
    HW.$('#cfgTotal').textContent = HW.money(HW.priceFor(p, HW.car, st.sel) * st.qty);
    HW.$('#qtyVal').textContent = st.qty;
    const fit = HW.fit(p, HW.car), n = HW.$('#carNote');
    const dur = HW.durationFor(p, HW.car);
    const time = p.type === 'service' ? `<div class="carnote__time">${HW.t('takes')} <b>${HW.fmtDur(dur)}</b></div>` : '';
    if (!HW.car) n.innerHTML = `<div class="carnote__row"><span>${HW.t('car_price_hint')}</span><button type="button" class="btn btn--ghost" data-pickcar>${HW.t('select_car')}</button></div>${time}`;
    else n.innerHTML = `<div class="carnote__row ${fit === 'no' ? 'bad' : ''}"><span>${fit === 'no' ? HW.t('not_for_car_long') : fit === 'confirm' ? HW.t('confirm_fit_long') : `${HW.t('price_for')} <b>${HW.carLabel()}</b>`}</span><button type="button" class="linklike" data-pickcar>${HW.t('change')}</button></div>${fit === 'no' ? `<a class="btn btn--ghost btn--block" target="_blank" rel="noopener" href="https://wa.me/${HW.CONTACT.wa}?text=${encodeURIComponent(HW.t('wa_hello') + ' ' + HW.L(p.name) + ' – ' + HW.carLabel())}">${HW.t('ask_wa')}</a>` : time}`;
  }

  function addToCart() {
    if (HW.fit(p, HW.car) === 'no') return;
    if (p.groups.some((g) => g.required && !st.sel[g.id].length)) { HW.$('#cfgErr').textContent = HW.t('err_required'); return; }
    const line = { pid: p.id, sel: st.sel, qty: st.qty };
    if (editing) Object.assign(editing, line);
    else HW.cart.push({ key: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`, ...line });
    HW.saveCart();
    location.href = 'cart.html';
  }

  document.body.classList.add('is-product');
  HW.boot(render);
})();
