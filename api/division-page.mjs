import division from './division.mjs';
import { DIVISIONS } from '../lib/divisions.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const scriptJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export function renderDivisionPage(period,data,code=200){
 const label=period==='CTSO'?'NEST™ Robotics':'Division '+period;
 const allowed=code===200&&data?.manager&&Array.isArray(data.leaders);
 const content=allowed?`<main class="division-workspace division-page" data-period="${escape(period)}"><div class="division-window-layout">
 <div class="division-page-intro"><p class="division-eyebrow">Your division home</p><h1>${escape(label)}</h1><p>Your team, leadership slides, and opportunities in one place.</p><nav class="division-page-actions" aria-label="Division actions"><a href="/leadership-application?division=${escape(period)}">Apply for a leadership position</a><a data-hiring href="/hiring?period=${escape(period)}#manager-hiring"${data.canManage?'':' hidden'}>Manage hiring</a></nav></div>
 <section class="division-team"><h2>Current leadership team</h2><div data-team-summary></div><nav class="division-window-positions" aria-label="Leadership positions and slides"></nav></section>
 <section class="division-slideshow"><h2>Manager slideshow</h2><div class="division-window-controls"><button type="button" data-load disabled>Load division slides</button><p></p><button type="button" data-edit-manager hidden>Edit manager slide</button></div><p class="division-window-status" role="status" aria-live="polite"></p><div class="division-window-stage"></div><div class="division-window-footer"><small>Use your school Google account to view and edit slides.</small><button type="button" data-refresh>Refresh team and slideshow</button></div></section></div></main><script type="application/json" id="division-bootstrap">${scriptJSON(data)}</script>`:
 `<main class="division-page-lock"><p class="division-eyebrow">Division home</p><h1>${escape(label)}</h1><p role="status">${escape(data?.error||'This division is unavailable.')}</p>${code===401?'<button type="button" data-sign-in>Sign in to NEST</button>':''}${code===503?'<button type="button" data-retry>Try again</button>':''}<p><a href="/divisions">Choose a division</a></p></main>`;
 return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(label)} · NEST™</title><link rel="stylesheet" href="/css/styles.css"><link rel="stylesheet" href="/css/nest-auth.css"><link rel="stylesheet" href="/css/division-workspace.css"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet"></head><body><div class="bg-watermark"></div><header><a href="/" aria-label="NEST home"><img src="/assets/nest_menu_icon.png" alt="NEST™" class="logo" style="height:60px;object-fit:contain"></a><nav class="division-site-nav"><a href="/divisions">Divisions</a><a href="/leadership">Leadership directory</a><a href="/">NEST home</a></nav></header>${content}<footer class="site-footer"><div class="footer-content">NEST™ · ${escape(label)}</div></footer><script src="/js/nest-auth.js"></script><script src="/js/division-workspace.js"></script></body></html>`;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('X-Robots-Tag','noindex, nofollow');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).send('Method not allowed.');}
 const period=String(req.query?.period||'');
 if(!Object.hasOwn(DIVISIONS,period))return res.status(404).send('Division not found.');
 let code=200,data;
 // Reuse the same live membership check before returning any team or deck data.
 await division({method:req.method,headers:req.headers,query:{period}}, {setHeader(){},status(value){code=value;return this;},json(value){data=value;return this;}});
 return res.status(code).send(renderDivisionPage(period,data,code));
}
