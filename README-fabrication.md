# Fabrication requests

The public queue is `/print-queue`; supervisors manage requests at `/print-management`. The existing Form remains embedded and the original workbook remains the data source. The school bridge now includes `Fabrication.js`. Production deployment 27 already contains these actions.

Current Fabrication Supervisors, Division Managers, Assistant Managers, and CTSO Chief Executive, Financial, and Operations Officers have management rights based on the live Imported roster. Owner accounts retain administrator access. Linked manual accounts use their verified student identity. CFO and COO access activates when those roles appear in the roster.

Status, internal notes, and audit history commit together. Public updates expose only an opaque request ID, equipment, status, and intentionally public update messages. Names, emails, uploaded files, internal notes, and legacy sheet history are management-only. Legacy statuses Printing and Stand by display as In progress and On hold. Archive and Library records remain outside the active queue.

Requests are read by header labels, including new equipment/process fields. Incoming responses that have not been routed to a machine tab can be managed through the audit log without altering raw form answers. Keep Timestamp, Email Address, and requester-name questions recognizable. After changing the Form, verify a laser, WAZER, and Bambu sample against the actual final questions before treating the expanded form as fully tested.

Email is a separate deliberate action to the stored submitter address. It sends the latest saved status and public update only. A send reservation blocks duplicate attempts; uncertain delivery is marked for manual review. No student emails were sent as deployment tests. Public and management views refresh every 30 seconds; unsaved drafts pause refresh. Search and filters operate on the current page (50 requests).

Queue limits: at most 40 tabs, 5,000 rows per tab and 20,000 audit events. Duplicate submission identities are excluded to prevent updates to the wrong row. Request IDs survive normal row sorting; changing the timestamp, email, or requester name creates a different identity. Apps Script locks serialize website writes, but spreadsheet editors and the old queue script do not share that lock; avoid simultaneous website and sheet changes during migration.

The leadership-bound script now normalizes requested role keys and includes CFO/COO in fabrication sharing. The queue-bound notification scripts use Fabrication Supervisor and exclude FabricationWebLog from printer processing. Original school-script source backups are saved outside the site repository in fabrication-work.
