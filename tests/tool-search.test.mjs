import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

function setup(t) {
    const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), { url: 'https://gknest.org/', runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    const { window: w } = dom;
    w.eval(fs.readFileSync('js/disclosures.js', 'utf8'));
    w.eval(fs.readFileSync('js/sop-tools.js', 'utf8'));
    w.eval(fs.readFileSync('js/tool-search.js', 'utf8'));
    const input = w.document.querySelector('#tool-search-input');
    return { w, input, search(value) { input.value = value; input.dispatchEvent(new w.Event('input')); return [...w.document.querySelectorAll('#tool-search-results a')]; } };
}

test('finds tools inside collapsed menus by names and student vocabulary', t => {
    const { w, search } = setup(t);
    for (const [query, href] of [['printer', '/print-queue'], ['equipment', '/inventory'], ['lab pass', '/nestrequest'], ['BELL schedule', '/bell-schedule'], ['nest request', '/nestrequest'], ['sign-in', '/sign-in-sheet'], ['thingiverse', '/thingiverse'], ['robotics membership', '/join-robotics']]) {
        assert.ok(search(query).some(link => link.getAttribute('href') === href), query);
    }
    const links = search('weather');
    assert.equal(links.length, 1, 'duplicate navigation destinations appear once');
    assert.equal(links[0].getAttribute('href'), '/weather');
    assert.equal(w.document.querySelector('.tool-search').hidden, false);
});

test('all SOP sections are searchable with direct links, including Magic Spinner and name picker', t => {
    const { w, search } = setup(t);
    const sops = new JSDOM(fs.readFileSync('sops.html', 'utf8'));
    t.after(() => sops.window.close());
    const titles = [...sops.window.document.querySelectorAll('.sops-link')].map(button => button.textContent.trim());
    assert.deepEqual(Array.from(w.NestSopTools, entry => entry.title).sort(), titles.sort(), 'directory covers every SOP section');
    for (const title of titles) {
        const link = search(title).find(link => link.querySelector('strong').textContent === title && link.getAttribute('href').startsWith('/sops#'));
        assert.ok(link, title);
        assert.match(link.getAttribute('href'), /^\/sops#/);
    }
    for (const query of ['spinner', 'magic spinner', 'random name', 'name picker']) {
        assert.ok(search(query).some(link => link.getAttribute('href') === '/sops#magic-spinner'), query);
    }
});

test('SOP direct links select the requested tool on load and when the hash changes', async t => {
    const dom = new JSDOM(fs.readFileSync('sops.html', 'utf8'), { url: 'https://gknest.org/sops#magic-spinner', runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    const w = dom.window;
    w.matchMedia = () => ({ matches: false });
    w.eval(fs.readFileSync('js/main.js', 'utf8'));
    w.eval(fs.readFileSync('js/sop-tools.js', 'utf8'));
    assert.equal(w.document.querySelector('.sops-link.active').textContent, 'Magic Spinner');
    assert.ok(w.document.querySelector('#spin-button'));
    const fileNaming = [...w.document.querySelectorAll('.sops-link')].find(button => button.textContent === 'File Naming');
    fileNaming.click();
    assert.equal(w.location.hash, '#file-naming');
    w.history.replaceState(null, '', '#magic-spinner');
    w.dispatchEvent(new w.HashChangeEvent('hashchange'));
    assert.ok(w.document.querySelector('#spin-button'));
    w.history.replaceState(null, '', '#unknown');
    w.dispatchEvent(new w.HashChangeEvent('hashchange'));
    assert.equal(w.document.querySelector('.sops-link.active').textContent, 'Magic Spinner');
    w.history.replaceState(null, '', '/sops');
    w.dispatchEvent(new w.PopStateEvent('popstate'));
    assert.equal(w.document.querySelector('.sops-link.active').textContent, 'Community Agreements');
    assert.equal(w.location.hash, '', 'returning to the default section does not add history');
    await new Promise(resolve => setImmediate(resolve));
});

test('empty, unmatched, and unsafe-looking input stay local and recover with Clear', t => {
    const { w, input, search } = setup(t);
    assert.equal(w.document.querySelector('#tool-search-results').hidden, true);
    assert.equal(search('<img src=x onerror=alert(1)>').length, 0);
    assert.equal(w.document.querySelector('#tool-search-results img'), null);
    assert.match(w.document.querySelector('.tool-search-status').textContent, /No tools found/);
    search('   ');
    assert.equal(w.document.querySelector('#tool-search-results').hidden, true);
    search('printer');
    w.document.querySelector('.tool-search button').click();
    assert.equal(input.value, '');
    assert.equal(w.document.activeElement, input);
    assert.equal(w.document.querySelector('#tool-search-results').hidden, true);
});

test('keyboard search reaches results, Escape resets, and external behavior is retained', t => {
    const { w, input, search } = setup(t);
    search('onshape');
    const link = w.document.querySelector('#tool-search-results a');
    assert.equal(link.target, '_blank');
    assert.equal(link.hasAttribute('data-resource-exit'), true);
    assert.match(link.rel, /noopener/);
    w.document.querySelector('.tool-search form').dispatchEvent(new w.Event('submit', { cancelable: true }));
    assert.equal(w.document.activeElement, link);
    link.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(input.value, '');
    assert.equal(w.document.activeElement, input);
    search('magic spinner');
    input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    assert.equal(w.document.activeElement.getAttribute('href'), '/sops#magic-spinner');
    assert.equal(search('doughnut').length, 0, 'conditional hidden links stay hidden');
});
