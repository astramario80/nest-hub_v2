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
