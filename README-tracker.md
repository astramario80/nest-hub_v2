# Trip-o-meter implementation — local draft, not activated

Production currently includes only the SOP link cleanup. The new tracker and shared cookies are not deployed. Updated combined service source and its manifest are saved in the school-owned Apps Script editor, but the production deployment remains version 4. The new Drive and external-request OAuth permissions are awaiting user confirmation.

## Access

One host-only Secure/HttpOnly/SameSite=Strict session cookie serves both Magic Spinner and Trip-o-meter for six hours, without sliding renewal. Each server read/write rechecks authorization. Owner emails and rich-text administrator mailto links from NEST Database `Location_Lists_Inventory_OSPI_21stCenturySkills!T2:T20` have global access. Other users are restricted to the verified period. Roster names and emails now come from each NEST Database period tab (A and C), not the legacy trackers. No student IDs or guardian fields are returned. External linked tools retain their own authentication.

## Tracker

Private app-created JSON files in the school account hold assignments and scores independently of the old spreadsheets. The Google service keeps file IDs in Script Properties. Writes are serialized under the existing script lock and require matching revisions to prevent lost updates. Student users cannot edit or export; managers and their active temporary editors can edit within their period. Only administrators export all-period data. Administrator exports include retained historical students; normal views contain current roster members only. CSV generation neutralizes spreadsheet formula injection.

Migration is one-time per period and refuses to overwrite an existing imported tracker. It preserves all legacy score strings, including Yes/No, and snapshots names/emails for historical CSV recovery. Original spreadsheets remain intact. Only score 4 counts as complete; no Yes-to-grade conversion occurs.

## Activation status

1. Implemented live manager/assistant checks from Division Leaderships `Imported!B2:F`, period normalization, independently verified six-hour editor grants, and non-transitive delegation. Manager removal also invalidates their grants.
2. Only score 4 counts as completion. Score breakdowns show all five scores. CTSO/Robotics uses the existing CTSO tracker and the central NEST CTSO roster. Legacy Yes/No values remain unchanged and do not count as score 4.
3. Complete migration consistency checks on all configured periods, including blank rosters and unrecognized score values.
4. Google authorization for app-created Drive files (`drive.file`) and Google API requests (`script.external_request`). This extends the existing read-only Sheets and send-email scopes. It does not grant public access or modify original sheet sharing.
5. Copy Code.js and Tracker.js into the school-owned Apps Script project; update its manifest and deploy only after Google consent. Do not use the old Gmail-owned clasp project.
6. Deploy the website/API together after backend smoke tests. Existing per-period cookies are ignored by the new shared-cookie version; users verify once again.
7. Verify real email → code → tracker → spinner → another permitted period → logout. Verify manager restrictions and student wrong-period rejection on the actual service. The earlier live code-verification failure remains unconfirmed; unit tests alone are insufficient.

## Local review

`npm test` runs access, mutation and UI regressions. `/private/tmp/nest-tracker-preview.mjs` serves a clearly labeled fictional sample preview at http://127.0.0.1:4178/trip-o-meter. It is not a production backend and must never be deployed.
