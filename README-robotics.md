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
