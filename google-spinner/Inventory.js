// Website assignments follow the existing workbook’s validation and free-text fields.
const INVENTORY_BOOK='1gAksPMtChw2vwC61aBDqVBEx8BrgG2GLbqX31Ld2ZqM';
const INVENTORY_TYPES={kits:'EE Kits',drones:'Drones',laptops:'Laptops',usbs:'USBs',radios:'Radios',computers:'Computer serials',printers:'3D printers',machines:'Room machines'};
const INVENTORY_HARDWARE_BOOK='1dRyHDG8UbdjaOyQVXaGWS6UoqiEJr5uOg2LUQPM_rEY';
function inventoryBookId_(type){return ['computers','printers'].includes(type)?INVENTORY_HARDWARE_BOOK:INVENTORY_BOOK;}
function inventoryCanonical_(value){const text=String(value||'').trim().toLowerCase();return /^\d+$/.test(text)?String(Number(text)):text;}
function inventoryCatalogVersion_(state){return hash_(JSON.stringify(state.records.map(r=>[r.id,r.version])));}

function inventoryType_(title){
 const key=String(title).toLowerCase().replace(/[^a-z]/g,'');
 return {eekits:'kits',engineeringessentialskits:'kits',drones:'drones',laptops:'laptops',usbs:'usbs',radios:'radios'}[key]||'';
}
function inventoryAllowed_(identity){
 if(websiteAdmin_(identity))return true;
 const leaders=Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
 return leaders.some(row=>{
  const period=String(row[0]||'').replace(/^period\s*/i,'').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(PERIODS,period)&&email_(row[4])===memberEmail_(identity,period)&&/^(director of inventory|inventory director)$/i.test(String(row[2]||'').trim());
 });
}
function inventoryOptions_(rule,cache){
 if(!rule)return null;
 const type=rule.getCriteriaType(),values=rule.getCriteriaValues(),criteria=SpreadsheetApp.DataValidationCriteria;
 let options,key;
 if(type===criteria.VALUE_IN_LIST){key='list:'+JSON.stringify(values[0]);if(cache[key])return cache[key];options=values[0];}
 else if(type===criteria.VALUE_IN_RANGE){
  const range=values[0],source=range.getSheet();key='range:'+source.getSheetId()+':'+range.getA1Notation();
  if(cache[key])return cache[key];
  // The live workbook uses whole-column rules. Read only their populated part.
  const height=Math.max(0,Math.min(range.getNumRows(),source.getLastRow()-range.getRow()+1)),width=range.getNumColumns();
  if(height*width>10000)throw new Error('Dropdown range too large');
  options=height?source.getRange(range.getRow(),range.getColumn(),height,width).getDisplayValues().flat():[];
 }else return null;
 const unique=[...new Set(options.map(String).filter(v=>v.trim()&&!/^(Status|Student Name|#(?:N\/A|REF!|VALUE!|ERROR!|NAME\?|DIV\/0!))$/i.test(v.trim())))];
 if(unique.length>1000||unique.some(v=>v.length>500))throw new Error('Dropdown options too large');
 cache[key]=unique;return unique;
}
function inventoryRead_(book,type){
 if(['computers','printers'].includes(type))return inventoryHardwareRead_(book,type);
 const matches=book.getSheets().filter(sheet=>inventoryType_(sheet.getName())===type);
 if(matches.length!==1)return null;
 const sheet=matches[0],height=sheet.getLastRow(),width=sheet.getLastColumn();
 if(height>5000||width>30||!height||!width)throw new Error('Unsupported inventory dimensions');
 const range=sheet.getRange(1,1,height,width),values=range.getDisplayValues(),formulas=range.getFormulas(),rules=range.getDataValidations(),optionCache={};
 // Recognize the equipment-number column, including a laptop matrix with period headings.
 let header=-1,idColumn=-1;
 for(let row=0;row<Math.min(5,height);row++){
  const col=values[row].findIndex(v=>/^(?:ID|Computer Station|(?:(?:ee\s*)?kit|drone|laptop|usb|radio)(?:\s*(?:#|no\.?|number|id))?)$/i.test(String(v).trim()));
  if(col>=0){header=row;idColumn=col;break;}
 }
 if(header<0)throw new Error('Assignment headers need review');
 const headers=values[header],records=[];
 const columnRules=headers.map((_,col)=>rules.slice(header+1).map(row=>row[col]).find(Boolean)||null);
 for(let index=header+1;index<height;index++){
  const number=values[index][idColumn].trim();if(!number)continue;
  const cells=headers.map((label,col)=>{
   const assignment=type==='laptops'&&/^(Period [123457]|NEST[™]? Robotics)$/i.test(String(label).trim());
   const options=inventoryOptions_(rules[index][col]||(assignment?columnRules[col]:null),optionCache);
   const freeText=/^notes?$/i.test(label.trim())||(type==='drones'&&label.trim()==='Equipment')||(type==='laptops'&&label.trim()==='Guest');
   const editable=col!==idColumn&&!formulas[index][col]&&Boolean(String(label).trim())&&(options!==null||freeText);
   return {column:col,label:String(label),value:values[index][col],editable,options};
  }).filter(cell=>cell.column!==idColumn&&cell.label.trim());
  records.push({id:hash_(sheet.getSheetId()+'|'+number),number,row:index+1,version:hash_(JSON.stringify([values[index],formulas[index],cells.map(c=>[c.column,c.editable,c.options])])),cells});
 }
 const counts={};records.forEach(r=>counts[r.id]=(counts[r.id]||0)+1);
 records.forEach(r=>{if(counts[r.id]>1)r.cells.forEach(c=>c.editable=false);});
 const serialColumn=headers.findIndex(h=>/^Serial Number$/i.test(String(h).trim()));
 records.forEach(record=>{record.serial=serialColumn>=0?String(values[record.row-1][serialColumn]||''):'';record.assigned=record.cells.some(c=>c.value&&(type==='laptops'?/^(Period |NEST.*Robotics|Guest)/i.test(c.label):/student/i.test(c.label)));});
 return {sheet,records,headers,values:values.slice(header+1),firstDataRow:header+2,idColumn,serialColumn,serialLabel:'Serial number',idLabel:type==='laptops'?'Computer station':'Equipment ID'};
}
function inventoryView_(r,book){
 if(!Object.prototype.hasOwnProperty.call(INVENTORY_TYPES,r.type)||!Number.isInteger(r.page)||r.page<0||r.page>166)return {status:400};
 const state=inventoryRead_(book,r.type);
 if(!state)return {status:200,categories:INVENTORY_TYPES,records:[],choices:{},total:0,page:r.page,hasMore:false,unavailable:true};
 const choices={},records=state.records.slice(r.page*30,(r.page+1)*30).map(record=>({id:record.id,number:record.number,serial:record.serial||'',makerSerial:record.makerSerial||'',assigned:record.assigned===true,version:record.version,cells:record.cells.map(cell=>{
  const {options,...field}=cell;
  if(options!==null){field.choices=hash_(JSON.stringify(options));choices[field.choices]=options;}
  return field;
 })}));
 return {status:200,categories:INVENTORY_TYPES,records,choices,total:state.records.length,page:r.page,hasMore:state.records.length>(r.page+1)*30,catalogVersion:inventoryCatalogVersion_(state),idLabel:state.idLabel,serialLabel:state.serialLabel};
}
function inventorySave_(identity,r,book){
 if(!Object.prototype.hasOwnProperty.call(INVENTORY_TYPES,r.type)||!/^[a-f0-9]{64}$/.test(r.id||'')||!/^[a-f0-9]{64}$/.test(r.version||'')||!Array.isArray(r.changes)||!r.changes.length||r.changes.length>30)return {status:400};
 const state=inventoryRead_(book,r.type),matches=state?.records.filter(row=>row.id===r.id)||[];
 if(matches.length!==1)return {status:409};
 const row=matches[0];if(row.version!==r.version)return {status:409};
 const columns=new Set(),updates=[];
 for(const change of r.changes){
  const field=row.cells.find(cell=>cell.column===change.column);
  if(!field?.editable||columns.has(change.column)||typeof change.value!=='string'||change.value.length>2000)return {status:400};
  if(field.options!==null&&change.value!==''&&!field.options.includes(change.value))return {status:400};
  columns.add(change.column);
  updates.push({updateCells:{range:{sheetId:state.sheet.getSheetId(),startRowIndex:row.row-1,endRowIndex:row.row,startColumnIndex:field.column,endColumnIndex:field.column+1},rows:[{values:[{userEnteredValue:{stringValue:change.value}}]}],fields:'userEnteredValue'}});
 }
 // RAW string cells prevent notes or names from becoming spreadsheet formulas.
 let log=book.getSheetByName('InventoryWebLog');
 if(!log){log=book.insertSheet('InventoryWebLog');log.getRange(1,1,1,6).setValues([['Time','Actor','Category','Equipment','Before','Changes']]);log.hideSheet();}
 updates.push({appendCells:{sheetId:log.getSheetId(),rows:[{values:[new Date().toISOString(),identity,r.type,row.number,JSON.stringify(row.cells.map(c=>({column:c.column,value:c.value}))),JSON.stringify(r.changes)].map(value=>({userEnteredValue:{stringValue:value}}))}],fields:'userEnteredValue'}});
 Sheets.Spreadsheets.batchUpdate({requests:updates},inventoryBookId_(r.type));
 let mirrorSync='updated';
 r.changes.forEach(change=>state.values[row.row-state.firstDataRow][change.column]=change.value);
 try{if(!['computers','printers'].includes(r.type))inventorySyncPublic_(book,r.type,state);}catch(_){mirrorSync='pending';}
 return {status:200,saved:true,mirrorSync};
}
// Match the existing bound Public_Push script: publish first names and periods only.
function inventoryPublicName_(value,periods){
 const name=String(value||'').trim(),comma=name.indexOf(',');
 if(comma<0)return '';
 const first=name.slice(comma+1).trim();if(!first)return '';
 const period=periods.get(name)||'';
 return first+(period?' ('+(/^\d+$/.test(period)?'P'+period:period)+')':'');
}
function inventorySyncPublic_(book,type,snapshot){
 if(['computers','printers'].includes(type))return;
 const state=snapshot||inventoryRead_(book,type);if(!state)throw new Error('Missing category');
 const roster=Sheets.Spreadsheets.Values.get('12XogWM3af3PLIvEyrFR39hzkI0kEmfiCZkr66y3eDcU',"'EnrolledStudents'!F8:G5000").values||[],periods=new Map();
 roster.forEach(row=>{const name=String(row[0]||'').trim();if(name&&!periods.has(name))periods.set(name,String(row[1]||'').trim());});
 const width=type==='laptops'?9:type==='drones'?5:4;
 const rows=state.values.map(row=>Array.from({length:width},(_,col)=>{
  const value=String(row[col]||'');return (type==='laptops'?col>0:col===2)?inventoryPublicName_(value,periods):value;
 }));
 const mirror='1DvIrekgpOo_gJJat8SiP3MYHr44389yJm6mNq_5OML0';
 const meta=Sheets.Spreadsheets.get(mirror,{fields:'sheets(properties)'});
 const target=(meta.sheets||[]).map(s=>s.properties).find(s=>s.title===state.sheet.getName());
 if(!target||target.gridProperties.rowCount<rows.length+2||target.gridProperties.columnCount<width)throw new Error('Public mirror dimensions need review');
 // Replace the category output atomically, clearing stale values below the new data.
 const outputRange={sheetId:target.sheetId,startRowIndex:2,endRowIndex:target.gridProperties.rowCount,startColumnIndex:0,endColumnIndex:width};
 Sheets.Spreadsheets.batchUpdate({requests:[{setDataValidation:{range:outputRange}},{updateCells:{range:outputRange,rows:rows.map(row=>({values:row.map(value=>({userEnteredValue:{stringValue:value}}))})),fields:'userEnteredValue'}}]},mirror);
}
function inventoryDispatch_(r){
 const session=authSession_(r.session,PropertiesService.getScriptProperties(),Date.now());
 if(!session)return {status:401};
 if(!inventoryAllowed_(session.email))return {status:403};
 if(r.type==='machines'){if(r.operation==='view'&&Number.isInteger(r.page)&&r.page>=0&&r.page<=166)return roomMachineView_(r);if(r.operation!=='manage')return {status:400};const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return {status:503};try{return roomMachineManage_(session,r);}finally{lock.releaseLock();}}
 if(!['view','save','sync','manage'].includes(r.operation)||!Object.prototype.hasOwnProperty.call(INVENTORY_TYPES,r.type))return {status:400};
 const book=SpreadsheetApp.openById(inventoryBookId_(r.type));
 if(r.operation==='view')return inventoryView_(r,book);
 const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return {status:503};
 try{
  if(r.operation==='sync'){inventorySyncPublic_(book,r.type);return {status:200,mirrorSync:'updated'};}
  if(r.operation==='manage')return inventoryManage_(session.email,r,book);
  return inventorySave_(session.email,r,book);
 }finally{lock.releaseLock();}
}

function inventoryHardwareRead_(book,type){
 const computer=type==='computers',sheet=book.getSheetByName(computer?'LaptopInventory':'3d Printers');
 if(!sheet)return null;
 const height=sheet.getLastRow(),width=sheet.getLastColumn();if(!height||height>5000||width>30)throw new Error('Unsupported hardware register');
 const range=sheet.getRange(1,1,height,width),values=range.getDisplayValues(),formulas=range.getFormulas(),headers=values[0];
 const expected=computer?['Timestamp','What is your computer number?','What is the barcode of the device?','Email Address','Station']:['Printer Name','Make','Maker Serial Number','BSD Serial Number'];
 if(!expected.every((label,i)=>headers[i]===label))throw new Error('Hardware headers changed');
 const idColumn=computer?1:0,serialColumn=computer?2:3,records=[];
 for(let index=1;index<height;index++){
  const number=String(values[index][idColumn]||'').trim();if(!number)continue;
  // Never return submitter timestamps or student email addresses to this interface.
  const columns=computer?[2]:[1,2,3];
  const cells=columns.map(column=>({column,label:computer?'BSD serial number':headers[column],value:values[index][column]||'',editable:!computer&&column===1&&!formulas[index][column],options:null}));
  records.push({id:hash_(sheet.getSheetId()+'|'+number),number,serial:String(values[index][serialColumn]||''),makerSerial:computer?'':String(values[index][2]||''),assigned:false,row:index+1,version:hash_(JSON.stringify([values[index],formulas[index]])),cells});
 }
 return {sheet,records,headers,values:values.slice(1),firstDataRow:2,idColumn,serialColumn,serialLabel:'BSD serial number',idLabel:computer?'Computer station':'Printer name'};
}
function inventoryLogRequest_(book,identity,type,number,before,change){
 let log=book.getSheetByName('InventoryWebLog');
 if(!log){log=book.insertSheet('InventoryWebLog');log.getRange(1,1,1,6).setValues([['Time','Actor','Category','Equipment','Before','Changes']]);log.hideSheet();}
 return {appendCells:{sheetId:log.getSheetId(),rows:[{values:[new Date().toISOString(),identity,type,number,JSON.stringify(before),JSON.stringify(change)].map(value=>({userEnteredValue:{stringValue:value}}))}],fields:'userEnteredValue'}};
}
function inventoryManage_(identity,r,book){
 const state=inventoryRead_(book,r.type);if(!state||!['add','edit','remove'].includes(r.change))return {status:400};
 const adding=r.change==='add',removing=r.change==='remove',matches=adding?[]:state.records.filter(row=>row.id===r.id),record=matches[0];
 if(adding){if(r.catalogVersion!==inventoryCatalogVersion_(state))return {status:409};}
 else if(matches.length!==1||record.version!==r.version)return {status:409};
 const number=removing?record.number:typeof r.number==='string'?r.number.trim():'',serial=removing?record.serial:typeof r.serial==='string'?r.serial.trim():'';
 if(!removing&&(!/^[a-zA-Z0-9][a-zA-Z0-9 ._()#-]{0,79}$/.test(number)||serial.length>100||serial&&!/^[a-zA-Z0-9][a-zA-Z0-9 ._-]*$/.test(serial)))return {status:400};
 if(r.type==='printers'&&!removing&&(typeof r.makerSerial!=='string'||r.makerSerial.length>100||r.makerSerial&&!/^[a-zA-Z0-9][a-zA-Z0-9 ._-]*$/.test(r.makerSerial)))return {status:400};
 if(r.type==='computers'&&!removing&&!/^\d{1,30}$/.test(serial))return {status:400};
 if(!removing&&state.records.some(row=>row.id!==record?.id&&(inventoryCanonical_(row.number)===inventoryCanonical_(number)||(serial&&serial!==record?.serial&&row.serial&&row.serial.toLowerCase()===serial.toLowerCase()))))return {status:409};
 if(removing&&record.assigned)return {status:409};
 if(r.type==='computers'&&(removing||(!adding&&inventoryCanonical_(number)!==inventoryCanonical_(record.number)))){
  const assignments=inventoryRead_(SpreadsheetApp.openById(INVENTORY_BOOK),'laptops');
  if(!assignments)throw new Error('Assignment check unavailable');
  if(assignments.records.some(row=>inventoryCanonical_(row.number)===inventoryCanonical_(record.number)&&row.assigned))return {status:409};
 }
 const sheetId=state.sheet.getSheetId(),requests=[],width=state.headers.length;
 // Freeze generated IDs to their displayed values before any identity edit or removal.
 // Otherwise changing B3 can silently renumber every device below its B3+1 formula.
 if(state.values.length)requests.push({updateCells:{range:{sheetId,startRowIndex:state.firstDataRow-1,endRowIndex:state.firstDataRow-1+state.values.length,startColumnIndex:state.idColumn,endColumnIndex:state.idColumn+1},rows:state.values.map(row=>({values:[{userEnteredValue:{stringValue:String(row[state.idColumn]||'')}}]})),fields:'userEnteredValue'}});
 let rowNumber=record?.row;
 if(adding){
  const empty=state.values.findIndex(row=>row.every(value=>!String(value||'').trim()));rowNumber=empty>=0?state.firstDataRow+empty:state.firstDataRow+state.values.length;
  if(rowNumber>5000)return {status:400};
  if(rowNumber>state.sheet.getMaxRows())requests.push({appendDimension:{sheetId,dimension:'ROWS',length:rowNumber-state.sheet.getMaxRows()}});
  const template=state.records[0]?.row||state.firstDataRow;
  if(template!==rowNumber)requests.push({copyPaste:{source:{sheetId,startRowIndex:template-1,endRowIndex:template,startColumnIndex:0,endColumnIndex:width},destination:{sheetId,startRowIndex:rowNumber-1,endRowIndex:rowNumber,startColumnIndex:0,endColumnIndex:width},pasteType:'PASTE_DATA_VALIDATION'}});
 }
 let serialColumn=state.serialColumn;
 if(!removing&&serial&&serialColumn<0){
  serialColumn=width;if(serialColumn>=30)return {status:400};
  if(serialColumn>=state.sheet.getMaxColumns())requests.push({appendDimension:{sheetId,dimension:'COLUMNS',length:serialColumn+1-state.sheet.getMaxColumns()}});
  requests.push(inventoryCellRequest_(sheetId,state.firstDataRow-1,serialColumn,'Serial Number'));
 }
 const before=adding?[]:state.values[record.row-state.firstDataRow].slice();
 if(removing){
  requests.push({updateCells:{range:{sheetId,startRowIndex:rowNumber-1,endRowIndex:rowNumber,startColumnIndex:0,endColumnIndex:width},rows:[{values:state.headers.map(()=>({userEnteredValue:{stringValue:''}}))}],fields:'userEnteredValue'}});
  state.values[rowNumber-state.firstDataRow]=state.headers.map(()=>'');
 }else{
  requests.push(inventoryCellRequest_(sheetId,rowNumber,state.idColumn,number));
  if(serialColumn>=0)requests.push(inventoryCellRequest_(sheetId,rowNumber,serialColumn,serial));
  if(r.type==='printers')requests.push(inventoryCellRequest_(sheetId,rowNumber,2,r.makerSerial.trim()));
  if(r.type==='computers')requests.push(inventoryCellRequest_(sheetId,rowNumber,4,'Station: '+(/^\d+$/.test(number)?number.padStart(2,'0'):number)+'; BSD Serial Number: '+serial));
  const values=adding?Array.from({length:Math.max(width,serialColumn+1)},()=> ''):before.slice();values[state.idColumn]=number;if(serialColumn>=0)values[serialColumn]=serial;
  if(r.type==='printers')values[2]=r.makerSerial.trim();
  state.values[rowNumber-state.firstDataRow]=values;
 }
 requests.push(inventoryLogRequest_(book,identity,r.type,number,before,{action:r.change,number,serial,...(r.type==='printers'&&!removing?{makerSerial:r.makerSerial.trim()}:{})}));
 Sheets.Spreadsheets.batchUpdate({requests},inventoryBookId_(r.type));
 let mirrorSync='updated';try{inventorySyncPublic_(book,r.type,state);}catch(_){mirrorSync='pending';}
 return {status:200,saved:true,mirrorSync,id:removing?null:hash_(sheetId+'|'+number),page:Math.floor(state.records.filter(item=>item.row<rowNumber).length/30)};
}
function inventoryCellRequest_(sheetId,row,column,value){
 return {updateCells:{range:{sheetId,startRowIndex:row-1,endRowIndex:row,startColumnIndex:column,endColumnIndex:column+1},rows:[{values:[{userEnteredValue:{stringValue:value}}]}],fields:'userEnteredValue'}};
}
