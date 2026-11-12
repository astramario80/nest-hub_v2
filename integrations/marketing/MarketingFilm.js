// Private homepage media. Never accept a client-selected root or follow shortcuts.
const MARKETING_ROOT_='1-NAs0GW0WZAh_kiTGe22elBTk0YTJs-8';
const MARKETING_DIVISIONS_=['1Gh2gmUgXl0zeLhBg0iAgcXnJRZROWGQi','1TnAU1a97znrf40KIw9I69x4WBK4vOi0T','1-jA0NEoRJJEH31bYBzd9BoAUOuonW2oS','10S-9Xn1wJ1zJs7rO84dly0M60suJTgyG','1R9xi1GOuS9BZ5xBTKmfgl3t08etvmuvk'];
function marketingType_(type){return /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))$/.test(type||'');}
function marketingWithin_(file){
 let parents=file.parents||[];
 for(let depth=0;depth<16&&parents.length;depth++){
  let parent;try{parent=Drive.Files.get(parents[0],{fields:'id,mimeType,parents,trashed'});}catch(_){return false;}
  if(parent.trashed||parent.mimeType!=='application/vnd.google-apps.folder')return false;
  if(MARKETING_DIVISIONS_.includes(parent.id))return (parent.parents||[]).includes(MARKETING_ROOT_);
  parents=parent.parents||[];
 }
 return false;
}
function marketingPool_(){
 const cache=CacheService.getScriptCache(),key='marketing-film:v1',saved=cache.get(key);if(saved)return JSON.parse(saved);
 const queue=MARKETING_DIVISIONS_.map(id=>({id,division:id})),groups={};let calls=0;
 while(queue.length&&calls<100){
  const folder=queue.shift();if(!groups[folder.division]){const meta=Drive.Files.get(folder.id,{fields:'id,name,parents,trashed'});if(meta.trashed||!(meta.parents||[]).includes(MARKETING_ROOT_))continue;groups[folder.division]={label:meta.name,items:[],seen:0};}
  const group=groups[folder.division];let pageToken;
  do{
   const page=Drive.Files.list({q:"'"+folder.id+"' in parents and trashed = false and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'image/' or mimeType contains 'video/')",fields:'nextPageToken,files(id,mimeType,size)',pageSize:1000,...(pageToken?{pageToken}:{})});calls++;
   for(const file of page.files||[]){
    if(file.mimeType==='application/vnd.google-apps.folder'){queue.push({id:file.id,division:folder.division});continue;}
    if(!marketingType_(file.mimeType)||!Number(file.size))continue;
    group.seen++;const item={id:file.id,type:file.mimeType};
    if(group.items.length<100)group.items.push(item);else{const slot=Math.floor(Math.random()*group.seen);if(slot<100)group.items[slot]=item;}
   }
   pageToken=page.nextPageToken;
  }while(pageToken&&calls<100);
 }
 const result=Object.values(groups).filter(g=>g.items.length);const value=JSON.stringify(result);if(value.length<95000)cache.put(key,value,600);return result;
}
function marketingDispatch_(r){
 // Website verifies the NEST session before contacting this private bridge.
 if(r.file){
  if(!/^[A-Za-z0-9_-]{10,150}$/.test(r.file))return {status:400};
  let file;try{file=Drive.Files.get(r.file,{fields:'id,mimeType,size,parents,trashed,thumbnailLink'});}catch(_){return {status:404};}
  if(file.trashed||!marketingType_(file.mimeType)||!marketingWithin_(file))return {status:404};
  return {status:200,file:{id:file.id,type:file.mimeType,size:Number(file.size),thumbnail:r.thumbnail&&file.mimeType.indexOf('image/')===0?file.thumbnailLink:null},readToken:ScriptApp.getOAuthToken()};
 }
 const groups=marketingPool_().map(g=>{const items=g.items.slice();for(let i=items.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}return {label:g.label,items};}),items=[];
 // Round-robin selection keeps large folders from drowning out other divisions.
 for(let round=0;items.length<18&&round<18;round++)for(const g of groups){const file=g.items[round];if(file&&items.length<18)items.push({...file,division:g.label});}
 for(let i=items.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}
 return {status:200,items};
}
