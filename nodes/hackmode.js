module.exports = function (RED) {
  'use strict';

  function HackmodeNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    node.runtime = RED.nodes.getNode(config.runtime);

    node.on('input', function (msg, send, done) {
      send = send || function () { node.send.apply(node, arguments); };
      done = done || function (err) { if (err) node.error(err, msg); };

      if (!node.runtime || typeof node.runtime.evaluate !== 'function') {
        const e = new Error('missing hackmode-runtime configuration');
        e.code = 'HM_CONFIG';
        return done(e);
      }
      let form = (config.form || '').trim();
      if (!form) {
        if (msg.payload === undefined || msg.payload === null) {
          const e = new Error('no form: set the node form or provide msg.payload');
          e.code = 'HM_CONFIG';
          return done(e);
        }
        form = String(msg.payload);
      }

      node.status({ fill: 'blue', shape: 'dot', text: 'evaluating' });
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

  RED.nodes.registerType('hackmode', HackmodeNode);
};
