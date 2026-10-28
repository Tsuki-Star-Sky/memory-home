# Developer instructions

Experimental local private-memory engine, extracted from qq-bridge. Read README.md, FORK_REPORT.md, and THIRD_PARTY_NOTICES.md before changing scope. Preserve LICENSE and provenance; do not imply that the upstream commit exactly matches all extracted working-tree files.

## Commands

Requires Node.js >= 22.13.0 and npm; no external dependencies or installation required.

- `npm test`: Node built-in test runner, all scripts/test-*.mjs.
- `npm run demo`: synthetic example with temporary storage and cleanup.
- `sh setup.sh`: nonmutating runtime check and command guidance.

Tests create temporary files. In restricted Windows environments use a writable local TEMP/TMP directory if atomic rename is denied. Do not retain runtime databases in the repository.

## Architecture

- src/private-memory/store.mjs: persistence and memory operations; package entry.
- src/private-memory/bridge.mjs: host-facing prompt/tool integration.
- src/private-memory/capture.mjs: evidence capture.
- src/private-memory/cognitive.mjs: cognitive recall modeling.
- src/private-memory/learning.mjs: bounded learning preferences.
- src/private-memory/care.mjs: guarded proactive care decisions.
- public/private-memory.html: management page requiring an authenticated host adapter.
- scripts/test-*.mjs and examples/demo.mjs: standalone validation and example.

## Change constraints

Use Node built-ins where possible and preserve existing module conventions. Add meaningful tests for behavior changes. Run the relevant tests and full core suite before reporting completion. The HTML page has no bundled backend; do not describe it as a turnkey QQ application. Document adapter contract changes and authorization requirements.

Use synthetic fixtures only. Never commit real conversations, account IDs, tokens, local paths, databases, exports, or logs. Plaintext storage, numeric private identities, and lack of multi-process coordination are current limitations. Preserve sanitization warnings; re-scan all release files after packaging changes. Do not publish, push, or contact others without user authorization.
