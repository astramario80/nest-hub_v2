# Trip-o-meter — production

Live at https://gknest.org/trip-o-meter. Website/API deploy from main through Vercel. School-owned Google service version 6 is deployed as of September 15, 2026. All seven trackers were imported and read back successfully after owner authorization.

## Access

One host-only Secure/HttpOnly/SameSite=Strict session cookie serves both Magic Spinner and Trip-o-meter for six hours, without sliding renewal. Each server read/write rechecks authorization. Owner emails and rich-text administrator mailto links from NEST Database `Location_Lists_Inventory_OSPI_21stCenturySkills!T2:T20` have global access. Other users are restricted to the verified period. Roster names and emails now come from each NEST Database period tab (A and C), not the legacy trackers. No student IDs or guardian fields are returned. External linked tools retain their own authentication.

## Tracker

Private app-created JSON files in the school account hold assignments and scores independently of the old spreadsheets. The Google service keeps file IDs in Script Properties. Writes are serialized under the existing script lock and require matching revisions to prevent lost updates. Student users cannot edit or export; managers and their active temporary editors can edit within their period. Only administrators export all-period data. Administrator exports include retained historical students; normal views contain current roster members only. CSV generation neutralizes spreadsheet formula injection.

Migration is one-time per period and refuses to overwrite an existing imported tracker. It preserves all legacy score strings, including Yes/No, and snapshots names/emails for historical CSV recovery. Original spreadsheets remain intact. Only score 4 counts as complete; no Yes-to-grade conversion occurs.

## Leadership and delegation

Division Leaderships spreadsheet `1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I`, `Imported!B2:F`, is checked live. Column B supplies the period, D the position, F the email. Division Manager and Assistant Manager can edit and delegate within their period. Delegates must verify their own email, expire after six hours, and cannot delegate further. Removing a manager invalidates their grants.

## Google deployment

School project: `1hXsy9t4RqGMLElVzmBNM5VdrYlbJrPmzAGMDgjb1XewyzMxfNhjUOBIb`. Combine Code.js and Tracker.js in Code.gs and use the committed manifest. Update the existing school deployment; do not use the older Gmail-owned clasp project. Google code changes require a new version independently of Git/Vercel.

Approved scopes: read-only Sheets, send mail, app-created Drive files, external Google API requests. These do not change sheet sharing. App-created JSON files live in the school account's private NEST Private Trackers folder. File IDs stay in Script Properties. initializeTrackers skips existing data and must never overwrite it.

## Verification

Automated tests cover owner/admin global access, student period restrictions, expiry/replay/logout, live manager removal, non-transitive six-hour grants, revision conflicts, score validation and score-4-only completion. Desktop/mobile sample UI checks passed. Live email delivery with clean subject, code verification, Periods 1, 2 and 4, shared Magic Spinner access and Period 2 CSV download were verified. Saving an unchanged blank score in Period 4 succeeded without changing its value; sign-out then locked both tools. All 22 automated tests passed. CSV has 24 student rows and 7 assignment columns. Original spreadsheet data is preserved, including legacy values.

The prior automatic Google response redirect timed out in production. The API now explicitly reads Google's result using a fresh GET restricted to script.googleusercontent.com, with safe stage timing logs and a bounded timeout. Live sign-in/read/export calls completed in approximately 2–4 seconds after this change. The browser displays separate verification/loading progress and bounds requests at 55 seconds.
