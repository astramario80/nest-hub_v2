import {upload} from '@vercel/blob/client';
import {MEDIA_TYPES,MAX_FILE_SIZE,MAX_FILES,MAX_TOTAL_SIZE} from '../lib/service-media-types.mjs';
const fallback=Object.fromEntries(Object.entries(MEDIA_TYPES).map(([type,extension])=>[extension,type]));fallback.jpeg='image/jpeg';
function selection(files){
 const chosen=[...files];if(chosen.length>MAX_FILES||chosen.reduce((n,f)=>n+f.size,0)>MAX_TOTAL_SIZE)throw Error('Choose up to five photos or videos, totaling 250 MB.');
 return chosen.map(file=>{const type=file.type&&file.type!=='application/octet-stream'?file.type:fallback[file.name.split('.').pop().toLowerCase()];if(!Object.hasOwn(MEDIA_TYPES,type)||!file.size||file.size>MAX_FILE_SIZE||file.name.length>180)throw Error('Choose a supported photo or video, up to 100 MB per file.');return {file,fileId:crypto.randomUUID(),type,started:false};});
}
async function action(operation,data){
 const response=await fetch('/api/service-upload',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,...data}),signal:AbortSignal.timeout(45000)});
 const result=await response.json().catch(()=>({error:'The file response could not be confirmed. Retry this same submission.'}));if(!response.ok){const error=new Error(result.error||'The upload could not be confirmed.');error.status=response.status;throw error;}return result;
}
async function uploadFiles(tasks,ticketId,progress,context){
 const ids=[];for(let i=0;i<tasks.length;i++){
  const task=tasks[i],file=task.file;progress('Preparing '+file.name+' ('+(i+1)+' of '+tasks.length+')…');
  const prepared=await action('prepare',{file:{ticketId,fileId:task.fileId,name:file.name,size:file.size,type:task.type,...(context||{})}}),complete=()=>action('complete',{receipt:prepared.receipt});
  if(task.started){try{await complete();ids.push(task.fileId);continue;}catch(error){if(error.status!==404)throw error;}}
  if(prepared.storage==='drive'){
   const completeDrive=()=>action('complete',{receipt:prepared.receipt});
   if(prepared.complete){ids.push(task.fileId);continue;}
   if(task.started){try{await completeDrive();ids.push(task.fileId);continue;}catch(error){if(error.status!==404)throw error;}}
   task.started=true;
   try{await uploadDrive(prepared.uploadUrl,file,message=>progress(message));}
   catch(error){
    // Drive can accept the bytes even when the browser loses its success response.
    // Confirm server-side before deciding whether this same file needs another transfer.
    try{await completeDrive();ids.push(task.fileId);continue;}
    catch(confirmation){if(confirmation.status!==404)throw confirmation;}
    throw Error('The upload of '+file.name+' could not be confirmed. Keep these files selected and save again to resume this same draft.');
   }
   await completeDrive();ids.push(task.fileId);continue;
  }
  task.started=true;
  try{await upload(prepared.path,file,{access:'private',handleUploadUrl:'/api/service-upload',clientPayload:prepared.receipt,contentType:task.type,multipart:true,onUploadProgress:event=>progress(file.name+' — '+Math.round(event.percentage)+'% ('+(i+1)+' of '+tasks.length+')')});}
  catch(error){try{await complete();ids.push(task.fileId);continue;}catch(confirmation){if(confirmation.status!==404)throw confirmation;}throw Error('The upload of '+file.name+' stopped. Retry this same submission.');}
  await complete();ids.push(task.fileId);
 }return ids;
}
async function uploadDrive(url,file,progress){
 if(typeof url!=='string'||!/^https:\/\/(?:www\.)?googleapis\.com\/upload\/drive\//.test(url))throw Error('The Drive upload session is unavailable. Retry this upload.');
 let start=0;const probe=await fetch(url,{method:'PUT',credentials:'omit',headers:{'Content-Range':'bytes */'+file.size}});if(probe.ok)return;if(probe.status!==308)throw Error('The Drive upload session expired. Reselect this file and retry.');const range=probe.headers.get('Range');if(range)start=Number(range.split('-')[1])+1;
 while(start<file.size){const end=Math.min(start+8*1024*1024,file.size),response=await fetch(url,{method:'PUT',credentials:'omit',headers:{'Content-Type':file.type||'application/octet-stream','Content-Range':'bytes '+start+'-'+(end-1)+'/'+file.size},body:file.slice(start,end)});if(response.ok){progress(file.name+' — 100%');return;}if(response.status!==308)throw Error('Drive upload stopped. Retry this same file.');const received=response.headers.get('Range');const next=received?Number(received.split('-')[1])+1:end;if(!Number.isSafeInteger(next)||next<=start||next>end)throw Error('Drive upload progress could not be confirmed. Retry this file.');start=next;progress(file.name+' — '+Math.round(start/file.size*100)+'%');}
}
window.NestServiceUpload={selection,uploadFiles};
