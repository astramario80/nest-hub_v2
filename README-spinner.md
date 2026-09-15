# Magic Spinner period access

Production: https://gknest.org/sops → Magic Spinner.

Period buttons cover the existing Trip-o-Meter periods 1, 2, 3, 4, 5 and 7. The fixed sheet mapping is in `google-spinner/Code.js`. Each period reads its matching tab: names from A6:A and allowed emails from B6:B. Only names leave the Google service after email verification; no grades or email list is returned to the browser. Updating the existing sheets updates authorization and rosters without redeployment. Period 3 currently has blank initial roster rows; access is denied unless the email exists in its B column.

## Google setup

Project: https://script.google.com/d/1hXsy9t4RqGMLElVzmBNM5VdrYlbJrPmzAGMDgjb1XewyzMxfNhjUOBIb/edit

The project is owned and deployed by `mpenalver@bethelsd.org`. The owner must run `authorizeSpinner` once and grant read-only Google Sheets access and email-send permission. This only checks all configured sheet reads and remaining email quota. It sends no email and prints no student records. The Advanced Sheets service is declared in the manifest.

The deployed web app executes as its owner and rejects every request without the server-only bridge token. The browser never calls it directly. `SPINNER_BRIDGE_URL` and sensitive `SPINNER_BRIDGE_TOKEN` are configured in Vercel production. Only the token digest is committed. Never expose the token, add arbitrary sheet selectors, or return rosters from an unauthenticated route.

Google MailApp sends from `mpenalver@bethelsd.org`, with display name gk NEST™. The HTML email includes the site's existing NEST banner linked to https://gknest.org and a plain-text alternative. Google sending quotas and the receiving school email policy apply. A real eligible account should confirm delivery, including spam/junk filtering; unit tests do not establish inbox delivery.

## Access model

The three owner addresses `astramario@gmail.com`, `mpenalver@bethelsd.org`, and `mario@memberhq.net` are authorized for all periods independently of B6:B. They must still receive and enter the emailed code, and their sessions still expire after six hours. Magic Spinner is currently the only site-hosted email-locked tool; future locked tools must reuse this owner-access rule. Linked external Google files retain their own sharing permissions.

- Six-digit cryptographically generated code, expires in 10 minutes, at most five attempts, single use.
- Random challenge identifier in a Secure, HttpOnly, SameSite=Strict, host-only cookie binds verification to the requesting browser.
- Opaque random session cookie per period expires after six hours. Server state stores only the session hash, period, email and fixed expiry. No sliding renewal.
- Authorization is checked again during verification and every subsequent roster load. Removing an email revokes later loads; already displayed/copied names cannot be recalled.
- Sign-out revokes that period's server session and deletes its cookies. Shared devices must sign out; access follows the browser session rather than identifying the person physically at the keyboard.
- UI clears names and selection history on period change, sign-out and expiry. Credentials and rosters are not stored in localStorage. Existing manual paste remains available.
- Private API responses are no-store. Code requests return a generic response for unknown addresses. Rate limits are held in durable Google Script Properties under a lock: five per address per hour, one per minute, 60 per IP per hour and 1,000 total requests per hour. IP addresses are HMAC-hashed before Google receives them. These limits also bound stored state. Expired records are swept hourly on use.

## Validation / deployment

`npm test` tests code expiry, replay, wrong attempts, session separation, revocation, authorization rechecks, cookies, cross-origin rejection, email banner content, and UI clearing. Browser checks cover desktop and mobile layout. Google code changes require a new immutable Apps Script version and updating the existing deployment; Git pushes do not deploy Apps Script. The website and API deploy through the existing main → Vercel flow.

School deployment ID: `AKfycbygtJUtH24qVVbEFQG9OI20J7PwGrVW8KSxtomtCFzUTC7pjybBif7ruChly2ogQb7d4g`. Maintain this deployment while signed into the school account; the older Gmail-owned project is not the production source.
