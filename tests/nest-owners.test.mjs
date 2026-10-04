import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {accountEmail,registrationEmail} from '../lib/nest-auth.mjs';
test('all three verified owner identities are eligible to sign in across NEST and use every bridge owner role',()=>{
 const emails=['mario@memberhq.net','mpenalver@bethelsd.org','astramario@gmail.com'];
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('google-spinner/Code.js','utf8')+'\nglobalThis.ownerIdentities=OWNER_EMAILS;',ctx);
 for(const email of emails){assert.equal(accountEmail(email),email);assert.equal(registrationEmail(email),email);assert.ok(ctx.ownerIdentities.includes(email));}
 assert.equal(registrationEmail('stranger@gmail.com'),'');
 for(const file of ['google-spinner/ServiceRequests.js','google-spinner/Weather.js','google-spinner/Fabrication.js','google-spinner/Hiring.js','google-spinner/DivisionSlides.js'])assert.match(fs.readFileSync(file,'utf8'),/OWNER_EMAILS\.includes/);
});
