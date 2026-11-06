# Homepage marketing filmstrip

The homepage shows a muted, translucent right-to-left filmstrip behind its gears after NEST account verification. Pause stops movement and video. Reduced-motion users start paused. Hidden tabs pause playback; sign-out removes all media. Files are streamed through the authenticated same-origin `/api/marketing-film` route, with no shared Drive links or OAuth tokens sent to the browser.

The separate **NEST Homepage Media — Read Only** Apps Script project reads only the five verified division folders inside NEST Social Marketing. It uses Google's `drive.readonly` scope (Google grants this scope at Drive level; application code restricts it to those division folders). It does not change files or sharing. Nested folders are scanned, shortcuts and nonmedia files are excluded, and a bounded reservoir is cached for ten minutes. Each visit shuffles up to 18 media items while representing each populated division. Parent ancestry is checked afresh for every media stream.

Google approval is complete for mpenalver@bethelsd.org (verified November 3, 2026). To reauthorize if required, Open https://script.google.com/home/projects/1rg9iC_cDNJY9TVlnJVIRb3yr-goj2YWM0tQIh_bucQSZUCEQ_Y_ljbHL/edit, choose `Code.gs`, select `Authorize_NEST_Media`, and click Run. Complete Google's authorization prompts using the district account. Reload https://gknest.org afterward.

The existing school bridge verifies every NEST session before Vercel contacts the separate media reader. Its production-only `NEST_MARKETING_READER_URL` and `NEST_MARKETING_READER_TOKEN` are configured in Vercel. Only a hash of the dedicated media secret exists in Apps Script. The original school backend's permissions are unchanged.

Supported MIME types: JPEG, PNG, WebP, GIF, MP4, WebM, QuickTime. Video playback also depends on browser codec support; failed media are skipped. Photos use Drive previews when available and fall back to originals. Live browser verification confirmed loaded photos and muted videos playing through the protected website route.

Verification: `node --test tests/marketing-film.test.mjs tests/gear-hover.test.mjs tests/tool-search.test.mjs` (19 passing). Browser QA verified real synced folder images, movement, and pause in a local preview. Production anonymous media access returns 401. Live media delivery is verified: visible photos, two muted videos at readyState 4 with advancing playback time, and an advancing filmstrip after NEST verification.

November 4, 2026: fixed a browser timer overflow that immediately hid the slideshow for newly issued 30-day sessions. Expiry checks now run in intervals within the browser timer limit and clear the media at actual session expiry. Regression checks cover 1-day, 7-day, and 30-day sessions, the long-session timer transition, and actual expiration.
