import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

test('manager can choose a roster student and submit a position-scoped assignment',async()=>{
 const dom=new JSDOM(fs.readFileSync('hiring.html','utf8'),{runScripts:'outside-only',url:'https://gknest.org/hiring?period=1#manager-hiring'});
 const w=dom.window,requests=[];
 w.NestAuth={identity:{signedIn:true,email:'manager@students.bethelsd.org'},ready:Promise.resolve({signedIn:true}),open(){}};
 w.fetch=async (url,options={})=>{
   if(url.startsWith('/api/hiring?period=mine'))return {ok:true,json:async()=>({periods:['1']})};
   if(url.startsWith('/api/hiring?period=1'))return {ok:true,json:async()=>({division:'Division 1',canManage:true,columns:['Timestamp','Applicant'],applications:[['Today','Applicant']],team:[['Division Manager','Existing, Student','existing@students.bethelsd.org']],candidates:[{name:'Existing, Student',email:'existing@students.bethelsd.org'},{name:'New, Student',email:'new@students.bethelsd.org'}],hasMore:false})};
   requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({name:'New, Student',email:'new@students.bethelsd.org'})};
 };
 w.eval(fs.readFileSync('js/hiring.js','utf8'));
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.match(w.document.querySelector('#hiring-status').textContent,/application/i);
 const select=w.document.querySelector('#hiring-team select');assert.ok(select);
 select.value='new@students.bethelsd.org';w.document.querySelector('#hiring-team button').click();
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.deepEqual(requests,[{action:'assign',period:'1',row:3,position:'Division Manager',expectedName:'Existing, Student',expectedEmail:'existing@students.bethelsd.org',studentEmail:'new@students.bethelsd.org'}]);
 dom.window.close();
});
