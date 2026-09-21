'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadModules, instantiate, driveInput, fixturePath, readCapture } = require('./helpers');

const { loadModules: _lm } = require('./helpers');

function runtimeNode(RED, overrides) {
  return instantiate(RED, 'hackmode-runtime', Object.assign({
    id: 'rt1',
    lisp: fixturePath('fake-lisp'),
    source: 'checkout',
    hackmodeHome: '/opt/hackmode/source',
    timeoutMs: 30000
  }, overrides));
}

function captureFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hm-')), 'cap.json');
}

function makeNode(RED, config, runtime) {
  RED._nodesById.rt1 = runtimeNode(RED, runtime);
  return instantiate(RED, 'hackmode', Object.assign({ runtime: 'rt1' }, config));
}

function freshEnv(cap) {
  const restore = { ...process.env };
  process.env.FAKE_LISP_CAPTURE = cap;
  process.env.FAKE_LISP_MODE = 'ok';
  return () => {
    for (const k of Object.keys(restore)) process.env[k] = restore[k];
    delete process.env.FAKE_LISP_MODE;
    delete process.env.FAKE_LISP_CAPTURE;
  };
}

test('hackmode node loads the ASDF system and evaluates the form', async () => {
  const cap = captureFile();
  const restore = freshEnv(cap);
  const RED = loadModules('nodes/hackmode-runtime.js', 'nodes/hackmode.js');
  const node = makeNode(RED, { form: '(hm:operation-status)' });
  const result = await driveInput(node, {});
  restore();
  assert.strictEqual(result.err, undefined, result.err && result.err.message);
  assert.match(result.sent[0].payload, /fake lisp output/);
  const argv = readCapture(cap).argv.join(' ');
  assert.match(argv, /--noinform --non-interactive/);
  assert.match(argv, /\(require "asdf"\)/);
  assert.match(argv, /asdf:load-system :hackmode/);
  assert.match(argv, /\(hm:operation-status\)/);
  // The checkout path is escaped into the Lisp string literal safely.
  assert.match(argv, /truename "\/opt\/hackmode\/source"/);
});

test('hackmode node falls back to msg.payload for the form', async () => {
  const cap = captureFile();
  const restore = freshEnv(cap);
  const RED = loadModules('nodes/hackmode-runtime.js', 'nodes/hackmode.js');
  const node = makeNode(RED, {});
  const result = await driveInput(node, { payload: '(print :hi)' });
  restore();
  assert.strictEqual(result.err, undefined);
  assert.match(readCapture(cap).argv.join(' '), /\(print :hi\)/);
});

test('hackmode node escapes quotes in the checkout path', async () => {
  const cap = captureFile();
  const restore = freshEnv(cap);
  const RED = loadModules('nodes/hackmode-runtime.js', 'nodes/hackmode.js');
  const node = makeNode(RED, { form: '(x)' }, { hackmodeHome: '/opt/we"ird/path' });
  await driveInput(node, {});
  restore();
  const argv = readCapture(cap).argv;
  const joined = argv.join(' ');
  assert.ok(!joined.includes(String.raw`"/opt/we"ird/path"`), 'unescaped quote leaked');
  assert.ok(joined.includes(String.raw`truename "/opt/we\"ird/path"`), 'escaped checkout path missing');
});

test('hackmode node surfaces non-zero exits as HM_EXIT', async () => {
  const cap = captureFile();
  const restore = freshEnv(cap);
  process.env.FAKE_LISP_MODE = 'fail';
  const RED = loadModules('nodes/hackmode-runtime.js', 'nodes/hackmode.js');
  const node = makeNode(RED, { form: '(x)' });
  const result = await driveInput(node, {});
  restore();
  assert.strictEqual(result.sent.length, 0);
  assert.strictEqual(result.err.code, 'HM_EXIT');
});

test('hackmode node kills hung evaluations as HM_TIMEOUT', async () => {
  const cap = captureFile();
  const restore = freshEnv(cap);
  process.env.FAKE_LISP_MODE = 'sleep';
  const RED = loadModules('nodes/hackmode-runtime.js', 'nodes/hackmode.js');
  const node = makeNode(RED, { form: '(x)' }, { timeoutMs: 250 });
  const result = await driveInput(node, {});
  restore();
  assert.strictEqual(result.sent.length, 0);
  assert.strictEqual(result.err.code, 'HM_TIMEOUT');
});

test('hackmode node refuses to run without a runtime config', async () => {
  const RED = loadModules('nodes/hackmode-runtime.js', 'nodes/hackmode.js');
  const node = instantiate(RED, 'hackmode', { runtime: 'missing' });
  const result = await driveInput(node, { payload: '(x)' });
  assert.strictEqual(result.sent.length, 0);
  assert.strictEqual(result.err.code, 'HM_CONFIG');
});

test('hackmode node works when loaded alone on its own RED view (loader isolation regression)', async () => {
  const cap = captureFile();
  const restore = freshEnv(cap);
  const REDcfg = loadModules('nodes/hackmode-runtime.js');
  const RED = loadModules('nodes/hackmode.js');
  RED._nodesById.rt1 = instantiate(REDcfg, 'hackmode-runtime', {
    id: 'rt1', lisp: fixturePath('fake-lisp'), source: 'checkout',
    hackmodeHome: '/opt/hackmode/source', timeoutMs: 30000
  });
  const node = instantiate(RED, 'hackmode', { runtime: 'rt1', form: '(solo)' });
  const result = await driveInput(node, {});
  restore();
  assert.strictEqual(result.err, undefined, result.err && result.err.message);
  assert.match(readCapture(cap).argv.join(' '), /\(solo\)/);
});

test('hackmode-tool node renders templates and loads the tool system', async () => {
  const cap = captureFile();
  const restore = freshEnv(cap);
  const REDcfg = loadModules('nodes/hackmode-runtime.js');
  const RED = loadModules('nodes/hackmode-tool.js');
  RED._nodesById.rt1 = instantiate(REDcfg, 'hackmode-runtime', {
    id: 'rt1', lisp: fixturePath('fake-lisp'), source: 'checkout',
    hackmodeHome: '/opt/hackmode/source', timeoutMs: 30000
  });
  const node = instantiate(RED, 'hackmode-tool', {
    runtime: 'rt1', system: 'recon-dns', template: '(recon.dns:subfinder "{{payload}}")'
  });
  const result = await driveInput(node, { payload: 'starintel.actor', args: { depth: 2 } });
  restore();
  assert.strictEqual(result.err, undefined, result.err && result.err.message);
  const argv = readCapture(cap).argv.join(' ');
  assert.match(argv, /asdf:load-system :recon-dns/);
  assert.match(argv, /recon\.dns:subfinder "starintel\.actor"/);
});

test('hackmode-tool alist rendering quotes strings and passes numbers raw', async () => {
  const cap = captureFile();
  const restore = freshEnv(cap);
  const REDcfg = loadModules('nodes/hackmode-runtime.js');
  const RED = loadModules('nodes/hackmode-tool.js');
  RED._nodesById.rt1 = instantiate(REDcfg, 'hackmode-runtime', {
    id: 'rt1', lisp: fixturePath('fake-lisp'), source: 'checkout',
    hackmodeHome: '/opt/hackmode/source', timeoutMs: 30000
  });
  const node = instantiate(RED, 'hackmode-tool', {
    runtime: 'rt1', system: 'recon-dns', template: '(f {{payload}} :args {{args}})'
  });
  await driveInput(node, { payload: 'x', args: { depth: 2, mode: 'fast' } });
  restore();
  const argv = readCapture(cap).argv.join(' ');
  assert.match(argv, /\(f x :args '\(\(depth \. 2\) \(mode \. "fast"\)\)\)/);
});
