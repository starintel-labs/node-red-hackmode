'use strict';

// Form-template rendering shared by hackmode-tool and generated tool nodes.

function renderForm(template, msg) {
  const payload = msg.payload === undefined || msg.payload === null
    ? '' : String(msg.payload);
  const args = msg.args && typeof msg.args === 'object'
    ? toLispAlist(msg.args) : '()';
  return String(template || '')
    .replace(/\{\{payload\}\}/g, payload.replace(/"/g, '\\"'))
    .replace(/\{\{args\}\}/g, args);
}

function toLispAlist(obj) {
  const pairs = Object.entries(obj).map(([k, v]) => {
    const value = typeof v === 'number' ? String(v) : '"' + String(v).replace(/"/g, '\\"') + '"';
    return '(' + k.replace(/[^a-z0-9-]/gi, '-') + ' . ' + value + ')';
  });
  return "'(" + pairs.join(' ') + ')';
}

module.exports = { renderForm, toLispAlist };
