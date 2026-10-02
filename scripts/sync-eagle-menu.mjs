// Generate the public corner navigation from the homepage's four gears.
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const dom=new JSDOM(fs.readFileSync('index.html','utf8'));
const panels=[...dom.window.document.querySelectorAll('.home-dashboard > .gear-panel')];
if(panels.length!==4)throw new Error('Expected all four NEST gears.');
const html=panels.map(panel=>{
 const section=dom.window.document.createElement('section');section.className='gear-panel';
 section.append(panel.querySelector('.gear-label').cloneNode(true),panel.querySelector('.gear-links').cloneNode(true));return section.outerHTML;
}).join('');
const file='js/eagle-menu.js',source=fs.readFileSync(file,'utf8');
const begin='// BEGIN GENERATED NEST NAVIGATION',end='// END GENERATED NEST NAVIGATION';
const block=begin+'\nconst NEST_NAVIGATION_HTML = '+JSON.stringify('<main class="home-dashboard">'+html+'</main>')+';\n'+end;
const start=source.indexOf(begin),finish=source.indexOf(end);
fs.writeFileSync(file,start>=0?source.slice(0,start)+block+source.slice(finish+end.length):block+'\n'+source);
dom.window.close();
