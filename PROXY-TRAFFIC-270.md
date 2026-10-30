# Windows proxy accounting (2026-10-30, task270)

Windows reports only classified proxy payload bytes. The previous desktop sent
Mihomo global totals, including DIRECT, into quota/usage reports. Connection-list
sampling cannot fix this accurately: a short connection can close between samples.

The Windows build now pins Mihomo `3f27ef39f8c96bbfbc8b0b9bb10f5c9ef60149d8`
plus `scripts/mihomo/proxy-traffic.patch`. The core accumulates proxy totals on
all existing TCP/UDP tracker IO paths, including peek bytes and zero-copy callbacks.
Classification uses the completed connection's concrete leaf and provider identity,
not the rule label or a selector's later state. DIRECT aliases, reject, DNS,
unknown leaves and inner dialer trackers do not add proxy bytes. Dialer chains
count only the outer application tracker, once. The totals remain after close and
reset with the core. `/connections` adds proxyUploadTotal/proxyDownloadTotal.
Global UI traffic totals retain their original meaning.

`build-proxy-core.py TARGET` applies the audited patch to the exact upstream SHA,
runs native tests, builds Windows amd64/arm64 with Go/CGO disabled and writes both
stable/alpha sidecars and a source/patch/binary SHA manifest. Windows therefore
pins both kernel choices to the same accounting source. Prebuild calls this path;
Dev/Release/Autobuild provision Go. Existing stock sidecar files are not trusted.
Do not use core online-upgrade to replace these with a stock kernel: missing
classified fields suspend Windows billing rather than reverting to global totals.

The raw WebSocket bridge preserves the additive fields. Both connection stores
retain them. Windows Home reads the classified values and uses a separate
`shenxianyun.managedTraffic.proxy.v2` local cache, leaving the old v1 cache alone
and never flushing ambiguous old total traffic as proxy traffic. Existing backend
history is not altered. Cumulative counter IDs/sequences, frozen retries and core
reset handling remain. macOS/Linux and Android are outside this Windows fix.

Tests: native Go accounting/classification tests, `pnpm test:managed-traffic`,
`pnpm test:code-switch`, typecheck/lint/web build; `Proxy Accounting Core` workflow
builds the full kernel and runs a real loopback HTTP DIRECT/HTTP-proxy fixture with
five short closed proxy requests. `Development Test` builds temporary Windows
installers. Runtime Windows/VPS/Xray comparisons must be reported separately from
CI. No tag, formal release or NAS updater change is authorized by these checks.

Rollback: revert this task source and rebuild a prior installer; preserve database,
new traffic and both versioned local caches. Only roll back test file350 from its
own private `vpn-web-mobile270-*` snapshot after checking subsequent edits; never
restore the whole live database. Mobile now uses the same 80 endpoint as PC,
independent access codes. Xray80 combines them; use serial tests or sum both codes.

Editable paths: scripts/build-proxy-core.py, scripts/mihomo/*, scripts/prebuild.mjs,
src/hooks/use-connection-data.ts, src/pages/home.tsx, src/types/global.d.ts.
Go core/source downloads and build artifacts contain no VPS/node credentials.
