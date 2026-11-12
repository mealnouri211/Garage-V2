/* Live camera view for one bay.
   Stream sources come from HW.CONFIG.cameraStreams (js/config.js):
   - '.m3u8' address  → played with hls.js (loaded only when needed)
   - any other address → shown in an iframe (WebRTC/viewer pages)
   - empty            → a clearly labelled DEMO picture, so the flow can be tried without cameras. */
(() => {
  'use strict';
  const HW = window.HW;
  let hlsLoading;
  const loadHls = () => hlsLoading || (hlsLoading = new Promise((res, rej) => {
    if (window.Hls) return res(window.Hls);
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1';
    s.onload = () => res(window.Hls); s.onerror = rej; document.head.appendChild(s);
  }));
  const safeUrl = (u) => /^https:\/\//i.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)/i.test(u);

  /* Returns the markup for the camera frame. Call HW.camera.start(el) afterwards. */
  function html(bay) {
    const url = (HW.CONFIG.cameraStreams || {})[bay] || '';
    if (url && !safeUrl(url)) return `<div class="cam cam--msg">${HW.t('cam_bad_url')}</div>`;
    if (/\.m3u8(\?|$)/i.test(url)) return `<div class="cam" data-cam="hls" data-url="${url}"><video playsinline muted autoplay controls></video><span class="cam__live">● ${HW.t('live')} · ${HW.t('bay')} ${bay}</span></div>`;
    if (url) return `<div class="cam"><iframe src="${url}" allow="autoplay; fullscreen" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin" title="${HW.t('bay')} ${bay}"></iframe><span class="cam__live">● ${HW.t('live')} · ${HW.t('bay')} ${bay}</span></div>`;
    return `<div class="cam cam--demo" data-cam="demo"><img src="assets/categories/maint.jpg" alt=""><span class="cam__live">● ${HW.t('live')} · ${HW.t('bay')} ${bay}</span><span class="cam__demo">${HW.t('demo_feed')}</span><span class="cam__time" dir="ltr"></span><i class="cam__scan"></i></div>`;
  }

  /* Starts clocks/streams inside `root`. Returns a stop() function. */
  function start(root) {
    const stops = [];
    const el = root.querySelector('[data-cam]'); if (!el) return () => {};
    if (el.dataset.cam === 'demo') {
      const t = el.querySelector('.cam__time'); const tick = () => { t.textContent = new Date().toLocaleTimeString('en-GB'); };
      tick(); const id = setInterval(tick, 1000); stops.push(() => clearInterval(id));
    } else if (el.dataset.cam === 'hls') {
      const v = el.querySelector('video'), url = el.dataset.url;
      if (v.canPlayType('application/vnd.apple.mpegurl')) v.src = url;
      else loadHls().then((Hls) => { if (!Hls.isSupported()) return; const h = new Hls({ lowLatencyMode: true }); h.loadSource(url); h.attachMedia(v); stops.push(() => h.destroy()); }).catch(() => { el.insertAdjacentHTML('beforeend', `<span class="cam__err">${HW.t('cam_err')}</span>`); });
    }
    return () => stops.forEach((f) => f());
  }
  HW.camera = { html, start };
})();
