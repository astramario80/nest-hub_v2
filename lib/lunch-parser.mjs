import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
function lines(items) {
  const rows=[];
  for (const item of items.filter(i=>i.str?.trim()).sort((a,b)=>b.transform[5]-a.transform[5] || a.transform[4]-b.transform[4])) {
    let row=rows.find(r=>Math.abs(r.y-item.transform[5])<2);
    if(!row) { row={y:item.transform[5],items:[]};rows.push(row); }
    row.items.push(item);
  }
  return rows.sort((a,b)=>b.y-a.y).map(row=>{
    const sorted=row.items.sort((a,b)=>a.transform[4]-b.transform[4]);let text='',last=null;
    for(const item of sorted) {
      if(last && item.transform[4]-(last.transform[4]+last.width)>1.5) text+=' ';
      text+=item.str;last=item;
    }
    return {...row,text:text.replace(/\s+/g,' ').trim()};
  });
}
export async function parseLunchPdf(bytes) {
  const document=await getDocument({data:new Uint8Array(bytes),useSystemFonts:true,isEvalSupported:false}).promise;
  try {
    if(document.numPages>5) throw new Error('Unsupported lunch layout');
    for(let p=1;p<=document.numPages;p++) {
      const page=await document.getPage(p);const {items}=await page.getTextContent();
      const all=lines(items);
      // Detect columns from the three LUNCH headers, never from staff counts or names.
      const headings=items.filter(i=>/LUNCH|^L$|^UNCH$/i.test(i.str.trim()));
      const baseline=headings.find(i=>headings.filter(j=>Math.abs(j.transform[5]-i.transform[5])<2).length>=3)?.transform[5];
      if(!baseline) continue;
      const anchors=headings.filter(i=>Math.abs(i.transform[5]-baseline)<2).map(i=>i.transform[4]).sort((a,b)=>a-b).filter((x,i,a)=>i===0 || x-a[i-1]>40);
      if(anchors.length!==3) throw new Error('Expected three lunch columns');
      const bounds=[(anchors[0]+anchors[1])/2,(anchors[1]+anchors[2])/2];
      const planningHeading=all.find(r=>/STAFF ON PLANNING PERIOD/i.test(r.text));
      if(!planningHeading) throw new Error('Missing planning period');
      const columns=[0,1,2].map(col=>lines(items.filter(i=>i.transform[5]<baseline-4 && i.transform[5]>planningHeading.y+3 && (col===0 || i.transform[4]>=bounds[col-1]) && (col===2 || i.transform[4]<bounds[col]))));
      const schedules=[];const lunches=columns.map((column,col)=>{
        let sawTime=false;const staff=[];
        for(const row of column) {
          const match=row.text.match(/^(.+?):\s*(\d{1,2}:\d{2}\s*[-–—]\s*\d{1,2}:\d{2})$/);
          if(match) {
            sawTime=true;let schedule=schedules.find(s=>s.name===match[1]);
            if(!schedule) {schedule={name:match[1],times:[null,null,null]};schedules.push(schedule);}
            schedule.times[col]=match[2].replace(/\s/g,'');
          } else if(sawTime && /[A-Za-z]/.test(row.text)) staff.push(row.text);
        }
        if(!staff.length || staff.some(s=>/\d|:/.test(s))) throw new Error('Invalid staff column');
        return {label:['1st Lunch','2nd Lunch','3rd Lunch'][col],staff};
      });
      if(!schedules.length || schedules.some(s=>s.times.some(t=>!t))) throw new Error('Incomplete lunch times');
      const planning=all.filter(r=>r.y<planningHeading.y-3).map(r=>r.text).join(' ').split('/').map(s=>s.trim()).filter(Boolean);
      if(!planning.length || planning.some(s=>/\d|:/.test(s))) throw new Error('Invalid planning list');
      return {lunches,schedules,planning};
    }
    throw new Error('No readable three-column lunch table');
  } finally {await document.destroy();}
}
