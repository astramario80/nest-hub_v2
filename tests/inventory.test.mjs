import {staffContext} from './helpers/staff-context.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import handler from '../api/inventory.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
function harness(){
 const state={values:[['Status','Kit #','Student (Period)','Notes','Calculated'],['Available','001','','','Formula result'],['Assigned','002','Test (P1)','','']],formulas:[['','','','',''],['','','','','=A2'],['','','','','']],writes:[],leaders:[['Period 1','','Director of Inventory','','director@students.bethelsd.org']]};
 const list=options=>({getCriteriaType:()=> 'LIST',getCriteriaValues:()=>[options]});
 const rules=()=>state.values.map((r,i)=>r.map((_,c)=>i&&c===0?list(['Available','Assigned','Repair']):i&&c===2?list(['Test (P1)','Other (P2)']):null));
 const sheet={getName:()=> 'EE Kits',getSheetId:()=>1,getLastRow:()=>state.values.length,getLastColumn:()=>5,getRange:()=>({getDisplayValues:()=>state.values,getFormulas:()=>state.formulas,getDataValidations:rules})};
 const book={getSheets:()=>[sheet],getSheetByName:()=>({getSheetId:()=>9})};
 const ctx=staffContext({SpreadsheetApp:{DataValidationCriteria:{VALUE_IN_LIST:'LIST',VALUE_IN_RANGE:'RANGE'}},Sheets:{Spreadsheets:{Values:{get:()=>({values:state.leaders})},batchUpdate:body=>{state.writes.push(body);for(const update of body.requests){const cell=update.updateCells;if(cell)state.values[cell.range.startRowIndex][cell.range.startColumnIndex]=cell.rows[0].values[0].userEnteredValue.stringValue;}return {};}}},hash_:hash,email_:v=>String(v||'').toLowerCase(),memberEmail_:v=>v,OWNER_EMAILS:['owner@bethelsd.org'],LEADERSHIP_DATABASE:'leaders',PERIODS:{'1':'one','2':'two'},Date});
 vm.runInContext(fs.readFileSync('google-spinner/Inventory.js','utf8'),ctx);return {ctx,state,book};
}
test('only current inventory directors and owner can manage assignments',()=>{
 const {ctx,state}=harness();assert.equal(ctx.inventoryAllowed_('director@students.bethelsd.org'),true);assert.equal(ctx.inventoryAllowed_('student@students.bethelsd.org'),false);assert.equal(ctx.inventoryAllowed_('owner@bethelsd.org'),true);
 state.leaders[0][2]='Division Manager';assert.equal(ctx.inventoryAllowed_('director@students.bethelsd.org'),false);
 state.leaders[0][2]='Inventory Director';assert.equal(ctx.inventoryAllowed_('director@students.bethelsd.org'),true);
});
test('sheet headings, dropdown lists and formulas define the editor',()=>{
 const {ctx,book}=harness(),result=ctx.inventoryView_({type:'kits',page:0},book),row=result.records[0];
 assert.equal(row.number,'001');assert.equal(row.cells.find(c=>c.label==='Notes').editable,true);assert.equal(row.cells.find(c=>c.label==='Calculated').editable,false);assert.deepEqual(Array.from(result.choices[row.cells[0].choices]),['Available','Assigned','Repair']);assert.equal('row' in row,false);
});
test('save writes only selected cells and audit record atomically and rejects stale edits',()=>{
 const {ctx,state,book}=harness(),row=ctx.inventoryView_({type:'kits',page:0},book).records[0];
 const request={type:'kits',id:row.id,version:row.version,changes:[{column:2,value:'Test (P1)'},{column:3,value:'=IMPORTDATA("unsafe")'}]};
 assert.equal(ctx.inventorySave_('director',request,book).status,200);assert.equal(state.writes.length,1);assert.equal(state.writes[0].requests.length,3);assert.equal(state.values[1][2],'Test (P1)');assert.equal(state.values[1][3],'=IMPORTDATA("unsafe")');assert.equal(ctx.inventorySave_('director',request,book).status,409);
});
test('invalid choices, formulas, device IDs and duplicate cells cannot be written',()=>{
 for(const changes of [[{column:2,value:'Not a roster entry'}],[{column:4,value:'override'}],[{column:1,value:'003'}],[{column:0,value:'Assigned'},{column:0,value:'Available'}]]){
  const {ctx,state,book}=harness(),row=ctx.inventoryView_({type:'kits',page:0},book).records[0];assert.equal(ctx.inventorySave_('director',{type:'kits',id:row.id,version:row.version,changes},book).status,400);assert.equal(state.writes.length,0);
 }
});
test('duplicate device numbers, changed validation and removed equipment reject stale saves',()=>{
 const {ctx,state,book}=harness(),row=ctx.inventoryView_({type:'kits',page:0},book).records[0],request={type:'kits',id:row.id,version:row.version,changes:[{column:2,value:''}]};
 state.values[2][1]='001';assert.equal(ctx.inventorySave_('director',request,book).status,409);state.values[2][1]='002';state.values.splice(1,1);assert.equal(ctx.inventorySave_('director',request,book).status,409);
});
test('clearing assignments is supported; unknown sheet layouts fail closed',()=>{
 const {ctx,state,book}=harness(),row=ctx.inventoryView_({type:'kits',page:0},book).records[1];assert.equal(ctx.inventorySave_('director',{type:'kits',id:row.id,version:row.version,changes:[{column:2,value:''}]},book).status,200);assert.equal(state.values[2][2],'');state.values[0][1]='Unknown header';assert.throws(()=>ctx.inventoryRead_(book,'kits'),/headers/);
});
function response(){return {setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};}
test('API requires authentication, same-origin writes and bounded fields',async()=>{
 const unauth=response();await handler({method:'GET',headers:{},query:{}},unauth);assert.equal(unauth.code,401);
 const headers={cookie:'__Host-nest-auth='+'a'.repeat(64),'content-type':'application/json',origin:'https://evil.example'};
 const cross=response();await handler({method:'POST',headers,body:{}},cross);assert.equal(cross.code,403);
 const invalid=response();await handler({method:'POST',headers:{...headers,origin:'https://gknest.org'},body:{type:'kits',id:'a'.repeat(64),version:'b'.repeat(64),changes:[{column:31,value:'bad'}]}},invalid);assert.equal(invalid.code,400);
});
async function browser(){
 const dom=new JSDOM(fs.readFileSync('purchasing.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/purchasing#equipment'}),w=dom.window;
 const state={calls:[],saveStatus:200};w.NestAuth={identity:{signedIn:true},ready:Promise.resolve(),open(){}};w.confirm=()=>false;
 w.fetch=async(url,options)=>{state.calls.push({url,options});const body=options.method==='POST'?{saved:true}:{records:[{id:'a'.repeat(64),version:'b'.repeat(64),number:'001',cells:[{column:0,label:'Status',value:'Available',editable:true,choices:'status'},{column:2,label:'Student',value:'',editable:true,choices:'students'},{column:3,label:'Notes',value:'Private notes',editable:true}]}],choices:{status:['Available','Assigned'],students:['Test (P1)']},catalogVersion:'d'.repeat(64),idLabel:'Equipment ID',serialLabel:'Serial number',total:1,page:0,hasMore:false};return {ok:options.method!=='POST'||state.saveStatus===200,status:options.method==='POST'?state.saveStatus:200,json:async()=>options.method==='POST'&&state.saveStatus!==200?{error:'Refresh before saving.'}:body};};
 w.eval(fs.readFileSync('js/inventory-management.js','utf8'));assert.equal(state.calls.length,0);w.NestEquipment.open();await new Promise(r=>setTimeout(r,15));return {dom,w,state};
}
test('director UI protects drafts, saves exact changes and clears private fields on logout',async()=>{
 const {dom,w,state}=await browser();try{
  w.document.querySelector('.equipment-item').click();const student=w.document.querySelector('select[data-column="2"]');student.value='Test (P1)';student.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(w.document.querySelector('#equipment-save').disabled,false);
  w.document.querySelector('[data-type="drones"]').click();assert.equal(state.calls.length,1);assert.equal(student.value,'Test (P1)');
  w.document.querySelector('#equipment-edit').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,15));const saved=JSON.parse(state.calls.find(c=>c.options.method==='POST').options.body);assert.deepEqual(saved.changes,[{column:2,value:'Test (P1)'}]);assert.equal(state.calls.length,3);
  w.NestAuth.identity.signedIn=false;w.document.dispatchEvent(new w.Event('nest-auth-change'));assert.equal(w.document.querySelector('#equipment-workspace').hidden,true);assert.equal(w.document.querySelector('#equipment-fields').textContent,'');assert.equal(w.document.querySelector('#equipment-list').textContent,'');
 }finally{dom.window.close();}
});
test('conflict responses preserve assignment draft for review',async()=>{
 const {dom,w,state}=await browser();try{state.saveStatus=409;w.document.querySelector('.equipment-item').click();const notes=w.document.querySelector('#equipment-fields textarea');notes.value='Unsaved repair note';notes.dispatchEvent(new w.Event('input',{bubbles:true}));w.document.querySelector('#equipment-edit').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,15));assert.equal(notes.value,'Unsaved repair note');assert.equal(w.document.querySelector('#equipment-draft').textContent,'Unsaved changes');assert.match(w.document.querySelector('#equipment-message').textContent,/Refresh/);}finally{dom.window.close();}
});

test('live workbook ID headings start on row 2; formulas and actual status choices are preserved',()=>{
 const {ctx,book,state}=harness();state.values.unshift(['GO BACK','','','','']);state.formulas.unshift(['','','','','']);state.values[1]=['Status','ID','Assigned Student','Notes','Calculated'];
 const view=ctx.inventoryView_({type:'kits',page:0},book);assert.equal(view.records[0].number,'001');assert.equal(view.records[0].cells.find(c=>c.label==='Assigned Student').editable,true);
});
test('whole-column dropdowns are bounded, cached and exclude headers and spreadsheet errors',()=>{
 const {ctx}=harness();let reads=0;
 const sheet={getSheetId:()=>99,getLastRow:()=>5,getRange:(row,col,height,width)=>{assert.deepEqual([row,col,height,width],[1,4,5,1]);reads++;return {getDisplayValues:()=>[['Status'],['Operational'],['Stand-By'],['#N/A'],['']]};}};
 const range={getSheet:()=>sheet,getA1Notation:()=> 'D:D',getNumRows:()=>1000000,getNumColumns:()=>1,getRow:()=>1,getColumn:()=>4};
 const rule={getCriteriaType:()=> 'RANGE',getCriteriaValues:()=>[range]},cache={};
 assert.deepEqual(Array.from(ctx.inventoryOptions_(rule,cache)),['Operational','Stand-By']);ctx.inventoryOptions_(rule,cache);assert.equal(reads,1);
});
test('laptop matrix recognizes Computer Station and keeps per-period lists, guest text and formula IDs',()=>{
 const {ctx}=harness(),values=[['GO BACK','',''],['Computer Station','Period 1','Guest'],['1','Sample, Student','Visiting teacher']],formulas=[['','',''],['','',''],['=A2+1','','']];
 const rule={getCriteriaType:()=> 'LIST',getCriteriaValues:()=>[['Sample, Student']]};
 const sheet={getName:()=> 'Laptops',getSheetId:()=>3,getLastRow:()=>4,getLastColumn:()=>3,getRange:()=>({getDisplayValues:()=>[...values,['2','','']],getFormulas:()=>[...formulas,['=A3+1','','']],getDataValidations:()=>[[null,null,null],[null,null,null],[null,rule,null],[null,null,null]]})};
 const view=ctx.inventoryView_({type:'laptops',page:0},{getSheets:()=>[sheet]});assert.equal(view.records.length,2);assert.equal(view.records[0].cells.find(c=>c.label==='Guest').editable,true);assert.equal(view.records[1].cells.find(c=>c.label==='Period 1').editable,true);assert.deepEqual(Array.from(view.choices[view.records[1].cells[0].choices]),['Sample, Student']);
});
test('drone equipment remains editable free text without adding dropdown choices',()=>{
 const {ctx,book,state}=harness();state.values[0][3]='Equipment';book.getSheets()[0].getName=()=> 'Drones';
 const row=ctx.inventoryView_({type:'drones',page:0},book).records[0];assert.equal(row.cells.find(c=>c.label==='Equipment').editable,true);assert.equal(ctx.inventorySave_('director',{type:'drones',id:row.id,version:row.version,changes:[{column:3,value:'Controller + 2 batteries'}]},book).status,200);
});
test('public mirror replaces category atomically and publishes only scrubbed student names',()=>{
 const {ctx,book,state}=harness();state.values[0]=['Status','ID','Assigned Student','Notes','Calculated'];state.values[1][2]='Surname, Sample';
 vm.runInContext(`Sheets.Spreadsheets.Values.get=()=>({values:[['Surname, Sample','4']]});Sheets.Spreadsheets.get=()=>({sheets:[{properties:{sheetId:44,title:'EE Kits',gridProperties:{rowCount:100,columnCount:4}}}]});`,ctx);
 const writes=[];ctx.Sheets.Spreadsheets.batchUpdate=(body,id)=>writes.push({body,id});ctx.inventorySyncPublic_(book,'kits');
 assert.equal(writes.length,1);assert.equal(writes[0].id,'1DvIrekgpOo_gJJat8SiP3MYHr44389yJm6mNq_5OML0');const update=writes[0].body.requests[1].updateCells;assert.equal(update.rows[0].values[2].userEnteredValue.stringValue,'Sample (P4)');assert.equal(JSON.stringify(writes).includes('Surname'),false);assert.equal(update.range.endRowIndex,100);assert.ok(writes[0].body.requests[0].setDataValidation);
});
test('a public mirror failure never reports an already-saved assignment as failed',()=>{
 const {ctx,book,state}=harness(),row=ctx.inventoryView_({type:'kits',page:0},book).records[0];
 const result=ctx.inventorySave_('director',{type:'kits',id:row.id,version:row.version,changes:[{column:2,value:'Test (P1)'}]},book);assert.equal(result.saved,true);assert.equal(result.mirrorSync,'pending');assert.equal(state.values[1][2],'Test (P1)');
});

test('dispatcher rechecks session and current director role for reads, saves and syncs',()=>{
 const {ctx,book,state}=harness();ctx.PropertiesService={getScriptProperties:()=>({})};ctx.SpreadsheetApp.openById=()=>book;ctx.authSession_=()=>null;
 assert.equal(ctx.inventoryDispatch_({operation:'view',type:'kits',page:0}).status,401);
 ctx.authSession_=()=>({email:'student@students.bethelsd.org'});assert.equal(ctx.inventoryDispatch_({operation:'sync',type:'kits'}).status,403);
 ctx.authSession_=()=>({email:'director@students.bethelsd.org'});assert.equal(ctx.inventoryDispatch_({operation:'view',type:'kits',page:0}).status,200);
 state.leaders=[];assert.equal(ctx.inventoryDispatch_({operation:'save',type:'kits'}).status,403);assert.equal(state.writes.length,0);
});
test('public mirror uses the saved snapshot instead of a stale SpreadsheetApp read',()=>{
 const {ctx,book}=harness(),snapshot=ctx.inventoryRead_(book,'kits');snapshot.values[0][2]='Surname, Newly Assigned';
 vm.runInContext(`Sheets.Spreadsheets.Values.get=()=>({values:[['Surname, Newly Assigned','2']]});Sheets.Spreadsheets.get=()=>({sheets:[{properties:{sheetId:44,title:'EE Kits',gridProperties:{rowCount:100,columnCount:4}}}]});`,ctx);
 let mirror;ctx.Sheets.Spreadsheets.batchUpdate=body=>mirror=body;ctx.inventorySyncPublic_(book,'kits',snapshot);assert.equal(mirror.requests[1].updateCells.rows[0].values[2].userEnteredValue.stringValue,'Newly Assigned (P2)');
});
test('manual public sync preserves unsaved edits and sends only the category',async()=>{
 const {dom,w,state}=await browser();try{
  w.document.querySelector('.equipment-item').click();const notes=w.document.querySelector('#equipment-fields textarea');notes.value='Draft repair note';notes.dispatchEvent(new w.Event('input',{bubbles:true}));
  w.document.querySelector('#equipment-sync').click();await new Promise(r=>setTimeout(r,15));const body=JSON.parse(state.calls.find(c=>c.options.method==='POST').options.body);assert.deepEqual(body,{operation:'sync',type:'kits'});assert.equal(notes.value,'Draft repair note');assert.equal(w.document.querySelector('#equipment-draft').textContent,'Unsaved changes');
 }finally{dom.window.close();}
});

function catalogHarness(){
 const h=harness(),{ctx,state,book}=h,sheet=book.getSheets()[0];
 sheet.getMaxRows=()=>1000;sheet.getMaxColumns=()=>10;sheet.getLastColumn=()=>state.values[0].length;
 sheet.getRange=()=>({getDisplayValues:()=>state.values.map(row=>Array.from({length:state.values[0].length},(_,c)=>row[c]||'')),getFormulas:()=>state.values.map((_,r)=>Array.from({length:state.values[0].length},(_,c)=>state.formulas[r]?.[c]||'')),getDataValidations:()=>state.values.map((row,r)=>Array.from({length:state.values[0].length},(_,c)=>r&&c===2?{getCriteriaType:()=> 'LIST',getCriteriaValues:()=>[['Test (P1)','Other (P2)']]}:null))});
 ctx.Sheets.Spreadsheets.batchUpdate=body=>{state.writes.push(body);for(const request of body.requests){const update=request.updateCells;if(!update)continue;for(const [r,row] of update.rows.entries()){const index=update.range.startRowIndex+r;state.values[index]||=[];state.formulas[index]||=[];for(const [c,cell] of row.values.entries()){state.values[index][update.range.startColumnIndex+c]=cell.userEnteredValue?.stringValue||'';state.formulas[index][update.range.startColumnIndex+c]='';}}}};
 return h;
}
function catalogRequest(ctx,book,change,extra={}){const view=ctx.inventoryView_({type:'kits',page:0},book);return {type:'kits',change,catalogVersion:view.catalogVersion,id:view.records[0]?.id,version:view.records[0]?.version,...extra};}
test('equipment ID and serial edits preserve assignments and materialize generated IDs without renumbering neighbors',()=>{
 const {ctx,book,state}=catalogHarness();state.formulas[2][1]='=B2+1';
 const result=ctx.inventoryManage_('director',catalogRequest(ctx,book,'edit',{number:'009',serial:'SN-101'}),book);
 assert.equal(result.saved,true);assert.equal(state.values[1][1],'009');assert.equal(state.values[2][1],'002');assert.equal(state.values[2][2],'Test (P1)');assert.equal(state.formulas[2][1],'');assert.equal(state.values[0][5],'Serial Number');assert.equal(state.values[1][5],'SN-101');assert.ok(state.writes[0].requests.some(r=>r.appendCells));
});
test('equipment creation copies validation but does not copy another student assignment',()=>{
 const {ctx,book,state}=catalogHarness(),body=catalogRequest(ctx,book,'add',{number:'003',serial:'USB-333'});const result=ctx.inventoryManage_('director',body,book);assert.equal(result.saved,true);assert.equal(state.values[3][1],'003');assert.equal(state.values[3][2]||'','');assert.ok(state.writes[0].requests.some(r=>r.copyPaste?.pasteType==='PASTE_DATA_VALIDATION'));assert.equal(ctx.inventoryManage_('director',body,book).status,409);
});
test('duplicate IDs, duplicate serials, stale equipment edits and malformed identifiers are rejected',()=>{
 const {ctx,book,state}=catalogHarness();assert.equal(ctx.inventoryManage_('director',catalogRequest(ctx,book,'edit',{number:'2',serial:''}),book).status,409);
 assert.equal(ctx.inventoryManage_('director',catalogRequest(ctx,book,'add',{number:'=formula',serial:''}),book).status,400);
 ctx.inventoryManage_('director',catalogRequest(ctx,book,'edit',{number:'001',serial:'SN-1'}),book);
 assert.equal(ctx.inventoryManage_('director',catalogRequest(ctx,book,'add',{number:'003',serial:'sn-1'}),book).status,409);assert.equal(state.writes.length,1);
});
test('removing equipment preserves history, leaves other row positions intact and blocks assigned items',()=>{
 const {ctx,book,state}=catalogHarness(),assigned=ctx.inventoryView_({type:'kits',page:0},book).records[1];
 assert.equal(ctx.inventoryManage_('director',{type:'kits',change:'remove',id:assigned.id,version:assigned.version},book).status,409);
 assert.equal(ctx.inventoryManage_('director',catalogRequest(ctx,book,'remove'),book).saved,true);assert.ok(state.values[1].every(v=>!v));assert.equal(state.values[2][1],'002');assert.equal(state.values[2][2],'Test (P1)');assert.ok(state.writes[0].requests.some(r=>r.appendCells));assert.equal(state.writes[0].requests.some(r=>r.deleteDimension),false);
});
test('computer register exposes the actual serial while withholding submitter emails and timestamps',()=>{
 const {ctx}=harness(),values=[['Timestamp','What is your computer number?','What is the barcode of the device?','Email Address','Station'],['Private timestamp','01','44219719','private@students.bethelsd.org','Station: 01; BSD Serial Number: 44219719']];
 const sheet={getSheetId:()=>42,getLastRow:()=>2,getLastColumn:()=>5,getRange:()=>({getDisplayValues:()=>values,getFormulas:()=>values.map(row=>row.map(()=>''))})},book={getSheetByName:()=>sheet};
 const view=ctx.inventoryView_({type:'computers',page:0},book);assert.equal(view.records[0].serial,'44219719');assert.equal(view.records[0].number,'01');assert.equal(JSON.stringify(view).includes('private@'),false);assert.equal(JSON.stringify(view).includes('Private timestamp'),false);assert.equal(view.records[0].cells[0].editable,false);
});
test('equipment API validates new actions and never lets callers choose source workbooks',async()=>{
 const old=globalThis.fetch,env={url:process.env.SPINNER_BRIDGE_URL,token:process.env.SPINNER_BRIDGE_TOKEN};process.env.SPINNER_BRIDGE_URL='https://script.google.com/test';process.env.SPINNER_BRIDGE_TOKEN='test';let sent;
 globalThis.fetch=async(_url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({status:200,saved:true,mirrorSync:'updated',id:'c'.repeat(64),page:0})};};
 try{const res=response();await handler({method:'POST',headers:{cookie:'__Host-nest-auth='+'a'.repeat(64),origin:'https://gknest.org','content-type':'application/json'},body:{operation:'manage',change:'edit',type:'computers',id:'b'.repeat(64),version:'c'.repeat(64),number:'01',serial:'44219719',spreadsheetId:'attacker'}},res);assert.equal(res.code,200);assert.equal(sent.operation,'manage');assert.equal('spreadsheetId' in sent,false);assert.equal(res.data.id,'c'.repeat(64));}finally{globalThis.fetch=old;for(const [key,value] of [['SPINNER_BRIDGE_URL',env.url],['SPINNER_BRIDGE_TOKEN',env.token]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test('equipment editor opens add/edit/remove forms and clears their private values on logout',async()=>{
 const {dom,w,state}=await browser();try{
  const d=w.document;assert.equal(d.querySelector('#equipment-add').disabled,false);d.querySelector('#equipment-add').click();assert.equal(d.querySelector('#equipment-manage-dialog').open,true);assert.match(d.querySelector('#equipment-manage-title').textContent,/Add/);
  d.querySelector('#equipment-number').value='003';d.querySelector('#equipment-serial').value='SN-3';d.querySelector('#equipment-manage-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,15));const sent=JSON.parse(state.calls.find(c=>c.options.method==='POST').options.body);assert.equal(sent.change,'add');assert.equal(sent.number,'003');assert.equal(sent.serial,'SN-3');assert.equal(sent.catalogVersion,'d'.repeat(64));assert.equal(d.querySelector('#equipment-manage-dialog').open,false);
  d.querySelector('.equipment-item').click();d.querySelector('#equipment-details').click();assert.equal(d.querySelector('#equipment-number').value,'001');d.querySelector('#equipment-manage-cancel').click();d.querySelector('#equipment-remove').click();assert.match(d.querySelector('#equipment-manage-help').textContent,/history/);assert.equal(d.querySelector('#equipment-manage-fields').hidden,true);
  w.NestAuth.identity.signedIn=false;d.dispatchEvent(new w.Event('nest-auth-change'));assert.equal(d.querySelector('#equipment-manage-dialog').open,false);assert.equal(d.querySelector('#equipment-number').value,'');assert.equal(d.querySelector('#equipment-serial').value,'');
 }finally{dom.window.close();}
});
test('room machine editor converts uploaded icons and includes the shared image in its save',async()=>{const {dom,w,state}=await browser();try{const d=w.document;d.querySelector('[data-type="machines"]').click();await new Promise(r=>setTimeout(r,15));d.querySelector('#equipment-add').click();assert.equal(d.querySelector('#equipment-machine-fields').hidden,false);w.createImageBitmap=async()=>({width:400,height:200,close(){}});w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});const icon='data:image/webp;base64,UklGRgAAAABXRUJQ';w.HTMLCanvasElement.prototype.toDataURL=()=>icon;const input=d.querySelector('#equipment-machine-icon');Object.defineProperty(input,'files',{value:[new w.File(['image'],'machine.png',{type:'image/png'})]});input.dispatchEvent(new w.Event('change'));await new Promise(r=>setTimeout(r,5));assert.equal(d.querySelector('#equipment-machine-icon-preview').src,icon);d.querySelector('#equipment-number').value='Laser CNC';d.querySelector('#equipment-serial').value='LASER1';d.querySelector('#equipment-machine-type').value='laser-cnc';d.querySelector('#equipment-manage-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,15));const sent=state.calls.filter(c=>c.options.method==='POST').map(c=>JSON.parse(c.options.body)).at(-1);assert.equal(sent.type,'machines');assert.equal(sent.icon,icon);assert.equal(sent.machineType,'laser-cnc');}finally{dom.window.close();}});
