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

## Finished List skill coverage activities

Six additional Solo, Partner and Team activities cover the ten previously unused skill categories: Google Sheets project planning, Google Docs peer review, a changed-brief Tinkercad challenge, a MakeCode peer workshop, Twine team storytelling and an independent PhET investigation. Their activity prompts require evidence of the skill rather than relying on a tool name alone. Definitions and stable request IDs are recorded in data/finished-list-skill-coverage-2026-10-19.json; additions use the existing authorized resource workflow.

Finished List activities now store a `mode` of `solo`, `partner`, or `team`, editable alongside their purpose and skill tags. The page shows a consistent silhouette badge and combines the work-style filter with skill and text search. Older clients may omit `mode`; updates preserve the current choice. Legacy instruction disclosures are no longer displayed or searched. The approved 30-activity content refresh in `data/finished-list-uniform-activities-2026-10-19.json` uses a consistent skill/task/submission pattern of 53–56 words, preserving existing links, tool icons, and skill tags.

The project planner activity now uses Zoho Projects' Free-plan signup link instead of the generic Google Sheets landing page. The replacement in `data/finished-list-zoho-project-planner-2026-10-19.json` updates the existing resource in place, retaining Solo mode and its project/time-management skills. Its 54-word purpose uses tasks, due dates, and status updates available without paid time-tracking features. Plan availability verified against Zoho's official pricing page on 2026-10-19.

The separate Google Sheets Gantt chart activity is recorded in `data/finished-list-sheets-gantt-2026-10-19.json`. It links to Vertex42's Simple Gantt Chart page, instructs learners to use its Google Sheets option, and reuses the official Sheets icon. The Solo activity develops Manage Projects, Manage Goals & Time, and Apply Technology through scheduling, progress updates, and revising a real class-project timeline. The publisher's template is linked rather than redistributed.

`/google-accessibility-guide` provides six student how-tos for Google Translate, Chrome Reading Mode / Read Aloud, Google Docs Voice Typing, Google Docs document translation, Chrome Live Caption, and Chromebook Select-to-Speak. It retains the NEST header/footer and is linked from the Finished List introduction. The six activity definitions in `data/finished-list-google-accessibility-2026-10-19.json` link directly to their guide sections, use the existing work-style and skill filters, and distinguish device requirements, live captions from saved transcripts, and Chromebook Plus translation from ordinary captioning. The guide includes Google's official instructions and does not require paid Meet translation or any new district permissions.

## October 26 project members

Assigned service tickets support multiple project members chosen from the current student roster. The current PM, their division manager/assistant manager, and the three configured website owners may replace the member list. Client relations directors retain their existing ticket rights but do not gain membership management solely from that title. The school bridge checks current identity, role, roster, ticket version and assigned PM on every write; clients cannot supply display names or permission flags.

Membership is an append-only `members` event in the existing ServiceWebLog sheet. The saved snapshot survives ticket close/reopen without adding columns. Each change also records actor, timestamp and added/removed student names in the workbook log; the UI shows a dedicated immutable membership history. Current assigned members receive ticket editing/status/email access and may correct/delete only their own notes. Removing a member or removing them from the current roster revokes member-derived access at the next server check. Membership management never grants PM reassignment rights.

The searchable multi-select has a separate save action. Unsaved membership choices and normal note/status drafts cannot overwrite one another. The saved list and audit log refresh in place. Client email summaries put member names directly below the Project manager row with mailto links; internal notes remain excluded. Existing PM-copy and deliberate client-email behavior are unchanged.

Release checks cover role denials, member access/removal, stale writes, roster validation, close/reopen persistence, email markup and UI saves. No production membership or client email is changed merely for verification. School source is pulled in full and only ServiceRequests.js is replaced; all other live files/scopes remain byte-identical. Website releases are based on the exact current production source so unrelated uncommitted releases remain intact.

Production release: school version 102 and Vercel dpl_CqDymSaeqX5RJSFdR2cG9nCUNjKE. All 77 focused service tests pass, including compatibility with cached pre-membership HTML. Live owner access, roster choices and student search were verified on an assigned ticket; no membership was saved and no emails were sent for testing. Both domains serve matching final assets. Draft PR116 records the scoped change; production is based on dpl_Ctv6xXCBJCYeis1KafDm25QXsBv9 to preserve unrelated direct-release differences still absent from main.

Checkbox follow-up: normal ticket drafts previously disabled membership controls. Members can now be selected and saved while preserving unsaved status, PM and note fields against the returned version. Membership inputs never mark the normal ticket form dirty. All 78 focused tests pass; live Chrome reproduced disabled controls with an unsaved note before the fix and enabled controls afterward. Release dpl_GgY48m9X79MyCcurNU5ibGEDc82U preserves the exact preceding production files, changing only service.html and js/service.js. School bridge remains version 102. No production ticket changes were saved for verification.
