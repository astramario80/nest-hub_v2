import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync('lib/signals-player/app.txt', 'utf8').replace(/initialize\(\);\s*$/, '');
function playerContext() {
  const calls = [];
  const ctx = vm.createContext({
    calls, console: { error() {} }, Date,
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
  await assert.rejects(run('runCleanup({end:new Date()})'), /did not start/);
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
