module.exports = function (RED) {
  'use strict';

  const subprocess = require('../lib/hackmode-subprocess');
  const provision = require('../lib/auto-provision');

  function HackmodeRuntimeNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    node.lisp = config.lisp || 'sbcl';
    node.source = config.source || 'auto';
    node.hackmodeHome = config.hackmodeHome || '';
    node.timeoutMs = config.timeoutMs || 60000;
    node.refresh = !!config.refresh;
    node._ready = null;

    node.resolveHome = function (callback) {
      if (node.source !== 'auto') {
        if (!node.hackmodeHome) {
          const e = new Error('checkout source requires the hackmode source path');
          e.code = 'HM_CONFIG';
          return callback(e);
        }
        return callback(null, node.hackmodeHome);
      }
      if (node._ready) return node._ready.then((core) => callback(null, core), callback);
      node._ready = new Promise((resolve, reject) => {
        provision.ensureHackmodeClone(node.refresh, (err, core) => {
          if (err) reject(err); else {
            node.hackmodeHome = core;
            resolve(core);
          }
        });
      });
      return node._ready.then((core) => callback(null, core), callback);
    };

    node.evaluate = function (form, callback) {
      node.resolveHome((err) => {
        if (err) return callback(err);
        subprocess.runHackmode(node, form, callback);
      });
    };
  }

  RED.nodes.registerType('hackmode-runtime', HackmodeRuntimeNode);
};
