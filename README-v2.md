# HeroWorks – Draft 2 (pilot version)

Open `index.html` through any web host (GitHub Pages works) or run `python3 -m http.server` in this folder and visit http://localhost:8000.
Your live GitHub site is untouched: this is a separate copy.

## What is new
1. **Car selector + instant quote** – customer picks make → model → year; every price on the site follows the car. `quote.html` lets them tick services and see total price and time, then book or send the quote on WhatsApp.
2. **Customer accounts** – sign up/sign in with phone + password. "Track my car" shows all bookings with progress bars.
3. **Live job tracker (`job.html`)** – progress %, time left, ready-by time (counts only working hours), stage timeline, photo/notes feed from the garage, and **extra-work approvals** the customer can approve or decline.
4. **Bay camera panel** – customer can watch their car while it is in the workshop (they must allow it; staff can only show it if they did).
5. **Staff dashboard (`staff.html`)** – PIN-protected board: move cars through stages, assign bays, adjust ETA, post notes/photos, request approvals, WhatsApp-notify the customer, walk-in jobs, assistant requests inbox, price editor.
6. **Intake assistant** – chat bubble that collects name, phone, car, service and timing, then drops a request into the staff inbox and offers a WhatsApp summary.

## Try it
- Demo customer: phone `9999 0001`, password `demo1234` (it has a job in progress with a pending approval).
- Staff: open `staff.html`, PIN `1234`.
- Open staff and customer pages in two tabs of the **same browser**: changes show up live.

## IMPORTANT: what is simulated / guessed
- **All data lives in the browser (localStorage)**. Nothing is shared between devices yet, and nothing is private. Do not use for real customers until a backend is connected (see below). Staff PIN and demo data are visible in the code.
- **Prices by car size are placeholders**: catalog price = small car; other classes use multipliers 1.15 / 1.3 / 1.45 / 1.9 (`js/pricing.js`, editable in Staff → Pricing, with per-service overrides).
- **Service durations**, **opening hours** (9–20, Friday from 16) and **number of bays (4)** are guesses. Edit `js/config.js` and `DURATIONS` in `js/pricing.js`.
- Which services fit which car (American/European/Japanese oil & service packages, BMW remote start, Supra BM3) is inferred from the names; carplay/maps are "we will confirm".
- Vehicle list is a starter list (`js/vehicles.js`); unlisted cars can be entered with a size.
- Camera view shows a labelled DEMO picture until you connect real streams.
- The assistant is **scripted, not an AI model**.
- Online payment is not connected: customers choose a preferred method and pay at the garage.
- Models appear in English (Latin) in both languages.

## Connecting the cameras
Set a stream address per bay in `js/config.js` → `cameraStreams`. Use HLS (`.m3u8`) or a WebRTC/viewer page. Cameras that only give RTSP need a small gateway such as go2rtc or MediaMTX to convert. Only HTTPS addresses are accepted. For real use, streams must be access-controlled so only the owner of that job can open them (use signed, short-lived links from your server). Tell customers about the cameras and keep the consent option.

## Going live (backend)
All data access goes through `HW.api` in `js/store.js`. Replace that file with calls to a real service (Supabase, Firebase, or your own server) keeping the same function names and returned shapes, and move these to the server: accounts and password hashing, staff logins, job permissions (a customer may only read their own job), appointment-slot checks, photo storage, WhatsApp/SMS notifications (WhatsApp Business API), and online payment (K-Net / Apple Pay via a gateway such as MyFatoorah or Tap).
To make the assistant a real AI, send the chat text to a server function that calls an LLM with your price list and rules; never put an API key in these files.

## Ideas for next
Service reminders (oil change every N km/months), loyalty/referral codes, before/after photo gallery on delivery, review request after pickup, pickup & delivery requests, deposit for big jobs, staff-side per-technician timers.

## Files
`index/shop/product/cart/checkout/quote/login/account/job/staff/contact.html`, `styles.css`, `js/` (config, vehicles, pricing, store, i18n-v2, carpicker, chatbot, camera + page scripts), `assets/`.
Upload everything (keep the folder structure) to host it.
