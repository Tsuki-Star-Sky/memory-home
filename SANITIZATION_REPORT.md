# Sanitization report

Verdict: PASS WITH WARNINGS

Initial sanitizer scope: all 19 actual files in this release tree before this report was written,
including hidden files, recursively, excluding any .git metadata. All files were
read with strict UTF-8 decoding. No network or publishing actions were performed.
This is a bounded release-content audit, not a full application security review.

## Scan results

- Secrets: PASS. No embedded credentials, private keys, provider tokens, or real
  account configuration detected. Sensitive-word detection expressions and the
  synthetic test sentinel are intentional code/fixtures, not credentials.
- PII and private paths: PASS. No private Windows user paths, home paths, email
  addresses, phone-number-shaped personal identifiers, or private IP endpoints
  detected. Numeric test identities and test messages are synthetic fixtures.
- Internal references: PASS. Public upstream URL, contributor attribution,
  qq-bridge/QSH provenance, excluded-project names, and host tool names are
  intentional documented references. No private host or organization endpoints
  were detected. The upstream URL was inspected as text only.
- Dangerous files: PASS. No runtime memory database, exports, login/session state,
  actual .env, certificate/private-key files, credentials.json, logs, dependencies,
  installers, binaries, or repository history were present. .env.example contains
  explanatory comments only. .gitignore excludes common private runtime outputs.
- Configuration completeness: PASS WITH WARNINGS. Six core modules, four standalone
  tests, demo, package manifest, license, and supporting documentation are present.
  No environment variables or external dependencies are required by the core.
- Git history: PASS. No .git file or directory exists within the target; Git reports
  that the target is not a repository. No source history or remotes were copied.
  Fresh repository initialization is still required before publication.

## Warnings and functional limitations

The HTML management page is an integration asset. It requires an authenticated
host adapter implementing /api/private-memory and the host console; no server or
adapter is shipped. README explicitly documents this boundary, authorization,
input validation, response/action handling, and host-supplied qq_memory tools.

The page accepts a host token from a URL, stores it in browser localStorage, and
propagates it in its console backlink. No actual token is present in this release.
Before deploying a real host, review this design: URLs can expose tokens through
browser history and request logging. The standalone local demo does not use it.

The core writes plaintext local JSON and does not provide disk encryption,
authentication, multi-process coordination, or arbitrary nonnumeric user IDs;
README documents these limitations. Ignore rules are safeguards, not a guarantee
that future runtime files cannot be committed. Re-scan after packaging or edits.

## File inventory tally

| Type | Count |
| --- | ---: |
| .mjs | 11 |
| .md | 3 |
| .html | 1 |
| .json | 1 |
| .example | 1 |
| .gitignore | 1 |
| extensionless LICENSE | 1 |
| Total scanned before report creation | 19 |

## Unreadable Files

Unreadable count: 0

Tally by type: none (0 files).

Cross-check: the adjacent memory-home-open-source.UNREADABLE_FILES.txt sidecar
was checked by existence only and does not exist, as required for zero unreadable
files. No sidecar contents were read. All 19 enumerated actual files were read
successfully; strict decoding produced zero failures. This newly generated report
is the twentieth file and is verified readable after writing.
## Post-packaging verification

Current release tree: **25 actual files**, including this report and hidden files.
All 25 files were enumerated and read with strict UTF-8 decoding after packaging.
Unreadable count remains **0**; the adjacent unreadable-files sidecar does not exist.
A bounded credential/private-path pattern recheck found zero matching files.
No source, test, license, or third-party-notice files were changed by packaging.
The initial scan tally above is retained as historical evidence; the current tally is:

| Type | Count |
| --- | ---: |
| .mjs | 11 |
| .md | 8 |
| .html | 1 |
| .json | 1 |
| .example | 1 |
| .gitignore | 1 |
| .sh | 1 |
| extensionless LICENSE | 1 |
| Total scanned after packaging | 25 |

Added developer/contributor documentation, a nonmutating shell version check,
and two issue templates; README now leads in Chinese. Existing warnings remain
applicable. Windows does not preserve a POSIX executable bit for setup.sh here;
run it with `sh setup.sh`, or set its executable mode when creating the Git repo.
No network, publishing, Git initialization, or dependency installation was performed.