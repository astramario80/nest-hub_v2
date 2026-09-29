# NEST Signals access

`signals.gknest.org` embeds the NEST-hosted player from `/api/signals?asset=index`. This keeps the existing Signals address and Spotify redirect URI while using NEST's host-only session cookie. Only the canonical Signals domain embeds the player; the Sites alias redirects to it. The frame allows Spotify encrypted media and autoplay.

The server validates the active NEST session, uses its verified district email, and grants staff at exactly `@bethelsd.org`. Other district users must match the current leadership directory's email and one of five exact, case-insensitive roles: Assistant Manager, Division Manager, Chief Executive Officer, Chief Financial Officer, or Chief Operations Officer. The existing authenticated school bridge reads Imported!B2:F; position D and email F drive this check. No leadership list is sent to the Signals browser. Manual accounts and other owner email exceptions do not automatically receive Signals permission.

Player HTML and JavaScript require server authorization and are never cached. The page checks access at start and at least once per minute while running, stopping and disconnecting playback if permission cannot be verified. Menu visibility is convenience only; direct requests receive the same server check. Existing NEST account-registration rules are unchanged.

The Spotify application Client ID is still configured per browser until an owner supplies a shared ID. Moving playback into the authenticated NEST frame requires connecting Spotify once again on the classroom browser. Keep the Spotify redirect URI `https://signals.gknest.org/`. Spotify's OAuth code is forwarded to the NEST frame and the original PKCE state check still applies. No Spotify client secret is used.

Deploy the NEST endpoint before the Sites wrapper. Checks: npm test plus signed-out production endpoint checks. Real NEST login and Spotify playback require verification on an authorized classroom device.
