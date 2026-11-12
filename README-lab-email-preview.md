# Lab email design review — prepared, not active

The revised teacher emails and capability action are **local review work**. The active school service is still version 111; the teacher notification changes have not been published. The user asked to review the designs before trying them live.

Open `output/lab-request/email-demos/index.html` through the local preview server. Its four tabs use fictional student and teacher data: request received, pass issued, pass denied, and teacher denial confirmed. The request demo's Deny button runs a local, clearly labeled simulation and sends no email or API denial. Graphics are rendered in `assets/nest-lab-email-texture.png`; the new lab-pass SVG and short link are already published separately.

Prepared behavior:

- A new request emails the selected sending teacher(s) and Mario separately. Teachers receive a personal Deny request link. Reply-To is mpenalver@bethelsd.org. Tracking is disabled on these action links.
- Each capability is a random 256-bit value bound to one selected teacher and request. Only its digest is stored in the private website archive. It expires at the end of the visit day or after thirty days, whichever comes first. The raw token travels in the email link's fragment and is removed from the browser address after loading.
- The landing GET never changes data. A short-lived server-signed navigation grant permits an automatic denial POST after a normal user-initiated browser navigation. Scans, prefetches, unsupported email apps, and missing or expired navigation grants fall back to a confirmation button. Fetch metadata is a best-effort scanner safeguard, not proof of human intent; scanners that emulate a real interactive browser may still trigger a one-click action. Stronger protection requires always confirming or staff authentication.
- The teacher does not need a NEST account. The link is a bearer capability, so anyone it is forwarded to can use it while valid. It cannot access another request or change the reason/actor supplied by the server.
- The denial immediately saves state `denied` and reason `at incoming teacher’s request`, then sends separate confirmations to selected teachers, Mario, and the student. Repeated clicks and uncertain email delivery never repeat the transition or email batch. Checked-in, past-day, expired, or no-longer-selected teacher links cannot deny a request.
- Owners receive an on-screen teacher-denial alert on their next alert poll. Automatic past-day tabling remains silent.

44 focused checks passed. The full suite passed 607/608 with the existing unrelated resource-viewer script-src assertion failing. Source-only checks and the interactive mock denial passed; no real staff emails or student denials were used as tests.

## Publish only after design review

Take a fresh production website manifest and school source snapshot before publishing. Preserve all unrelated current sources. The prepared `tmp/nest-request/school-release.mjs` includes `LabEmails.js`, `LabTeacherActions.js`, and the `lab-teacher-action` dispatch. Verify the route extraction and updated source before use.

Website release additions: `api/lab-teacher.mjs`, `lib/lab-teacher-page.mjs`, `js/lab-teacher.js`, `css/lab-teacher.css`; rewrite `/lab-teacher` to `/api/lab-teacher` and give the API a 60-second budget. Publish the teacher landing/API first, then the school modules, so a newly sent teacher link always has a working destination. Also include the prepared teacher-denial alert rendering and request-receipt history label. Existing Blob storage and server secrets suffice.

After approval, test with the lab administrator selected as the sending teacher before sending a real student's teacher email. Validate actual email-client navigation behavior and the fallback confirmation path. Keep every test clearly marked and away from real student access decisions.

## Status artwork and grade viewer (October 28 review)

The gallery now includes six status previews: request received (blue), pass issued (green), checked in (blue), tabled (amber), and both denial variants (rose). Issued and checked-in notices include a golden Admit One ticket. Check-in uses a shared transparent stamp image plus private, dynamically rendered Pacific arrival text; the timestamp remains readable with images blocked and in plain text. Rebuild the small background and stamp assets with `node scripts/build-lab-email-art.mjs`. Include all four `assets/nest-lab-email-{amber,mint,blue,rose}.png` images and `assets/nest-lab-checked-in-stamp.png` when publishing the templates.

Owner grade evidence now opens in a labeled, dismissible dialog over the request using Google's private Drive preview. Closing it leaves the request in place; closing or signing out unloads the iframe. Existing Google Drive permissions still apply. The website does not copy or publish the screenshot. This interface change is prepared locally alongside the email review.

### Revised brand treatment

The latest review replaces the cream and gold ticket with website charcoal (#242424) and orange (#e87722). Every email uses the brand texture on its charcoal header, small “NEST™ Request” text, and a main heading stating the actual status. Green, rose, blue, and amber status accents remain for quick recognition. The check-in stamp uses light blue ink for contrast on charcoal. Publish `assets/nest-lab-email-brand.png` with the revised templates. Previous palette assets remain available but are no longer used by these headers.

## Approved and published October 28, 2026

The user approved the pass designs. The school service is now version 113 with the approved staff/student notifications, teacher action capability, full work signature verified from the work account, and official NEST™ Request / NEST™ Lab / Mario Peñalver naming. The website release includes the teacher response endpoint, charcoal/orange ticket and stamp artwork, teacher-denial alert display, and the private grade screenshot dialog. Source roster and archived names remain unchanged; the administrator's preferred name is applied when displaying the directory and email teacher labels.

Verification covered 48 focused checks before release, the additional preferred-name rendering test, staged authenticated access, live page and asset responses, and a read-only invalid-capability lookup returning HTTP 410. No real teacher emails were sent and no student pass decisions were made as deployment tests. Mail-provider acceptance and appearance in an actual staff mailbox have not been exercised by this release verification.

Final website: `dpl_GxDiQvL7xb6hQaquQYBL6Ey5pGFA` / `project-vqtkt-159ccqv1f-mario-penalvers-projects.vercel.app`, promoted and resolved through gknest.org. School service: version 113, 25 files verified. Live owner desk loads the current-year archive. A real archived request's grade button opened the dialog and closing it returned to the same request. Google's private preview required Google sign-in in this browser; image content was not viewed. No pass state was changed. Legacy staff records and external roster rows were preserved.
