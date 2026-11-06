import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync('lib/signals-player/app.txt', 'utf8').replace(/initialize\(\);\s*$/, '');
function playerContext() {
  const calls = [];
  const ctx = vm.createContext({
    calls, console: { error() {} }, Date, AbortSignal,
    document: { querySelector: () => ({ dataset: {}, querySelectorAll: () => [] }) },
    window: { location: { assign: () => calls.push('open-app') } },
    localStorage: { getItem: () => null, setItem() {} },
    clearInterval() {}, setTimeout: resolve => resolve()
  });
  vm.runInContext(source, ctx);
  return { ctx, calls, run: code => vm.runInContext(code, ctx) };
}

test('start click activates online audio before asynchronous setup without opening the desktop app', async () => {
  const { run, calls } = playerContext();
  run(`tokenRecord = () => ({}); state.player = { activateElement: () => { calls.push('activate'); return Promise.resolve(); } }; startSignals = async () => calls.push('start');`);
  const started = run('startSignalsFromClick()');
  assert.deepEqual(calls, ['activate']);
  await started;
  assert.deepEqual(calls, ['activate', 'start']);
});

test('cleanup catches up throughout its six-minute window, never before or after the period', async () => {
  for (const offset of [-1, 0, 120000, 359999, 360000]) {
    const { ctx, run, calls } = playerContext();
    const cleanupAt = new Date('2026-10-01T10:00:00Z').getTime();
    ctx.Date = class extends Date { constructor(...args) { super(...(args.length ? args : [cleanupAt + offset])); } static now() { return cleanupAt + offset; } };
    run(`state.running = true; state.schedule = [{label:'Period 1',start:new Date('2026-10-01T09:00:00Z'),end:new Date('2026-10-01T10:06:00Z')}]; checkNestAccess = async()=>{}; updateReadouts=()=>{}; enforcePeriodVolume=async()=>{}; runCleanup=async()=>calls.push('cleanup');`);
    await run('schedulerTick()');
    assert.equal(calls.includes('cleanup'), offset >= 0 && offset < 360000, String(offset));
  }
});

test('cleanup is not marked complete when the API succeeds but the local player stays paused', async () => {
  const { run, calls } = playerContext();
  run(`state.running=true; state.player={getCurrentState:async()=>({paused:true})}; isCompleted=()=>false; playbackState=async()=>null; activatePlayer=async()=>{}; setSpotifyVolume=async()=>{}; spotifyFetch=async()=>({}); markCompleted=()=>calls.push('completed');`);
  run('recordActivity=()=>{};');
  assert.equal(await run('runCleanup({end:new Date()})'),false);
  assert.equal(run('state.cleanupRetry.attempts'),1);
  assert.deepEqual(calls, []);
});

test('cleanup is completed only after confirmed local playlist playback', async () => {
  const { run, calls } = playerContext();
  run(`state.running=true; state.player={getCurrentState:async()=>({paused:false,context:{uri:CONFIG.cleanupUri}})}; isCompleted=()=>false; playbackState=async()=>null; activatePlayer=async()=>{}; setSpotifyVolume=async()=>{}; spotifyFetch=async()=>({}); markCompleted=()=>calls.push('completed'); recordActivity=()=>{};`);
  await run('runCleanup({end:new Date()})');
  assert.deepEqual(calls, ['completed']);
});

test('playback on a different Spotify device does not suppress local cleanup', async () => {
  const { run, calls } = playerContext();
  run(`state.deviceId='classroom'; isCompleted=()=>false; playbackState=async()=>({is_playing:true,context:{uri:CONFIG.cleanupUri},device:{id:'elsewhere'}}); playContext=async()=>calls.push('play'); markCompleted=()=>calls.push('completed'); recordActivity=()=>{};`);
  await run('runCleanup({end:new Date()})');
  assert.deepEqual(calls, ['play','completed']);
});

test('autoplay failure stops scheduling, preserves retry, and leaves a visible error', () => {
  const { run, ctx } = playerContext();
  const listeners = {};
  ctx.window.Spotify = ctx.Spotify = { Player: class { addListener(name, callback) { listeners[name] = callback; } } };
  run('preparePlayer(); state.running=true;');
  listeners.autoplay_failed();
  assert.equal(run('state.running'), false);
  assert.equal(run('ui.start.disabled'), false);
  assert.match(run('ui.statusDetail.textContent'), /blocked audio/);
});

test('cleanup volume remains at 80 percent during the cleanup interval', async () => {
  const { run, calls } = playerContext();
  run(`state.schedule=[{label:'Period 1',start:new Date('2026-10-01T09:00:00Z'),end:new Date('2026-10-01T10:06:00Z')}]; setSpotifyVolume=async level=>calls.push(level);recordActivity=()=>{};`);
  await run("enforcePeriodVolume(new Date('2026-10-01T10:02:00Z'))");
  assert.deepEqual(calls, [0.8]);
});

test('volume rises to 100 percent between classes and drops at the official class start', async () => {
  const { run, calls } = playerContext();
  run(`state.schedule=[{label:'Period 3',start:new Date('2026-10-01T09:00:00Z'),end:new Date('2026-10-01T10:06:00Z')},{label:'Period 4',start:new Date('2026-10-01T10:11:00Z'),end:new Date('2026-10-01T11:11:00Z')}];setSpotifyVolume=async level=>calls.push(level);recordActivity=()=>{};`);
  for (const time of ['10:05:59.999', '10:06:00', '10:10:59.999', '10:11:00', '10:11:01']) {
    await run(`enforcePeriodVolume(new Date('2026-10-01T${time}Z'))`);
  }
  assert.deepEqual(calls, [0.8, 1, 0.3]);
  assert.equal(run('CONFIG.tickMs'), 1000);
});

test('a transition caught after class starts uses class volume immediately', async () => {
  for (const [label, time, expected] of [['Period 4','10:10:59',1], ['Period 4','10:11:00',0.3], ['2nd Period','10:11:00',0]]) {
    const { run, ctx, calls } = playerContext();
    ctx.Date = class extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-01T' + time + 'Z'])); } };
    ctx.nextLabel = label;
    run(`const previous={label:'Period 3',start:new Date('2026-10-01T09:00:00Z'),end:new Date('2026-10-01T10:06:00Z')};const next={label:nextLabel,start:new Date('2026-10-01T10:11:00Z'),end:new Date('2026-10-01T11:11:00Z')};state.schedule=[previous,next];isCompleted=()=>false;playContext=async(uri,volume)=>calls.push(volume);markCompleted=()=>{};recordActivity=()=>{};`);
    await run('runTransition(previous,next)');
    assert.deepEqual(calls, [expected]);
  }
});

test('transfer waits for exact SDK device registration and confirmed activation', async () => {
  const { run, ctx, calls } = playerContext();
  let listed = 0, transferred = false;
  ctx.fetchDevice = async (path, options) => {
    if (options) { calls.push(JSON.parse(options.body).device_ids[0]); transferred = true; return {}; }
    listed++;
    return { json: async () => ({ devices: listed === 1 ? [{ id:'other',is_active:true }] : [{id:'nest',is_active:transferred}] }) };
  };
  run("state.deviceId='nest'; spotifyFetch=fetchDevice;");
  await run('activatePlayer()');
  assert.deepEqual(calls, ['nest']);
  assert.equal(listed, 3);
});

test('transient Device Not Found retries the same player', async () => {
  const { run, ctx } = playerContext();
  let transfers = 0;
  ctx.fetchDevice = async (path, options) => {
    if (options) { if (++transfers === 1) throw Object.assign(new Error('Device Not Found'),{status:404}); return {}; }
    return {json:async()=>({devices:[{id:'nest',is_active:transfers > 1}]})};
  };
  run("state.deviceId='nest'; spotifyFetch=fetchDevice;");
  await run('activatePlayer()');
  assert.equal(transfers, 2);
});

test('missing player never falls back to another device and resets stale connection', async () => {
  const { run, calls } = playerContext();
  run("state.deviceId='stale';state.spotifyReady=true;state.player={disconnect:()=>calls.push('disconnect')};spotifyFetch=async(path,options)=>{if(options)calls.push('transfer');return {json:async()=>({devices:[{id:'other',is_active:true}]})};};");
  await assert.rejects(run('activatePlayer()'), /click Start signals to reconnect/);
  assert.deepEqual(calls, ['disconnect']);
  assert.equal(run('state.deviceId'), '');
  assert.equal(run('state.spotifyReady'), false);
});

test('permission errors do not trigger device transfer retries', async () => {
  const { run, ctx, calls } = playerContext();
  ctx.fetchDevice = async (path, options) => {
    if(options) { calls.push('transfer'); throw Object.assign(new Error('Forbidden'),{status:403}); }
    return {json:async()=>({devices:[{id:'nest'}]})};
  };
  run("state.deviceId='nest';state.player={disconnect:()=>{}};spotifyFetch=fetchDevice;");
  await assert.rejects(run('activatePlayer()'), /Forbidden/);
  assert.deepEqual(calls, ['transfer']);
});

test('browser volume changes do not send device-targeted Web API requests', async () => {
  const { run, calls } = playerContext();
  run("state.deviceId='nest';state.player={setVolume:async value=>calls.push(value)};spotifyFetch=async()=>{throw new Error('unexpected API request')};");
  await run('setSpotifyVolume(0.8)');
  assert.deepEqual(calls,[0.8]);
});

test('online Signals never launches the native Spotify app', () => {
  assert.doesNotMatch(source, /spotify:home|openSpotifyApp/);
  assert.doesNotMatch(readFileSync('lib/signals-player/index.txt', 'utf8'), /open-spotify-button/);
});

test('delayed Division 2 transition catches up after 45 seconds but never interrupts its cleanup', async () => {
  for (const time of ['09:20:59','09:21:00','09:22:30','09:27:00','10:20:59','10:21:00','10:27:00']) {
    const { run, ctx, calls } = playerContext();
    const at = new Date('2026-10-01T'+time+'Z').getTime();
    ctx.Date = class extends Date {constructor(...args){super(...(args.length?args:[at]));}static now(){return at;}};
    run(`state.running=true;state.schedule=[{label:'Study Support',start:new Date('2026-10-01T08:51:00Z'),end:new Date('2026-10-01T09:21:00Z')},{label:'2nd Period',start:new Date('2026-10-01T09:26:00Z'),end:new Date('2026-10-01T10:27:00Z')}];checkNestAccess=async()=>{};updateReadouts=()=>{};enforcePeriodVolume=async()=>{};runCleanup=async()=>{};runTransition=async(item,next)=>calls.push(playlistFor(next));`);
    await run('schedulerTick()');
    assert.equal(calls.length, time >= '09:21:00' && time < '10:21:00' ? 1 : 0, time);
    if(calls.length)assert.equal(calls[0],'spotify:playlist:1ZTICxG3ozlLYqfrqOkpbu');
  }
});

test('transition completion is recorded after playback and suppresses duplicate ticks', async () => {
  const { run, calls } = playerContext();
  run(`const completed=new Set();isCompleted=id=>completed.has(id);markCompleted=id=>completed.add(id);playContext=async uri=>calls.push(uri);recordActivity=()=>{};const item={end:new Date('2026-10-01T09:21:00Z')};const next={label:'2nd Period'};`);
  await run('runTransition(item,next);');
  await run('runTransition(item,next);');
  assert.deepEqual(calls,['spotify:playlist:1ZTICxG3ozlLYqfrqOkpbu']);
});

test('announcement mute is visible and period volume resumes afterward', async () => {
  const {run,ctx,calls}=playerContext();
  let at=new Date('2026-10-01T09:30:00Z').getTime();
  ctx.Date=class extends Date{constructor(...args){super(...(args.length?args:[at]));}static now(){return at;}};
  run(`state.running=true;state.schedule=[{label:'2nd Period',start:new Date('2026-10-01T09:26:00Z'),end:new Date('2026-10-01T10:27:00Z')}];checkNestAccess=async()=>{};updateReadouts=()=>{};setSpotifyVolume=async level=>calls.push(level);recordActivity=()=>{};`);
  await run('schedulerTick()');
  assert.equal(run('ui.statusHeading.textContent'),'ANNOUNCEMENT QUIET TIME');
  assert.deepEqual(calls,[0]);
  at=new Date('2026-10-01T09:31:00Z').getTime();
  await run('schedulerTick()');
  assert.equal(run('ui.statusHeading.textContent'),'SIGNALS ACTIVE');
  assert.deepEqual(calls,[0,0.3]);
});

test('planning starts Chill Folk after silent lunch, even with completed transition markers', async () => {
  const { run,ctx,calls }=playerContext();
  run('checkPlaybackHealth=async()=>true;');
  ctx.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-01T11:15:00Z']));}};
  run(`state.running=true;state.schedule=[{label:'1ST LUNCH',silentLunch:true,start:new Date('2026-10-01T10:27:00Z'),end:new Date('2026-10-01T10:57:00Z')},{label:'3RD PERIOD',planning:true,start:new Date('2026-10-01T11:02:00Z'),end:new Date('2026-10-01T12:03:00Z')}];state.player={getCurrentState:async()=>({paused:true})};checkNestAccess=async()=>{};updateReadouts=()=>{};enforcePeriodVolume=async()=>{};isCompleted=()=>true;playContext=async(uri,volume)=>calls.push([uri,volume]);recordActivity=()=>{};`);
  await run('schedulerTick()');await run('schedulerTick()');
  assert.deepEqual(calls.map(entry=>Array.from(entry)),[['spotify:playlist:1leyIgu6VXG7cpa2HjO9FF',0.3]]);
  assert.match(run('ui.audioStatus.textContent'),/Chill Folk playback confirmed/);
});

test('planning without a following block continues Chill Folk without an exit cue', async () => {
  const {run,calls}=playerContext();
  run(`const item={label:'3RD PERIOD',planning:true,start:new Date('2026-10-01T11:02:00Z'),end:new Date('2026-10-01T12:03:00Z')};state.schedule=[item];isCompleted=()=>false;playbackState=async()=>{throw new Error('cleanup must not run')};setSpotifyVolume=async level=>calls.push(level);recordActivity=()=>{};`);
  await run('runCleanup(item)');await run("enforcePeriodVolume(new Date('2026-10-01T12:00:00Z'))");
  assert.deepEqual(calls,[0.3]);
});

test('planning recognizes existing local Chill Folk without restarting the playlist', async()=>{
  const {run,calls}=playerContext();
  run(`state.player={getCurrentState:async()=>({paused:false,context:{uri:CONFIG.quietUri}})};playContext=async()=>calls.push('restart');recordActivity=()=>{};`);
  await run('runPlanning({start:new Date()})');assert.deepEqual(calls,[]);
});


test('planning exit cleanup runs only in the final six minutes and never restores Chill Folk over it', async () => {
  for (const time of ['11:56:59','11:57:00','12:00:00']) {
    const {run,ctx,calls}=playerContext();
    ctx.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-01T'+time+'Z']));}};
    run(`state.running=true;state.schedule=[{label:'3RD PERIOD',planning:true,start:new Date('2026-10-01T11:02:00Z'),end:new Date('2026-10-01T12:03:00Z')},{label:'4th Period',start:new Date('2026-10-01T12:08:00Z'),end:new Date('2026-10-01T13:09:00Z')}];checkNestAccess=async()=>{};updateReadouts=()=>{};runPlanning=async()=>calls.push('folk');runCleanup=async()=>calls.push('cleanup');setSpotifyVolume=async level=>calls.push(level);recordActivity=()=>{};`);
    await run('schedulerTick()');
    assert.deepEqual(calls,time<'11:57:00'?['folk',0.3]:['cleanup',0.8]);
  }
});

test('planning has no exit cleanup into another planning block or lunch',()=>{
  for(const next of [{planning:true},{lunch:true,silentLunch:true}]){
    const {run,ctx}=playerContext();ctx.nextBlock=next;
    run('const planning={planning:true};state.schedule=[planning,nextBlock];');
    assert.equal(run('hasCleanup(planning)'),false);
  }
});


test('starting during lunch attached to planning plays Chill Folk without lunch cleanup',async()=>{
  const {run,ctx,calls}=playerContext();
  ctx.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-01T10:53:00Z']));}};
  run(`state.running=true;state.schedule=[{label:'1ST LUNCH',lunch:true,silentLunch:true,start:new Date('2026-10-01T10:27:00Z'),end:new Date('2026-10-01T10:57:00Z')},{label:'3RD PERIOD',planning:true,start:new Date('2026-10-01T11:02:00Z'),end:new Date('2026-10-01T12:03:00Z')}];checkNestAccess=async()=>{};updateReadouts=()=>{};runPlanning=async()=>calls.push('folk');runCleanup=async()=>calls.push('cleanup');setSpotifyVolume=async level=>calls.push(level);recordActivity=()=>{};`);
  await run('schedulerTick()');assert.deepEqual(calls,['folk',0.3]);
});

test('embed selects the cue and requests autoplay without Spotify Web API calls',async()=>{
  const {run,calls}=playerContext();
  run(`state.embedded=true;state.embed={loadEntity:uri=>calls.push('load:'+uri),play:()=>calls.push('play'),pause:()=>calls.push('pause')};spotifyFetch=async()=>{throw new Error('Web API should not be called')};`);
  await run('playContext(CONFIG.cleanupUri,0.8)');
  assert.deepEqual(calls,['load:spotify:playlist:1IkWS5ICPcOUKJvXVslYd3','play']);
});

test('embedded announcement pause resumes when quiet time ends and Stop pauses playback',async()=>{
  const {run,calls}=playerContext();
  run(`state.embedded=true;state.running=true;state.embed={play:()=>calls.push('play'),pause:()=>calls.push('pause')};`);
  await run('setSpotifyVolume(0)');await run('setSpotifyVolume(0.3)');run('stopSignals()');
  assert.deepEqual(calls,['pause','play','pause']);
});

test('embedded startup works without a developer token or SDK connection',async()=>{
  const {run,ctx,calls}=playerContext();ctx.setInterval=()=>1;
  run(`state.embedded=true;state.embed={play:()=>calls.push('play'),loadEntity:()=>{},pause:()=>{}};tokenRecord=()=>null;checkNestAccess=async()=>calls.push('nest-check');loadSchedule=async()=>{};loadProfile=connectPlayer=activatePlayer=async()=>{throw new Error('must not use connected player')};requestWakeLock=async()=>{};schedulerTick=async()=>{};`);
  await run('startSignals()');
  assert.equal(run('state.running'),true);assert.deepEqual(calls,['nest-check','play']);
});

test('embed planning uses the playlist controller and separate completion markers',async()=>{
  const {run,calls}=playerContext();
  run(`state.embedded=true;state.embed={play:()=>calls.push('play'),loadEntity:uri=>calls.push(uri)};recordActivity=()=>{};`);
  await run('runPlanning({start:new Date()})');
  assert.deepEqual(calls,['spotify:playlist:1leyIgu6VXG7cpa2HjO9FF','play']);
  run("markCompleted('test')");assert.equal(run("isCompleted('test')"),true);
  assert.match(run('ui.audioStatus.textContent'),/selected/);
});

test('database enrollment overrides division playlists for zero or absent classes',()=>{
 const {run}=playerContext();
 run(`state.schedule=[{label:'0 Hour'},{label:'1st Period'},{label:'2nd Period'},{label:'3RD PERIOD',planning:true},{label:'Period 7'},{label:'CTSO'},{label:'Study Support'}];applyClassEnrollment({'1':true,'2':false,'3':false,'7':true,CTSO:true});`);
 assert.equal(run('playlistFor(state.schedule[0])'),run('CONFIG.quietUri'));
 assert.equal(run('playlistFor(state.schedule[1])'),run('CONFIG.periodUris[1]'));
 assert.equal(run('playlistFor(state.schedule[2])'),run('CONFIG.quietUri'));
 assert.equal(run('playlistFor(state.schedule[3])'),run('CONFIG.quietUri'));
 assert.equal(run('playlistFor(state.schedule[4])'),run('CONFIG.periodUris[7]'));
 assert.equal(run('playlistFor(state.schedule[5])'),run('CONFIG.ctsoUri'));
 assert.equal(run('state.schedule[6].noStudents'),false);
});

test('starting connected playback mid Period 0 selects Chill Folk without a previous transition',async()=>{
 const {run,ctx,calls}=playerContext();ctx.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-02T07:00:00Z']));}};
 run(`state.running=true;state.schedule=[{label:'0 Hour',noStudents:true,start:new Date('2026-10-02T06:55:00Z'),end:new Date('2026-10-02T07:40:00Z')}];state.player={getCurrentState:async()=>null};checkNestAccess=async()=>{};updateReadouts=()=>{};enforcePeriodVolume=async()=>{};playContext=async uri=>calls.push(uri);recordActivity=()=>{};`);
 await run('schedulerTick()');assert.deepEqual(calls,['spotify:playlist:1leyIgu6VXG7cpa2HjO9FF']);
});

test('unexpected pause reports interruption, waits, resumes locally, and confirms recovery', async () => {
 const {run,calls}=playerContext();
 run(`state.running=true;state.spotifyReady=true;state.deviceId='nest';let paused=true;state.player={getCurrentState:async()=>({paused,context:{uri:'playlist'}}),resume:async()=>{calls.push('resume');paused=false;}};playbackState=async()=>({device:{id:'nest'},is_playing:false});recordActivity=message=>calls.push(message);`);
 assert.equal(await run('checkPlaybackHealth(new Date(100000))'),false);
 assert.equal(run('ui.statusHeading.textContent'),'PLAYBACK INTERRUPTED');
 await run('checkPlaybackHealth(new Date(105000))');
 assert.equal(calls.includes('resume'),false);
 await run('checkPlaybackHealth(new Date(110000))');
 assert.equal(calls.filter(x=>x==='resume').length,1);
 assert.equal(await run('checkPlaybackHealth(new Date(115000))'),true);
 assert.ok(calls.includes('Spotify playback recovered.'));
});

test('recovery never takes over Spotify playing on another device', async () => {
 const {run,calls}=playerContext();
 run(`state.running=true;state.deviceId='nest';state.player={getCurrentState:async()=>null};playbackState=async()=>({device:{id:'phone'},is_playing:true});connectPlayer=async()=>calls.push('connect');recordActivity=()=>{};`);
 await run('checkPlaybackHealth(new Date(100000))');
 await run('checkPlaybackHealth(new Date(110000))');
 assert.equal(run('ui.statusHeading.textContent'),'SPOTIFY PLAYING ELSEWHERE');
 assert.deepEqual(calls,[]);
 assert.equal(run('state.playbackHealth.attempts'),0);
});

test('failed recovery attempts are spaced and capped', async () => {
 const {run,calls}=playerContext();
 run(`state.running=true;state.spotifyReady=true;state.player={getCurrentState:async()=>({paused:true,context:{uri:'playlist'}}),resume:async()=>{calls.push('resume');throw new Error('offline');}};playbackState=async()=>null;recordActivity=()=>{};`);
 for(const at of [100000,110000,115000,125000,140000]) await run('checkPlaybackHealth(new Date('+at+'))');
 assert.equal(calls.length,3);
 await assert.rejects(run('checkPlaybackHealth(new Date(155000))'),/three attempts/);
});

test('Stop during a playback check prevents recovery', async () => {
 const {run,calls}=playerContext();
 run(`state.running=true;state.player={getCurrentState:async()=>{state.running=false;return null;},resume:async()=>calls.push('resume')};recordActivity=()=>{};`);
 assert.equal(await run('checkPlaybackHealth(new Date(100000))'),false);
 assert.deepEqual(calls,[]);
});

test('offline browser reconnects and restores the scheduled playlist at class volume', async () => {
 const {run,calls}=playerContext();
 run(`state.running=true;state.player={getCurrentState:async()=>null,disconnect:()=>calls.push('disconnect')};state.expectedUri='scheduled';state.schedule=[{label:'Period 4',start:new Date(0),end:new Date(1000000)}];playbackState=async()=>null;connectPlayer=async()=>calls.push('connect');playContext=async(uri,volume)=>calls.push([uri,volume]);recordActivity=()=>{};`);
 // Use actual date for volume resolution after the asynchronous reconnect.
 run(`volumeSettings=()=>({volume:0.3});`);
 await run('checkPlaybackHealth(new Date(100000))');
 await run('checkPlaybackHealth(new Date(110000))');
 assert.deepEqual(calls.slice(0,2),['disconnect','connect']);
 assert.deepEqual(Array.from(calls[2]),['scheduled',0.3]);
});

test('scheduler shows playback interruption instead of Signals Active when Spotify is paused',async()=>{
 const {run,ctx}=playerContext();
 ctx.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-01T12:20:00Z']));}};
 run(`state.running=true;state.schedule=[];state.player={getCurrentState:async()=>({paused:true})};updateReadouts=()=>{};recordActivity=()=>{};`);
 await run('schedulerTick()');
 assert.equal(run('ui.statusHeading.textContent'),'PLAYBACK INTERRUPTED');
 await run('schedulerTick()');
 assert.equal(run('ui.statusHeading.textContent'),'PLAYBACK INTERRUPTED');
});

test('announcement quiet time does not request playback recovery',async()=>{
 const {run,calls}=playerContext();
 run(`state.running=true;state.schedule=[{label:'2nd Period',start:new Date(100000),end:new Date(1000000)}];state.player={getCurrentState:async()=>({paused:true}),resume:async()=>calls.push('resume')};recordActivity=()=>{};`);
 assert.equal(await run('checkPlaybackHealth(new Date(110000))'),true);
 assert.equal(await run('checkPlaybackHealth(new Date(140000))'),true);
 assert.deepEqual(calls,[]);
});

test('confirmed playlist playback enables context repeat',async()=>{
 const {run,calls}=playerContext();
 run(`state.running=true;state.deviceId='nest';state.player={getCurrentState:async()=>({paused:false,context:{uri:'scheduled'}})};activatePlayer=async()=>{};setSpotifyVolume=async()=>{};spotifyFetch=async path=>{calls.push(path);return {};};`);
 await run("playContext('scheduled',0.3)");
 assert.ok(calls.includes('/me/player/repeat?state=context&device_id=nest'));
});

test('cue does not transfer playback when the browser device is already active',async()=>{
 const {run,calls}=playerContext();
 run(`state.deviceId='nest';spotifyFetch=async(path,options)=>{calls.push(options?'transfer':'devices');return {json:async()=>({devices:[{id:'nest',is_active:true}]})};};`);
 await run('activatePlayer()');
 assert.deepEqual(calls,['devices']);
});

test('cleanup retries a transient failure, preserves completion, and stops retrying on success',async()=>{
 const {run,ctx,calls}=playerContext();let at=100000;
 ctx.Date=class extends Date{constructor(...args){super(...(args.length?args:[at]));}static now(){return at;}};
 run(`state.running=true;state.deviceId='nest';const item={end:new Date(500000)};let failures=1;isCompleted=()=>false;playContext=async()=>{calls.push('play');if(failures-->0)throw Object.assign(new Error('Spotify unavailable'),{status:503});};markCompleted=()=>calls.push('complete');recordActivity=()=>{};`);
 assert.equal(await run('runCleanup(item)'),false);
 assert.equal(run('ui.statusHeading.textContent'),'CLEANUP RETRY');
 at=110000;assert.equal(await run('runCleanup(item)'),false);
 assert.deepEqual(calls,['play']);
 at=115000;await run('runCleanup(item)');
 assert.deepEqual(calls,['play','play','complete']);
 assert.equal(run('state.cleanupRetry'),null);
});

test('cleanup respects Retry-After and caps failures at three attempts',async()=>{
 const {run,ctx,calls}=playerContext();let at=100000;
 ctx.Date=class extends Date{constructor(...args){super(...(args.length?args:[at]));}static now(){return at;}};
 run(`state.running=true;state.deviceId='nest';const item={end:new Date(500000)};isCompleted=()=>false;playContext=async()=>{calls.push('play');throw Object.assign(new Error('Rate limited'),{status:429,retryAfterMs:60000});};markCompleted=()=>calls.push('complete');recordActivity=()=>{};`);
 await run('runCleanup(item)');at=115000;await run('runCleanup(item)');
 assert.equal(calls.length,1);
 at=160000;await run('runCleanup(item)');
 at=220000;await assert.rejects(run('runCleanup(item)'),/Rate limited/);
 assert.deepEqual(calls,['play','play','play']);
});

test('cleanup uses local playback confirmation without a redundant Web API lookup',async()=>{
 const {run,calls}=playerContext();
 run(`state.player={getCurrentState:async()=>({paused:false,context:{uri:CONFIG.cleanupUri}})};isCompleted=()=>false;playbackState=async()=>{throw new Error('must not query Web API')};playContext=async()=>calls.push('play');markCompleted=()=>calls.push('complete');recordActivity=()=>{};`);
 await run('runCleanup({end:new Date()})');
 assert.deepEqual(calls,['complete']);
});

test('scheduler keeps cleanup failure retryable instead of stopping or showing Signals Active',async()=>{
 const {run,ctx}=playerContext();
 ctx.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-01T10:02:00Z']));}static now(){return new Date('2026-10-01T10:02:00Z').getTime();}};
 run(`state.running=true;state.deviceId='nest';state.schedule=[{label:'Period 3',start:new Date('2026-10-01T09:00:00Z'),end:new Date('2026-10-01T10:06:00Z')}];isCompleted=()=>false;updateReadouts=()=>{};recordActivity=()=>{};playContext=async()=>{throw Object.assign(new Error('temporary failure'),{status:503});};`);
 await run('schedulerTick()');
 assert.equal(run('state.running'),true);
 assert.equal(run('ui.statusHeading.textContent'),'CLEANUP RETRY');
});
