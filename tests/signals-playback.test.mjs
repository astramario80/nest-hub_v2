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

test('start click activates browser audio before opening Spotify or starting asynchronous setup', async () => {
  const { run, calls } = playerContext();
  run(`tokenRecord = () => ({}); state.player = { activateElement: () => { calls.push('activate'); return Promise.resolve(); } }; startSignals = async () => calls.push('start');`);
  const started = run('startSignalsFromClick()');
  assert.deepEqual(calls, ['activate', 'open-app']);
  await started;
  assert.deepEqual(calls, ['activate', 'open-app', 'start']);
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
