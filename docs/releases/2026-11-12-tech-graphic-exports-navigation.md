# Tech graphics and persistent navigation — November 12, 2026

## Delivered behavior

- Earlier Google Form history shows only the TechTickets response tab; Builder and both barometer spelling variants are excluded by an allowlist.
- The room-health overview now contains the dials, issue-type bar chart, room indicators, device-count table and status table. The separate Leadership meeting tables block, copy controls and CSV control are removed.
- Select an authorized destination division once, then use Export to leader’s slide beside a graphic. Each export updates both that division's Software Technician source deck and its current manager slideshow, without rebuilding other content.
- LinkedIn in About Me uses the existing NEST™ Universe departure confirmation before opening externally. Shared runtime normalization also covers dynamically inserted footers and prevents duplicate resource dialogs.
- Shared page headers and footers stay fixed during scrolling, including the top-left NEST™ eagle/menu icon. ResizeObserver measures both bars and reserves body space so the end of page content remains reachable. Only direct page-shell headers are pinned; dialog headers remain inside their dialogs.
- Quick Access → Join Us consistently goes to `/hiring`, the native landing page leading to the HTML application forms. Older static headers still held the Google Form URL; this is now repaired in static pages and guarded by shared runtime normalization. Shared templates already used the correct native route.

## Source and permissions

School: new `google-spinner/TechSlides.js`, updated TechTickets. Control Center: new `google-control-center/TechGraphicExport.js` and one protected operation branch in NestDivisionWeb. Existing credentials, OAuth scopes, manifests, role policies and sharing remain unchanged. Server and Control Center independently recheck current destination permissions. Exported PNGs contain room-wide aggregate data only; private ticket text, identities, notes and screenshots are excluded.

API/rendering: `api/tech-slide-export.mjs`, `lib/tech-slide-graphic.mjs`, bundled OFL fonts in `lib/tech-slide-assets`. Clients cannot choose arbitrary deck IDs, images or statistics. The model version is rechecked before the write. Action IDs prevent duplicate exports and allow a partial two-deck operation to finish safely. A marked image slot is reused per graphic/school year; unrelated slide elements and notes remain intact. Large device exports summarize the top 12 plus Other, preserving totals. Exports are timestamped image snapshots, refreshed by exporting again.

UI: `js/tech-tickets.js`, ticket HTML and CSS; shared navigation in `js/main.js`, `js/resource-viewer.js`, `css/nest-shell.css`; static Join Us/LinkedIn links and shared footer templates. Other unrelated dirty working-directory changes were excluded from publication.

## Releases and verification

School runtime **194**, **47 modules**. Control Center runtime **16**, **9 modules**. Backups, exact readbacks and isolated website source are retained under ignored `tmp/tech-graphic-export/`. Unrelated school/control modules and manifests were preserved.

Production website: **`dpl_2datHYSxGteMVfiqx9N3fr7n9Qvd`**, READY at https://gknest.org. The isolated release derives from the previous verified production tree, with scoped feature files and navigation replacements. Never deploy the entire dirty repository as a continuation shortcut.

**65 focused tests passed**, plus **4 checks against the assembled release's navigation**. Coverage includes response-tab filtering, aggregate privacy, current division export authorization, server-rendered-only images, same-ID retry, partial two-deck retry, image-slot reuse with annotation preservation, existing manager-rebuild safety, LinkedIn confirmation, and native Join Us links in every static Quick Access menu.

Live verification:

- Earlier history exposed only TechTickets (131 data rows); no helper/barometer tabs.
- Selected Division 1 and exported the Open tickets dial through the actual website. Saved image presence was independently read back from both decks, with the expected graphic/year marker.
- Source slide: https://docs.google.com/presentation/d/1P4PspJuZl1_REOt1Wn6pkz_S-ZU5nIlS8AkwIfuCNUs/edit#slide=id.SLIDES_API136890717_0
- Division slideshow slide: https://docs.google.com/presentation/d/1gqZ-iyiFJy16NpoEtw4bFOoTl39778Gdy4DriRw0mI8/edit#slide=id.SLIDES_API791493122_0
- Export used the actual room overview (0 open, 1 closed validation ticket), not fabricated classroom issue data. Those graph slides remain available for review. No emails, sharing changes, full deck rebuilds or real ticket edits occurred during this release check.
- After scrolling to the archive, header position was fixed at viewport top 0; footer position was fixed at viewport bottom; the NEST menu icon remained visible.
- Quick Access showed Join Us → `/hiring`.
- LinkedIn showed “You are leaving the NEST™ Universe for LinkedIn,” with Cancel and Continue. Cancel returned to NEST without opening an external page.
- Anonymous access to the new export API returned 401; the live authenticated export completed successfully with the bundled renderer/fonts.

Local screenshot evidence: `tmp/tech-graphic-export/overview-export.png` and `linkedin-confirmation.png`. Those images and signed Google image URLs are not Git artifacts.
