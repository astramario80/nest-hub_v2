# Fabrication requests

The public queue is `/print-queue`; supervisors manage requests at `/print-management`. The existing Form remains embedded and the original workbook remains the data source. The school bridge now includes `Fabrication.js`. Production deployment 27 already contains these actions.

Current Fabrication Supervisors, Division Managers, Assistant Managers, and CTSO Chief Executive, Financial, and Operations Officers have management rights based on the live Imported roster. Owner accounts retain administrator access. Linked manual accounts use their verified student identity. CFO and COO access activates when those roles appear in the roster.

Status, internal notes, and audit history commit together. Public updates expose only an opaque request ID, equipment, status, and intentionally public update messages. Names, emails, uploaded files, internal notes, and legacy sheet history are management-only. Legacy statuses Printing and Stand by display as In progress and On hold. Archive and Library records remain outside the active queue.

Requests are read by header labels, including new equipment/process fields. Incoming responses that have not been routed to a machine tab can be managed through the audit log without altering raw form answers. Keep Timestamp, Email Address, and requester-name questions recognizable. After changing the Form, verify a laser, WAZER, and Bambu sample against the actual final questions before treating the expanded form as fully tested.

Email is a separate deliberate action to the stored submitter address. It sends the latest saved status and public update only. A send reservation blocks duplicate attempts; uncertain delivery is marked for manual review. No student emails were sent as deployment tests. Public and management views refresh every 30 seconds; unsaved drafts pause refresh. Search and filters operate on the current page (50 requests).

Queue limits: at most 40 tabs, 5,000 rows per tab and 20,000 audit events. Duplicate submission identities are excluded to prevent updates to the wrong row. Request IDs survive normal row sorting; changing the timestamp, email, or requester name creates a different identity. Apps Script locks serialize website writes, but spreadsheet editors and the old queue script do not share that lock; avoid simultaneous website and sheet changes during migration.

The leadership-bound script now normalizes requested role keys and includes CFO/COO in fabrication sharing. The queue-bound notification scripts use Fabrication Supervisor and exclude FabricationWebLog from printer processing. Original school-script source backups are saved outside the site repository in fabrication-work.

## Native pop-out request form (2026-11-10)

`print-queue` opens the native `fabrication-intake` dialog, one section at a time. The current source form's Sketch Large, laser cutter, and water jet cutter choices determine the path. Optional instruction sections can be skipped. The four GIFs from Fabrication Form / Instruction Gifs are associated with SVG export, SVG download, SVG-to-DXF conversion, and DXF download. Protected, resized GIFs play on request and have still previews; original Drive files remain unchanged. Legacy shared sign-in credentials from the Google Form are not copied into the website.

Signed-in requesters choose only their own verified roster divisions. Files remain in memory until the final Submit action; closing and reopening retains the current draft in that tab, while signing out clears it. The web app prepares direct resumable Google Drive uploads (100 MB per fabrication file, 10 MB per calculator screenshot); Google Drive files are stored under a private root without inheriting the source form folder's sharing. Uncertain submission retries use the same submission identity and fingerprint. New rows enter the existing queue on `Website Fabrication`, with headers on row 3 and records from row 4. This path intentionally does not append synthetic Google Forms responses or run the legacy printer-processing triggers. Managers use the existing website queue and private downloads, authorized against current fabrication roles for each download chunk.

The existing Google Form, original responses, and original GIFs are retained. The `api/fabrication-intake` handler protects both GIF assets and native attachments; a Vercel redirect sends direct requests for `lib/fabrication-media` through that authenticated handler before static file serving. Native intake is dispatched by `FabricationIntake.js` in the school runtime. No automatic emails are sent on submission.

The Product Calculator is native HTML inside the wizard. It uses the original weight-based formula (grams / spool grams × current spool price) and adds a dollar markup. Current rates are read from Vendors Short List / FilamentCurrentPrice; the server recomputes the quote and checks its pricing revision at submission. Calculator screenshots are no longer required. The production cost, markup, selling price, material weight, and pricing revision are saved together in the queue. No external calculator link is used.

### Instruction animation repair

The 3D path now includes 11 original animations from Fabrication Supervisor / Print Instructions: Onshape export/save, Digital Factory Prepare/import, warnings/printer selection, slicing/material estimates, and download/save/naming. Login credential recordings and obsolete external calculator recordings are excluded. These animations use the same protected media handler as the four cutting GIFs. Each instruction animation starts automatically unless the browser prefers reduced motion, with pause/play, loading feedback, and a visible retry control on failure. The page versions its form script and stylesheet so existing visitors receive this fix after refreshing.

## Request-first landing page and shared space norms

The fabrication landing page starts with its request launcher and a local SVG fabrication banner. Resources groups the software and file library links. The Menu link and duplicate 3D-instruction/SOP buttons are removed from this page; the request wizard retains the instructional content and GIFs.

`FabricationNorms.js` provides the shared norms document, initially the four existing 3D-printing SOP expectations from `js/main.js`. Current fabrication management authorization is checked on every management read and publication. The public endpoint projects only title, content, and publication time. Management uses a title/body editor with a safe text preview, character limits, optimistic revision checking, and a deliberate Save & publish action. A conflicting draft is retained; an identical retry does not add another publication.

Publications append to a hidden `Fabrication Norms` history tab in the existing school-owned fabrication workbook. All versions and publisher identity remain private to the school bridge; no email is sent. That tab is excluded from the fabrication request scanner. This history is capped at 4,999 published versions before archiving is required. Frontend rendering supports plain paragraphs, headings, and bullets, with no raw HTML execution. Sign-out clears private editing state. No real manager or student records were modified for QA; publication was exercised with fictional in-memory browser/API fixtures.

## Public print-status ticker

A full-width ticker sits above the fabrication hero and lists active requests (Queued, In progress, On hold, Errored, and Ready for pickup). It reads every available public queue page and refreshes every 30 seconds while the page is visible. Anonymous viewers see the opaque request ID, equipment, and status. Authenticated NEST users also see partner names, regardless of role. The dedicated signed-in names projection excludes contact details, notes, versions, and attachments. Current managers receive direct management links from both cards and ticker; server-side permissions still protect every management read and write. Completed and cancelled work stays in the full queue without appearing in the active ticker. Unavailable updates are marked as stale rather than silently presented as current.

Ticker links use `/print-queue?request=<opaque-id>#<opaque-id>`. The public API supports a validated `id` query for stable request lookup across pagination and row movement, with the same sanitized projection as the public queue. No sign-in is required to view an order. Show all requests returns to the normal queue. The scrolling region supports pause/resume, pauses on hover, provides keyboard access, and displays a static horizontally scrollable list for reduced-motion users. Duplicate animation items are excluded from the accessibility tree and tab order.

The norms editor opens as a dialog from “Edit fabrication norms.” Protected fabrication interactions use the shared cancellable `NestAuth.requireSignIn()` prompt; protected writes are never automatically replayed.


## Shared room machine catalog (2026-11-12)

The native intake now loads equipment from Inventory & Purchasing → Equipment → Room machines. Machine name, type, serial, icon and active state come from `google-spinner/RoomMachines.js`; icon cards use the same uploaded icon as the inventory editor. Laser CNC and waterjet CNC use the cutting path. 3D printers use their configured filament pricing profile and the printing path; Other machines are excluded. Removing a machine removes it from future request choices while preserving previous requests. Backend validation rejects stale machine versions; exact saved submissions can still be recovered. See `README-tech-tickets.md` for catalog storage, icon limits, permissions and continuation guidance. Legacy static equipment strings remain accepted for compatible existing drafts.
