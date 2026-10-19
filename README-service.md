# NEST service requests

## October 17 status access and readability

Status changes now use a separate canChangeStatus permission. Assigned current project managers retain access to their own tickets. Current division managers and client relations directors may change any ticket status, including unassigned and historical assignments. Existing division-scoped note, assignment and email permissions remain in force; note edit/delete stays original-author-only except website owners. Current assistant managers retain their existing own-division rights. Both director title word orders are recognized. Mutations recheck current school roles and ticket versions.

The Git source service module was reconciled with the freshly downloaded live school module before applying this change, preserving note revisions, author checks, email audit/formatting, automatic PM copies and unassigned-ticket routing. Twelve school modules were preserved, with only ServiceRequests changed; no scope changes.

Division HQ Trip-o-meter assignment headings render white in editable and read-only views. Quick Access bridges its ten-pixel hover gap and keeps the menu open for a 450ms pointer grace period; re-entry cancels closing. Keyboard focus, explicit click pinning, outside click and Escape are preserved.

Validation:81 focused tests pass. Full suite354 of356 pass; the two unchanged failures in resource-viewer and eagle-menu tests also reproduce on untouched origin/main. Assignment heading computed colors were checked with the full shared style stack. School source was independently pulled back and matched all12 staged modules before release. No live student tickets were changed or emails sent for verification.

## October 19 Trip-o-meter width control

Assignment and student-name columns now resize down to 64px (previously 120px and 130px). The table no longer stretches small columns to fill its viewport. Narrow columns wrap their headings and stack score/fill controls. Assignment widths remain shared per period; student-name width remains a browser preference per signed-in account and period. Existing widths and upper limits are preserved.

The school Tracker validation must be released alongside the frontend to accept the new lower bound. The live bundled Code module is patched in place, preserving all other school modules and the manifest.
