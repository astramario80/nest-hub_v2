(() => {
 'use strict';
 const dialog=document.getElementById('signature-dialog'),canvas=document.getElementById('signature-canvas');
 const $=id=>document.getElementById('signature-'+id);
 let strokes=[],active=null,resolveCapture=null,context=null,frame={width:1000,height:360};
 const clone=value=>value.map(stroke=>stroke.map(p=>({x:p.x,y:p.y})));
 function hasInk(value){return value.reduce((sum,s)=>sum+s.slice(1).reduce((distance,p,i)=>distance+Math.hypot(p.x-s[i].x,p.y-s[i].y),0),0)>.035;}
 function draw(ctx,value,width,height,origin={x:0,y:0}){
  ctx.strokeStyle='#152b3b';ctx.lineWidth=2.6;ctx.lineCap='round';ctx.lineJoin='round';
  for(const stroke of value){if(stroke.length<2)continue;ctx.beginPath();ctx.moveTo(stroke[0].x*width-origin.x,stroke[0].y*height-origin.y);for(const p of stroke.slice(1))ctx.lineTo(p.x*width-origin.x,p.y*height-origin.y);ctx.stroke();}
 }
 function render(){
  const rect=canvas.getBoundingClientRect(),scale=window.devicePixelRatio||1;
  canvas.width=Math.max(1,Math.round(rect.width*scale));canvas.height=Math.max(1,Math.round(rect.height*scale));
  context=canvas.getContext('2d');if(!context){$('help').textContent='Drawing is unavailable on this device. Use the signed-paper alternative.';$('save').disabled=true;return;}
  context.setTransform(scale,0,0,scale,0,0);context.clearRect(0,0,rect.width,rect.height);
  const g=geometry();context.translate(g.x,g.y);context.scale(g.scale,g.scale);draw(context,strokes,frame.width,frame.height);
  $('save').disabled=active!==null||!hasInk(strokes);$('undo').disabled=active!==null||!strokes.length;$('clear').disabled=active!==null||!strokes.length;
 }
 function finish(value){
  if(!resolveCapture)return;const resolve=resolveCapture;resolveCapture=null;active=null;document.body.classList.remove('signature-locked');
  if(dialog.close)dialog.close();else dialog.removeAttribute('open');resolve(value);
 }
 function geometry(){const r=canvas.getBoundingClientRect(),scale=Math.min(r.width/frame.width,r.height/frame.height);return {scale,x:(r.width-frame.width*scale)/2,y:(r.height-frame.height*scale)/2};}
 const point=e=>{const r=canvas.getBoundingClientRect(),g=geometry();return {x:Math.max(0,Math.min(1,(e.clientX-r.left-g.x)/(frame.width*g.scale))),y:Math.max(0,Math.min(1,(e.clientY-r.top-g.y)/(frame.height*g.scale)))};};
 canvas.addEventListener('pointerdown',e=>{
  if(!resolveCapture||active!==null||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;
  e.preventDefault();active=e.pointerId;strokes.push([point(e)]);canvas.setPointerCapture?.(e.pointerId);render();
 });
 canvas.addEventListener('pointermove',e=>{
  if(e.pointerId!==active)return;e.preventDefault();
  const p=point(e),stroke=strokes[strokes.length-1],last=stroke[stroke.length-1];
  if(Math.hypot(p.x-last.x,p.y-last.y)>.001){stroke.push(p);render();}
 });
 function end(e){if(e.pointerId!==active)return;active=null;try{canvas.releasePointerCapture?.(e.pointerId);}catch{}render();}
 canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);
 $('clear').addEventListener('click',()=>{if(active===null){strokes=[];const r=canvas.getBoundingClientRect();frame={width:Math.max(1,r.width),height:Math.max(1,r.height)};render();}});
 $('undo').addEventListener('click',()=>{if(active===null){strokes.pop();render();}});
 $('cancel').addEventListener('click',()=>finish(null));
 dialog.addEventListener('cancel',e=>{e.preventDefault();finish(null);});
 $('save').addEventListener('click',()=>{
  if(active!==null||!hasInk(strokes)||!context)return;
  // Crop ink with padding, preserving its proportions when placed in the original PDF signature line.
  const {width,height}=frame,padding=8,points=strokes.flat(),left=Math.max(0,Math.floor(Math.min(...points.map(p=>p.x*width)))-padding),top=Math.max(0,Math.floor(Math.min(...points.map(p=>p.y*height)))-padding);
  const right=Math.min(width,Math.ceil(Math.max(...points.map(p=>p.x*width)))+padding),bottom=Math.min(height,Math.ceil(Math.max(...points.map(p=>p.y*height)))+padding),output=document.createElement('canvas');
  output.width=Math.max(1,(right-left)*2);output.height=Math.max(1,(bottom-top)*2);const ctx=output.getContext('2d');
  if(!ctx){$('help').textContent='The signature image could not be prepared. Please try again.';return;}
  ctx.scale(2,2);draw(ctx,strokes,width,height,{x:left,y:top});
  try{finish({png:output.toDataURL('image/png'),strokes:clone(strokes),size:{...frame}});}catch{$('help').textContent='The signature could not be saved. Please try again.';}
 });
 window.addEventListener('resize',()=>{if(resolveCapture)render();});
 window.NestSignaturePad={hasInk,capture(initial={}){
  if(resolveCapture)return Promise.reject(new Error('A signature window is already open.'));
  strokes=clone(initial.strokes||[]);active=null;document.body.classList.add('signature-locked');$('help').textContent='Use your finger, stylus, or mouse. Nothing is submitted until you review and submit the permission form.';
  if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
  const rect=canvas.getBoundingClientRect();frame=initial.size||{width:Math.max(1,rect.width),height:Math.max(1,rect.height)};
  render();$('cancel').focus();return new Promise(resolve=>{resolveCapture=resolve;});
 }};
})();
