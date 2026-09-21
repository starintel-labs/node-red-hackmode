#!/usr/bin/env node
// Metaprogramming: generate a dedicated hackmode tool node from a tool
// family. Used by the Kali/nix coverage slices to stamp out one node per
// tool without hand-editing.
//   node scripts/generate-tool-node.js <system> <default-template> "<label>"
// Example:
//   node scripts/generate-tool-node.js recon-dns '(recon.dns:subfinder "{{payload}}")' "recon dns"
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const [system, template, label] = process.argv.slice(2);
if (!system || !template || !label) {
  console.error('usage: node scripts/generate-tool-node.js <system> <default-template> "<label>"');
  process.exit(1);
}
const name = 'hackmode-' + system.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const root = path.resolve(__dirname, '..');

const js = `module.exports = function (RED) {
  'use strict';

  function Node(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    node.runtime = RED.nodes.getNode(config.runtime);
    node.template = config.template || ${JSON.stringify(template)};

    node.on('input', function (msg, send, done) {
      send = send || function () { node.send.apply(node, arguments); };
      done = done || function (err) { if (err) node.error(err, msg); };
      if (!node.runtime || typeof node.runtime.evaluate !== 'function') {
        const e = new Error('missing hackmode-runtime configuration');
        e.code = 'HM_CONFIG';
        return done(e);
      }
      const forms = require('../lib/hackmode-forms');
      const form = '(progn (asdf:load-system :${system}) ' +
        forms.renderForm(node.template, msg) + ')';
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

  RED.nodes.registerType('${name}', Node);
};
`;

const html = `<script type="text/javascript">
    RED.nodes.registerType('${name}', {
        category: 'hackmode',
        color: '#1abc9c',
        defaults: {
            name: { value: '' },
            runtime: { type: 'hackmode-runtime', required: true },
            template: { value: ${JSON.stringify(template)} }
        },
        inputs: 1,
        outputs: 1,
        icon: 'serial.svg',
        label: function () {
            return this.name || '${label}';
        }
    });
</script>

<script type="text/html" data-template-name="${name}">
    <div class="form-row">
        <label for="node-input-name"><i class="fa fa-tag"></i> Name</label>
        <input type="text" id="node-input-name">
    </div>
    <div class="form-row">
        <label for="node-input-runtime"><i class="fa fa-server"></i> Runtime</label>
        <input type="text" id="node-input-runtime">
    </div>
    <div class="form-row">
        <label for="node-input-template"><i class="fa fa-code"></i> Form template</label>
        <input type="text" id="node-input-template">
        <div class="form-tips">Placeholders: {{payload}} and {{args}} (Lisp alist). Loads ASDF system :${system} first.</div>
    </div>
</script>
`;

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg['node-red'].nodes[name] = `nodes/${name}.js`;
fs.mkdirSync(path.join(root, 'nodes'), { recursive: true });
fs.writeFileSync(path.join(root, 'nodes', `${name}.js`), js);
fs.writeFileSync(path.join(root, 'nodes', `${name}.html`), html);
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`generated nodes/${name}.js nodes/${name}.html (system ${system}) and registered it`);
