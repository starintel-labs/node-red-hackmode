# node-red-hackmode

Node-RED nodes for [hackmode](https://github.com/lost-rob0t/hackmode), the
Common Lisp actor-oriented investigation and reconnaissance environment.

## Nodes

| Node | Kind | Purpose |
|------|------|---------|
| `hackmode-runtime` | config | lisp binary (default sbcl), hackmode checkout, hard timeout |
| `hackmode` | i/o | evaluate a Lisp form in a fresh runtime process with the `:hackmode` ASDF system loaded |

Form comes from the node configuration or `msg.payload`; stdout lands on
`msg.payload`. Failures surface as typed node errors (`HM_EXIT`,
`HM_TIMEOUT`, `HM_SPAWN`, `HM_CONFIG`).

## Status and follow-ups

This is a POC string-in/stdout-out contract:

- structured result decoding once the hackmode-core package API is confirmed
  (roadmap issue #1),
- a real transport (hackmode-server HTTP) when it lands.

## Security notes

- Subprocesses spawn via `execFile` with argv arrays; the checkout path is
  escaped into the ASDF load form.
- Forms are operator-owned flow configuration: Node-RED flows are trusted
  code, same as function nodes.

## Install

```sh
cd ~/.node-red
npm install /path/to/node-red-hackmode
```

## Nix

```sh
nix flake check
nix develop
nix build .#palette
```

## Verification

```sh
node --test
```

## License

MIT
