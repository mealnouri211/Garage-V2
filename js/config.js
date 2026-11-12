/* HeroWorks – Draft 2 settings. Edit this file to match the real garage.
   Everything marked GUESS is a placeholder that the garage should confirm. */
(() => {
  'use strict';
  window.HW = Object.assign(window.HW || {}, {
    CONFIG: {
      /* Staff dashboard PIN (staff.html). DEMO ONLY: it is visible in this file, so it is not real security.
         A real deployment must use proper staff accounts on a server. */
      staffPin: '1234',

      /* Number of work bays. Used to decide when an appointment slot is full. GUESS */
      bays: 4,

      /* Working hours (24h clock). Progress and "ready by" times only count these hours. GUESS */
      workHours: { start: 9, end: 20, fridayStart: 16 },

      /* Days ahead a customer can book. */
      bookingDays: 30,

      /* Live camera per bay. Leave '' to show the labelled DEMO picture.
         - HLS stream:  'https://your-gateway.example/bay1/index.m3u8'   (played with hls.js)
         - Any web page / WebRTC viewer: 'https://your-gateway.example/bay1/viewer'  (shown in an iframe)
         Cameras that only speak RTSP need a small gateway (go2rtc or MediaMTX) to turn them into HLS/WebRTC. */
      cameraStreams: { 1: '', 2: '', 3: '', 4: '' },

      /* When true the app fills itself with example customers and jobs the first time it opens,
         and shows a "DEMO" pill. Set to false when the garage starts using it for real. */
      demoMode: true
    }
  });
})();
