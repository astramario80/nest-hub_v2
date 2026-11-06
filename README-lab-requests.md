# NEST lab requests and passes

`/lab-request` replaces the old external NEST Request menu link with a native page. Students sign in with their district-linked NEST account, identify the sending teacher(s), choose a division from the original form, give a goal and Pacific visit date/time, confirm a B or higher in every class, and upload a PNG/JPEG/WebP StudentVue screenshot (2 MB maximum). The screenshot must show their name, today's date, and grades. Grade eligibility is reviewed by the lab administrator; image contents are not automatically graded.

Only existing NEST owners can issue, table, deny, or check in a pass. Issuing and arrival check-in are separate actions. Table and deny require a standard or custom reason. Arrival check-in is available only for issued passes on the requested Pacific date. Original form requests without a time require an arrival time before a new pass can be issued.

Each decision sends a separate transactional email from `communications@gknest.org` to every selected teacher and the student. Each email has the NEST banner linked to the menu, student name, goal, visit date/time, status, and applicable reason or arrival timestamp. Student grade screenshots are not emailed. New requests and due arrivals also email `mpenalver@bethelsd.org` with a direct request link. Email links never authenticate the recipient; NEST sign-in and live role checks remain required.

The administrator's default view shows the current August–July school year, with pending/issued requests above a collapsed closed/tabled/denied section. Archive filters include school year, trimester, student, status, and student-name/district-email search. Visit date determines school year and trimester. Malformed legacy dates are preserved and flagged; those records use their submission date for archive grouping. Existing NEST school calendar dates are used; old years without configured dates appear as Dates not assigned. Owners can enter the four trimester boundary dates in the Archive tab without changing Weather calendars.

## Data and scheduling

- Original form: `11fmiXfrOhpecIxNJKyyb60meLxXm40JQTSSl1bvIpV4` (division list item `160380651`).
- Staff source: Staff List_NEST™ Edition, `1SXaKUeh3tCsBVSdO90iWWX_pL8WhNe7aTSrELEIE98o`, `Shared_data!A1:D1001`. Only GKHS district staff are used; personal-email columns are never read. Browser options contain opaque IDs and staff names; selected teacher emails are resolved in the school service.
- Legacy history: `1kFIpoNmKFXnCEUPxfQ6j-5alQfaK-_OE3HY-MGx9g5I`, Requests. First owner bootstrap imports historical rows once into the private app store, without emails or source changes. Imported status labels and missing times are preserved explicitly. Unparseable dates are reported for source review. New submissions to the old Google Form after this one-time import remain in that original system; distribute the new website link for new requests.
- `lab-request-store`: school-owned private workbook, Requests (opaque ID + JSON) and Staff. `lab-evidence-folder`: private school-owned Drive folder. No public or student sharing is added.
- First signed-in page bootstrap configures the daily 5 AM Pacific staff refresh and a five-minute arrival reminder trigger. The Postmark token is provided only by the Vercel server and retained in school Script Properties for unattended reminders. It never reaches the browser or request rows. Bootstrap reports setup failures; Sync staff now retries setup.
- Staff refresh retains the previous directory on failure; new submissions require a successful refresh for the current Pacific date. No browser is needed for either scheduled job after setup. Arrival reminders run after the approved time on the same day; checked-in/tabled/denied passes are excluded.
- On-screen alerts follow signed-in administrators across NEST pages. New-request dismissal retains the request in the desk; arrival alerts can be snoozed for ten minutes. Only opaque alert IDs and snooze timestamps are saved in sessionStorage.

Request IDs, decision IDs, version checks, script locks, and durable email reservations prevent duplicate requests and sends after a lost response. `accepted` means Postmark accepted the message, not confirmed inbox delivery. Rejected/partial/unknown/sending outcomes remain visible for review; uncertain emails are never automatically resent. School storage currently holds up to 10,000 requests and twenty decision events per request. Legacy grade image permissions remain unchanged.

## Release and checks

Publish `LabRequests.js` and its authenticated dispatch addition over the exact current school project before the matching website files. Existing manifest scopes suffice. Preserve all unrelated current school and website sources.

Run `node --test tests/lab-requests.test.mjs`, then `npm test`. Browser previews in `tmp/nest-request` use clearly synthetic records and send no emails. Verify actual owner bootstrap, form division choices, staff sync, scheduled triggers, archive import counts, and private permissions after release. Do not issue real student passes as a test.

Published October 28, 2026: school service version 110 and website deployment `dpl_GWSXavEVPqqgj4BnGPHmMnd9q8EN`. The live owner page verified 395 archived requests across 2023–2024 through 2026–2027, 93 staff options, the original seven division choices, and successful daily/reminder trigger configuration. The private store is not shared. All 25 focused tests passed. The full suite passed 586/587 before the final archive refinements, with the existing `resource-viewer.test.mjs` exact script-src check failing on unrelated pages; the final archive refinements passed focused coverage. No real student pass, teacher email, or test notification was issued. Screenshots in `output/lab-request` contain synthetic preview data only.

## October 28 theme and browser-freeze repair

The request page uses the shared `--dark-bg`, `--card-bg`, `--text-light`, and `--primary-orange` variables, including dark form controls and review dialogs. Bright alert CSS is unchanged.

The lab alert observer previously treated its own insertion into an open dialog as a reason to rebuild the alert, creating an unbounded mutation loop. It now watches only dialog open/close and dialog insertion/removal, and skips rendering when the alert data and host are unchanged. This also preserves keyboard focus across ordinary alert polls. Three regression tests reproduce the previous failure safely and verify stable modal transitions, unchanged polls, dismissal, and logout cleanup.

All 28 focused tests passed; the full suite passed 591/592 with the existing unrelated resource-viewer script-src assertion failing. Browser verification held a sample request dialog and bright alert open for over 90 seconds through repeated polls, then successfully changed the decision dropdown without submitting. Published website deployment `dpl_7QHwqNwW9SY6Xcst1omXoYoJqsiA`; only `css/lab-requests.css` and `js/lab-request-alerts.js` differ from the previous 247-file production source. Both public assets were verified byte-for-byte after promotion. School service and student pass records were unchanged by this release.

## Active archive and automatic tabling — October 28, 2026

All 395 requests were migrated and compared in full to private Vercel Blob storage (`nest-lab-requests`, `lab-requests/archive-v1.json`). The old request workbook is disconnected from active archive reads/writes after cutover and retained as a backup. The original Google Form is no longer read for division choices; the seven verified choices are stored in code. The Staff List and existing school identity service remain connected. Existing grade-image links retain their original private Drive permissions.

`LabWebsiteStorage.js` keeps the school workflow connected to the authenticated server-only `/api/lab-storage` endpoint. Conditional ETag writes prevent stale archive overwrites, and a website storage failure never falls back to Google request rows after cutover. The archive currently enforces 10,000 records, 50 KB per record, and a 4 MB JSON document limit. Migration is owner-only and verifies record contents as well as counts before switching authority.

The existing five-minute unattended job automatically changes past-day pending and issued requests to Tabled, using the Pacific visit date. An audit note records the change and `not-sent` email state. No notifications are sent for this automatic action. Already tabled, denied, checked-in, today's, and future requests are preserved. Owner bootstrap also applies this cleanup immediately. School service version 111 is active.

The short link https://gknest.org/nestrequest and original /lab-request both serve the native page. Website deployment `dpl_FLu9erBBdnnD3FN1Ke9uWu1jsaYT` publishes the dedicated lab-pass icon and heading “Your next visit to the NEST™ Lab.” Revised staff email designs and one-click teacher denial remain preview work; see README-lab-email-preview.md before activating them.
