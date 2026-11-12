# Software Technician export destination and insertion correction — 2026-11-12

## Requested behavior

Export only to the selected division’s Software Technician individual deck in Division Leader Slides. The user clarified that each export should add a new slide. Insert the chart as a regular image with margins so the leader can resize, move or remove it. Preserve every existing slide and object. Never write to the manager slideshow.

## Implementation

- `google-control-center/TechGraphicExport.js` resolves exactly one Software Technician presentation inside the division’s leader-source folder; it no longer enumerates manager deck files. A new explicit export appends a blank slide with a centered image and margins.
- V3 markers and request records isolate this behavior from the earlier two-deck and existing-slide implementations. An exact retry rechecks authorization and recovers its existing image/slide. A new request UUID creates a new slide.
- `api/tech-slide-export.mjs` accepts only one Software Technician destination link. Existing snapshot validation, live role checks and private-data exclusion remain.
- The website explains the new-slide behavior and returns the source-deck slide link.

## Published runtime

Control Center version 18, existing stable deployment. School runtime remains version 194; no school source was changed. Website deployment `dpl_78GP84tTXdSv4WpJte9eBKURW9G2` is READY and aliased to https://gknest.org. Website source was prepared from the previous isolated production release with only the export API, ticket UI script and two ticket page cache versions changed.

An accidental deployment started from the dirty working directory (`dpl_DCJqSzSfFkuZzDds8tnVZhusXyup`) was canceled during BUILDING, before production aliasing. It did not reach READY. The isolated deployment above is the published release.

## Preservation and verification

49 focused export and ticket tests pass. Coverage includes single-deck resolution, unchanged existing content, a new slide for every new request, exact retry deduplication, recovery after losing the completion record and live authorization revocation.

The manager’s original export image had already been removed when inspected. Only its empty generated page was removed; all ten remaining manager slides were preserved. During verification before the user’s new-slide clarification arrived, one V2 image was inserted on the existing Software Technician slide; that exact QA-created image was removed after the clarification. The six original role-slide objects and the prior V1 source export page were preserved.

Live final verification succeeded through the authenticated production UI for Division 1. The result linked only to the Software Technician deck and newly appended page `SLIDES_API600666601_0`, containing the independent image `SLIDES_API600666601_3` with a V3 request marker. The deck now has three pages: its original role page, the preserved older V1 export, and the new V3 export. All six original role-page objects and the old V1 export page matched their prior content and geometry (excluding expiring image content URLs). The manager deck remained at revision `A2TpLq5eyplsEg` with all ten pages unchanged. The Google Slides editor visibly showed the new slide and ordinary chart image with margins. Screenshot: `tmp/tech-insert-fix/software-tech-new-slide.png`.
