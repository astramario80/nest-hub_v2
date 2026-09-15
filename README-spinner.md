# Shared NEST email access

Production: https://gknest.org/sops (Magic Spinner) and https://gknest.org/trip-o-meter.

See [README-tracker.md](README-tracker.md) for shared permissions, leadership, private storage and current verification status. Both tools use one six-hour host-only Secure/HttpOnly/SameSite=Strict session cookie. Owners and live NEST administrators have global access; students stay within their verified period. Access follows the verified browser session, so shared devices must sign out. External tools retain their own authentication.

Rosters come from central NEST Database Period N or CTSO tabs, names A and emails C; student IDs and guardian fields are excluded. The old Trip-o-meter spreadsheets are only initial migration sources.

Codes are cryptographically generated, valid for ten minutes, limited to five attempts and single-use. Challenge cookies bind codes to the requesting browser. Server sessions store fixed expiry and recheck authorization on every request. Logout revokes the shared server session. No credentials or rosters are stored in localStorage; private responses are no-store.

Rate limits: one request per minute and five per email per hour; 60 per HMAC-hashed IP per hour; 1,000 total per hour. Unknown emails receive the same generic response. Expired state is cleaned on use. MailApp quotas and receiving-school filters still apply.

MailApp sends from mpenalver@bethelsd.org with ASCII sender name gk NEST and subject Your gk NEST Period N access code (Robotics for CTSO), avoiding the observed trademark encoding corruption. The supplied NEST banner links to https://gknest.org; HTML alternative text uses entities. Actual inbox delivery and clean subject were verified September 15, 2026.

Vercel holds SPINNER_BRIDGE_URL and SPINNER_BRIDGE_TOKEN. The Google endpoint rejects requests lacking the token. Only the digest is committed. Never expose the token or add browser-selectable spreadsheet IDs.

School deployment ID: AKfycbygtJUtH24qVVbEFQG9OI20J7PwGrVW8KSxtomtCFzUTC7pjybBif7ruChly2ogQb7d4g. Google changes require a new version in the school-owned project; Git pushes only deploy website/API changes.
