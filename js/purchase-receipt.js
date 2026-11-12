(()=>{
 'use strict';
 // PDF bytes stay in this browser. Load PDF.js only when a receipt is selected.
 const root='/assets/vendor/pdfjs-5.4.624/';
 function amazonDescription(pages){
  const text=pages.flat().map(x=>String(x).replace(/\s+/g,' ').trim()).filter(Boolean);
  if(!/amazon(?:\.com| business)/i.test(text.join(' ')))return '';
  const items=[];let item=null;
  const finish=()=>{if(item?.parts.length)items.push({quantity:item.quantity,title:item.parts.join(' ').trim()});item=null;};
  for(const line of text){
   const start=line.match(/^(\d{1,5})\s+of\s*:\s*(.*)$/i);
   if(start){finish();item={quantity:Number(start[1]),parts:start[2]?[start[2]]:[]};continue;}
   if(!item)continue;
   if(/^(?:sold by\b|supplied by\b|seller\b|condition\s*:|business price\b|shipping (?:address|speed)\s*:|payment\b|billing\b|item\(s\) subtotal\b|grand total\b|total (?:before|for)\b|order total\b)/i.test(line)){finish();continue;}
   if(/^(?:\$\s*[\d,.]+|(?:USD\s*)?[\d,.]+|price|items ordered|page \d+(?: of \d+)?|final details for order.*)$/i.test(line))continue;
   item.parts.push(line);
  }
  finish();if(!items.length)return '';
  const shorten=(s,max)=>s.length<=max?s:s.slice(0,max-1).replace(/\s+\S*$/,'')+'…';
  const lines=items.map(x=>x.quantity+' × '+shorten(x.title,130));
  let result='';for(let i=0;i<lines.length;i++){const next=result+(result?'\n':'')+lines[i];if(next.length>1850){result+='\n+'+(lines.length-i)+' more item(s) — review invoice';break;}result=next;}
  return result;
 }
 async function describe(file){
  if(file.type!=='application/pdf')return {description:'',message:'Automatic descriptions currently support Amazon text PDFs. Enter the description for this image manually.'};
  if(file.size>2*1024*1024)throw Error('Choose a receipt under 2 MB.');
  const pdfjs=await import('/assets/vendor/pdfjs-5.4.624/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=root+'pdf.worker.min.mjs';
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true,disableAutoFetch:true});
  let timeout;const expire=new Promise((_,reject)=>{timeout=setTimeout(()=>{void task.destroy();reject(Error('Receipt reading took too long. Enter the description manually.'));},20000);});
  const read=async()=>{const doc=await task.promise;try{if(doc.numPages>20)throw Error('This receipt has too many pages to read automatically. Enter the description manually.');const pages=[];for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n),content=await page.getTextContent();pages.push(content.items.filter(x=>typeof x.str==='string').map(x=>x.str));page.cleanup();}const description=amazonDescription(pages);return {description,message:description?'Description filled from the Amazon invoice. Review and edit it before submitting.':'No Amazon item list could be read. For a scanned receipt or another format, enter the description manually.'};}finally{await doc.destroy();}};
  try{return await Promise.race([read(),expire]);}finally{clearTimeout(timeout);}
 }
 window.NestPurchaseReceipt={describe,amazonDescription};
})();
