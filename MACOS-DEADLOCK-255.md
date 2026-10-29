# Mac startup deadlock and round power button — 2026-10-29 / #255

User reproduced a frozen macOS test build `2.5.46+deploytest.1028.a85df40`. A 3-second process sample captured the main AppKit thread blocked in Tauri `AppManager::get_webview` on a mutex, while a runtime thread was inside `Handle::send_event → emit_js_filter → eval_script → recv`, waiting for the main thread. No Mihomo core process was present. This is a native lock cycle, distinct from the subscription read deadlines fixed in #243. The current process/configuration was left intact during diagnosis.

## Change and scope

`src-tauri/src/core/notification.rs` serializes borrowed event fields into owned JSON before queueing the entire window lookup and emit through `AppHandle::run_on_main_thread`. With inspected Tauri/runtime-wry 2.11.2, UI-thread evaluation completes on that thread instead of holding the webview/listener locks on a worker waiting for UI IPC. Existing event names, payloads and missing-main-window behavior remain compatible. Queue failures log the event name/error only and never fall back to synchronous emission. Profile switching, managed deep links and updater progress now use the same dispatch boundary; there are no other direct app `.emit` call sites outside this module. Cross-producer global ordering is not promised; a producer's queued event order is preserved.

`src/components/home/glass-power-button.tsx` sets both outer dimensions from one CSS variable and both inner dimensions from the same inset calculation; the inner button has zero default padding. This removes WebKit's cyclic percentage-height/content sizing and prevents flex shrink. Glass styling and busy/connected accessibility remain.

## Verification / reproducibility

- Python 3.11+, Cargo/rustc, this repo's Cargo.lock and dependency cache: `python3 scripts/test-notification-dispatch.py`. It compiles the actual notification module with an isolated queued-runtime double, checks lock contention, borrowed payload lifetime, event ordering, a window disappearing after enqueue and a closed event loop. Dependencies must match the existing lock. No app/config/network/VPN access. Temporary Cargo workspace is deleted. This is a regression contract test, not native WebKit verification. Mac Development Test runs it before artifact upload.
- `scripts/fixtures/notification-dispatch.rs` is the runtime fixture. Do not run with user credentials or app state.
- UI fixture: copy `scripts/fixtures/power-button-check.html` to `src/power-button-check.html`, run `pnpm web:dev --host 127.0.0.1 --port 1421 --strictPort`, visit `/power-button-check.html`; remove the copied file and stop the server afterward. It uses the actual component with simulated idle/busy state and no VPN. Chromium IAB measured inner and outer equal dimensions at 1280×720, 860×620 and 640×480; the later native WKWebView check is recorded below and in the delivery report. No stale old screenshot is claimed as final UI verification.
- TypeScript/ESLint/Biome, startup refresh 17 cases, updater source contract 3 cases, Rust formatting and local `cargo clippy-all` passed. The updater test's old `install(bytes)` pattern was corrected to accept the existing `install(&bytes)` implementation and retain the blocking-thread guard; the production installation logic is unchanged.
- Frontend40760471009 / Clippy40760477035 / Mac Development40760483042 all passed at exact f925380a. New Mac package and native delivery results are in MACOS-FIX255-DELIVERY.md; fix254 remains the historical failing build.

## Activation / rollback / boundaries

Rebuild and install the new macOS test package, quit the old application before opening it. Replacing source alone does not update an installed app. Check repeated launch, code switch, connection and subscription refresh, and inspect a fresh process sample if it stalls. Current user's real VPN settings are not test fixtures.

Previous source `761dd0f7` and desktop-glass-test-20261028 are retained for diagnosis/rollback (known to contain this reported deadlock). Formal stable releases remain the operational fallback. No data migration or manual configuration deletion is required. Main, Dufs, updater metadata and native Apple/iOS/iPad/tv source remain unchanged. Formal Mac naming compatibility task #241 is still required before a formal release.

Evidence: local `../ops/macos-deadlock255-20261029/` contains a sanitized native stack excerpt, field facts, regression logs and isolated UI size/screenshot evidence. Raw application logs/configuration, extraction codes, subscription credentials and signing material must not be committed or uploaded. Screenshot focus is component roundness in simulated state; it is invalidated by component/theme/layout changes and cannot prove native startup/VPN success.

## Verified delivery

[Mac fix255 test release](https://github.com/abxian/shenxianyun/releases/tag/macos-deadlock-test-20261029) (427364773), product/source f925380a, displayed version `2.5.46+deploytest.1029.f925380`. Installed locally after package verification and private app/config recovery snapshots; the paired encryption key was preserved. Three distinct native processes started normally with enabled Start/Switch Code controls and round power button; normal Cmd-Q quits in between, third left running. A fresh native sample did not show the old lock cycle. System proxy and TUN remained off; the agent did not click VPN. VPN connection and subscription update with VPN are still user acceptance items.

DMG70092254B/SHA256 `0f04c02f6d3fec18a5ab5b95480912030df6851a138ec1cdbeda8d19f92853ff`, artifact12848798349. Six initial public assets passed anonymous full HTTP200 downloads with exact size/SHA; the separate public receipt was also uploaded/read back. Detailed source/CI/operational tool prerequisites, picture focus/invalidation and rollback are in the delivery report and downloadable evidence archive.
