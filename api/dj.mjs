import { withDiagnostics } from '../lib/diagnostics.mjs';
import { COOKIE, cookies, validToken, bridge, verifiedIdentity, originAllowed } from '../lib/nest-auth.mjs';
import { get, put } from '@vercel/blob';
import { nestHeader, nestFooter } from '../lib/nest-page-shell.mjs';

// Playlist identities migrated from the division DJ slides. Invitations stay in private storage.
const playlists = {
  "1": "https://open.spotify.com/playlist/1K0glrm9jnPJBa64osGW7v",
  "2": "https://open.spotify.com/playlist/1ZTICxG3ozlLYqfrqOkpbu",
  "3": "https://open.spotify.com/playlist/6EexR3hq8ayXBPjTjlzOQL",
  "4": "https://open.spotify.com/playlist/4mXl8LkAQDMJeuhXc75jnw",
  "5": "https://open.spotify.com/playlist/6rsF8UXwicG49P40H69gbQ",
  "7": "https://open.spotify.com/playlist/0r6xwWvb7oH117JQRA29kx",
  "CTSO": "https://open.spotify.com/playlist/1p8yWfniqsYOiyyg992D3Q"
};
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scriptJSON = value => JSON.stringify(value).replace(/</g, '\\u003c');
const playlistURL = period => playlists[period].split('?')[0];
const invitePath = period => 'dj/invitation-' + period + '.json';
const inviteLifetime = 7 * 86400000;
export function validInvitation(period, value) {
 try {
  const url = new URL(value);
  return url.origin === 'https://open.spotify.com' && url.pathname === new URL(playlistURL(period)).pathname && (/^[a-f0-9]{32}$/i.test(url.searchParams.get('pt') || '') || /^[a-zA-Z0-9_-]{16,128}$/.test(url.searchParams.get('si') || '')) && !url.username && !url.password && value.length < 1000;
 } catch { return false; }
}
function invitationState(period, state) {
 return state && validInvitation(period,state.url) && Number.isFinite(state.savedAt) && state.savedAt <= Date.now() && state.savedAt > Date.now()-inviteLifetime ? state : null;
}
function djGuide(data) {
 const collaboration = data.invite && new URL(data.invite.url).searchParams.has('pt') ? `<a class="dj-join" href="${escape(data.invite.url)}" target="_blank" rel="noopener noreferrer">Open collaboration invitation ↗</a>` : 'Use the playlist link above. If Spotify does not let you add songs, ask Mr. Penalver to check your collaboration access.';
 return `<section class="dj-guide dj-reveal" aria-labelledby="dj-guide-title">
 <div class="dj-section-heading"><div><p class="dj-eyebrow">FROM FIRST CLICK TO FIRST TRACK</p><h2 id="dj-guide-title">Make it part of your mix.</h2></div><p>Use your personal account. Work in the original division playlist.</p></div>
 <div class="dj-guide-nav" aria-label="Playlist guide chapters" hidden><button type="button" data-guide-tab="setup">01 <span>Get connected</span></button><button type="button" data-guide-tab="songs">02 <span>Add your songs</span></button><button type="button" data-guide-tab="check">03 <span>Check your mix</span></button></div>
 <div class="dj-guide-panel" data-guide-panel="setup"><div class="dj-step-grid">
 <article class="dj-step"><span class="dj-step-number">01</span><h3>Your account. Your app.</h3><p><a href="https://www.spotify.com/us/download/other/" target="_blank" rel="noopener noreferrer">Get the Spotify app ↗</a> for your device. Open it and sign in to <strong>your personal Spotify account</strong>.</p><p>Then use <strong>Open Spotify</strong> above to open this division’s playlist. Choose <strong>Open in app</strong> if your browser asks.</p></article>
 <article class="dj-step"><span class="dj-step-number">02</span><h3>Save the shared playlist.</h3><div class="dj-spotify-controls" aria-label="Look beside the playlist Play button for the plus and three-dot controls"><span class="dj-mini-play" aria-hidden="true">▶</span><span class="dj-mini-save" aria-hidden="true">＋</span><span class="dj-mini-menu" aria-hidden="true">•••</span><span class="dj-control-caption">Playlist controls</span></div><p>Under the playlist title, find the <strong>Play button</strong>. Beside it, use <strong>＋ / Save</strong> to add the playlist to <strong>Your Library</strong>. A checkmark means it is already saved.</p><p>On versions that put <strong>Add to Your Library</strong> or <strong>Save to Your Library</strong> in the <strong>three-dot menu (…)</strong> beside Play, choose that option.</p><p class="dj-step-tip"><strong>Keep the shared original.</strong> <strong>Add to other playlist</strong> copies its songs into a different playlist. Edits to that copy will not update our division playlist.</p></article>
 </div><div class="dj-collab-note"><span aria-hidden="true">↗</span><div><h3>Need permission to add songs?</h3><p>${collaboration} Open it in Spotify with the same personal account and accept a collaboration invitation if Spotify shows one. Opening or saving a playlist alone does not grant editing access. If you still cannot add songs, ask Mr. Penalver to check your collaborator access.</p></div></div></div>
 <div class="dj-guide-panel" data-guide-panel="songs"><div class="dj-step-grid">
 <article class="dj-step"><span class="dj-step-number">03</span><h3>Find a song that fits.</h3><p>Search Spotify for a song that is <strong>safe and school-appropriate</strong>. Check its lyrics, themes, and the exact version before you add it.</p><p>A clean or non-explicit label is a starting point. The song still needs to follow our Community Agreements.</p></article>
 <article class="dj-step"><span class="dj-step-number">04</span><h3>The song’s dots. Our playlist.</h3><div class="dj-menu-path" aria-label="Song menu, then Add to playlist, then your division playlist"><span>Song <b>•••</b></span><span aria-hidden="true">→</span><span>Add to playlist</span><span aria-hidden="true">→</span><span>Your division</span></div><ol><li>Find the <strong>three dots (…)</strong> beside the <strong>song</strong>. On desktop, you can also right-click the song.</li><li>Choose <strong>Add to playlist</strong>.</li><li>Select <strong>this division’s original shared playlist</strong>. On mobile, tap <strong>Done</strong> if Spotify asks.</li></ol><p class="dj-step-tip">Use the <strong>song’s menu</strong> for this step. The three dots beside the playlist’s Play button control the whole playlist.</p></article>
 </div></div>
 <div class="dj-guide-panel" data-guide-panel="check"><div class="dj-step-grid">
 <article class="dj-step"><span class="dj-step-number">05</span><h3>Find it in Your Library.</h3><p>Open <strong>Your Library</strong> in Spotify, choose the division’s shared playlist, and confirm that your new song appears.</p><p>Check the playlist title and owner so you know you added to the shared original.</p></article>
 <article class="dj-step"><span class="dj-step-number">06</span><h3>Ready for the whole room.</h3><p>Give your selection one last check against our <a href="/sops#community-agreements">Community Agreements</a>. Have the music ready before division time or events.</p><p>If the playlist is missing from <strong>Add to playlist</strong>, check that you saved it and are using the same personal account. If you can listen but cannot edit, ask Mr. Penalver to check collaboration access.</p></article>
 </div></div>
 <div class="dj-guide-footer" hidden><p data-guide-progress aria-live="polite">Chapter 1 of 3 · Get connected</p><div><button type="button" data-guide-previous>← Previous</button><button type="button" data-guide-next>Add your songs →</button></div></div>
 <details class="dj-help"><summary>Spotify’s buttons look different on my device</summary><p>Labels vary between the desktop, mobile, and web apps. Look for <strong>＋ / Save</strong> on the playlist to keep it in Your Library. To add music, use the <strong>song’s three-dot menu → Add to playlist</strong>. Spotify may show a separate invitation when collaborator access is needed.</p><a href="https://support.spotify.com/us/article/save-recover-playlists/" target="_blank" rel="noopener noreferrer">Saving playlists ↗</a> <a href="https://support.spotify.com/us/article/create-playlists/" target="_blank" rel="noopener noreferrer">Adding songs ↗</a> <a href="https://support.spotify.com/us/article/collaborative-playlists/" target="_blank" rel="noopener noreferrer">Collaboration help ↗</a></details>
 </section>
 <section class="dj-norms dj-reveal" aria-labelledby="dj-norms-title"><div><p class="dj-eyebrow">THE SOUND OF OUR COMMUNITY</p><h2 id="dj-norms-title">Good music.<br>Shared agreements.</h2><a href="/sops#community-agreements">Our Community Agreements ↗</a></div><ul><li><span aria-hidden="true">✓</span><div><h3>Safe &amp; school-appropriate</h3><p>Check lyrics, themes, and versions. When you are unsure, ask Mr. Penalver before adding a song.</p></div></li><li><span aria-hidden="true">↔</span><div><h3>All in, All heard</h3><p>Welcome different tastes. Choose music that helps everyone feel safe, respected, and included.</p></div></li><li><span aria-hidden="true">◎</span><div><h3>Teamship &amp; accountability</h3><p>Care for our shared playlist, listen to feedback, and respond respectfully when a song needs to change.</p></div></li><li><span aria-hidden="true">↗</span><div><h3>Keep it with the DJ team</h3><p>Keep collaboration links within your division’s DJs. Your selections represent the whole division.</p></div></li></ul></section>
 ${data.isOwner ? `<details class="dj-checklist dj-teacher"><summary>Teacher · Manage collaboration link</summary><p>In Spotify, open this division’s playlist, choose the three-dot menu (…) beside Play → <strong>Invite collaborators</strong> → copy the link. Paste a newly generated link below. Saving an old invitation again does not renew it in Spotify.</p><form data-invite-form><label for="dj-invite">New Spotify collaboration invitation</label><input id="dj-invite" name="invitation" type="url" required maxlength="1000" autocomplete="off" placeholder="Paste the new invitation link"><button type="submit">Save invitation</button><p role="status" data-invite-status></p></form></details>` : ''}`;
}
export function renderDJPage(period, data = {}, status = 200) {
 const label = period === 'CTSO' ? 'NEST™ Robotics' : 'Division ' + period;
 const allowed = status === 200;
 const content = allowed ? `<section class="dj-player" aria-label="Spotify playlist"><div class="dj-player-copy"><p class="dj-eyebrow">YOUR DIVISION. YOUR SOUND.</p><h2>Set the tone.</h2><p>Your shared playlist. Your community.<br>Bring something good to the room.</p><div class="dj-player-actions"><a class="dj-spotify" href="#dj-listen-title">Play on this page ↓</a><a class="dj-app-link" data-external href="${escape(playlistURL(period))}" target="_blank" rel="noopener noreferrer">Open Spotify ↗</a><a class="dj-start-guide" href="#dj-guide-title" data-start-guide>Show me the steps ↓</a></div><p class="dj-account-note">Personal Spotify account · Safe, school-appropriate music</p></div><div class="dj-turntable" aria-hidden="true"><div class="dj-record"><div class="dj-record-label">NEST<span>DJ</span></div></div><div class="dj-tonearm"></div><div class="dj-equalizer"><i></i><i></i><i></i><i></i><i></i></div><span class="dj-record-caption">A MIX THAT BELONGS TO EVERYONE</span></div></section><section class="dj-listen dj-reveal" aria-labelledby="dj-listen-title"><div class="dj-section-heading"><div><p class="dj-eyebrow">RIGHT HERE IN NEST</p><h2 id="dj-listen-title">Your division’s playlist.</h2></div><p>Browse and play here. Open Spotify to save the playlist or add songs.</p></div><iframe class="dj-embed" src="${escape(playlistURL(period).replace('/playlist/','/embed/playlist/'))}?theme=0" title="${escape(label)} Spotify playlist" height="352" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><p class="dj-embed-help">If the player cannot load, <a data-external href="${escape(playlistURL(period))}" target="_blank" rel="noopener noreferrer">open the playlist in Spotify ↗</a>.</p></section>${djGuide(data)}` :
 `<section class="dj-player dj-locked"><span class="dj-record" aria-hidden="true">🔒</span><h2>${status === 401 ? 'Sign in to open your DJ page' : status === 403 ? 'Reserved for this division’s DJs' : 'Your DJ page could not load'}</h2><p role="status">${escape(data.error || 'Please try again.')}</p>${status === 401 ? '<button type="button" data-sign-in>Sign in to NEST</button>' : '<button type="button" data-retry>Check access again</button>'}</section>`;
 const identity = allowed ? verifiedIdentity(data.identity) : null;
 return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(label)} DJ · NEST™</title><link rel="stylesheet" href="/css/styles.css"><link rel="stylesheet" href="/css/nest-auth.css?v=password-toggle-1"><link rel="stylesheet" href="/css/dj.css?v=embedded-loop-3"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet"></head><body><div class="bg-watermark"></div>${nestHeader}<main class="dj-workspace" data-dj-page data-authorized="${allowed}"><nav aria-label="DJ navigation"><a href="/dj">← All DJ divisions</a><a href="/divisions/${escape(period)}">Division HQ</a></nav><div class="dj-heading"><img src="/assets/division-icons/${period === 'CTSO' ? 'ctso' : 'division-' + escape(period)}-512.webp" alt="" width="96" height="96"><div><p class="dj-eyebrow">DJ WORKSPACE</p><h1>${escape(label)}</h1><p>Music starts here.</p></div></div>${content}</main>${identity ? '<script type="application/json" id="nest-auth-bootstrap">' + scriptJSON(identity) + '</script>' : ''}${nestFooter}<script src="/js/nest-auth.js?v=password-toggle-1"></script><script src="/js/dj.js?v=embedded-loop-3"></script><script src="/js/main.js"></script></body></html>`;
}
export function createDJHandler(storage = {get,put}) {
return async function handler(req, res) {
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('Vercel-CDN-Cache-Control','no-store'); res.setHeader('Vary','Cookie');
 res.setHeader('Content-Type',req.method === 'POST' ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8');
 res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('X-Robots-Tag','noindex, nofollow');
 if(!['GET','POST'].includes(req.method)) { res.setHeader('Allow','GET, POST'); return res.status(405).send('Method not allowed.'); }
 const period = String(req.query?.period || '');
 if(!Object.hasOwn(playlists,period)) return res.status(404).send('DJ division not found.');
 const send = (status, data) => req.method === 'POST' ? res.status(status).json({error:data.error}) : res.status(status).send(renderDJPage(period,data,status));
 if(req.method === 'POST' && (!originAllowed(req) || !String(req.headers['content-type']||'').startsWith('application/json'))) return send(403,{error:'This action is unavailable.'});
 const session = cookies(req)[COOKIE];
 if(!validToken(session)) return send(401,{error:'Use your NEST account to open the DJ workspace for your division.'});
 try {
  const result = await bridge({action:'auth-division-slides',session,period,operation:'access'},45000);
  if(result.status === 401) return send(401,{error:'Your NEST sign-in has expired. Sign in again.'});
  if(result.status === 403) return send(403,{error:'Only current Division DJs assigned to this division can open its playlist.'});
  if(result.status !== 200) throw new Error('DJ access unavailable');
  const isDJ = Array.isArray(result.roles) && result.roles.some(role => String(role).trim().toLowerCase() === 'division dj');
  if(result.isOwner !== true && !isDJ) return send(403,{error:'Only current Division DJs assigned to this division can open its playlist. If you were just hired, check access again after your assignment is saved.'});
  if(req.method === 'POST') {
   if(result.isOwner !== true) return res.status(403).json({error:'Only the teacher can update collaboration invitations.'});
   let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Paste the new Spotify invitation.'});}
   if(!body || typeof body.url !== 'string' || !validInvitation(period,body.url)) return res.status(400).json({error:'Use Invite collaborators in Spotify and paste the new link for this division’s playlist.'});
   await storage.put(invitePath(period),JSON.stringify({url:body.url,savedAt:Date.now()}),{access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true,cacheControlMaxAge:0});
   return res.status(200).json({saved:true});
  }
  let invite = null;
  try { const stored = await storage.get(invitePath(period),{access:'private',useCache:false}); if(stored) invite = invitationState(period,await new Response(stored.stream).json()); } catch { /* The original playlist stays available if invitation storage is unavailable. */ }
  return send(200,{identity:result.identity,isOwner:result.isOwner===true,invite});
 } catch { return send(503,{error:'DJ access is temporarily unavailable. Please try again.'}); }
}
}
export default withDiagnostics('division',createDJHandler());

