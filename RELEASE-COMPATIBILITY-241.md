# 241 / 261 · macOS 正式发布兼容

2026-10-29 / Codex。神仙云原生 Mac App 使用 `神仙云.app` / `de.sxnn.shenxianyun.desktop`，用户数据仍沿现有配置目录适配。正式发布须同时保留历史 ASCII 安装包链接，不能直接将测试包改名宣称新正式版本。

Release Build 的 Tauri Action 仅在 Mac 目标传入 `Clash.Verge_[version]_[arch][ext]`。因此新 DMG 仍是 `Clash.Verge_2.5.47_aarch64.dmg` / `Clash.Verge_2.5.47_x64.dmg`，Release 下载表与 NAS Dufs 脚本的精确版本匹配无需改业务规则。Windows/Linux 保持原有命名。Mac updater 使用带版本及架构的 `.app.tar.gz` 与对应 `.sig`，现有 updater 按 Darwin 架构后缀识别；只改外层资产名，不重打包、不修改 App 身份、不重签。

`macos-intel.yml` 独立重建使用 `scripts/macos-release-assets.py stage` 复制原生输出到同一 ASCII 名并核完整 SHA。复用模式用 `select` 从准确版本 Release 选择 Intel DMG 以及成对 updater/签名：优先本版带版本名，兼容既有 `Clash.Verge_x64.app.tar.gz` 及更旧无架构拼写。拒绝错误 tag、缺签名、ARM 误当 Intel、重复/冲突资产，不把其他版本 DMG 当作当前版本。操作前提、参数、读写范围、风险和回退见工具 docstring。

本机 `python3 scripts/test-macos-release-assets.py` 覆盖双架构/旧版本同列表、历史名字、错误 tag/缺签名/错架构、原始签名字节不变与冲突拒写；`scripts/test_nas_sync_release_to_dufs.py` 增加新版 updater 名、历史 DMG 别名和版本化分发回归。两套接入 Frontend Check，另有版本载体/服务 IPC 一致性门禁。正式矩阵构建和实际资产签名/下载/分发验收以本次 release261 审计回执为准，隔离假文件测试不是原生包验收。

发布阶段：用户本轮明确要求发新版本，目标 PC2.5.47 / Android2.11.51(211051)，由新准确源重新构建。保留旧正式和各测试里程碑；正式标签/Release、NAS Dufs 原子分发及版本 API 分开验证，不自动安装本机 App，不把发布当作真实 VPN/网站支付验收。Mac 仍是 ad-hoc 签名未公证，沿既有手动下载安装方式；没有新增 Apple 开发者证书或商店发布。
