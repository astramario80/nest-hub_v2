# CTSO Member Status in Division HQ

The CTSO-only Member Status tab manages active/inactive membership, accepted FIRST youth registration, parent consent and reminder previews. Mario and current rostered CTSO CEO/CFO/COO roles can open it and edit CTSO assignments. CTSO delegation is disabled; other divisions retain existing permissions.

## Website authority

Membership and imported FIRST data are owned by the website. The CTSO spreadsheet is only persistence: the dedicated `Website Member Status` tab stores membership in A:E and FIRST records in H:L. Existing membership and FIRST records are copied once, under the script lock, with a durable migration marker. Later legacy spreadsheet scripts and Program of Work changes are not read or written. The old Refresh from Program of Work control is removed. Legacy refresh requests reload without importing data.

The existing legacy tabs and Program of Work remain intact. Duplicate membership identities appear with review warnings; their status edits and reminders are blocked. Their row IDs remain unique. Other members remain usable. Member Status writes update only its own storage tab.

FIRST status still comes from pasting Accepted Youth dashboard records. Pending and declined records are excluded. Notification recipients must match live CTSO roster IDs and district emails, and only active members qualify. Recipients and messages are previewed before confirmation. Preview tickets bind to the actor and revision; claimed tickets never resend on retry. No student emails were sent during verification.

## Deployment

1. Update Robotics.gs in the existing school bridge with google-spinner/Robotics.js. Earlier Code, DivisionSlides and Tracker integration remains required. Preserve existing project configuration, token and deployment URL.
2. Publish a new version of the existing owner-run Apps Script web-app deployment. The school owner requires Sheets read/write access to CTSO. The first authorized website load creates and seeds Website Member Status once.
3. Publish the website label and removed refresh control. Existing #robotics bookmarks remain valid.
4. Verify membership loading, duplicate warnings, an individual status save, and reminder preview. Confirm later Program of Work changes do not affect website records. Send no reminders without reviewing the recipient list.

Validation: 66 focused tests passed, covering website-only writes, one-time migration, ignoring legacy/POW changes, duplicate review controls, roles, conflicts, FIRST parsing, reminder retries, HQ and tracker flows. Live verification depends on the school deployment and an authenticated NEST session.


## Signup and private profiles

Member Status now includes Members, New Members, Onboarding Steps, and My Profile. Inactive records are in a separate collapsible table. Active students can read their own submitted form answers and edit contact fields. School account email, identity, consent answers, uploads, and acknowledgments remain read-only. Current rostered CTSO CEO/CFO/COO/EVP and Mario can process signups, edit contact information, and manage onboarding steps. Partner Liaisons receive signup notifications but cannot access profiles. EVP access here does not grant tracker assignment editing.

The correct source form is `1ROTm1QXYvOzRUh3TVeNDQNhXmxRrYxNayzxZHvBI1cg`. Installable Form submit events capture all answered questions dynamically, including upload IDs, without changing the form. Account identity comes from collected respondent email, not a user-editable answer. An executive explicitly approves activation against a verified NEST roster identity. Unmatched applicants stay in the review queue.

Private answers and protocol settings live in a separate, owner-private workbook created by setup. They never enter the shared CTSO spreadsheet or public page bootstrap. Do not share that private workbook with the team or enable link sharing. Public API responses are authenticated and marked no-store; students never receive other profiles or the leadership queue. Existing verified membership profiles attach to their latest historical form response during setup. Historical submissions remain silent. A missing historical response gets an editable contact-only profile.

Protocol settings are seeded once from legacy NewMemberProtocols columns A:C, then managed only on the website. Stable step IDs preserve progress when wording changes; retiring steps preserves history. Token-bearing legacy URLs are excluded and the FIRST Dashboard link is replaced with a stable URL. Notification emails contain escaped rich links for active steps. Profile and protocol edits use revision checks to prevent overwriting concurrent edits.

The submit trigger sends the applicant a receipt and the next `NEST™ Robotics Weekly` or meeting event from the club calendar, in the calendar’s timezone. It includes the supplied Google Calendar add link; once subscribed, the applicant can enable that calendar in their device’s calendar settings. If no future meeting exists within 180 days, the receipt says the club will confirm the date. Current rostered executives, a hired Partner Liaison, and Mario each receive a processing notice. Recipients and message contents are frozen before delivery. Each recipient is claimed before sending; repeat triggers and retries cannot send duplicates. An hourly worker retries unclaimed work after quota or temporary lookup failures. Failed or uncertain claimed deliveries remain marked “Needs review”; check school sent mail before a manual follow-up.

### School owner setup for this change

1. Preserve the existing combined Code.gs; update Robotics.gs and DivisionSlides.gs from this repository and add RoboticsOnboarding.gs from google-spinner/RoboticsOnboarding.js. The existing auth-robotics route and script lock in Code.gs remain required.
2. Review and add these scopes to the existing manifest: Forms access, Calendar read-only, and Apps Script trigger management (see google-spinner/appsscript.json). Preserve all other project settings and scopes. These are new authorizations; no live scope changes or trigger installation were performed during development.
3. In the school owner account, run `roboticsSetupOnboarding` and authorize. The owner must edit the source form and read the club calendar. Setup creates private storage, migrates protocols, imports historical responses silently, and installs the form submit and hourly pending-work triggers. Repeating setup is safe.
4. Review any old membership notification triggers in the legacy project and disable the obsolete notification handler before enabling new live submissions, to avoid two separate projects sending welcome mail. This setup cannot enumerate or disable triggers owned by another project/account. Do not disable unrelated robotics or calendar scripts.
5. Publish a new version of the existing school web-app deployment; retain its URL and owner-run execution mode. Publish the website changes after the bridge is ready.
6. Verify with an authorized, real applicant: submission appears in New Members; receipt has the correct next meeting and calendar link; leadership receives checklist links; activation exposes only that member’s profile; an inactive member cannot access profiles. Development tests use synthetic data and send no real emails.
