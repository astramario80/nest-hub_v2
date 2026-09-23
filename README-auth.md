# NEST account launch

The website and the school-owned Apps Script bridge must be updated together. The old six-hour email-code route has been removed from the Vercel API. Registration still sends one email code to prove ownership of a district address; normal sign-in uses a username and password.

## Data and deployment

- `StudentNESTAccess` in NEST Database holds `Username`, `District Email`, `Password Hash`, `Password Salt`, `Active`, `Session Version`, `Created At`, and `Last Login At`. Passwords are PBKDF2-SHA256 hashes with 210,000 iterations and random 16-byte salts, generated on the Vercel server. No readable password is written to Sheets.
- The school script project is `1hXsy9t4RqGMLElVzmBNM5VdrYlbJrPmzAGMDgjb1XewyzMxfNhjUOBIb`. Deploy `google-spinner/Code.js`, `google-spinner/Auth.js`, `google-spinner/Tracker.js`, and `google-spinner/appsscript.json` as one script project. Create a new version and update the existing web-app deployment. The `spreadsheets` scope replaces `spreadsheets.readonly`; the school owner must authorize the new scope. Keep execute-as-owner and the existing application bridge token unchanged.
- Vercel keeps the existing `SPINNER_BRIDGE_URL` and `SPINNER_BRIDGE_TOKEN`. The shared authentication API uses these; no additional secret is required. Deploy the school script before promoting the website because the website routes require the new bridge actions.
- Run the unit suite with `npm test`. After script deployment, verify registration with a recognized district test account, then a username/password sign-in, period access, unauthorized period rejection, and logout. Verify browser-session and one persistent duration in a real browser. Do not create accounts for actual students as a test.

## Session behavior

Opaque 256-bit sessions are stored as hash-keyed Script Properties records. Cookies are `__Host-` scoped, HttpOnly, Secure, and SameSite=Strict. Browser-session cookies have no Max-Age; the server record expires after 12 hours. Persistent options expire after 1, 7, or 30 days. Logout deletes the server record. Every protected request reads the account's Active and Session Version columns, then checks current period membership or editor role. Changing Active to false or incrementing Session Version revokes a user's sessions.

## Operational note

Apps Script Script Properties are suitable for the present school deployment, but they have finite storage. Monitor account count and session volume as NEST grows. A dedicated session store is recommended before much larger scale.
