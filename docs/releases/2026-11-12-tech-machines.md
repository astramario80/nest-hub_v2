# Tech Tickets and room machines — November 12, 2026

## User decisions

- Replace Google Form ticket intake with an embedded HTML form on `/tech-tickets`, linked from Help & Support.
- Require NEST sign-in before exposing the form; no redundant sign-in control inside it.
- Keep a compact, translucent, movable site-wide Report a bug button with reviewed screenshot capture.
- Students see their own tickets and updates. Current Software Technicians manage issues, archives, leadership tables and visible-tab alerts. Room health uses aggregate charts.
- Only Mario's explicitly configured identities select recipients and send outside escalations. Techs escalate to Mario. Recipient directory is Notifications H:J in the NEST database; software requests recommend CTE TOSA, general issues Tech Support. Preserve the original email format.
- Computer reports select one or multiple current stations, with Select all/Deselect all. Hardware reports select room machines.
- Inventory owns machine name, manufacturer serial, type and uploaded icon. Eligible machines and their icons also appear in fabrication. Do not invent missing serials or pricing profiles.

## Implementation and owning source

`README-tech-tickets.md` documents permissions, storage, API operations, limits, retry behavior, and continuation pointers. `README-fabrication.md` documents fabrication integration.

New shared module: `google-spinner/RoomMachines.js`. Integration: Inventory, TechTickets, TechEscalation, FabricationIntake school modules; inventory, tech-ticket and fabrication-intake API handlers; corresponding browser scripts, forms and styles. Existing unrelated school modules and manifest were preserved.

School runtime: version **188**, **46 modules**, published to the existing stable deployment. Original 45-module source and exact published source are in ignored `tmp/tech-machines/school-before.json` and `school-release.json` on the originating machine. These files can contain private application source and are not Git artifacts.

Website: assembled from the previous production release (`dpl_3nQjQkoZ5gPLF19MmF74Br9M9ZfB`) plus the scoped file list retained in `tmp/tech-machines/release-files.json`. Never deploy the repository's entire dirty worktree as a continuation shortcut.

## Verification

82 focused tests passed: inventory authorization and editing, machine catalog propagation and icon validation, browser icon upload conversion, multi-select/all/none, sign-in gating, reporter isolation, owner escalation, fabrication machine versions, exact submission deduplication, and uncertain-submit recovery. No real email, ticket or fabrication request was submitted as a deployment test.

The earlier submission failure coincided with non-JSON responses from the school connection. A direct authenticated read succeeded. Creation now permits only an exact idempotent replay and checks the reporter's own submission reference if the response is lost. A real production ticket creation has not been verified; do not describe the outage's underlying cause as conclusively resolved.

Temporary connection-health probes were removed from the release. New machine icons have not been assigned to real machines; owners upload their chosen images through the editor.

Production website deployment: `dpl_BUP5ksPMrFL1YAHS7jbKmM5qJzvR`, READY and aliased to https://gknest.org. The preceding scoped deployment was `dpl_27ioAQSK1tspStqbjv8BzcPLCTe6`. All 11 changed public static files matched the isolated release bytes; anonymous access to the removed diagnostic route returns 401.

Live authenticated ticket form verification loaded the registered room machines and 35 stations; Select all selected 35 and Deselect all returned to zero. The editor was hidden while checking sign-in. Inventory/purchasing and fabrication access also encountered the existing school connection failure during verification; their read operations now have the same bounded transient retry as ticket catalog reads. Live icon persistence and a real ticket creation remain unverified. Browser upload conversion and shared icon propagation passed isolated fixtures.

Git records feature source and documentation, not a complete dump of the production workspace. Other independent feature work remains uncommitted. In particular, existing protected fabrication instruction media are local release assets under `lib/fabrication-media/`; recover them from the verified production/source baseline if building a release elsewhere. Do not expose them as unrestricted static files. This release was published by CLI from an isolated tree before its documentation commit, so the Vercel Git metadata refers to the earlier repository HEAD rather than this source checkpoint.

## Follow-up: screenshot ticket submission failure

The reporter confirmed the failing ticket included a screenshot and raised teacher enrollment as a possible cause. The teacher/owner exemption already exists; the catalog now explicitly returns all supported divisions for administrator accounts. An empty-roster regression confirms teacher submission succeeds without changing student access restrictions.

A separate defect affected initial screenshot-folder creation: its Drive call passed an options object into the media argument. It now uses a metadata-only folder call matching the official Advanced Drive documentation: https://developers.google.com/apps-script/advanced/drive#create_a_folder . JPEG uploads keep the actual blob in the media argument. A strict regression tests argument positions, private parent linkage, deduplicated retries and first-ticket worksheet creation.

School version 189 contains the repair; version 190 adds redacted failure metadata returned only to the credential-protected server bridge. The API logs that metadata and returns its existing generic error to the browser. Production website deployment: `dpl_AZdzG2eJvLixiuyNKFoAa9Tqq2vj`. All 84 focused tests passed. Unrelated school modules and the manifest were preserved. Private source backups and test output are in ignored `tmp/tech-submit-fix/`.

### Confirmed quota failure and server repair

Live server diagnostics subsequently identified `sheets.googleapis.com` **Read requests per minute per user** exhaustion. This is a confirmed additional cause, independent of enrollment and the screenshot-folder overload. School version **191** switches Tech Ticket authorization and ticket-state reads to a request-scoped native SpreadsheetApp context. Account activity and roles are reread each time; request maps are restored in `finally`, with no access decisions cached between requests. Owner catalog/create/result/image/access calls skip roster and leadership reads; management reads and student permission checks still use fresh sources. Existing Advanced Sheets writes are unchanged.

The common school boundary now encodes the timer context's early `status:200`/`status:401` results as ContentService JSON. Previously an idle timer could return a plain object from `doPost`, producing HTML failures and repeated retries/diagnostic traffic on every open NEST tab. Already-encoded responses pass through unchanged. This change preserves timer behavior and access rules. Only Code and TechTickets changed in the school publication; other modules and manifest match the saved baseline.

### Live screenshot verification and requested landing order

A clearly labeled owner-account ticket `796260F0` was submitted with a captured screenshot after the repair. The browser showed submission confirmation, the ticket appeared in the live queue, and authenticated View screenshot loaded the saved image. It was then closed with a public verification note. No outside escalation or email was sent. This is a separate validation record; the user's earlier unsaved draft was not changed or recreated. The original native-ticket tab did not exist before this live check, confirming there were no saved native tickets in that workbook at the earlier inspection.

School version **192** adds `canViewOverview` for current Software Technicians, Division Managers, Assistant Managers, CEO, Executive Vice-President, CFO, Operations Officers, and administrators. Overview-authorized landing users see charts and their existing ticket section before the embedded form. Others see the form first and only their own ticket section, with room charts hidden. Leadership presentation does not grant private ticket management or outside escalation. The frontend reorders actual DOM sections after its authenticated read and hides the form host during the role lookup to avoid showing the wrong initial order. Tests cover role recognition, revocation, both DOM orders, and unchanged management rights.

Final focused verification: **157 tests passed** across tech tickets, room machines, inventory, fabrication intake, school transport and safety. Website publication uses the previously isolated production tree with only the ticket API, landing script and landing HTML updated. The final deployment ID and Git source checkpoint are recorded after publication.

Final production website deployment: **`dpl_8aXJMTZhFur2HWxmX2H1rU9XezxF`**, READY and aliased to https://gknest.org. The published landing HTML and script match the isolated release bytes. The live teacher/owner page showed Room tech health, ticket totals and the ticket list above the embedded form. The ordinary-reporter ordering and leadership role matrix were verified with isolated browser/API fixtures rather than a real student sign-in. Screenshot proof is retained locally at `tmp/tech-submit-fix/overview-before-form.png`. The labeled validation ticket remains Closed for audit history.
