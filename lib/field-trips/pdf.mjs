import fs from 'node:fs';
import {DOMMatrix,ImageData,Path2D,createCanvas} from '@napi-rs/canvas';import vm from 'node:vm';import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url);
export async function permissionPdf({trip,student,parent,template,signedAt,preview=false}){
 if(!template||createHash('sha256').update(Buffer.from(template.base64,'base64')).digest('hex')!==template.sourceHash)throw Error('The district template could not be verified.');
 const window={},ctx=vm.createContext({window,Uint8Array,setTimeout,clearTimeout,URL});
 vm.runInContext(fs.readFileSync(new URL('pdf-lib.min.js',root),'utf8'),ctx);window.PDFLib=ctx.PDFLib;
 const offset=await districtOffset(template.base64);
 window.NestPermissionTemplates={[trip.id]:{offset,base64:template.base64}};
 vm.runInContext(fs.readFileSync(new URL('branding-assets.js',root),'utf8'),ctx);
 vm.runInContext(fs.readFileSync(new URL('../../js/field-trips/trip-icons.js',import.meta.url),'utf8'),ctx);
 vm.runInContext(fs.readFileSync(new URL('permission-pdf.js',root),'utf8'),ctx);
 const answers=preview?{name:'PREVIEW ONLY',medical:'Preview only - no medical information collected.',signaturePng:createCanvas(2,2).toDataURL('image/png')}:parent;
 const bytes=await window.NestPermissionPdf.generate({trip,student,parent:answers,signedAt});
 if(!preview)return Buffer.from(bytes);
 const doc=await window.PDFLib.PDFDocument.load(bytes),font=await doc.embedFont(window.PDFLib.StandardFonts.HelveticaBold);for(const page of doc.getPages())page.drawText('PREVIEW - NOT SIGNED',{x:220,y:778,size:9,font,color:window.PDFLib.rgb(.7,.1,.1)});doc.setTitle('PREVIEW - NOT SIGNED - '+trip.title);return Buffer.from(await doc.save());
}

export async function districtOffset(base64){
 Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const doc=await getDocument({data:new Uint8Array(Buffer.from(base64,'base64')),useSystemFonts:true}).promise;
 try{if(doc.numPages!==1)throw Error('The district permission template must remain one page.');const page=await doc.getPage(1);const view=page.getViewport({scale:1});if(view.width!==612||view.height!==792)throw Error('The district form dimensions changed.');const content=await page.getTextContent();
 const anchors=[[/^Parent\/Guardian Name:$/,279.311708985],[/^Medical conditions, medical information, or allergies district personnel should be aware of:/,227.76733506],[/^Parent\/Guardian Signature:/,110.778258985]];
 const offsets=anchors.map(([pattern,y])=>{const found=content.items.filter(x=>pattern.test(x.str));if(found.length!==1||Math.abs(found[0].transform[4]-54)>.1)throw Error('The district form field layout needs review.');return y-found[0].transform[5];});
 if(offsets.some(v=>Math.abs(v-offsets[0])>.1)||offsets[0]<-1||offsets[0]>100||!content.items.some(x=>/I authorize qualified emergency medical professionals/.test(x.str)))throw Error('The district form field layout needs review.');return offsets[0];
 }finally{await doc.destroy();}
}

export async function itineraryPdf(trip){const window={},ctx=vm.createContext({window,Uint8Array,setTimeout,clearTimeout,URL});vm.runInContext(fs.readFileSync(new URL('pdf-lib.min.js',root),'utf8'),ctx);window.PDFLib=ctx.PDFLib;for(const file of ['branding-assets.js','../../js/field-trips/trip-icons.js','permission-pdf.js'])vm.runInContext(fs.readFileSync(new URL(file,root),'utf8'),ctx);return Buffer.from(await window.NestPermissionPdf.itinerary({trip}));}
export async function districtPacketPdf(roster,itinerary,title){const ctx=vm.createContext({roster:roster.toString('base64'),itinerary:itinerary.toString('base64'),title,setTimeout,clearTimeout});vm.runInContext(fs.readFileSync(new URL('pdf-lib.min.js',root),'utf8'),ctx);return Buffer.from(await vm.runInContext(`(async()=>{const doc=await PDFLib.PDFDocument.create();for(const data of [roster,itinerary]){const source=await PDFLib.PDFDocument.load(data);for(const page of await doc.copyPages(source,source.getPageIndices()))doc.addPage(page);}doc.setTitle(title+' - Roster and Itinerary - NEST™ TripHub');doc.setAuthor('NEST™ TripHub');return doc.save();})()`,ctx));}
