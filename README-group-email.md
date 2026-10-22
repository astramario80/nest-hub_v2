# NEST Communications — Postmark

Managers and assigned division leaders compose and send inside Communications using their NEST session. Gmail OAuth is no longer used. Current division roles and active roster membership are read again on every send. Building leadership remains available to current leaders; other student rosters remain division-scoped.

## Provider

Existing Postmark account: MemberHQ. Dedicated live server: NEST™ Communications, ID 21154259. NEST has its own server token and default Broadcast stream (`broadcast`); MemberHQ servers, tokens, streams and senders are unchanged. Sender: `NEST Communications <communications@gknest.org>`. Reply-To is derived on the school bridge from the authenticated account or its linked school address. Browser-supplied sender/reply fields are ignored. Manual accounts need a verified linked or recovery school email.

The `gknest.org` domain is registered in Postmark as 8206578. DKIM TXT `20261022173940pm._domainkey` and DNS-only return-path CNAME `pm-bounces` → `pm.mtasv.net` are verified. Unrelated Cloudflare records are preserved. This provides sending, not a hosted mailbox. Replies go to the manager’s linked inbox; the shared sender itself has no inbox configured.

Production configuration: `POSTMARK_SERVER_TOKEN` (secret), `POSTMARK_FROM_EMAIL=communications@gknest.org`, `POSTMARK_MESSAGE_STREAM=broadcast`, `NEST_EMAIL_ENABLED=true`. Keep the token server-side. Preview/development must not receive the live token. The ignored owner-readable `.env.postmark.local` supports technical setup checks and must never be committed or deployed. Update `/email-privacy` if provider or retention settings change.

## Sending

`api/group-email-send.mjs` accepts same-origin JSON POST requests with a valid NEST session. The server revalidates the audience and every selected address, sanitizes HTML independently of browser formatting, and rebuilds the banner/footer. Maximum 300 recipients, 180-character subject, 60,000-character HTML. Each recipient gets an individual Postmark message without exposing the group’s other addresses. Open tracking is enabled for new NEST sends and link tracking remains disabled; broadcast messages include Postmark’s managed unsubscribe link. Suppressions are honored.

The school bridge’s `auth-group-email` dispatcher in `GroupEmail.js` reserves each attempt under a script lock before the provider call. It binds request IDs and content fingerprints to the authenticated account. Identical content cannot be submitted again for ten minutes, including through another browser tab. Attempt metadata is retained for up to seven days; quota metadata expires after two days. No message body, subject, recipient addresses, or Postmark credentials are stored in that journal. Existing script OAuth scopes are unchanged.

Per-account limits: one submission every 30 seconds, 20 submissions and 500 recipient deliveries per UTC day. Global limits: 100 submissions and 2,000 recipient deliveries per UTC day. Tests count toward those limits. The self-test addresses only the server-derived reply email and preserves the team draft.

Postmark HTTP 200 does not itself imply success: every per-recipient result is inspected. Provider acceptance differs from inbox delivery. Accepted, partial, rejected and uncertain outcomes are shown distinctly. A request timeout, pending reservation, malformed response or failed journal acknowledgement never triggers an automatic retry. After ambiguous or partial results, an administrator should inspect the NEST Postmark server by tag `nest-<requestId>` before a new send. Do not reset a journal to force a retry.

## Release and verification

Preserve the school project's complete live source set. Its live Code.js combines multiple source modules and includes additional files; do not replace it wholesale with the split files in `google-spinner/`. Add only the dispatch block and GroupEmail.js, read back all files and compare hashes, then version and update the existing school deployment. Rollback is school version 68 plus the prior Vercel production deployment. Pending/uncertain send records must remain intact across rollback.

Focused verification covers permission loss, recipient injection, foreign origin, header injection, HTML sanitization, self-test destination, duplicate clicks, durable duplicate reservations, cross-tab content duplicates, quotas, partial/rejected/malformed provider responses, uncertain delivery, journal acknowledgement loss and logout during sending. Technical provider canary used `test@blackhole.postmarkapp.com` with fixed setup text and no member data. No real team email was sent.

School deployment version 69 activates the new dispatcher; all 14 staged files were pulled back and matched by SHA-256 before release. The existing deployment ID and manifest/scopes are preserved.

## Sent history and observed opens

Communications includes Compose and Sent history subtabs. `api/group-email-history.mjs` validates a live NEST identity before each read, derives an HMAC sender key from that identity and the school bridge secret, and fixes all Postmark searches to that key. Each new sent message includes this sender key, its request ID, selected count and test flag in Postmark metadata. Browser-supplied actor selectors are ignored; list rows, selected-message details and open activity are independently checked against the sender and request. Existing Gmail messages and technical canaries without sender metadata are excluded.

Postmark supplies the retained message content and first observed open for each recipient, so no separate NEST message archive or public webhook is needed. Current retention is 45 days. Recipients are deduplicated by their individual provider message IDs. The displayed open rate is unique recipient opens divided by messages accepted by Postmark; selected but rejected recipients are not counted as accepted. No detected open is labeled accordingly rather than as proof of unread mail. Student-facing responses omit provider credentials, metadata keys, IP addresses, geography, devices and user-agent data.

The content preview extracts the server-marked original message, sanitizes it again and places it in a sandboxed iframe with a restrictive CSP that blocks scripts, remote images, forms and base URLs. Viewing history cannot load the provider's tracking image. Drafts remain intact across the two subtabs; logout and stale responses clear history.

The sanitizer remains at patched version 2.18.1. Its htmlparser2 dependency is pinned to compatible CJS-exporting 10.0.0 because Vercel's current loader rejects require(ESM) in the latest parser. Sanitization tests and npm audit verify this deployed dependency graph.
