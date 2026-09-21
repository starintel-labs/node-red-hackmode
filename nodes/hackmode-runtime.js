module.exports = function (RED) {
  'use strict';

  const helpers = require('../lib/hackmode-subprocess');

  function HackmodeRuntimeNode(config) {
    RED.nodes.createNode(this, config);
    this.lisp = config.lisp || 'sbcl';
    this.hackmodeHome = config.hackmodeHome || '';
    this.timeoutMs = config.timeoutMs || 60000;
  }

  RED.nodes.registerType('hackmode-runtime', HackmodeRuntimeNode);

  // Convenience only; sibling nodes require the lib module directly because
  // RED views differ per node file in the runtime loader.
  RED.nodes.hackmode = helpers;
};
