(() => {
 'use strict';
 // Server-side district permission rendering; authorization and private storage are handled by the API.
 const clean=value=>String(value||'').trim().replace(/\s+/g,' ');
 async function generate({trip,student,parent,signedAt}){
  const template=window.NestPermissionTemplates?.[trip.id];
  if(!template||trip.templateDirty)throw new Error('This trip needs a refreshed district-template PDF before it can be signed.');
  const {PDFDocument,StandardFonts,rgb}=window.PDFLib;
  const doc=await PDFDocument.load(template.base64),page=doc.getPage(0);
  if(doc.getPageCount()!==1||page.getWidth()!==612||page.getHeight()!==792)throw new Error('District template dimensions changed; review the field map.');
  const regular=await doc.embedFont(StandardFonts.TimesRoman),bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const offset=template.offset;
  function field(value,x,top,width,{size=10,shift=true}={}){
   const text=clean(value);if(!text)return;
   const font=regular;
   // Fail rather than clip or cover the district wording. Long values need an approved continuation page.
   while(size>8&&font.widthOfTextAtSize(text,size)>width)size-=.25;
   if(font.widthOfTextAtSize(text,size)>width)throw new Error('An entry is too long for its district form space. Shorten the entry or contact the organizer.');
   page.drawText(text,{x,y:792-top-(shift?offset:0)-9,size,font,color:rgb(.06,.09,.12)});
  }
  field(student.name,52,115,270,{shift:false});
  field(parent.name,163,504,210);
  field(parent.homePhone,447,504,114);
  field(parent.workPhone,115,521,150);
  field(parent.extension,298,521,90);
  field(parent.cellPhone,450,521,111);
  field(parent.address,99,538,460);
  field(parent.medical||'None reported.',54,570,503,{size:9});
  field(parent.emergencyName1,89,604,245);
  field(parent.emergencyPhone1,382,604,175);
  field(parent.emergencyName2,89,621,245);
  field(parent.emergencyPhone2,382,621,175);
  if(typeof parent.signaturePng!=='string'||!parent.signaturePng.startsWith('data:image/png;base64,')||parent.signaturePng.length>2000000)throw new Error('Draw a signature before preparing the permission PDF.');
  const signature=await doc.embedPng(parent.signaturePng),fit=signature.scaleToFit(230,24);
  page.drawImage(signature,{x:180,y:792-672-offset-9,width:fit.width,height:fit.height});
  // Preserve the original district page and add only the parent and student values.

  await addItinerary(doc,trip,student);
  doc.setTitle(trip.title+' - '+student.name);doc.setSubject('Parent permission and trip itinerary. Signed '+signedAt);doc.setAuthor('NEST™');
  return doc.save();
 }
 async function addItinerary(doc,trip,student){const {StandardFonts,rgb}=window.PDFLib;const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const itinerary=doc.addPage();itinerary.setSize(612,792);
  const sans=await doc.embedFont(StandardFonts.Helvetica),teal=rgb(0,.145,.161),ink=rgb(.16,.23,.25),pale=rgb(.922,.984,.988),orange=rgb(.91,.47,.13),muted=rgb(.37,.45,.47);
  const brand=window.NestFieldTripBranding?.bannerPng;if(!brand)throw new Error('The NEST itinerary banner is unavailable.');
  const banner=await doc.embedPng(brand),height=612*banner.height/banner.width;
  itinerary.drawImage(banner,{x:0,y:792-height,width:612,height});
  const foodPlan=window.NestTripIcons.food(trip.foodChoice,trip.food),transportPlans=trip.days.map(d=>window.NestTripIcons.transportation(d.transport)),emojiImages={};
  for(const key of new Set([foodPlan.key,...transportPlans.flat().map(p=>p.key)])){
   const image=window.NestFieldTripBranding.icons?.[key];if(image)emojiImages[key]=await doc.embedPng(image);
  }
  function lines(value,font,size,width){
   const output=[];let line='';
   for(const word of clean(value).split(' ')){
    if(font.widthOfTextAtSize(word,size)>width)throw new Error('An itinerary entry is too long to fit. Shorten the entry or contact the organizer.');
    const next=line?line+' '+word:word;
    if(font.widthOfTextAtSize(next,size)>width){output.push(line);line=word;}else line=next;
   }if(line)output.push(line);return output;
  }
  const date=value=>new Date(value+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  const time=value=>{const [h,m]=value.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;};
  let y=792-height-24;
  itinerary.drawRectangle({x:32,y:y-6,width:548,height:24,color:teal});itinerary.drawText('NEST™',{x:40,y,size:12,font:bold,color:orange});const brandX=40+bold.widthOfTextAtSize('NEST™ ',12);itinerary.drawText('TripHub',{x:brandX,y,size:12,font:bold,color:rgb(1,1,1)});itinerary.drawText('.',{x:brandX+bold.widthOfTextAtSize('TripHub',12),y,size:12,font:bold,color:orange});itinerary.drawText('YOUR ITINERARY',{x:450,y:y+1,size:8,font:bold,color:rgb(1,1,1)});y-=25;
  const title=lines(trip.title,bold,19,540);for(const line of title){itinerary.drawText(line,{x:36,y,size:19,font:bold,color:teal});y-=23;}
  itinerary.drawText('Prepared for '+clean(student.name),{x:36,y:y-1,size:10,font:sans,color:muted});y-=24;
  function icon(kind,cx,cy){
   itinerary.drawCircle({x:cx,y:cy,size:12,color:rgb(.84,.94,.93)});
   const line=(x1,y1,x2,y2)=>itinerary.drawLine({start:{x:cx+x1,y:cy+y1},end:{x:cx+x2,y:cy+y2},thickness:1.1,color:teal});
   if(kind==='pin'){itinerary.drawCircle({x:cx,y:cy+2,size:4,borderColor:teal,borderWidth:1});line(-3,-1,0,-7);line(3,-1,0,-7);}
   if(kind==='calendar'){itinerary.drawRectangle({x:cx-5,y:cy-5,width:10,height:10,borderColor:teal,borderWidth:1});line(-5,1,5,1);line(-3,7,-3,3);line(3,7,3,3);}
   if(kind==='purpose'){line(-6,-5,5,5);line(-1,5,5,5);line(5,-1,5,5);line(-6,-5,2,-5);}
   if(kind==='bag'){itinerary.drawRectangle({x:cx-5,y:cy-6,width:10,height:10,borderColor:teal,borderWidth:1});line(-2,4,-2,7);line(-2,7,2,7);line(2,7,2,4);line(-2,-2,2,-2);}
   if(kind==='food'&&emojiImages[foodPlan.key])itinerary.drawImage(emojiImages[foodPlan.key],{x:cx-9,y:cy-9,width:18,height:18});
  }
  const sections=[
   ['pin','DESTINATION',[trip.destination,trip.address]],
   ['calendar','SCHEDULE & TRANSPORTATION',trip.days.flatMap((d,i)=>[(trip.days.length>1?'Day '+(i+1)+' · ':'')+date(d.date),`Leave school ${time(d.depart)}   |   Return to school ${time(d.returnTime)}`,...transportPlans[i].map(plan=>({text:plan.label,icon:plan.key}))])],
   ['purpose','WHY WE\'RE GOING',[trip.purpose]],
   ['bag','WHAT TO BRING',[trip.bring||'No additional materials listed.']],
   ['food','FOOD ARRANGEMENTS',[trip.food.replace(/\n/g,' ')]]
  ];
  const cards=sections.map(([kind,label,values])=>({kind,label,rows:values.flatMap(v=>lines(typeof v==='string'?v:v.text,sans,10.5,typeof v==='string'?484:466).map((text,i)=>({text,icon:i===0&&typeof v!=='string'?v.icon:null})))}));
  const total=cards.reduce((sum,c)=>sum+38+c.rows.length*14+9,0);
  if(y-total<58)throw new Error('The itinerary needs more room. Shorten the trip details before generating the two-page PDF.');
  for(const card of cards){
   const h=38+card.rows.length*14;
   itinerary.drawRectangle({x:32,y:y-h,width:548,height:h,color:pale,borderColor:rgb(.81,.9,.9),borderWidth:.6});
   icon(card.kind,54,y-19);itinerary.drawText(card.label,{x:75,y:y-22,size:10,font:bold,color:teal});
   let rowY=y-42;for(const row of card.rows){if(row.icon&&emojiImages[row.icon])itinerary.drawImage(emojiImages[row.icon],{x:75,y:rowY-2,width:13,height:13});itinerary.drawText(row.text,{x:row.icon?94:75,y:rowY,size:10.5,font:sans,color:ink});rowY-=14;}
   y-=h+9;
  }
  itinerary.drawLine({start:{x:36,y:48},end:{x:576,y:48},thickness:1,color:teal});
  itinerary.drawText('Questions? The NEST Lab (Rm. 174)  |  253.800.6221',{x:36,y:33,size:8,font:sans,color:muted});

 }
 async function itinerary({trip}){const doc=await window.PDFLib.PDFDocument.create();await addItinerary(doc,trip,{name:'All invited students'});doc.setTitle(trip.title+' - Itinerary - NEST™ TripHub');doc.setAuthor('NEST™ TripHub');return doc.save();}
 window.NestPermissionPdf={generate,itinerary};
})();
