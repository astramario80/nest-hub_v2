import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const effects = fs.readFileSync('js/spinner-celebration.js', 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const main = fs.readFileSync('js/main.js', 'utf8');

function setup({reduced = false, audio = true} = {}) {
  const dom = new JSDOM('<body><button id="community-tab" class="sops-link active">Community Agreements</button><button id="magic-tab" class="sops-link">Magic Spinner</button><main class="sops-content"><h1></h1><p class="subtitle"></p><div class="placeholder"></div></main></body>', {runScripts: 'outside-only', pretendToBeVisual: true});
  const w = dom.window, intervals = new Map(), timers = new Map();
  let key = 0, starts = 0, stops = 0, resumes = 0;
  w.fetch = async () => ({ok: true, arrayBuffer: async () => new ArrayBuffer(8)});
  w.matchMedia = () => ({matches: reduced});
  w.setInterval = fn => {intervals.set(++key, fn); return key;};
  w.clearInterval = id => intervals.delete(id);
  w.setTimeout = fn => {timers.set(++key, fn); return key;};
  w.clearTimeout = id => timers.delete(id);
  const context = {scale(){}, clearRect(){}, save(){}, translate(){}, rotate(){}, fillRect(){}, restore(){}};
  w.HTMLCanvasElement.prototype.getContext = () => context;
  if (audio) w.AudioContext = class {
    state = 'suspended'; sampleRate = 8000;
    resume() {resumes++; this.state = 'running'; return Promise.resolve();}
    decodeAudioData() {return Promise.resolve({duration: 5.385});}
    createBufferSource() {return {connect(){}, disconnect(){}, start(){starts++;}, stop(){stops++;}};}
  };
  w.eval(effects);
  w.eval(main);
  const click = selector => w.document.querySelector(selector).click();
  click('#magic-tab');
  const finishSpin = () => {for (let i = 0; i < 15; i++) for (const fn of intervals.values()) fn();};
  const names = w.document.querySelector('#spinner-names');
  names.value = 'Alex\nJordan\nSam';
  return {dom, w, click, finishSpin, intervals, timers, counts: () => ({starts, stops, resumes})};
}

test('applause and viewport confetti start only at the reveal; names do not repeat', async () => {
  const t = setup();
  try {
    t.click('#spin-button');
    assert.equal(t.counts().resumes, 1);
    assert.equal(t.counts().starts, 0);
    assert.equal(t.w.document.querySelector('.spinner-confetti'), null);
    t.finishSpin(); await settle();
    assert.equal(t.counts().starts, 1);
    assert.equal(t.w.document.querySelector('.spinner-confetti').width, t.w.innerWidth);
    for (let i = 0; i < 2; i++) {t.click('#spin-button'); t.finishSpin(); await settle();}
    const selected = [...t.w.document.querySelectorAll('#selected-list li')].map(el => el.textContent);
    assert.equal(new Set(selected).size, 3);
    assert.equal(t.w.document.querySelector('#spinner-status').textContent, 'All names have been selected.');
    for (const fn of t.timers.values()) fn();
    assert.equal(t.w.document.querySelector('.spinner-confetti'), null);
    assert.equal(t.counts().stops, 3);
  } finally {await new Promise(resolve => setImmediate(resolve)); t.dom.window.close();}
});

test('reset and SOP navigation cancel pending spins and active effects', async () => {
  const t = setup();
  try {
    t.click('#spin-button'); t.click('#reset-spinner'); t.finishSpin(); await settle();
    assert.equal(t.counts().starts, 0);
    t.click('#spin-button'); t.finishSpin(); await settle();
    t.click('#community-tab');
    assert.equal(t.w.document.querySelector('.spinner-confetti'), null);
    assert.equal(t.counts().stops, 1);
    t.click('#magic-tab');
    t.w.document.querySelector('#spinner-names').value = 'Taylor';
    t.click('#spin-button'); t.click('#community-tab');
    assert.equal(t.intervals.size, 0);
  } finally {await new Promise(resolve => setImmediate(resolve)); t.dom.window.close();}
});

test('reduced motion keeps applause without animated confetti', async () => {
  const t = setup({reduced: true});
  try {
    t.click('#spin-button'); t.finishSpin(); await settle();
    assert.equal(t.counts().starts, 1);
    assert.equal(t.w.document.querySelector('.spinner-confetti'), null);
    assert.equal(t.w.document.querySelectorAll('#selected-list li').length, 1);
  } finally {await new Promise(resolve => setImmediate(resolve)); t.dom.window.close();}
});

test('unsupported audio and empty names do not break selection', async () => {
  const t = setup({audio: false});
  try {
    t.w.document.querySelector('#spinner-names').value = '';
    t.click('#spin-button');
    assert.equal(t.intervals.size, 0);
    assert.equal(t.w.document.querySelector('.spinner-confetti'), null);
    t.w.document.querySelector('#spinner-names').value = 'Taylor';
    t.click('#spin-button'); t.finishSpin(); await settle();
    assert.equal(t.w.document.querySelector('#spinner-result').textContent, 'Taylor');
    assert.ok(t.w.document.querySelector('.spinner-confetti'));
  } finally {await new Promise(resolve => setImmediate(resolve)); t.dom.window.close();}
});
