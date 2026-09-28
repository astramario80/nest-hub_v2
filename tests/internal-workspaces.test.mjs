import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import weatherHandler from '../api/weather.mjs';
import hiringHandler from '../api/hiring-access.mjs';
import hiringViewHandler from '../api/hiring.mjs';

const code=fs.readFileSync('google-spinner/Code.js','utf8')+fs.readFileSync('google-spinner/Tracker.js','utf8')+fs.readFileSync('google-spinner/Weather.js','utf8')+fs.readFileSync('google-spinner/Hiring.js','utf8');
const serial=date=>Date.parse(date+'T00:00:00Z')/86400000+25569;
function context(role='Partner Liaison',options={}) {
  const calls=[];
  const rows=[['Period 1','','Division Manager','', 'manager@students.bethelsd.org'],['Period 2','',role,'','liaison@students.bethelsd.org'],['Advisory','','Partner Liaison','','advisory@students.bethelsd.org'],['CTSO','','Chief Executive Officer','','exec@students.bethelsd.org']];
  const dates=options.dates||[serial('2026-03-04'),serial('2026-09-28'),serial('2026-09-28')];
  const responses=options.responses||[['Old','','','Period 2'],['Current','','','Period 2'],['Other division','','','Period 1']];
  const rowCount=dates.length+9;
  const Sheets={Spreadsheets:{get:(id)=>{calls.push(['metadata',id]);return {sheets:[{properties:{sheetId:746267134,title:'Period 1',hidden:false,gridProperties:{rowCount}}},{properties:{sheetId:1427888033,title:'Period 2',hidden:false,gridProperties:{rowCount}}},{properties:{sheetId:336431884,title:'Advisory',hidden:false,gridProperties:{rowCount}}}]};},Values:{get:(id,range)=>{calls.push(['values',id,range]);if(range==="'Imported'!B2:F")return {values:rows};if(range.endsWith('C2:F6'))return {values:[["Today's Trimester 1","Pacing","Rigor","Safety"],['',3,2,5],['Trimester 1',3,2,5]]};if(range.endsWith('A9:M9'))return {values:[['Timestamp','Report']]};if(/!A10:A\d+$/.test(range))return {values:dates.map(value=>[value])};const match=range.match(/!A(\d+):M(\d+)$/);if(match)return {values:responses.slice(Number(match[1])-10,Number(match[2])-9)};return {values:[]};}}}};
  const Utilities={formatDate:()=>options.today||'2026-09-28'};
  const ctx=vm.createContext({Sheets,Utilities,console});vm.runInContext(code,ctx);return {ctx,calls};
}
test('weather bridge reads only the requested authorized division tab',()=>{
 const {ctx,calls}=context();
 const denied=ctx.weatherForMember_('manager@students.bethelsd.org','2',0);
 assert.equal(denied.status,403);assert.equal(calls.some(call=>call[0]==='metadata'&&call[1]==='1px1NzRmcf0sSRp0u3SZE4dKlYXbfagyHdRYNYGeNJM8'),false);
 const allowed=ctx.weatherForMember_('liaison@students.bethelsd.org','2',0);
 assert.equal(allowed.status,200);assert.equal(allowed.division,'Period 2');
 assert.equal(allowed.summary[1][1],'3');
 assert.equal(allowed.rows.length,1);
 assert.equal(calls.filter(call=>call[0]==='metadata'&&call[1]==='1px1NzRmcf0sSRp0u3SZE4dKlYXbfagyHdRYNYGeNJM8').length,1);
 assert.equal(allowed.rows[0][0],'Current');
 assert.deepEqual(calls.filter(call=>call[0]==='values'&&call[1]==='1px1NzRmcf0sSRp0u3SZE4dKlYXbfagyHdRYNYGeNJM8').map(call=>call[2]),["'Period 2'!C2:F6","'Period 2'!A9:M9","'Period 2'!A10:A12","'Period 2'!A11:M12"]);
 assert.equal(ctx.weatherForMember_('advisory@students.bethelsd.org','Advisory',0).status,200);
 assert.equal(ctx.weatherForMember_('liaison@students.bethelsd.org','bogus',0).status,400);
 assert.equal(ctx.weatherForMember_('liaison@students.bethelsd.org','7',0).status,400);
});
test('weather division list exposes only authorized periods',()=>{
 const {ctx}=context();
 assert.deepEqual(Array.from(ctx.weatherForMember_('liaison@students.bethelsd.org','mine').periods),['2']);
 const typo=context('Parnter Liaison');
 assert.deepEqual(Array.from(typo.ctx.weatherForMember_('liaison@students.bethelsd.org','mine').periods),['2']);
 const executive=ctx.weatherForMember_('exec@students.bethelsd.org','mine');
 assert.deepEqual(Array.from(executive.periods),['1','2','3','4','5','Advisory','CTSO']);
 assert.equal(ctx.weatherForMember_('exec@students.bethelsd.org','2',0).status,200);
 assert.equal(ctx.weatherForMember_('former@students.bethelsd.org','2',0).status,403);
 assert.equal(ctx.weatherForMember_('astramario@gmail.com','2',0).status,403);
 assert.equal(ctx.weatherForMember_('mpenalver@bethelsd.org','2',0).status,200);
 assert.equal(ctx.weatherForMember_('mario@memberhq.net','2',0).status,200);
});
test('weather responses paginate only matching rows from the current trimester',()=>{
 const dates=[serial('2025-09-28'),...Array(105).fill(serial('2026-09-28'))];
 const responses=[['Prior year','','','Period 2'],...Array.from({length:105},(_,index)=>['Current '+index,'','','Period 2'])];
 const {ctx}=context('Partner Liaison',{dates,responses});
 const first=ctx.weatherForMember_('liaison@students.bethelsd.org','2',0);
 const second=ctx.weatherForMember_('liaison@students.bethelsd.org','2',1);
 assert.equal(first.rows.length,100);assert.equal(first.rows[0][0],'Current 0');assert.equal(first.hasMore,true);
 assert.equal(second.rows.length,5);assert.equal(second.rows[0][0],'Current 100');assert.equal(second.hasMore,false);
 const outside=context('Partner Liaison',{dates,responses,today:'2027-07-01'}).ctx.weatherForMember_('liaison@students.bethelsd.org','2',0);
 assert.equal(outside.rows.length,0);assert.equal(outside.hasMore,false);
});
test('weather trimester boundaries follow the published school calendar',()=>{
 const dates=['2026-11-24','2026-11-25','2027-03-10','2027-03-11'].map(serial);
 const responses=dates.map((_,index)=>['Boundary '+index,'','','Period 2']);
 for(const [today,expected] of [['2026-11-24','Boundary 0'],['2026-11-25','Boundary 1'],['2027-03-10','Boundary 2'],['2027-03-11','Boundary 3']]) {
   const result=context('Partner Liaison',{dates,responses,today}).ctx.weatherForMember_('liaison@students.bethelsd.org','2',0);
   assert.equal(result.rows.at(-1)?.[0],expected);
 }
});
function response(){return {headers:{},statusCode:0,setHeader(k,v){this.headers[k]=v;return this;},status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;}};}
for(const [name,handler] of [['weather',weatherHandler],['hiring',hiringHandler],['hiring view',hiringViewHandler]])test(`${name} API rejects missing session and invalid division`,async()=>{
 const noSession=response();await handler({method:'GET',headers:{},query:{period:'1'}},noSession);assert.equal(noSession.statusCode,401);
 const badDivision=response();await handler({method:'GET',headers:{cookie:'__Host-nest-auth='+'a'.repeat(64)},query:{period:'4<script>'}},badDivision);assert.equal(badDivision.statusCode,400);
});

test('hiring workbook is resolved only from the matching period and managers cannot review another period',()=>{
 const {ctx}=context();
 const rows=[['Period 1','https://docs.google.com/spreadsheets/d/one/edit','Division Manager','','manager@students.bethelsd.org'],['Period 2','https://docs.google.com/spreadsheets/d/two/edit','Partner Liaison','','liaison@students.bethelsd.org']];
 assert.equal(ctx.hiringWorkbook_('1',rows),'one');
 assert.equal(ctx.hiringPermissions_('manager@students.bethelsd.org','1',rows).canManage,true);
 assert.equal(ctx.hiringPermissions_('manager@students.bethelsd.org','2',rows).canReview,false);
 assert.equal(ctx.hiringPermissions_('liaison@students.bethelsd.org','2',rows).canReview,false);
 rows.push(['CTSO','https://docs.google.com/spreadsheets/d/ctso/edit','Chief Executive Officer','','exec@students.bethelsd.org']);
 assert.equal(ctx.hiringPermissions_('exec@students.bethelsd.org','2',rows).canReview,true);
 assert.equal(ctx.hiringPermissions_('exec@students.bethelsd.org','2',rows).canManage,false);
});
