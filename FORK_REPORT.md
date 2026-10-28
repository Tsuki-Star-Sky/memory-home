# Fork report

## Scope and exact copy allowlist

Source working tree: qq-bridge-memory. New independent target: memory-home-open-source.
Copied source files only:
- src/private-memory/bridge.mjs
- src/private-memory/capture.mjs
- src/private-memory/care.mjs
- src/private-memory/cognitive.mjs
- src/private-memory/learning.mjs
- src/private-memory/store.mjs
- public/private-memory.html

Copied self-contained tests only:
- scripts/test-private-memory.mjs
- scripts/test-private-care.mjs
- scripts/test-memory-learning.mjs
- scripts/test-memory-cognitive.mjs

LICENSE retains only the original MIT grant and attribution. New files are
package.json, .gitignore, .env.example, THIRD_PARTY_NOTICES.md, this report,
and examples/demo.mjs. Later pipeline documentation and scan reports may be added.

No private runtime data, message history, exports, logs, credentials, real account
configuration, git history, overlays, installers, full bridge or MCP servers,
node_modules, SnowLuma code, or binary assets were copied. Test strings and the
demo identity are synthetic fixtures. The source checkout was not modified.

The target was created only after checking it did not exist. No git history was
copied; initialize a fresh repository in the target before publishing. No network
or publishing action was performed in this stage. Sanitizer verification remains
the next pipeline gate; this report is an allowlist record, not its verdict.

The HTML page is a host integration asset and is not a standalone working web app.
It expects an authenticated /api/private-memory adapter. The core/demo run locally
without a server or dependencies.

## Local validation

Node.js v24.22.1: all 39 copied core tests passed and the temporary-data demo
completed successfully. Restricted Windows OS-temp atomic rename returned EPERM;
rerunning with TEMP/TMP pointing at a writable sibling temporary directory passed.
No core source changes were needed. README.md documents the experimental boundary
and required host adapter. No runtime database was retained in the release tree.
