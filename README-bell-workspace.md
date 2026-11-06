# Bell Schedule Studio — phase 1

Owner workspace: `/bell-workspace`. The owner-only link also appears on `/bell-schedule` after NEST sign-in.

The workspace manages draft templates, date assignments, teacher profiles, lunch variations, and parallel assembly/activity groups. All times are explicit 24-hour Pacific wall-clock values. The preview resolves one teacher's day and reports overlaps; halls-open time may intentionally overlap zero hour. The Signals preview is informational.

## Live-system boundary

This release does not change the existing published feeds, spreadsheet, Apps Script triggers, Signals player, classroom/guest teacher slides, or calendar outputs. Saving creates a draft in the website backend only. There is no live activation operation in phase 1.

## Source import

`lib/bell-schedule-import.json` captures the 23 templates, lunch rows, and five upcoming date assignments read on November 6, 2026. It is reference input, not a recurring synchronization. `lib/bell-schedule-seed.mjs` converts it into editable records. The Veterans Day draft uses the two paths and exact lunch/period times in the November 6 assembly PDF. Only Penalver's teacher profile and Assembly A assignment are seeded; other teacher assignments must be entered. Historical source inconsistencies remain review notes or preview errors. The initial GET has no write side effects; Save imported drafts / Save draft persists the initial workspace.

## Backend and access

`/api/bell-workspace` re-verifies the active NEST session using the existing school `auth-me` bridge on every request. Only the existing three owner email identities may read or write. Student leaders, staff delegates, and anonymous visitors cannot read drafts or history. POSTs require an allowed origin and JSON content type. Responses are private/no-store. Existing server-only bridge and private Blob credentials are reused; no new credentials are exposed in the page.

Drafts are stored at `bell-workspace/v1/state.json` in the existing private Vercel Blob store. Each save writes an immutable snapshot under `bell-workspace/v1/revisions/`, then conditionally updates the head using its ETag. Initial creation disallows overwrite. Expected-revision checks and ETag conditions prevent concurrent editors from silently losing work. The latest 30 referenced saves can be restored; older immutable snapshots remain stored without automatic deletion. Restoring writes a new revision. User draft data and history are private runtime records, not committed to Git.

Operations: GET returns the workspace; POST `save`, `restore`, or `preview`. Saves require `expectedRevision`; preview accepts an optional unsaved workspace and resolved date/teacher/group/lunch choices. Structural validation rejects malformed references and times. Schedule conflicts are displayed while drafts remain editable. Download draft exports an independent JSON backup. On a conflict, download unsaved changes before reloading; phase 1 has no automatic merge or JSON re-import.

## Verification

`node --test tests/bell-workspace.test.mjs` covers both Veterans Day paths, lunch slicing, no-school, Fly Day/absence previews, Pacific date boundaries, bad input, authentication, source isolation, save/read/restore, simultaneous saves, UI save/reload, and sign-out during an in-flight read.

## Next phase

Add a reviewed publication model and explicit activation, connect public schedule/flight-clock consumers, then Signals with activity-aware quiet/cleanup policies, followed by Slides and calendar adapters. Preserve existing absence, enrollment, Fly Day, robotics, and planning behavior. Resolve the website published-feed owner and replace calendar delete/recreate with stable managed event updates before switching those outputs. Keep old outputs running until each adapter has been compared and verified.

## November 6 release

Production deployment: `dpl_6whVjBuFwHaHPDUWbLbT7etPTexA` at `https://gknest.org/bell-workspace`. Source verification preserved 350 existing production files byte-for-byte; only `bell-schedule.html` (owner navigation link) and `vercel.json` changed, alongside nine new files. All 1,078 repository tests passed. Browser checks exercised edit/save/history on the isolated local fixture. Anonymous deployed API access was denied. The existing live bell renderer and flight-clock scripts matched their previous source after promotion. Authenticated production save/reload remains a separate owner-browser check.

Git source backup: `b31adb0` on `codex/nest-postmark-communications` contains accumulated website updates and phase 1. `ddd65c1` on `backup/nest-live-2026-11-06` additionally preserves the verified deployed application source where it differs from the working branch. Local captures, release bundles, environment files, and runtime draft records are excluded.
