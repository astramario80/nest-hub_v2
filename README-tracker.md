# Trip-o-meter implementation — local draft, not activated

Production currently includes only the SOP link cleanup. The new tracker, shared cookies and Google service changes are not deployed.

## Access

One host-only Secure/HttpOnly/SameSite=Strict session cookie serves both Magic Spinner and Trip-o-meter for six hours, without sliding renewal. Each server read/write rechecks authorization. Owner emails and rich-text administrator mailto links from NEST Database `Location_Lists_Inventory_OSPI_21stCenturySkills!T2:T20` have global access. Other users are restricted to the verified period. Roster names and emails now come from each NEST Database period tab (A and C), not the legacy trackers. No student IDs or guardian fields are returned. External linked tools retain their own authentication.

## Tracker

Private app-created JSON files in the school account hold assignments and scores independently of the old spreadsheets. The Google service keeps file IDs in Script Properties. Writes are serialized under the existing script lock and require matching revisions to prevent lost updates. Student users cannot edit or export. Administrator exports include retained historical students; normal views contain current roster members only. CSV generation neutralizes spreadsheet formula injection.

Migration is one-time per period and refuses to overwrite an existing imported tracker. It preserves all legacy score strings, including Yes/No, and snapshots names/emails for historical CSV recovery. Original spreadsheets remain intact. Current completion configuration is intentionally unset pending the user's scoring definition; no Yes-to-grade conversion occurs.

## Required before activation

1. User identifies the current division-manager source and confirms period/division editing scope. `trackerRole_` currently fails closed to student except for live administrators/owners.
2. User defines which scores count as completion and whether Robotics is included. Set completionScores explicitly in each migrated tracker using the confirmed rule; add Robotics source mapping only if requested.
3. Complete migration consistency checks on all configured periods, including blank rosters and unrecognized score values.
4. Google authorization for app-created Drive files (`drive.file`) and Google API requests (`script.external_request`). This extends the existing read-only Sheets and send-email scopes. It does not grant public access or modify original sheet sharing.
5. Copy Code.js and Tracker.js into the school-owned Apps Script project; update its manifest and deploy only after Google consent. Do not use the old Gmail-owned clasp project.
6. Deploy the website/API together after backend smoke tests. Existing per-period cookies are ignored by the new shared-cookie version; users verify once again.
7. Verify real email → code → tracker → spinner → another permitted period → logout. Verify manager restrictions and student wrong-period rejection on the actual service. The earlier live code-verification failure remains unconfirmed; unit tests alone are insufficient.

## Local review

`npm test` runs access, mutation and UI regressions. `/private/tmp/nest-tracker-preview.mjs` serves a clearly labeled fictional sample preview at http://127.0.0.1:4178/trip-o-meter. It is not a production backend and must never be deployed.
