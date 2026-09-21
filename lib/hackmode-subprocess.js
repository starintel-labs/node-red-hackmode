'use strict';

// Subprocess contract for hackmode evaluations, shared by every node in
// this palette. RED-free on purpose: the Node-RED loader hands each node
// file its own RED view, so helpers stashed on RED.nodes do not survive
// across files.

function escapeLispString(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildArgv(config, form) {
  const argv = ['--noinform', '--non-interactive'];
  if (config.hackmodeHome) {
    argv.push('--eval', '(require "asdf")');
    argv.push('--eval',
      '(progn (pushnew (truename "' + escapeLispString(String(config.hackmodeHome)) +
      '") asdf:*central-registry* :test #\'equal) (asdf:load-system :hackmode))');
  }
  argv.push('--eval', form);
  return argv;
}

function truncate(text, max) {
  const s = String(text || '');
  const limit = max || 4000;
  return s.length > limit ? s.slice(0, limit) + '...[truncated]' : s;
}

function runHackmode(config, form, callback) {
  const { execFile } = require('node:child_process');
  const lisp = config.lisp || 'sbcl';
  const argv = buildArgv(config, form);
  const timeout = Number(config.timeoutMs) || 60000;
  execFile(lisp, argv, {
    timeout,
    killSignal: 'SIGKILL',
    maxBuffer: 16 * 1024 * 1024,
    env: process.env
  }, (err, stdout) => {
    if (err) {
      if (err.code === 'ENOENT') {
        const e = new Error('failed to start lisp runtime ' + lisp);
        e.code = 'HM_SPAWN';
        return callback(e);
      }
      if (err.killed || err.signal === 'SIGKILL') {
        const e = new Error('hackmode evaluation timed out or was killed');
        e.code = 'HM_TIMEOUT';
        return callback(e);
      }
      const e = new Error('hackmode evaluation failed with status ' + err.code);
      e.code = 'HM_EXIT';
      e.exitCode = err.code;
      e.stdout = truncate(stdout, 4000);
      return callback(e);
    }
    callback(null, String(stdout));
  });
}

module.exports = { buildArgv, runHackmode, truncate, escapeLispString };
