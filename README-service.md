# NEST service requests

## October 17 status access and readability

Status changes now use a separate canChangeStatus permission. Assigned current project managers retain access to their own tickets. Current division managers and client relations directors may change any ticket status, including unassigned and historical assignments. Existing division-scoped note, assignment and email permissions remain in force; note edit/delete stays original-author-only except website owners. Current assistant managers retain their existing own-division rights. Both director title word orders are recognized. Mutations recheck current school roles and ticket versions.

The Git source service module was reconciled with the freshly downloaded live school module before applying this change, preserving note revisions, author checks, email audit/formatting, automatic PM copies and unassigned-ticket routing. Twelve school modules were preserved, with only ServiceRequests changed; no scope changes.

Division HQ Trip-o-meter assignment headings render white in editable and read-only views. Quick Access bridges its ten-pixel hover gap and keeps the menu open for a 450ms pointer grace period; re-entry cancels closing. Keyboard focus, explicit click pinning, outside click and Escape are preserved.

Validation:81 focused tests pass. Full suite354 of356 pass; the two unchanged failures in resource-viewer and eagle-menu tests also reproduce on untouched origin/main. Assignment heading computed colors were checked with the full shared style stack. School source was independently pulled back and matched all12 staged modules before release. No live student tickets were changed or emails sent for verification.

## October 19 Trip-o-meter width control

Assignment and student-name columns now resize down to 64px (previously 120px and 130px). The table no longer stretches small columns to fill its viewport. Narrow columns wrap their headings and stack score/fill controls. Assignment widths remain shared per period; student-name width remains a browser preference per signed-in account and period. Existing widths and upper limits are preserved.

The school Tracker validation must be released alongside the frontend to accept the new lower bound. The live bundled Code module is patched in place, preserving all other school modules and the manifest.

## October 19 Finished List editing and skills

The authenticated NEST owner/supervisor can now add and edit Finished List resources alongside the previously authorized current positions. Role and membership checks run again for every write. Edits preserve original activity instructions and use resource versions plus request IDs to prevent stale overwrites and duplicate retries.

Skill choices come from NEST Database → Location_Lists_Inventory_OSPI_21stCenturySkills!R2:R1002. Resources accept multiple skills; text search includes them and the category dropdown filters by any selected skill. All 17 original activities receive initial skill assignments and local icons, with official website icons where available. Existing custom descriptions, uploaded icons, and chosen tags are preserved when enriching older saved data.

Editors may upload PNG/JPEG/WebP icons. The browser creates a 128px raster thumbnail, and both servers validate bounded raster payloads or local icon paths. The shared header and footer remain visible while the Finished List workspace scrolls. Website icons are self-hosted with sources recorded in assets/finished-list/SOURCES.md.

Validation: 17 focused tests cover supervisor access, role revocation, skill/category search, migration, version conflicts, idempotent updates, upload conversion and image validation. Desktop and 390px browser checks confirm fixed navigation, multiple skill editing and saving. The full suite retains only its two previously documented unrelated failures. Browser file selection is restricted by the Chrome extension's file-URL setting; the conversion/save pipeline is tested separately without changing that setting.

## Finished List deletion

Existing-resource editors now show Delete tool. Confirmation identifies the resource and explains that its link, purpose, icon and tags will be removed for everyone. The server checks current editing rights and the resource version under the same write lock. Deleted content is removed from storage; minimal request metadata makes retries safe and prevents delayed add requests from recreating a deleted tool. Original seed activities do not return after deletion. A refresh resolves uncertain deletion responses without discarding unrelated resources.

Validation: 21 Finished List tests pass, including denied/stale deletions, persistence, cancellation, retry recovery and prevention of resurrection. Existing production resources are not deleted during verification.

## Finished List eight-tool expansion

Added Tinkercad Circuits, Microsoft MakeCode for micro:bit, PhET, Datawrapper, Checkology, Zooniverse, Twine and Desmos 3D through the existing authorized resource workflow. Each entry includes a project prompt, finish requirement, selected database skills and a self-hosted official tool or publisher icon. The content and stable retry IDs are recorded in data/finished-list-expansion-2026-10-19.json. Existing resources, custom icons and prior deletions remain unchanged.
