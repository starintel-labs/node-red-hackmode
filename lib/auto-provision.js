'use strict';

// Auto-provisions the hackmode monorepo so operators never wire a manual
// checkout: clones (recursive, depth 1) into the node's data dir on first
// use and reuses the cache. Returns the hackmode-core source path.

const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_URL = 'https://github.com/lost-rob0t/hackmode.git';

function dataRoot() {
  const xdg = process.env.XDG_DATA_HOME;
  return path.join(xdg || path.join(os.homedir(), '.local', 'share'), 'node-red-hackmode');
}

function ensureHackmodeClone(refresh, callback) {
  const root = dataRoot();
  const clone = path.join(root, 'hackmode');
  const core = path.join(clone, 'source', 'hackmode-core');
  fs.stat(path.join(core, 'hackmode.asd'), (err) => {
    if (!err && !refresh) return callback(null, core);
    if (!err && refresh) {
      // Reuse the existing clone: just fast-forward the superproject.
      return execFile('git', ['-C', clone, 'pull', '--ff-only'], { timeout: 120000 }, (pullErr) => {
        if (pullErr) return wipeAndClone();
        callback(null, core);
      });
    }
    return wipeAndClone();
  });

  function wipeAndClone() {
    fs.rmSync(clone, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    execFile('git',
      ['clone', '--recursive', '--depth', '1', REPO_URL, clone],
      { timeout: 300000, maxBuffer: 16 * 1024 * 1024 },
      (cloneErr, _out, stderr) => {
        if (cloneErr) {
          const e = new Error('auto-provisioning hackmode failed: ' +
            String(stderr || cloneErr.message).slice(0, 500));
          e.code = 'HM_PROVISION';
          return callback(e);
        }
        // Submodules cloned with --recursive already; ensure they exist for
        // older git versions that defer.
        execFile('git', ['-C', clone, 'submodule', 'update', '--init', '--recursive', '--depth', '1'],
          { timeout: 300000 }, (subErr) => {
            if (subErr) {
              const e = new Error('hackmode submodule init failed: ' + String(subErr.message).slice(0, 500));
              e.code = 'HM_PROVISION';
              return callback(e);
            }
            callback(null, core);
          });
      });
  }
}

module.exports = { ensureHackmodeClone, dataRoot, REPO_URL };
