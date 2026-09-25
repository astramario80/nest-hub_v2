# NEST account launch

The website and the school-owned Apps Script bridge must be updated together. The new Google bridge temporarily accepts old six-hour email-code sessions while the website is switched. The old email-code route has been removed from the new Vercel API. Registration still sends one email code to prove ownership of a district address; normal sign-in uses a username and password.

## Data and deployment

- `StudentNESTAccess` in NEST Database holds `Username`, `District Email`, `Password Hash`, `Password Salt`, `Active`, `Session Version`, `Created At`, and `Last Login At`. Passwords are PBKDF2-SHA256 hashes with 210,000 iterations and random 16-byte salts, generated on the Vercel server. No readable password is written to Sheets.
- The school script project is `1hXsy9t4RqGMLElVzmBNM5VdrYlbJrPmzAGMDgjb1XewyzMxfNhjUOBIb`. Deploy `google-spinner/Code.js`, `google-spinner/Auth.js`, `google-spinner/Tracker.js`, `google-spinner/Weather.js`, `google-spinner/Hiring.js`, and `google-spinner/appsscript.json` as one script project. Run `authorizeNestAuth` in the school-owned editor to approve the new `spreadsheets` scope and check the account headers without changing student data. Create a new version and update the existing web-app deployment. Keep execute-as-owner and the existing application bridge token unchanged.
- Vercel keeps the existing `SPINNER_BRIDGE_URL` and `SPINNER_BRIDGE_TOKEN`. The shared authentication API uses these; no additional secret is required. Deploy the school script before promoting the website because the website routes require the new bridge actions.
- Run the unit suite with `npm test`. After script deployment, verify registration with a recognized district test account, then a username/password sign-in, period access, unauthorized period rejection, and logout. Verify browser-session and one persistent duration in a real browser. Do not create accounts for actual students as a test.
- The September 2026 concurrency repair must be published as a new version of the existing school web app before evaluating its effect on class logins. The website change accepts both the previous two-call registration bridge and the new single-call registration bridge during rollout.

## Session behavior

Opaque 256-bit sessions are stored as hash-keyed Script Properties records. Cookies are `__Host-` scoped, HttpOnly, Secure, and SameSite=Strict. Browser-session cookies have no Max-Age; the server record expires after 12 hours. Persistent options expire after 1, 7, or 30 days. Logout deletes the server record. Every protected request reads the account's Active and Session Version columns, then checks current period membership or editor role. Changing Active to false or incrementing Session Version revokes a user's sessions.

The website also sets a server-signed, HttpOnly identity cookie with a five-minute lifetime. Ordinary menu identity checks use this cookie; after it expires, the website refreshes it from the school bridge. It never grants tool or Tech Ticket access. Those requests continue to check the current session, account status, and permissions in the school script. The school script caches login directory reads for 20 seconds and account-creation eligibility for 60 seconds; session creation and protected tool access still read current account status from Sheets. The optional `Last Login At` write was removed from the synchronous sign-in path so a slow audit write cannot delay or fail a class login.

## Operational note

Apps Script Script Properties are suitable for the present school deployment, but they have finite storage. Monitor account count and session volume as NEST grows. A dedicated session store is recommended before much larger scale.
