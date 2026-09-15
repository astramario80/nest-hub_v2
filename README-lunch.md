# NEST lunch assignments

## Trimester workflow

Upload or replace the trimester lunch PDF in the existing Live_Lunch Assignments folder:
https://drive.google.com/drive/folders/1uZMZ1kgGk0TiZZuut4voigcWT0-APO_0

The newest modified PDF wins; creation time breaks a tie. Old files can remain in the folder. Updates become visible within about five minutes after reopening the lunch panel. No PDF file ID, staff list, or trimester is hard-coded.

## Service

Google Apps Script project: https://script.google.com/d/17ScgI7u1h2BxUf-fp95l11mEROtsRW1aQiUNFmCRY03H5Vz34bfoRXr7/edit

The bridge executes as its owner and uses read-only Drive access. GET and incorrect POST keys return an authentication error. Its fixed folder is the only source. A SHA-256 digest verifies a server-only random key; the actual key lives in Vercel's encrypted LUNCH_BRIDGE_TOKEN setting. LUNCH_BRIDGE_URL identifies the deployed script. Neither setting goes into browser JavaScript. The PDF is transferred only to the site's server; `/api/lunch` returns the parsed table and source name/date.

The owner must authorize the script's read-only scope once in Apps Script. Run `authorizeLunchFolder` to confirm folder access. The web app deployment must execute as the owner and allow incoming requests; the application-level key protects the payload.

`lib/lunch-parser.mjs` uses the three LUNCH headings to locate columns. It preserves names across split PDF text fragments and validates lunch times and planning staff. Text-based PDFs with the same general three-column structure update automatically. Scanned image-only PDFs or substantially different layouts show the source-folder fallback instead of potentially incorrect data. PDFs over 5 MB or five pages are rejected. No last-trimester data is silently served on extraction failure.

## Verification

`npm test` covers disclosures, keyboard dismissal, nested links, Pacific period timing, passing-time boundaries, stale schedule dates, changing PDF staff counts, malformed PDFs, and authenticated newest-file selection. Tests use synthetic staff names. The actual T1 26–27 PDF was separately checked locally against all three staff columns, all four time variants, and planning staff.

Passing time between scheduled rows is included in the next period’s marker; before the first row and after the final row remain unmarked. The current-period marker uses America/Los_Angeles time, refreshes every 15 seconds, and only highlights a schedule whose date matches the current Pacific date. Schedule feeds refresh every five minutes and when a backgrounded page is revisited.
