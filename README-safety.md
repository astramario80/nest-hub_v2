# Safety workspace

`/safety` lives in Tools → Leadership. A signed-in member chooses their current division. Safety Officers, Division Managers, Assistant Managers, and the teacher see division flight monitoring and queue controls; other members see the shared bathroom board and their own flight records. Roles and roster membership are verified in the school runtime on every request. Robotics uses the same membership requirement; no unrelated leadership role expands this access.

## Bathroom board

Officers/managers open or close sign-ups. Members join once, leave their own waiting entry, and record their return. Officers/managers dispatch the next waiting member only when nobody else is out, record returns, and moderate discussion posts. Closing sign-ups preserves the queue. Waiting entries and discussion display for the current Pacific date; outstanding departures persist until marked returned. The board does not issue a SmartPass or authorize a student to leave.

## Native flight forms and alerts

`js/safety-fields.js` and `google-spinner/SafetySchema.js` preserve the original form's aircraft, mechanical, weather/NOTAM, flight-plan, IMSAFE, clearance, and conditional damage questions. The original Google Form remains available; the website writes native submissions to the existing `PreFlight/PostFlight` recorder. A native form does not create a Google Forms response receipt or invoke an installable Google Forms submit trigger. The existing bound scripts remain unchanged. The website computes monitoring directly from recorder rows, so it immediately includes native and legacy responses without relying on a delayed debrief rebuild.

Go/No-Go decisions reproduce the existing checks: No/No-Go in readiness items or Yes in IMSAFE produces No-Go. A student can submit a hold early without completing clearance or later sections. Missing required answers cannot produce Go. A Go result is checklist readiness, not flight authorization. No automatic clearance or supervisor override is provided. Monitoring uses a general IMSAFE supervisor-review flag rather than sharing individual health answers.

The overview defaults to today and offers date selection, completion counts, missing students, No-Go/incomplete alerts, post-flight follow-up, submitted checklists, and unresolved maintenance. Completion is date-specific; a post-flight must follow the latest pre-flight for the same aircraft. Maintenance remains open across dates until addressed and can be reopened. Historical flight records are scoped to the current NEST enrollment roster for the division.

Damage reports require a JPG/PNG/WebP image of at most 2 MB. Images and ownership metadata are private Vercel Blob objects. The media endpoint checks division membership plus manager/owner or submitting-student access before serving bytes. Legacy Drive photo links remain in the teacher's original recorder rather than being exposed to division members.

## Persistence and deployment

`api/safety.mjs` proxies bounded operations through the existing school bridge and keeps credentials and internal storage paths off dashboard responses. `google-spinner/Safety.js` and `SafetySchema.js` implement authorization, data mapping, validation, and queue/event state. A hidden `SafetyWebEvents` tab is created on the first authorized mutation in the existing recorder. Each append writes a request ID; native flight response and event writes are atomic. The browser reuses a submission ID after an uncertain save to prevent duplicates. Event text is written as RAW strings and rendered as text, not HTML.

Deploy by merging these two modules and the `auth-safety` dispatch route into fresh school project source, preserving all unrelated modules. Publish the existing school web app version, then deploy the website source plus the `/api/safety` function (60-second duration). The existing private Blob store and school bridge environment are reused. Preserve the current production website source when preparing a release; this checkout contains unrelated changes.

## Validation

`node --test tests/safety.test.mjs tests/tool-search.test.mjs tests/soar-eagle-menu.test.mjs tests/gear-hover.test.mjs`

Use fictional data for mutation QA. Read-only production checks may inspect existing real records; do not submit a fabricated flight checklist to the live recorder or send Fly Day notification email as a test.

## School No Fly / escort restrictions

A separate leaders-only panel sits above the flight reference. Current Safety Officers, Division Managers, Assistant Managers and the teacher may add/remove division entries by selecting a student from their own current division roster. School-list matches are independent: removing a division entry cannot remove an official school match. Ordinary member responses omit the restriction list, roster choices, and source metadata entirely. No Fly means escort-required classroom supervision; it does not change a drone checklist result or automatically deny a bathroom request.

`integrations/safety/SchoolNoFly.js` runs in the existing flight recorder's bound project, which already has GmailApp authorization for its Fly Day functions. Its `syncSchoolNoFly` function reads the latest No Fly/No-Fly Word attachment from the verified school sender `mlandron@bethelsd.org`, extracts names from DOCX table cells (including headers for source/date validation), and matches them against CombinedStudentList!A2:F in the NEST enrollment master. Names come from A, email from C, division period from D, prep from E, and trimester from F. The current year and trimester come from NEST Database Schedule!A2 and B6; future and historical terms are excluded. Photos and unmatched schoolwide names are not copied into the website. Matching normalizes punctuation/accents and supports an unambiguous surname + first-name match; duplicates are held for teacher review. Failed/unsupported imports preserve the last successful matches and display a source warning. The complete current attachment replaces the previous school snapshot, allowing removals in the latest school list to take effect without changing local division entries.

The importer stores its private matched snapshot in hidden `SafetySchoolNoFly!A1`; the website filters that snapshot again against the current division roster. Its hourly Apps Script trigger is independent of the original form-submit/on-open triggers. No new mailbox access is added to the public school web app.

## Published flight reference

Safety leaders edit today's radio channel, ceiling (with units), and clearance code, then explicitly choose **Publish to division**. All signed-in members of that division see the published reference above the forms. Draft changes stay in the leader's browser. The published reference expires at midnight Pacific time; yesterday's code never appears as today's code. These values do not automatically approve a No-Go checklist.

The native checklist is available to current division members with NEST enrollment records. The missing-checklist tracker follows current Drone Piloting enrollment and includes other members who submit on the selected date.

Safety `view` and `media` calls participate in the bridge's existing read-only retry handling. Mutations are never automatically replayed. The focused Safety/navigation checks pass. The broader pre-existing `auth-bridge.test.mjs` fixture currently concatenates duplicate consolidated auth declarations (`AUTH_SHEET`) and fails before running its cases; the live school release preserves the actual owning modules and compiles successfully.

The `NoFlyRoster.js` helper is installed identically in both the bound importer project and the school web app, keeping column mapping, active-term filtering, duplicate handling, and period normalization consistent. Multiple current enrollments for one email are preserved.

## Flight form, archive, and class log

The form renders immediately for signed-out visitors with submission disabled. Verified accounts can use the archive; current enrolled division accounts can submit their own checklists. The first tab holds the Pre/Post-Flight wizard. The weather step embeds `/metar` and `/notams`, with separate pop-out links and origin/window/channel-checked transfer of findings into the checklist.

`SafetyFlights.js` provides `catalog`, `archive`, and `current-flight-log` operations. The archive includes only Pre-Flight operational reference fields: aircraft checks, flight plan/weather, aircraft number, METAR, and NOTAM findings. It excludes IMSAFE answers, clearance codes, maintenance reports/photos, contact addresses, and No Fly information. Pagination is 30 records. Filters include school year, trimester, student/date/aircraft text, and date/name sort. Existing recorder entries are included. Known school calendars assign legacy trimester dates; historical records without a configured calendar are explicitly “Calendar not assigned” and remain searchable by year.

The current-trimester tab is server-restricted to current Drone Piloting students and the owner. It uses CombinedStudentList A:F and Schedule A2/B6, lists each current Drone Piloting division separately, and shows completed pre-flights plus students still awaiting any pre-flight during that trimester. New native submission audit events capture the enrolled division and configured trimester to retain historical attribution.

## Reviewed flight clearance

`SafetyClearance.js` enforces the two-stage website workflow. A student’s checklist first becomes a `flight-review` draft with “Pending clearance”; it is not appended as a completed pre-flight. Only the administrator publishes a daily global code (`clearance-code`), expiring at midnight Pacific. All current division Safety Officers, Division Managers, and Assistant Managers can see it in their private leader view. Radio channel and ceiling remain shared division settings; the code is never part of shared settings or the reference archive.

After reviewing operational answers and the generic supervisor-review flags, a leader uses “Reviewed · Copy & release code” for a specific pending checklist. Only its submitter then sees that released code, copies/pastes it into the completion field, and submits `flight-complete`. The backend requires the authenticated submitter, the correct division, a current administrator code release, and a Go checklist. The recorder append and completion journal event are atomic and idempotent. No-Go drafts cannot be cleared; they can be cancelled and corrected through a new checklist. Code rotation requires a fresh release, and all drafts/releases expire with their Pacific calendar day. The legacy Google Form remains an independent historical intake; this handshake governs the native website form.

## Weather observations and nearby lookups

The weather step places a collapsible NOTAM iframe next to the NOTAM findings answer and a collapsible METAR iframe next to the METAR report/observation answers. Copying a METAR changes only the report; a separate required observation asks students to explain what its conditions mean for their planned flight. The observation is stored in the draft and completion journal, shown during leader review, and included in the shared reference archive. Original recorder columns remain unchanged. Existing pending drafts remain completable; new Go reviews require an observation. Early No-Go reporting still works without later answers.

The aircraft dropdown has an assigned-drone lookup button. It opens a native modal dialog containing the existing scrubbed inventory table at `/inventory?popup=drones`; closing the dialog preserves the checklist and aircraft choice. The inventory popup opens directly to the drone table with its existing name/period/equipment filter.

Safety requests now seed the existing request-only access map from native SpreadsheetApp reads (`safetyReadContext_`). Account status, current membership, and leadership roles are reread each request; no permissions persist between requests. This avoids the shared Advanced Sheets API read quota that interrupted authenticated loading. A failed private load also leaves the public form visible with submission disabled.

## Break-first Safety workspace (November 2026)

`/safety` opens the division break board and shared discussion. `/safety-flight` contains the existing pre/post-flight wizard, archive, current-class tables, clearance review, and monitoring tabs. Leaders have radio, ceiling (including custom values), and flight-location dropdowns near the top of the landing page. Restrictions live in a separate leader-only tab.

New NEST restriction reports require a reason and allow private notes; custom reasons require notes. The journal records the authenticated reporter and server timestamp. Removing an entry appends an immutable removal event and retains earlier reports. The queue cross-checks all active NEST restrictions and the last successful school No Fly snapshot. A held member can join but sees the teacher dialog and a grey entry; departure remains blocked server-side. Other members never receive restriction reasons/history or the school list. Held entries do not prevent the next eligible member from being dispatched.

`SafetyBreaks.js` serves role-checked flight notifications and report details. Safety officers, managers, assistant managers, inventory directors, and authorized administrators receive flight-in-progress, pending/No-Go, cleared, and post-flight/maintenance notices. Inventory directors receive operational report details, not restriction reports, health answers, or clearance codes. An airplane link/badge follows authenticated leaders across pages using `main.js`; reads recheck current roles. Read markers store only event IDs locally.

The supplied flight Google Calendar is read-only. Current all-day Fly Day events flag that day; upcoming notices remain tied to the same calendar. Existing office-email automation is untouched. Calendar access failure does not suppress checklist notifications.

The official FAA NOTAM page checks its acknowledgment cookie every 30 seconds and can return to the welcome screen in a third-party iframe. The inline NEST wrapper retains the findings-to-form workflow and provides a primary named FAA window, verified to load its search after acknowledgment. The legacy embedded FAA view is optional and labeled browser dependent. No FAA acknowledgment, CAPTCHA, or cookie restriction is bypassed.

## Automatic floating flight clock

Safety and Drone piloting pages show a floating clock for the current trimester’s Drone Piloting periods, supplied as non-identifying `dronePeriods` catalog metadata. It follows the current period by Pacific wall-clock time, independent of the selected division. The same live published bell feeds used by the Bell Schedule page supply today’s class times, including assigned lunch adjustments and special schedules. Both feed dates must match, and a previous day’s timetable never produces a flight countdown.

The flight window runs from the period bell to ten minutes before the ending bell. At that cutoff, remaining flight time stays at 00:00 and the panel says to land and complete post-flight checks, with the remaining period time below. Before a drone class it shows the next start time; after the final drone period it hides. It recalculates from the actual time every second, resynchronizes when the tab returns, refreshes feeds/catalog every five minutes, can be minimized, and clears when signed out. It is a time reference; it does not change clearance permissions or submit reports.

## Today’s transition and post-flight photos
Safety officers, managers, assistant managers, and administrators can set 0–60 whole minutes before the selected drone period’s end bell for landing and post-flight transition. The default is 10 minutes. Settings expire at midnight Pacific, use the live bell schedule, and reach open Safety pages through the 30-second workspace refresh. Saves append an idempotent `flight-transition` audit event.

Post-flight damage reports accept 1–8 JPG, PNG, or WebP photos, up to 20 MiB each and 80 MiB total. `scripts/safety-upload-entry.mjs` bundles to `js/safety-upload.js` with esbuild. Direct, resumable uploads use `/api/safety-upload` and private Google Drive folders; the normal checklist request carries only paths. Earlier Blob uploads remain readable for compatibility. Preparation, token generation, completion and attachment verify current enrollment and division ownership. Completion checks size, type, and image signature. Retries retain upload IDs and completed files. Raw recorder column 33 retains the first photo; the atomic submit audit event preserves all paths without changing the 38-column recorder. Authorized media requests select an attachment index and stream privately. The shared pre-flight archive includes no damage photos.

## Google Drive report folders
Canonical new post-flight photos upload directly to Google Drive through owner-authorized resumable upload sessions. Reports are stored at Curriculum(NEST) / Course_Drone Piloting / Flight Safety Reports / school year / trimester / division / report. Each report folder contains Flight report.txt, Flight report.json, and Photos when provided. These are operational summaries: detailed health answers and clearance codes are excluded. No Drive sharing is granted; leaders retain scoped website access, and the administrator gets a Drive archive link.

SafetyDrive.js uses the existing drive.file scope. The script creates its own private root, which is moved into the verified curriculum folder before uploads are enabled. A five-minute SafetyDriveSync trigger archives pending flight-review, flight-complete, and submit events. Successful writes append drive-archived markers, making retries and backfill idempotent. Failures leave a report pending for retry without duplicating the checklist. The signed server bridge can run safety-drive-worker setup/sync. Website setup and sync controls require a fresh administrator session; anonymous callers cannot run the worker. Previous private Blob media remains readable through the same authorized endpoint, and historical report summaries retain protected links for those earlier attachments. The existing spreadsheet recorder and No Fly data remain unchanged.


## Compact Safety landing page (November 6, 2026)

The Safety landing page contains the shared bathroom break board, daily radio channel, and inline private NEST™ No Fly management for authorized safety leaders. Drone ceiling, flight location, flight transition, notifications, and checklists live in Drone piloting. Flight settings are collapsed on non-fly days and never block radio publication. Each setting publishes on selection; custom values publish when the completed text field loses focus. Green/yellow status appears under each control. Daily setting events merge within a Pacific calendar date and reset on a new date.

Flight notifications default to collapsed and support individual/bulk dismissal stored per account in the current browser. Dismissal does not remove reports. Bathroom sign-up toggles show pending feedback immediately and update from a confirmed save without waiting for a full flight workspace reload. Students in line see their highlighted entry and position or out/teacher status; the join button is hidden while their request is active.
