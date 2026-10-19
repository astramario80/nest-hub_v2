// Original activities from Finished List, read October 19, 2026. The Doc remains unchanged.
const FINISHED_LIST_SEED = [
  {
    "id": "original-1",
    "instructions": "Look for some courses you like on Khan Academy. Especially useful if you have AP courses next year, if you like computer science, or if you want to brush up on some life skills.",
    "url": "https://www.khanacademy.org/",
    "title": "Khan Academy courses",
    "description": "Strengthen subject knowledge, prepare for AP courses, or explore computer science and practical life skills.",
    "skills": [
      "Be Self-Directed Learners",
      "Access & Evaluate Information"
    ],
    "icon": "/assets/finished-list/khan-academy.ico"
  },
  {
    "id": "original-2",
    "instructions": "Create a WeaveSilk on weavesilk.com",
    "url": "http://weavesilk.com",
    "title": "WeaveSilk generative art",
    "description": "Explore symmetry, color, and composition by creating a piece of generative art.",
    "skills": [
      "Think Creatively",
      "Create Media"
    ],
    "icon": "/assets/finished-list/weavesilk.ico"
  },
  {
    "id": "original-3",
    "instructions": "Create a Sketch on Sketchpad 5.1!",
    "url": "https://sketchpad.app/en/",
    "title": "Sketchpad digital drawing",
    "description": "Practice digital drawing and communicate an idea through an original sketch.",
    "skills": [
      "Think Creatively",
      "Create Media",
      "Communicate Clearly"
    ],
    "icon": "/assets/finished-list/sketchpad.ico"
  },
  {
    "id": "original-4",
    "instructions": "Create a phone app with App Inventor: appinventor.mit.edu",
    "url": "http://appinventor.mit.edu/",
    "title": "MIT App Inventor",
    "description": "Develop computational thinking by designing and building a mobile app.",
    "skills": [
      "Apply Technology",
      "Solve Problems",
      "Think Creatively"
    ],
    "icon": "/assets/finished-list/app-inventor.ico"
  },
  {
    "id": "original-5",
    "instructions": "Make 3 different projects in bighugelabs.com. If you make something great, we can print it!",
    "url": "https://bighugelabs.com/",
    "title": "Big Huge Labs design projects",
    "description": "Practice visual communication through three design projects and prepare a finished piece for print.",
    "skills": [
      "Create Media",
      "Communicate Clearly"
    ],
    "icon": "/assets/finished-list/big-huge-labs.ico"
  },
  {
    "id": "original-6",
    "instructions": "Create a documentary-type video. This can be a spoof-type of documentary (a.k.a. “Mockumentary) or it can be an actual documentary on an actual topic. We will show it to the class when you are done.",
    "url": "",
    "title": "Create a documentary",
    "description": "Practice research, scripting, filming, and editing to explain a topic or tell a documentary-style story.",
    "skills": [
      "Create Media",
      "Access & Evaluate Information",
      "Communicate Clearly"
    ],
    "icon": "/assets/finished-list/documentary.svg"
  },
  {
    "id": "original-7",
    "instructions": "Make a Voki on voki.com . Put it on your website",
    "url": "http://www.voki.com/",
    "title": "Voki talking avatar",
    "description": "Practice clear communication by scripting an avatar presentation for your website.",
    "skills": [
      "Communicate Clearly",
      "Create Media"
    ],
    "icon": "/assets/finished-list/voki.ico"
  },
  {
    "id": "original-8",
    "instructions": "Make a word cloud on tagxedo.com. It should revolve around a theme. ‘all about me’ ‘Washington State’ ‘Things that are Green’ etc. Put it in your Multimedia folder so I can Print it.",
    "url": "",
    "title": "A themed word cloud",
    "description": "Organize vocabulary and ideas around a theme, then use typography to communicate it visually.",
    "skills": [
      "Think Creatively",
      "Communicate Clearly"
    ],
    "icon": "/assets/finished-list/word-cloud.svg"
  },
  {
    "id": "original-9",
    "instructions": "Make a comic strip on pixton.com. Put in the Multimedia folder and let me know.",
    "url": "https://www.pixton.com/",
    "title": "Pixton comic strip",
    "description": "Develop storytelling and visual literacy by creating an original comic strip.",
    "skills": [
      "Think Creatively",
      "Create Media",
      "Communicate Clearly"
    ],
    "icon": "/assets/finished-list/pixton.svg"
  },
  {
    "id": "original-10",
    "instructions": "Make an animated video on goanimate.com . It can be a story (Red Riding Hood), or teach a lesson (How to Sharpen a Pencil with a Vegetable Peeler), a Newscast, or a Sitcom type animation – you choose. Share or put in the Multimedia folder.",
    "url": "https://www.iorad.com/player/123331/GO-ANIMATE#trysteps-1",
    "title": "Animated storytelling tutorial",
    "description": "Practice sequencing, storyboarding, and animation to tell a story or teach a lesson.",
    "skills": [
      "Create Media",
      "Think Creatively",
      "Communicate Clearly"
    ],
    "icon": "/assets/finished-list/iorad.ico"
  },
  {
    "id": "original-11",
    "instructions": "Make an animoto video as a gift for someone on animoto.com. Gather photos and videos that make sense for that person (family pictures and a video for mom for the holiday season, dog pictures for your friend who loves dogs, math pictures for your math teacher). Make the video and email it to Mr. Penalver.",
    "url": "https://animoto.com/",
    "title": "Animoto video gift",
    "description": "Practice selecting and sequencing photos and video to communicate a meaningful message to an audience.",
    "skills": [
      "Create Media",
      "Communicate Clearly"
    ],
    "icon": "/assets/finished-list/animoto.svg"
  },
  {
    "id": "original-12",
    "instructions": "Make a Prezi for another class project on prezi.com. Science, Social Studies, Language Arts – could you incorporate any other class with a Prezi? Do you need to make a presentation for them? Make it here in Prezi. Email it to Mr. Penalver.",
    "url": "https://prezi.com/",
    "title": "Prezi for another class",
    "description": "Connect learning across classes by organizing and presenting another subject's ideas visually.",
    "skills": [
      "Communicate Clearly",
      "Create Media",
      "Use Systems Thinking"
    ],
    "icon": "/assets/finished-list/prezi.ico"
  },
  {
    "id": "original-13",
    "instructions": "Did you like one of the assignments we’ve done? Do it again!",
    "url": "",
    "title": "Revisit a favorite assignment",
    "description": "Deepen a skill from a completed assignment by trying a new approach or creating a stronger version.",
    "skills": [
      "Be Self-Directed Learners",
      "Produce Results"
    ],
    "icon": "/assets/finished-list/revisit.svg"
  },
  {
    "id": "original-14",
    "instructions": "Create a game on Scratch, and share the link with Mr. Penalver.",
    "url": "https://scratch.mit.edu/",
    "title": "Scratch game design",
    "description": "Practice programming, logic, and debugging by creating and sharing an original game.",
    "skills": [
      "Apply Technology",
      "Solve Problems",
      "Think Creatively"
    ],
    "icon": "/assets/finished-list/scratch.ico"
  },
  {
    "id": "original-15",
    "instructions": "Build a Javascript program on Brilliant.org.",
    "url": "http://Brilliant.org",
    "title": "Brilliant programming practice",
    "description": "Build problem-solving and programming skills through an independent challenge.",
    "skills": [
      "Solve Problems",
      "Reason Effectively",
      "Apply Technology"
    ],
    "icon": "/assets/finished-list/brilliant.ico"
  },
  {
    "id": "original-16",
    "instructions": "Make quizzes, and take quizzes on Sporcle.",
    "url": "https://www.sporcle.com/",
    "title": "Sporcle quizzes",
    "description": "Strengthen subject recall and question-writing skills by creating and taking quizzes.",
    "skills": [
      "Access & Evaluate Information",
      "Reason Effectively"
    ],
    "icon": "/assets/finished-list/sporcle.png"
  },
  {
    "id": "original-17",
    "instructions": "Learn chess www.mathsisfun.com/games/chess.html",
    "url": "http://www.mathsisfun.com/games/chess.html",
    "title": "Learn chess",
    "description": "Develop planning, pattern recognition, and strategic thinking by learning chess.",
    "skills": [
      "Reason Effectively",
      "Make Judgments & Decisions",
      "Solve Problems"
    ],
    "icon": "/assets/finished-list/maths-is-fun.ico"
  }
];
const FINISHED_LIST_KEY='finished-list-file-v1';
function finishedAllowed_(identity){
  if(OWNER_EMAILS.includes(email_(identity)))return true;
  const leaders=Sheets.Spreadsheets.Values.get(LEADERSHIP_DATABASE,"'Imported'!B2:F").values||[];
  return leaders.some(row=>{
    const period=String(row[0]||'').replace(/^period\s*/i,'').trim().toUpperCase();
    if(!Object.prototype.hasOwnProperty.call(PERIODS,period))return false;
    const role=String(row[2]||'').trim().toLowerCase().replace(/\s+/g,' ');
    const eligible=role==='software technician'||(period!=='CTSO'&&['division manager','assistant manager'].includes(role))||
      (period==='CTSO'&&/^chief (executive|financial|operations|operating) officers?$/.test(role));
    if(!eligible)return false;
    const address=memberEmail_(identity,period);
    return email_(row[4])===address&&rows_(period).some(member=>email_(member[1])===address);
  });
}
function finishedSkills_(){
  const rows=Sheets.Spreadsheets.Values.get(NEST_DATABASE,"'Location_Lists_Inventory_OSPI_21stCenturySkills'!R2:R1002").values||[];
  const skills=[...new Set(rows.map(row=>String(row[0]||'').trim()).filter(Boolean))];
  if(!skills.length||skills.length>100||skills.some(skill=>skill.length>120))throw new Error('Invalid skills list');
  return skills;
}
function finishedUrl_(value){
  return typeof value==='string'&&value.length<=2000&&/^https?:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?(?:[/?#][^\s\\<>"']*)?$/i.test(value);
}
function finishedIcon_(value){
  if(value==='')return true;
  if(typeof value!=='string'||value.length>45000)return false;
  if(/^\/assets\/finished-list\/[a-z0-9-]+\.(png|ico|svg|webp)$/.test(value))return true;
  const match=value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match||match[2].length%4!==0)return false;
  let bytes;try{bytes=Utilities.base64Decode(match[2]).map(byte=>byte&255);}catch(_){return false;}
  if(bytes.length<12||bytes.length>32768)return false;
  const text=(a,b)=>bytes.slice(a,b).map(byte=>String.fromCharCode(byte)).join('');
  return match[1]==='png'?[137,80,78,71,13,10,26,10].every((byte,index)=>bytes[index]===byte):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:text(0,4)==='RIFF'&&text(8,12)==='WEBP';
}
function finishedEntry_(r,skills){
  if(typeof r.title!=='string'||typeof r.description!=='string'||typeof r.url!=='string')return null;
  const title=r.title.trim(),description=r.description.trim(),url=r.url.trim(),update=r.action==='auth-finished-list-update';
  if(!title||title.length>120||!description||description.length>1500||!(update&&url===''||finishedUrl_(url))||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(r.requestId||''))return null;
  if(!Array.isArray(r.skills)||!r.skills.length||r.skills.length>24||new Set(r.skills).size!==r.skills.length||r.skills.some(skill=>!skills.includes(skill))||!finishedIcon_(r.icon||''))return null;
  if(update&&(typeof r.id!=='string'||!/^original-\d+$|^[a-f0-9-]{36}$/i.test(r.id)||!Number.isInteger(r.version)||r.version<1))return null;
  return {id:update?r.id:r.requestId,title,description,url,skills:r.skills,icon:r.icon||''};
}
function finishedRead_(store){
  const id=store.getProperty(FINISHED_LIST_KEY);
  if(!id)return {schema:1,entries:FINISHED_LIST_SEED.map(entry=>({...entry,version:1}))};
  const response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media',{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw new Error('Finished list unavailable');
  const state=JSON.parse(response.getContentText());
  if(state.schema!==1||!Array.isArray(state.entries)||state.entries.length>500)throw new Error('Invalid finished list');
  state.entries=state.entries.map(entry=>{const original=FINISHED_LIST_SEED.find(seed=>seed.id===entry.id);return {...original,...entry,version:entry.version||1,skills:entry.skills||original?.skills||[],icon:entry.icon===undefined?original?.icon||'':entry.icon};});
  return state;
}
function finishedPublic_(state,canAdd,skills){
  return {status:200,canAdd,canEdit:canAdd,skills,entries:state.entries.map(({id,title,url,description,instructions,icon,skills,version})=>({id,title,url,description,instructions:instructions||'',icon:icon||'',skills:skills||[],version:version||1}))};
}
function finishedDispatch_(r){
  const store=PropertiesService.getScriptProperties(),session=r.session?authSession_(r.session,store,Date.now()):null;
  if(r.action==='finished-list-view')return finishedPublic_(finishedRead_(store),Boolean(session&&finishedAllowed_(session.email)),finishedSkills_());
  if(!['auth-finished-list-add','auth-finished-list-update','auth-finished-list-delete'].includes(r.action))return {status:400};
  if(!session)return {status:401};
  const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return {status:503};
  try{
    if(!finishedAllowed_(session.email))return {status:403};
    const skills=finishedSkills_(),state=finishedRead_(store);
    if(r.action==='auth-finished-list-delete'){
      if(typeof r.id!=='string'||!/^(original-\d+|[a-f0-9-]{36})$/i.test(r.id)||!Number.isInteger(r.version)||r.version<1||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(r.requestId||''))return {status:400};
      const existing=state.entries.find(item=>item.id===r.id),deleted=state.deleted?.find(item=>item.id===r.id);
      if(!existing)return deleted?.requestId===r.requestId&&deleted.version===r.version?finishedPublic_(state,true,skills):{status:404};
      if(existing.version!==r.version)return {status:409};
      state.entries=state.entries.filter(item=>item.id!==r.id);
      // Keep only retry metadata; remove the resource, icon and description from storage.
      (state.deleted||(state.deleted=[])).push({id:r.id,version:r.version,requestId:r.requestId});
      finishedWrite_(store,state);return finishedPublic_(state,true,skills);
    }
    const entry=finishedEntry_(r,skills);if(!entry)return {status:400};
    if(state.deleted?.some(item=>item.id===entry.id))return {status:409};
    const existing=state.entries.find(item=>item.id===entry.id),update=r.action==='auth-finished-list-update';
    const same=existing&&['title','description','url','icon','skills'].every(key=>JSON.stringify(existing[key])===JSON.stringify(entry[key]));
    if(update){
      if(!existing)return {status:404};
      if(existing.lastRequestId===r.requestId)return same?finishedPublic_(state,true,skills):{status:409};
      if(existing.version!==r.version)return {status:409};
      // Existing project ideas without a website remain editable, but new blank links are not introduced.
      if(!entry.url&&existing.url)return {status:400};
      Object.assign(existing,entry,{version:existing.version+1,lastRequestId:r.requestId,updatedAt:new Date().toISOString(),actor:hash_(session.email)});
    }else{
      if(existing)return same?finishedPublic_(state,true,skills):{status:409};
      if(state.entries.length>=500)return {status:409};
      state.entries.push({...entry,instructions:'',version:1,createdAt:new Date().toISOString(),actor:hash_(session.email)});
    }
    finishedWrite_(store,state);
    return finishedPublic_(state,true,skills);
  }finally{lock.releaseLock();}
}

function finishedWrite_(store,state){
    const id=store.getProperty(FINISHED_LIST_KEY),blob=Utilities.newBlob(JSON.stringify(state),'application/json','NEST Finished List.json');
    if(id)Drive.Files.update({},id,blob,{fields:'id'});
    else{const file=Drive.Files.create({name:'NEST Finished List.json',parents:[trackerFolder_()],mimeType:'application/json'},blob,{fields:'id'});store.setProperty(FINISHED_LIST_KEY,file.id);}
}
