#!/bin/sh
# Nonmutating bootstrap check: no installs, downloads, or configuration writes.
set -eu
cd -- "$(dirname -- "$0")"
command -v node >/dev/null 2>&1 || { printf '%s\n' 'Install Node.js >= 22.13.0, then run this script again.' >&2; exit 1; }
node --input-type=module -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 13)) { console.error("Node.js >= 22.13.0 is required."); process.exit(1); } console.log(`Node.js ${process.versions.node}: OK`);'
command -v npm >/dev/null 2>&1 || { printf '%s\n' 'npm is required to run the documented commands; use a Node distribution with npm.' >&2; exit 1; }
printf '%s\n' 'No dependencies to install. No configuration was changed.' 'Next: npm test' 'Then: npm run demo' 'The HTML page requires a separately implemented authenticated host adapter.'
