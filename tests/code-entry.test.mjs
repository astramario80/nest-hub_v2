import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const tool of ['spinner','trip-o-meter'])for(const fails of [false,true]){
  test(`${tool}: first code request stays visible and editable through ${fails?'failure and retry':'success'}`,async()=>{
    const html=tool==='spinner'?'<section id="spinner-access"></section><textarea id="spinner-names"></textarea>':fs.readFileSync('trip-o-meter.html','utf8');
    const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://gknest.org/'}),w=dom.window,q=s=>w.document.querySelector(s);
    w.AbortSignal=AbortSignal;
    let finish,requests=0;
    w.fetch=async(_,options)=>{
      if(JSON.parse(options.body).action==='request'){
        requests++;
        return new Promise(resolve=>{finish=()=>resolve({ok:!fails,status:fails?429:200,json:async()=>fails?{error:'Wait one minute before retrying.'}:{message:'Check your email.'}});});
      }
      return {ok:false,status:401,json:async()=>({error:'Verify your email.'})};
    };
    try{
      w.eval(fs.readFileSync(`js/${tool==='spinner'?'spinner-access':tool}.js`,'utf8'));
      q('[data-period="1"]').click();await tick();
      const email=q('[type=email]'),code=q('[autocomplete="one-time-code"]'),row=q('[data-code-row]'),form=email.form;
      assert.equal(row.hidden,true);
      email.value='visitor@example.org';email.dispatchEvent(new w.Event('input'));
      assert.equal(row.hidden,false,'Code entry appears while typing a valid email');
      assert.equal(requests,0,'Typing does not send email');
      // Also cover autofill/submission without an input event.
      row.hidden=true;form.requestSubmit();
      assert.equal(requests,1);assert.equal(row.hidden,false);
      assert.equal(code.disabled,false);assert.equal(w.document.activeElement,code);
      assert.equal(q('[data-verify]').disabled,true);
      code.value='123456';finish();await tick();
      assert.equal(row.hidden,false);assert.equal(code.value,'123456','A late response must not erase the entered code');
      assert.equal(q('[data-verify]').disabled,false);
      code.value='123';form.requestSubmit();
      assert.equal(requests,2,'Partial code must not block resending');finish();await tick();
      email.value='another@example.org';email.dispatchEvent(new w.Event('input'));
      assert.equal(code.value,'','Changing email clears a code for the previous address');
      q('[data-period="2"]').click();await tick();assert.equal(row.hidden,true,'A new period starts a fresh form');
    }finally{w.close();}
  });
}
