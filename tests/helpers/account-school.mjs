import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';
const source=fs.readFileSync(new URL('../../google-spinner/Code.js',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../../google-spinner/DivisionSlides.js',import.meta.url),'utf8');
export function accountSchool() {
  let now=1_000_000_000, accounts=[], sent=[],leaders=[],failAuditUpdate=false,failSort=false,allowedHeader='',recoveryHeader='',linkedHeader='',mailMode='accepted',notesHeader='',columns=12;
  const state=new Map(),store={getProperty:key=>state.get(key)||null,setProperty:(key,value)=>state.set(key,value),deleteProperty:key=>state.delete(key),getProperties:()=>Object.fromEntries(state)};
  const cacheState=new Map(),cache={get:key=>cacheState.get(key)?.expires>now?cacheState.get(key).value:null,put:(key,value,seconds)=>cacheState.set(key,{value,expires:now+seconds*1000}),remove:key=>cacheState.delete(key)};
  const lock={tryLock:()=>true,releaseLock:()=>{}};
  const values={
    get(_id,range){
      if(range.includes('StudentNESTAccess')&&range.includes('!L')&&columns<12)throw Error('Range exceeds grid limits');
      if(range.includes('StudentNESTAccess')&&range==="'StudentNESTAccess'!L2:L")return {values:accounts.map(row=>[row[11]||''])};
      if(range.includes('StudentNESTAccess')&&range.endsWith('L1'))return {values:notesHeader?[[notesHeader]]:[]};
      if(range.includes('StudentNESTAccess')&&range.includes('I1'))return {values:allowedHeader?[[allowedHeader,recoveryHeader,linkedHeader]]:[]};
      if(range.includes('StudentNESTAccess'))return {values:accounts};
      if(range.includes("'Imported'"))return {values:leaders};
      if(range.includes("'Period 1'"))return {values:[['Student','','student@students.bethelsd.org']]};
      return {values:[]};
    },
    update(resource,_id,range){if(range.includes('I1')){allowedHeader=resource.values[0][0];recoveryHeader=resource.values[0][1];linkedHeader=resource.values[0][2];return {};}if(failAuditUpdate)throw new Error('Audit column unavailable');accounts[Number(range.match(/H(\d+)/)[1])-2][7]=resource.values[0][0];return {};},
    batchUpdate(resource){for(const item of resource.data){const match=item.range.match(/!([A-L])(\d+)/),value=item.values[0];if(match[1]==='L'&&match[2]==='1'){notesHeader=value[0];continue;}const row=accounts[Number(match[2])-2];if(match[1]==='A')row[0]=value[0];if(match[1]==='C'){row[2]=value[0];row[3]=value[1];}if(match[1]==='E')row[4]=value[0];if(match[1]==='F')row[5]=value[0];if(match[1]==='L')row[11]=value[0];}return {};},
    append(resource){accounts.push(resource.values[0]);return {};}
  };
  const batchUpdate=({requests})=>{for(const request of requests){
    if(request.appendDimension){assert.equal(request.appendDimension.dimension,'COLUMNS');columns+=request.appendDimension.length;}
    if(request.insertDimension)accounts.splice(request.insertDimension.range.startIndex-1,0,[]);
    if(request.updateCells)accounts[request.updateCells.range.startRowIndex-1]=request.updateCells.rows[0].values.map(cell=>Object.values(cell.userEnteredValue)[0]);
    if(request.sortRange){assert.equal(request.sortRange.range.endColumnIndex,12,'Account sorts must preserve Administrator Notes');if(failSort)throw new Error('Sort unavailable');accounts.sort((a,b)=>String(a[0]).localeCompare(String(b[0])));}
  }return {};};
  const ctx=vm.createContext({Date:class extends Date{static now(){return now;}},console,Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,input)=>[...createHash('sha256').update(input).digest()]},PropertiesService:{getScriptProperties:()=>store},CacheService:{getScriptCache:()=>cache},LockService:{getScriptLock:()=>lock},Sheets:{Spreadsheets:{Values:values,get:(_id,options)=>options?.fields?.includes('properties(sheetId,title')?{sheets:[{properties:{sheetId:57426151,title:'StudentNESTAccess',gridProperties:{columnCount:columns}}}]}:{sheets:[]},batchUpdate}},UrlFetchApp:{fetch:(url,options)=>{assert.equal(url,'https://api.postmarkapp.com/email');assert.equal(options.followRedirects,false);assert.equal(options.headers['X-Postmark-Server-Token'],'test-mail-token');const message=JSON.parse(options.payload);sent.push({...message,htmlBody:message.HtmlBody,body:message.TextBody});if(mailMode==='throw')throw new Error('Provider unavailable');return {getResponseCode:()=>mailMode==='rejected'?422:200,getContentText:()=>mailMode==='malformed'?'invalid':JSON.stringify({ErrorCode:mailMode==='rejected'?406:0,MessageID:'provider-message'})};}},MailApp:{getRemainingDailyQuota:()=>100,sendEmail:message=>sent.push(message)}});
  vm.runInContext(source,ctx);
  return {ctx,call:request=>JSON.parse(JSON.stringify(ctx.authDispatch_({accountMailToken:'test-mail-token',...request}))),tool:request=>JSON.parse(JSON.stringify(ctx.dispatch_(request))),manager:(identity,period)=>ctx.manager_(identity,period),state,sent,accounts,setColumns:value=>columns=value,getColumns:()=>columns,setLeaders:value=>leaders=value,setAuditFailure:value=>failAuditUpdate=value,setSortFailure:value=>failSort=value,setMailMode:value=>mailMode=value,advance:ms=>now+=ms};
}
