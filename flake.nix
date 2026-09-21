{
  description = "Node-RED nodes for the hackmode Common Lisp exploit metaframework";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [ pkgs.nodejs_22 pkgs.swi-prolog ];
        };
      });

      packages = forAllSystems (pkgs: {
        palette = pkgs.stdenv.mkDerivation {
          pname = "node-red-hackmode";
          version = (builtins.fromJSON (builtins.readFile ./package.json)).version;
          src = self;
          installPhase = ''
            runHook preInstall
            mkdir -p $out/lib/node_modules/node-red-hackmode
            cp -r . $out/lib/node_modules/node-red-hackmode/
            rm -rf $out/lib/node_modules/node-red-hackmode/.git
            runHook postInstall
          '';
        };
      });

      checks = forAllSystems (pkgs: {
        node-test = pkgs.runCommand "node-red-hackmode-node-test"
          {
            nativeBuildInputs = [ pkgs.nodejs_22 ];
          }
          ''
            cp -r ${self} source
            chmod -R u+w source
            cd source
            node --test
            touch $out
          '';
      });
    };
}
