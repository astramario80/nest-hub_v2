# Division DJ workspaces

`/dj` lists the division pages at `/dj/1`, `/dj/2`, `/dj/3`, `/dj/4`, `/dj/5`, `/dj/7`, and `/dj/CTSO`. These pages use the current NEST session and the existing school access bridge before returning any playlist or collaboration invitation. Current Division DJs can open their assigned division; teacher/owner accounts retain access. Division managers and Robotics executives do not inherit DJ access.

The school service checks live division membership, resolves linked manual accounts, and returns roles from the leadership database for that division. A newly saved hiring assignment is recognized on the next page request. DJ pages no longer load Google Slides or depend on slide sharing.

The server keeps the original Spotify playlist identities. Each authorized page includes a direct Spotify link, instructions for joining the shared playlist with a personal account, an app download link, and school-appropriate music and Community Agreements reminders.

## Collaboration invitations

Saving a playlist does not grant collaboration rights. Spotify's Invite collaborators links last seven days: https://support.spotify.com/us/article/collaborative-playlists/

Teachers have an invitation form on each protected division DJ page. Generate a new invitation from that playlist's Spotify three-dot menu → Invite collaborators, then paste and save it. Only owner accounts can save, and the server verifies the exact division playlist and the Spotify link format (`pt` invitations or the `si` format currently copied by Spotify’s Invite collaborators control). Use Invite collaborators; the site cannot infer Spotify editing rights from a sharing URL alone. The form rejects another playlist or a link without these parameters.

Invitations are stored in the existing private Vercel Blob store under `dj/invitation-{period}.json`, separate from the NEST Request archive. Reads bypass cache. The site stops displaying invitations seven days after saving them; pasting an already old invitation does not reset Spotify's expiration. Original slide links were migrated as playlist identities, not assumed to be valid invitations.

NEST controls access to its DJ pages. Spotify manages collaborator membership separately; removing a NEST DJ assignment does not remove a personal Spotify account already admitted to a playlist. Manage that membership in Spotify when changing DJs.

## Verification

Run `node --test tests/dj.test.mjs tests/division-workspace.test.mjs tests/executive-access.test.mjs`. Coverage includes per-division roles, newly hired and removed DJs, linked manual accounts, owner access, private and expired invitations, teacher-only updates, origin validation, anonymous and invalid routes, guide content, and browser-history cleanup.

## 2026-10-29 release

Published the DJ-only site routes and native Spotify instructions to gknest.org. Verified the owner page live and anonymous denials on both clean routes and the API. The focused DJ, division workspace, and executive access suites passed 49 tests. Generated new links through Spotify’s Invite collaborators control and saved each only in its matching protected division workspace.

## Instruction and design update

The guide separates saving the original playlist in Your Library from the song’s three-dot menu → Add to playlist. Add to other playlist copies tracks and does not update the shared original. Ordinary `si` sharing links are no longer labeled as collaboration invitations; a sharing URL is not evidence of editing permission.

Three accessible guide chapters provide numbered cards and playlist/song control illustrations. Styling uses the website’s charcoal, orange and existing typography. The record and equalizer loop while the page is displayed, cards reveal once, and reduced-motion settings disable those effects. All chapters remain visible if JavaScript is unavailable.

## 2026-11-02 player update

Authorized division DJ pages embed their own Spotify playlist using Spotify’s official `/embed/playlist/{id}` iframe. The primary action scrolls to the on-page player; an app link remains for playlist saving and song editing. The embed has encrypted-media permission, a responsive width and lazy loading. Denied pages never return an iframe. Existing auth-change/pagehide cleanup removes the player with the rest of the protected content. No music is automatically started.
