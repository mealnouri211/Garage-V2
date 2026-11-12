/* Home page */
(() => {
  const HW = window.HW;
  const FEATURED = ['polish-hero', 'ppf-full', 'thermal-a', 'wheels-protect', 'dc-m550', 'repaint-glasurit', 'wash-nano', 'service-jp'];
  HW.boot(() => {
    HW.$('#statItems').textContent = HW.PRODUCTS.length;
    HW.$('#statCats').textContent = HW.CATS.length;
    HW.$('#catGrid').innerHTML = HW.CATS.map((c) => {
      const n = HW.PRODUCTS.filter((p) => p.cat === c.id).length;
      return `<a class="cat" href="shop.html?cat=${c.id}">${HW.ph(c.img, HW.L(c.name))}<span class="cat__label">${HW.L(c.name)}<span class="cat__count">${n}</span></span></a>`;
    }).join('');
    const hc = HW.$('#homeCar');
    if (HW.car) {
      hc.innerHTML = `<h3>${HW.t('your_car')}</h3><p style="font-size:1.3rem;font-weight:800;margin:.4rem 0 1rem">${HW.carLabel()}</p><div class="btn-row"><a class="btn btn--gold" href="quote.html">${HW.t('get_quote')}</a><button class="btn btn--ghost" id="homeChange">${HW.t('change')}</button></div>`;
      HW.$('#homeChange').onclick = () => HW.openCarPicker({ onPick: (c) => { HW.setCar(c); HW.refresh(); }, onClear: () => { HW.setCar(null); HW.refresh(); } });
    } else {
      hc.innerHTML = `<h3>${HW.t('select_car')}</h3><div id="homePicker"></div>`;
      HW.mountCarPicker(HW.$('#homePicker'), { onPick: (c) => { HW.setCar(c); HW.refresh(); } });
    }
    HW.$('#featuredGrid').innerHTML = FEATURED.map(HW.findProduct).filter(Boolean).map(HW.cardHtml).join('');
  });
})();
