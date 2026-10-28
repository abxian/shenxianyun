# 电脑端测试版交付 #243 / #254

2026-10-28 / Codex。用户要求先测试 Android/Windows/macOS 再同步原生 Apple；本轮在启动订阅刷新修复上追加电脑端两列节点、圆形玻璃首页、紧凑布局、减少提示，以及自动选择固定首位/健康故障切换。实现和测试方法见 STARTUP-REFRESH-243.md。

## 下载和版本

[独立测试 Pre-release](https://github.com/abxian/shenxianyun/releases/tag/desktop-glass-test-20261028)，Release ID426782530，非v标签准确指向4749cacfc800bc5e01c27c5de1a7a5857eb88b54。正式 latest 仍为v2.5.46（ID383155547），未合main、未改updater/Dufs/正式服务。旧239/240测试页新增指向本版的提示，旧资产保留回退；Android原测试包和原生Apple8fd29aa不变。

所有包实际显示版本 **2.5.46+deploytest.1028.a85df40**。release-version按最后产品代码提交生成版本，工具修正4749不改变产品版本；此前预期Mac显示4749cac只是未核验假设，已按脚本和包内Info纠正。

| 平台/文件 | 实际构建源 | 大小 | SHA256 |
| --- | --- | ---: | --- |
| macOS Apple Silicon / Shenxianyun-test-20261028-macOS-AppleSilicon-fix254.dmg | 4749cacf | 70090746 | 81c171761da199a54809056333a39f3762fba965db08c1340f4723f4e1ea9b1c |
| Windows x64 / Shenxianyun-test-20261028-Windows-x64-fix254.exe | a85df40b | 54232255 | 44306d454f7c12c64622e5ea26b13f3c7af35629e7ea78771c461137262a5aaf |
| Windows ARM64 / Shenxianyun-test-20261028-Windows-ARM64-fix254.exe | a85df40b | 48251047 | 7e6eeec1c9bfe68568fa30b5e636f5c9eaf76521a8b679ba6328f576fa85e379 |

Mac source4749与Windows sourcea85只差验证工具和报告，产品源码/依赖/CI一致，Git diff和GitHub compare双重证明。Mac Development40706299993成功；Windows Development40699676172整体因旧Mac测试工具失败，但两个Windows job均成功，原件12823670279/12822697756已核对。Mac修正工具后构建/门禁/上传原件12825384660成功；不把整体失败run说成成功。Frontend40699682035准确a85通过；Clippy40696824480的37dbe241三平台通过，后续产品差异只有home.tsx互斥和报告、原生/Cargo/依赖/CI未变，按评估335/336精确比较门禁复用。未反复重建已通过且功能未变的Windows包。

## 验证与边界

17项前端专项：完整响应超时、取消、无变化订阅、规则保护、自动策略固定第一、提示过滤；5项Rust策略；Mihomo1.19.30本机和Mac CI验证准确生产配置，以及localhost假SOCKS A故障后切换B。provider-only缺自动组配置经当前核心-t验证。原有刷新5/隔离5/流量17/心跳9通过，本地TS/ESLint/Biome/web/Clippy与提交/推送hook通过。

Mac DMG原件与CI digest一致，hdiutil完整性/只读挂载、神仙云.app、Bundle ID de.sxnn.shenxianyun.desktop、arm64、codesign深度严格通过；签名ad-hoc未公证，最低系统11.0，没有Intel Mac包。Windows安装器PE有效，目标架构依据CI目标与工件记录（NSIS引导程序本身为x86，不伪称PE架构即应用架构），未执行安装器。

七个初始公开资产（三包、TESTING.md、SHA256SUMS.txt、verification.json、fix254-evidence.zip）全部匿名HTTP200整包回下载size/SHA一致，详见[公开回下载回执](https://github.com/abxian/shenxianyun/releases/download/desktop-glass-test-20261028/public-download-receipt.json)。源白名单/工具/前提/范围/风险/验证/回退/哈希随[证据归档](https://github.com/abxian/shenxianyun/releases/download/desktop-glass-test-20261028/fix254-evidence.zip)长期下载；ZIP SHA256 e6c87776bd489f21fba78c3ec8bc6726c589684f61d3e2ceaeff25963fffd2c6，已下载验证，无用户配置/原始日志/凭据。归档内旧节点截图明确标记模拟数据与已被后续UI改动失效，不作最终玻璃页视觉证据。

第一版节点组件640×480/860×620/1280×800、长名、键鼠选择、测速/忙碌禁用检查通过；后续最终玻璃首页因Work设置禁用本机浏览器而未视觉复验，没有绕过。真实首次启动、实际订阅、VPN开启更新、Windows安装和最终视觉待用户测试。单个/部分节点故障时自动组可切换可用出口；全节点故障、本机断网、订阅过期不能保证联网，不做DIRECT绕过。

## 本机安装与回退

本机三包与专属FIX254说明/校验/回执已放 `/Users/cgnay/Desktop/神仙云测试版-20261028`。先退出正在运行的旧客户端，再安装/替换神仙云；不要打开旧吾爱云/Clash Verge图标，不同时运行共享核心目录的客户端。Agent未替换/启动新包、未停止用户App、未改变系统代理/VPN、未清理用户数据。只读挂载已卸载。

旧Mac fix240包SHA7cc4bddc81c09704a0e0341996ce9a7cdf9eebffde5b5a807e06281223f81931保留；退出新版即可恢复旧包，不需数据库回滚。旧239/240里程碑和本轮源码备份保留，本机143GiB可用空间，无裁剪，用户测试后复审保留。正式发布前仍须完成#241 Mac包名/Intel/NAS精确匹配兼容门禁，不能直接用本测试分支正式发布。

完整本机审计：`/Users/cgnay/Desktop/claude/rc/ops/startup-refresh243-20261028`。评估319/320/332/333/334/335/336/337；持久事实同步至PC项目当前/架构/运维/功能/记忆/构建发布/编辑路径/验收/变更/AI账本和协作板，内部复核由Claude接收；测试分发完成不等于用户最终验收。
