// Original activities from Finished List, read October 19, 2026. The Doc remains unchanged.
const FINISHED_LIST_SEED = [
  {
    "id": "original-1",
    "instructions": "Look for some courses you like on Khan Academy. Especially useful if you have AP courses next year, if you like computer science, or if you want to brush up on some life skills.",
    "url": "https://www.khanacademy.org/",
    "title": "Khan Academy courses",
    "description": "Strengthen subject knowledge, prepare for AP courses, or explore computer science and practical life skills."
  },
  {
    "id": "original-2",
    "instructions": "Create a WeaveSilk on weavesilk.com",
    "url": "http://weavesilk.com",
    "title": "WeaveSilk generative art",
    "description": "Explore symmetry, color, and composition by creating a piece of generative art."
  },
  {
    "id": "original-3",
    "instructions": "Create a Sketch on Sketchpad 5.1!",
    "url": "https://sketchpad.app/en/",
    "title": "Sketchpad digital drawing",
    "description": "Practice digital drawing and communicate an idea through an original sketch."
  },
  {
    "id": "original-4",
    "instructions": "Create a phone app with App Inventor: appinventor.mit.edu",
    "url": "http://appinventor.mit.edu/",
    "title": "MIT App Inventor",
    "description": "Develop computational thinking by designing and building a mobile app."
  },
  {
    "id": "original-5",
    "instructions": "Make 3 different projects in bighugelabs.com. If you make something great, we can print it!",
    "url": "https://bighugelabs.com/",
    "title": "Big Huge Labs design projects",
    "description": "Practice visual communication through three design projects and prepare a finished piece for print."
  },
  {
    "id": "original-6",
    "instructions": "Create a documentary-type video. This can be a spoof-type of documentary (a.k.a. “Mockumentary) or it can be an actual documentary on an actual topic. We will show it to the class when you are done.",
    "url": "",
    "title": "Create a documentary",
    "description": "Practice research, scripting, filming, and editing to explain a topic or tell a documentary-style story."
  },
  {
    "id": "original-7",
    "instructions": "Make a Voki on voki.com . Put it on your website",
    "url": "http://www.voki.com/",
    "title": "Voki talking avatar",
    "description": "Practice clear communication by scripting an avatar presentation for your website."
  },
  {
    "id": "original-8",
    "instructions": "Make a word cloud on tagxedo.com. It should revolve around a theme. ‘all about me’ ‘Washington State’ ‘Things that are Green’ etc. Put it in your Multimedia folder so I can Print it.",
    "url": "",
    "title": "A themed word cloud",
    "description": "Organize vocabulary and ideas around a theme, then use typography to communicate it visually."
  },
  {
    "id": "original-9",
    "instructions": "Make a comic strip on pixton.com. Put in the Multimedia folder and let me know.",
    "url": "https://www.pixton.com/",
    "title": "Pixton comic strip",
    "description": "Develop storytelling and visual literacy by creating an original comic strip."
  },
  {
    "id": "original-10",
    "instructions": "Make an animated video on goanimate.com . It can be a story (Red Riding Hood), or teach a lesson (How to Sharpen a Pencil with a Vegetable Peeler), a Newscast, or a Sitcom type animation – you choose. Share or put in the Multimedia folder.",
    "url": "https://www.iorad.com/player/123331/GO-ANIMATE#trysteps-1",
    "title": "Animated storytelling tutorial",
    "description": "Practice sequencing, storyboarding, and animation to tell a story or teach a lesson."
  },
  {
    "id": "original-11",
    "instructions": "Make an animoto video as a gift for someone on animoto.com. Gather photos and videos that make sense for that person (family pictures and a video for mom for the holiday season, dog pictures for your friend who loves dogs, math pictures for your math teacher). Make the video and email it to Mr. Penalver.",
    "url": "https://animoto.com/",
    "title": "Animoto video gift",
    "description": "Practice selecting and sequencing photos and video to communicate a meaningful message to an audience."
  },
  {
    "id": "original-12",
    "instructions": "Make a Prezi for another class project on prezi.com. Science, Social Studies, Language Arts – could you incorporate any other class with a Prezi? Do you need to make a presentation for them? Make it here in Prezi. Email it to Mr. Penalver.",
    "url": "https://prezi.com/",
    "title": "Prezi for another class",
    "description": "Connect learning across classes by organizing and presenting another subject's ideas visually."
  },
  {
    "id": "original-13",
    "instructions": "Did you like one of the assignments we’ve done? Do it again!",
    "url": "",
    "title": "Revisit a favorite assignment",
    "description": "Deepen a skill from a completed assignment by trying a new approach or creating a stronger version."
  },
  {
    "id": "original-14",
    "instructions": "Create a game on Scratch, and share the link with Mr. Penalver.",
    "url": "https://scratch.mit.edu/",
    "title": "Scratch game design",
    "description": "Practice programming, logic, and debugging by creating and sharing an original game."
  },
  {
    "id": "original-15",
    "instructions": "Build a Javascript program on Brilliant.org.",
    "url": "http://Brilliant.org",
    "title": "Brilliant programming practice",
    "description": "Build problem-solving and programming skills through an independent challenge."
  },
  {
    "id": "original-16",
    "instructions": "Make quizzes, and take quizzes on Sporcle.",
    "url": "https://www.sporcle.com/",
    "title": "Sporcle quizzes",
    "description": "Strengthen subject recall and question-writing skills by creating and taking quizzes."
  },
  {
    "id": "original-17",
    "instructions": "Learn chess www.mathsisfun.com/games/chess.html",
    "url": "http://www.mathsisfun.com/games/chess.html",
    "title": "Learn chess",
    "description": "Develop planning, pattern recognition, and strategic thinking by learning chess."
  }
];
const FINISHED_LIST_KEY='finished-list-file-v1';
function finishedAllowed_(identity){
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
function finishedUrl_(value){
  return typeof value==='string'&&value.length<=2000&&/^https?:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?(?:[/?#][^\s\\<>"']*)?$/i.test(value);
}
function finishedEntry_(r){
  if(typeof r.title!=='string'||typeof r.description!=='string'||typeof r.url!=='string')return null;
  const title=r.title.trim(),description=r.description.trim(),url=r.url.trim();
  if(!title||title.length>120||!description||description.length>1500||!finishedUrl_(url)||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(r.requestId||''))return null;
  return {id:r.requestId,title,description,url,instructions:''};
}
function finishedRead_(store){
  const id=store.getProperty(FINISHED_LIST_KEY);
  if(!id)return {schema:1,entries:FINISHED_LIST_SEED.map(entry=>({...entry}))};
  const response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media',{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw new Error('Finished list unavailable');
  const state=JSON.parse(response.getContentText());
  if(state.schema!==1||!Array.isArray(state.entries)||state.entries.length>500)throw new Error('Invalid finished list');
  return state;
}
function finishedPublic_(state,canAdd){
  return {status:200,canAdd,entries:state.entries.map(({id,title,url,description,instructions})=>({id,title,url,description,instructions:instructions||''}))};
}
function finishedDispatch_(r){
  const store=PropertiesService.getScriptProperties(),session=r.session?authSession_(r.session,store,Date.now()):null;
  if(r.action==='finished-list-view')return finishedPublic_(finishedRead_(store),Boolean(session&&finishedAllowed_(session.email)));
  if(r.action!=='auth-finished-list-add')return {status:400};
  if(!session)return {status:401};
  const entry=finishedEntry_(r);if(!entry)return {status:400};
  const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return {status:503};
  try{
    // Authorization and the read/append/write all happen under the same lock.
    if(!finishedAllowed_(session.email))return {status:403};
    const state=finishedRead_(store),existing=state.entries.find(item=>item.id===entry.id);
    if(existing)return existing.title===entry.title&&existing.description===entry.description&&existing.url===entry.url?finishedPublic_(state,true):{status:409};
    if(state.entries.length>=500)return {status:409};
    state.entries.push({...entry,createdAt:new Date().toISOString(),actor:hash_(session.email)});
    const id=store.getProperty(FINISHED_LIST_KEY),blob=Utilities.newBlob(JSON.stringify(state),'application/json','NEST Finished List.json');
    if(id)Drive.Files.update({},id,blob,{fields:'id'});
    else{const file=Drive.Files.create({name:'NEST Finished List.json',parents:[trackerFolder_()],mimeType:'application/json'},blob,{fields:'id'});store.setProperty(FINISHED_LIST_KEY,file.id);}
    return finishedPublic_(state,true);
  }finally{lock.releaseLock();}
}
