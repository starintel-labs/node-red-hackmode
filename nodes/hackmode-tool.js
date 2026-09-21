module.exports = function (RED) {
  'use strict';

  const forms = require('../lib/hackmode-forms');

  // One node per hackmode tool family: loads the tool's ASDF system and
  // evaluates a form. The template supports {{payload}} (stringified
  // msg.payload) and {{args}} (JSON-encoded msg.args object rendered as a
  // plist-ish alist). Defaults target :recon-dns (subfinder/dnsrecon/...).
  function HackmodeToolNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    node.runtime = RED.nodes.getNode(config.runtime);
    node.system = config.system || 'recon-dns';
    node.template = config.template || '(recon.dns:subfinder "{{payload}}")';

    node.on('input', function (msg, send, done) {
      send = send || function () { node.send.apply(node, arguments); };
      done = done || function (err) { if (err) node.error(err, msg); };

      if (!node.runtime || typeof node.runtime.evaluate !== 'function') {
        const e = new Error('missing hackmode-runtime configuration');
        e.code = 'HM_CONFIG';
        return done(e);
      }
      const form = '(progn (asdf:load-system :' +
        String(node.system).replace(/[^a-z0-9-]/gi, '-') + ') ' +
        forms.renderForm(node.template, msg) + ')';
      node.status({ fill: 'blue', shape: 'dot', text: node.system });
      node.runtime.evaluate(form, (err, stdout) => {
        if (err) {
          node.status({ fill: 'red', shape: 'ring', text: err.code || 'error' });
          return done(err);
        }
        msg.payload = stdout;
        node.status({ fill: 'green', shape: 'dot', text: 'done' });
        send(msg);
        done();
      });
    });
  }

  RED.nodes.registerType('hackmode-tool', HackmodeToolNode);
};
