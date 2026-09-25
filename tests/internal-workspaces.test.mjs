import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import weatherHandler from '../api/weather.mjs';
import hiringHandler from '../api/hiring-access.mjs';
import hiringViewHandler from '../api/hiring.mjs';

const code=fs.readFileSync('google-spinner/Code.js','utf8')+fs.readFileSync('google-spinner/Tracker.js','utf8')+fs.readFileSync('google-spinner/Weather.js','utf8')+fs.readFileSync('google-spinner/Hiring.js','utf8');
function context(role='Partner Liaison') {
  const calls=[];
  const rows=[['Period 1','','Division Manager','', 'manager@students.bethelsd.org'],['Period 2','',role,'','liaison@students.bethelsd.org']];
  const Sheets={Spreadsheets:{get:(id)=>{calls.push(['metadata',id]);return {sheets:[{properties:{title:'Period 1',hidden:false,gridProperties:{rowCount:200}}},{properties:{title:'Division 2',hidden:false,gridProperties:{rowCount:200}}},{properties:{title:'Period 3',hidden:false,gridProperties:{rowCount:200}}}]};},Values:{get:(id,range)=>{calls.push(['values',id,range]);if(range==="'Imported'!B2:F")return {values:rows};if(range.endsWith('A9:M9'))return {values:[['Timestamp','Report']]};return {values:[['A','','','Period 2'],['B','','','Period 1']]};}}}};
  const ctx=vm.createContext({Sheets,console});vm.runInContext(code,ctx);return {ctx,calls};
}
test('weather bridge reads only the requested authorized division tab',()=>{
 const {ctx,calls}=context();
 const denied=ctx.weatherForMember_('manager@students.bethelsd.org','2',0);
 assert.equal(denied.status,403);assert.equal(calls.some(call=>call[0]==='metadata'&&call[1]==='1px1NzRmcf0sSRp0u3SZE4dKlYXbfagyHdRYNYGeNJM8'),false);
 const allowed=ctx.weatherForMember_('liaison@students.bethelsd.org','2',0);
 assert.equal(allowed.status,200);assert.equal(allowed.division,'Division 2');
 assert.equal(allowed.rows.length,1);
 assert.equal(calls.filter(call=>call[0]==='metadata'&&call[1]==='1px1NzRmcf0sSRp0u3SZE4dKlYXbfagyHdRYNYGeNJM8').length,1);
 assert.deepEqual(calls.filter(call=>call[0]==='values'&&call[1]==='1px1NzRmcf0sSRp0u3SZE4dKlYXbfagyHdRYNYGeNJM8').map(call=>call[2]),["'Division 2'!A9:M9","'Division 2'!A10:M109"]);
 assert.equal(ctx.weatherForMember_('liaison@students.bethelsd.org','bogus',0).status,400);
 assert.equal(ctx.weatherForMember_('liaison@students.bethelsd.org','7',0).status,400);
});
test('weather division list exposes only authorized periods',()=>{
 const {ctx}=context();
 assert.deepEqual(Array.from(ctx.weatherForMember_('liaison@students.bethelsd.org','mine').periods),['2']);
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
