import {KINDS,PERIODS,minutes,timeLabel,schoolDate,validateWorkspace,resolveSchedule,signalRows} from './bell-schedule-model.mjs';
const $=id=>document.getElementById('bw-'+id),node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const uid=prefix=>prefix+'-'+crypto.randomUUID().slice(0,12);
let workspace,revision=null,history=[],selected='',tab='template',dirty=false,saving=false,loading=false,authEpoch=0;
const template=()=>workspace.templates.find(t=>t.id===selected);
function message(text,error=false){$('status').textContent=text;$('status').dataset.error=String(error);}
function markDirty(){dirty=true;updateSave();preview();}
function updateSave(){$('save').disabled=saving||!dirty;$('save').textContent=saving?'Saving…':dirty?'Save draft · unsaved':'Draft saved';$('reload').disabled=saving;}
function button(text,action,cls){const b=node('button',text,cls);b.type='button';b.addEventListener('click',action);return b;}
function field(label,value,change,{type='text',options,maxLength=120}={}){
 const l=node('label',label);let input;
 if(options){input=node('select');for(const [v,t] of options)input.add(new Option(t,v));input.value=value??'';input.addEventListener('change',()=>{change(input.value);markDirty();});}
 else{input=node(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;else input.rows=3;if(type==='checkbox'){input.checked=!!value;l.className='bw-check';}else input.value=value??'';input.maxLength=maxLength;input.addEventListener(type==='checkbox'?'change':'input',()=>{change(type==='checkbox'?input.checked:input.value);markDirty();});}
 l.append(input);return l;
}
const grid=(...children)=>{const g=node('div',undefined,'bw-grid');g.append(...children);return g;};
function heading(parent,title,help){parent.append(node('h2',title));if(help)parent.append(node('p',help,'bw-help'));}
function rowhead(parent,title,action,label='+ Add block'){const h=node('div',undefined,'bw-rowhead');h.append(node('h3',title),button(label,action));parent.append(h);}
function empty(parent,text){parent.append(node('p',text,'bw-empty'));}
function freshBlock(){return {id:uid('block'),label:'New block',kind:'class',period:'',start:'14:20',end:'14:30'};}
function blocksEditor(parent,blocks){
 const list=node('div',undefined,'bw-blocks');
 for(const b of blocks){const card=node('div',undefined,'bw-block');card.dataset.kind=b.kind;const main=node('div',undefined,'bw-block-main');
  main.append(field('Activity',b.label,v=>b.label=v),field('Type',b.kind,v=>{b.kind=v;card.dataset.kind=v;},{options:KINDS.map(k=>[k,k.charAt(0).toUpperCase()+k.slice(1)])}),field('Period',b.period,v=>b.period=v,{options:[['','—'],...PERIODS.map(p=>[p,p])]}));
  const remove=button('×',()=>{blocks.splice(blocks.indexOf(b),1);markDirty();renderPanel();},'bw-danger');remove.setAttribute('aria-label','Remove '+b.label);main.append(remove);
  const times=node('div',undefined,'bw-block-time'),duration=node('span');const update=()=>{const n=minutes(b.end)-minutes(b.start);duration.textContent=Number.isFinite(n)&&n>0?`${n} minutes`:'Check start / end';};
  times.append(field('Start',b.start,v=>{b.start=v;update();},{type:'time'}),field('End',b.end,v=>{b.end=v;update();},{type:'time'}),duration);update();card.append(main,times);list.append(card);
 }
 if(!blocks.length)empty(list,'No blocks yet. Add the activities that make up this part of the day.');parent.append(list);
}
function library(){
 const query=$('search').value.toLowerCase();$('template-count').textContent=`(${workspace.templates.length})`;$('library').replaceChildren();
 for(const t of workspace.templates.filter(t=>t.name.toLowerCase().includes(query))){const b=button('',()=>{selected=t.id;tab='template';render();});b.className='bw-template';b.setAttribute('aria-current',String(selected===t.id));const dot=node('span',undefined,'bw-dot');dot.style.backgroundColor=t.color;b.append(dot,node('span',t.name));$('library').append(b);}
}
function renderTemplate(parent){
 const t=template();if(!t){empty(parent,'Create a schedule to begin.');return;}
 heading(parent,t.name,'Edit the shared day first, then add lunch and assembly variations. Times use the school’s Pacific time zone.');
 const actions=node('div',undefined,'bw-actions');actions.append(button('Duplicate',()=>{const copy=structuredClone(t);copy.id=uid('schedule');copy.name=t.name+' (copy)';workspace.templates.push(copy);selected=copy.id;markDirty();render();}),button('Remove schedule',()=>{if(workspace.days.some(d=>d.templateId===t.id)){message('Reassign dates before removing this schedule.',true);return;}if(!confirm('Remove this draft schedule? You can restore a saved revision from History.'))return;workspace.templates.splice(workspace.templates.indexOf(t),1);selected=workspace.templates[0]?.id;markDirty();render();},'bw-danger'));parent.append(actions);
 parent.append(grid(field('Schedule name',t.name,v=>{t.name=v;library();}),field('Schedule color',t.color,v=>t.color=v,{type:'color'})),field('Notes / source details',t.notes,v=>t.notes=v,{type:'textarea',maxLength:2000}),field('No school on this schedule',t.noSchool,v=>{t.noSchool=v;renderPanel();},{type:'checkbox'}));
 if(t.noSchool){empty(parent,'This schedule resolves to a no-school day. Class blocks will not be shown.');return;}
 rowhead(parent,'Shared day',()=>{t.blocks.push(freshBlock());markDirty();renderPanel();});blocksEditor(parent,t.blocks);
 parent.append(node('h3','Lunch variations'),node('p','Each lunch group replaces the selected period with its own class and lunch segments.','bw-help'));
 parent.append(field('Period containing lunch',t.lunchPeriod,v=>t.lunchPeriod=v,{options:[['','Choose period'],...PERIODS.map(p=>[p,p==='7'?'Advisory (7)':'Period '+p])]}));
 for(const lunch of t.lunches){const card=node('section',undefined,'bw-card');card.append(field('Lunch group name',lunch.name,v=>{lunch.name=v;previewControls();}));rowhead(card,lunch.name,()=>{lunch.blocks.push(freshBlock());markDirty();renderPanel();});blocksEditor(card,lunch.blocks);card.append(button('Remove lunch group',()=>removeVariation(t.lunches,lunch), 'bw-danger'));parent.append(card);}
 parent.append(button('+ Add lunch group',()=>{if(t.lunches.length>=6)return message('Use up to six lunch groups.',true);const id=String([1,2,3,4,5,6].find(n=>!t.lunches.some(l=>l.id===String(n)))||Date.now());t.lunches.push({id,name:'Lunch '+id,blocks:[]});markDirty();render();}));
 parent.append(node('h3','Assembly / activity groups'),node('p','Define each group’s sequence explicitly. A group replaces the periods you choose; shared activities stay in place.','bw-help'));
 for(const group of t.groups){const card=node('section',undefined,'bw-card');card.append(field('Group name',group.name,v=>{group.name=v;previewControls();}));
  card.append(field('Replaces periods (comma-separated)',group.replacePeriods.join(', '),v=>group.replacePeriods=v.split(',').map(x=>x.trim()).filter(Boolean),{maxLength:50}));
  rowhead(card,group.name,()=>{group.blocks.push(freshBlock());markDirty();renderPanel();});blocksEditor(card,group.blocks);card.append(button('Remove assembly group',()=>removeVariation(t.groups,group),'bw-danger'));parent.append(card);
 }
 parent.append(button('+ Add assembly group',()=>{if(t.groups.length>=12)return message('Use up to twelve assembly groups.',true);t.groups.push({id:uid('group'),name:'New assembly group',replacePeriods:['5'],blocks:[]});markDirty();render();}));
}
function removeVariation(array,item){
 const referenced=workspace.days.some(d=>d.templateId===selected&&d.assignments.some(a=>a.groupId===item.id||a.lunchId===item.id));
 if(referenced)return message('Remove teacher assignments to this group in Dates before deleting it.',true);
 if(!confirm('Remove this draft group and its blocks?'))return;array.splice(array.indexOf(item),1);markDirty();render();
}
function renderDates(parent){
 heading(parent,'Dates & assignments','Choose the schedule for each date, then assign teacher lunch and assembly groups. These are saved drafts.');
 const add=node('div',undefined,'bw-inline'),date=node('input');date.type='date';date.value=$('preview-date').value;date.setAttribute('aria-label','New schedule date');
 add.append(date,button('+ Add date',()=>{if(!date.value)return;if(workspace.days.some(d=>d.date===date.value))return message('That date already has an assignment.',true);workspace.days.push({date:date.value,templateId:selected,notes:'',flyDay:false,absent:false,assignments:[]});markDirty();renderPanel();}));parent.append(add);
 for(const d of [...workspace.days].sort((a,b)=>a.date.localeCompare(b.date))){const card=node('section',undefined,'bw-card'),t=workspace.templates.find(t=>t.id===d.templateId);rowhead(card,d.date,()=>{if(!confirm('Remove the draft assignment for '+d.date+'?'))return;workspace.days.splice(workspace.days.indexOf(d),1);markDirty();renderPanel();},'Remove date');
  card.append(field('Schedule',d.templateId,v=>{if(d.assignments.length&&!confirm('Changing the schedule clears this date’s assembly and lunch assignments.')){renderPanel();return;}d.templateId=v;d.assignments=[];renderPanel();},{options:workspace.templates.map(t=>[t.id,t.name])}),field('Date notes',d.notes,v=>d.notes=v,{maxLength:1000}),grid(field('Fly Day',d.flyDay,v=>d.flyDay=v,{type:'checkbox'}),field('Teacher absence / stop Signals',d.absent,v=>d.absent=v,{type:'checkbox'})));
  for(const teacher of workspace.teachers){const a=d.assignments.find(a=>a.teacherId===teacher.id)||{teacherId:teacher.id,groupId:'',lunchId:''};
   const set=(key,value)=>{a[key]=value;if(!d.assignments.includes(a))d.assignments.push(a);};
   const c=node('div',undefined,'bw-card');c.append(node('strong',teacher.name),grid(field('Lunch override',a.lunchId,v=>set('lunchId',v),{options:[['','Teacher default'],...(t?.lunches||[]).map(l=>[l.id,l.name])]}),field('Assembly assignment',a.groupId,v=>set('groupId',v),{options:[['','Choose / none'],...(t?.groups||[]).map(g=>[g.id,g.name])]})));card.append(c);
  }
  card.append(button('Preview this date',()=>{$('preview-date').value=d.date;$('preview-selected').checked=false;selected=d.templateId;render();}));parent.append(card);
 }
}
function renderTeachers(parent){
 heading(parent,'Teachers & classes','Teacher profiles supply lunch defaults and prep names. Assembly assignments belong to individual dates.');
 parent.append(button('+ Add teacher',()=>{workspace.teachers.push({id:uid('teacher'),name:'New teacher',lunchId:'1',preps:[]});markDirty();render();}));
 for(const teacher of workspace.teachers){const card=node('section',undefined,'bw-card');card.append(grid(field('Teacher name',teacher.name,v=>{teacher.name=v;previewControls();}),field('Default lunch group ID',teacher.lunchId,v=>teacher.lunchId=v,{maxLength:80})));rowhead(card,'Classes / planning',()=>{const period=PERIODS.find(p=>!teacher.preps.some(c=>c.period===p));if(!period)return;teacher.preps.push({period,name:'',enrolled:false});markDirty();renderPanel();},'+ Add period');
  for(const prep of teacher.preps){const c=node('div',undefined,'bw-card');c.append(grid(field('Period',prep.period,v=>prep.period=v,{options:PERIODS.map(p=>[p,p])}),field('Prep / class name',prep.name,v=>prep.name=v)),field('Enrolled students in this period',prep.enrolled,v=>prep.enrolled=v,{type:'checkbox'}),button('Remove period',()=>{teacher.preps.splice(teacher.preps.indexOf(prep),1);markDirty();renderPanel();},'bw-danger'));card.append(c);}
  card.append(button('Remove teacher',()=>{if(!confirm('Remove this teacher profile and their draft date assignments?'))return;workspace.teachers.splice(workspace.teachers.indexOf(teacher),1);workspace.days.forEach(d=>d.assignments=d.assignments.filter(a=>a.teacherId!==teacher.id));markDirty();render();},'bw-danger'));parent.append(card);
 }
}
function renderHistory(parent){
 heading(parent,'Saved revisions','Each save creates a private revision. Restoring creates another revision, so your current saved work stays in history. The latest 30 saves are available here.');
 if(!history.length)return empty(parent,'No saved revisions yet. Your first save creates the workspace in the website backend.');
 for(const h of history){const row=node('article',undefined,'bw-history'),detail=node('div');detail.append(node('strong',new Date(h.updatedAt).toLocaleString('en-US',{timeZone:'America/Los_Angeles'})),node('p',h.actor+' · '+h.action));const b=button(h.revision===revision?'Current':'Restore',async()=>{if(!confirm('Restore this revision? Unsaved edits on this page will be replaced.'))return;await persist({operation:'restore',revision:h.revision});});b.disabled=h.revision===revision||saving;row.append(detail,b);parent.append(row);}
}
function renderPanel(){const p=$('panel');p.replaceChildren();document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));p.setAttribute('aria-labelledby','bw-tab-'+tab);({template:renderTemplate,dates:renderDates,teachers:renderTeachers,history:renderHistory}[tab])(p);}
function choose(select,options,value){select.replaceChildren(...options.map(([v,t])=>new Option(t,v)));select.value=options.some(([v])=>v===value)?value:options[0]?.[0]||'';}
function previewControls(reset=false){
 if(!workspace)return;const d=workspace.days.find(d=>d.date===$('preview-date').value),t=$('preview-selected').checked?template():workspace.templates.find(t=>t.id===d?.templateId);
 const teacherValue=$('preview-teacher').options.length?$('preview-teacher').value:workspace.teachers[0]?.id;
 choose($('preview-teacher'),[['','No teacher'],...workspace.teachers.map(t=>[t.id,t.name])],teacherValue);
 choose($('preview-lunch'),[['','Use assignment'],...(t?.lunches||[]).map(l=>[l.id,l.name])],reset?'':$('preview-lunch').value);
 choose($('preview-group'),[['','Use assignment'],...(t?.groups||[]).map(g=>[g.id,g.name])],reset?'':$('preview-group').value);preview();
}
function preview(){
 if(!workspace)return;const r=resolveSchedule(workspace,{date:$('preview-date').value,teacherId:$('preview-teacher').value,templateId:$('preview-selected').checked?selected:undefined,groupId:$('preview-group').value||undefined,lunchId:$('preview-lunch').value||undefined}),p=$('preview-body');p.replaceChildren();
 p.append(node('h3',r.template?.name||'No schedule assigned','bw-preview-title'),node('p',$('preview-date').value+' · America/Los_Angeles','bw-preview-date'));
 if(r.noSchool){empty(p,'No school. No class or signal blocks.');return;}
 const errors=r.issues.filter(i=>i.level==='error');if(!errors.length)p.append(node('p','✓ Timeline has no conflicting activity blocks.','bw-success'));
 for(const issue of r.issues){const n=node('p',issue.message,'bw-issue');n.dataset.level=issue.level;p.append(n);}
 if(r.absent)p.append(node('p','Absence flag: Signals would be stopped for this date.','bw-issue'));
 const list=node('ol',undefined,'bw-timeline');for(const b of r.blocks){const n=node('li',undefined,'bw-event');n.dataset.kind=b.kind;n.append(node('div',`${timeLabel(b.start)} – ${timeLabel(b.end)} · ${b.duration} min`,'bw-event-time'),node('strong',b.label));if(b.prep)n.append(node('p',b.prep+(b.flyDay?' · Fly Day':'')));list.append(n);}p.append(list);
 const details=node('details'),summary=node('summary','Signals feed preview');details.append(summary,node('p','Preview only. The live player still uses its existing feed.','bw-help'),node('pre',signalRows(r).map(row=>row.join(' | ')).join('\n')));p.append(details);
}
function render(){library();renderPanel();previewControls(true);updateSave();}
async function request(body){const r=await fetch('/api/bell-workspace',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(55000)});const data=await r.json();if(!r.ok)throw Object.assign(new Error(data.error||'Workspace unavailable.'),{status:r.status});return data;}
function apply(data){workspace=data.workspace;revision=data.revision;history=data.history;dirty=data.revision===null;if(!workspace.templates.some(t=>t.id===selected))selected=workspace.days.find(d=>d.date===schoolDate())?.templateId||workspace.templates[0]?.id;}
async function load(){
 if(loading||saving)return;if(dirty&&!confirm('Reload the saved version and discard unsaved changes?'))return;loading=true;const epoch=authEpoch;message('Opening your saved schedule workspace…');
 try{const data=await request();if(epoch!==authEpoch)return;apply(data);$('gate').hidden=true;$('shell').hidden=false;for(const key of ['save','reload','download'])$(key).hidden=false;render();message(data.updatedAt?'Saved '+new Date(data.updatedAt).toLocaleString('en-US',{timeZone:'America/Los_Angeles'})+' Pacific.':'Imported drafts ready. Save to begin your revision history.');}
 catch(e){if(epoch!==authEpoch)return;if(!workspace){$('gate').hidden=false;$('gate-message').textContent=e.message;$('signin').hidden=e.status!==401;$('retry').hidden=e.status===401;}message(e.message,true);}finally{loading=false;}
}
async function persist(payload={operation:'save',workspace}){
 if(saving)return;const errors=validateWorkspace(payload.workspace||workspace);if(payload.operation==='save'&&errors.length)return message(errors.join(' '),true);saving=true;const epoch=authEpoch;updateSave();document.querySelectorAll('#bw-shell input,#bw-shell select,#bw-shell textarea,#bw-shell button').forEach(n=>n.disabled=true);
 try{const data=await request({...payload,expectedRevision:revision});if(epoch!==authEpoch)return;apply(data);render();message('Draft saved to the website backend. Live schedules continue unchanged.');}
 catch(e){if(epoch===authEpoch)message(e.message,true);}finally{saving=false;document.querySelectorAll('#bw-shell input,#bw-shell select,#bw-shell textarea,#bw-shell button').forEach(n=>n.disabled=false);updateSave();if(workspace&&tab==='history')renderPanel();}
}
$('search').addEventListener('input',library);$('save').addEventListener('click',()=>persist());$('reload').addEventListener('click',load);$('retry').addEventListener('click',load);$('signin').addEventListener('click',()=>window.NestAuth?.open());
$('download').addEventListener('click',()=>{if(!workspace)return;const blob=new Blob([JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),workspace},null,2)],{type:'application/json'}),a=node('a');a.href=URL.createObjectURL(blob);a.download='nest-bell-draft-'+schoolDate()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
$('new-template').addEventListener('click',()=>{const t={id:uid('schedule'),name:'New schedule',color:'#72acf7',noSchool:false,lunchPeriod:'3',notes:'',blocks:[],lunches:[],groups:[]};workspace.templates.push(t);selected=t.id;tab='template';markDirty();render();});
const tabs=[...document.querySelectorAll('[data-tab]')];for(const b of tabs){b.addEventListener('click',()=>{tab=b.dataset.tab;renderPanel();});b.addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(tabs.indexOf(b)+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[i].focus();tabs[i].click();});}
$('preview-date').value=schoolDate();for(const key of ['preview-date','preview-teacher','preview-selected'])$(key).addEventListener('change',()=>previewControls(true));for(const key of ['preview-lunch','preview-group'])$(key).addEventListener('change',preview);
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
document.addEventListener('nest-auth-change',e=>{if(!e.detail?.signedIn){authEpoch++;workspace=undefined;dirty=false;$('shell').hidden=true;for(const key of ['save','reload','download'])$(key).hidden=true;$('gate').hidden=false;$('gate-message').textContent='Sign in to your NEST owner account.';$('signin').hidden=false;}else if(!workspace)load();});
load();
