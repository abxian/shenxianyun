# 启动订阅刷新修复 #243

日期：2026-10-28；来源：用户反馈 macOS 首次打开短暂进入旧选项页、持续显示刷新订阅，强退重开后恢复。当前已安装版本为 fix240；不停止、替换或操作用户正在运行的客户端。原生 Apple/iOS 8fd29aa 继续冻结，Android 本轮无改动。

## 已确认的代码问题与修复

- `src/services/http-request-deadline.ts`：API/订阅完整响应（含响应体）单路径 12 秒、所有直连/代理回退合计 20 秒；底层忽略 AbortSignal 时调用者仍可退出。保留 TLS 校验、代理顺序和响应元数据。仅用于只读请求，不将配置写入/回滚放进 Promise.race。
- `src/pages/home.tsx`：前台启动或导入可取消后台只读刷新；进入配置提交/回滚后保持互斥至完成。启动有效性检查最多 5 秒，网络异常仍沿用原有缓存策略，服务器明确拒绝不绕过。有效性检查不提前消费远程订阅版本。
- `src/utils/subscription-content.ts`：先合入原配置的 rules/rule-providers/sub-rules，再一次性验证保存；YAML 语义相同不写文件、不重载核心，避免每次打开的重复重载。已有本地修改脱离管理保护和失败回滚保留。
- 国内 API 直连规则已存在时不重复保存；删除 saveProfileFile 之后多余的 enhanceProfiles。配置事务完成后不再等待七项只读界面查询才结束刷新状态；useProfiles 的刷新函数引用稳定。
- `src-tauri/src/core/manager/config.rs`：核心 reload IPC 最多 15 秒，超时走已有重启/失败回滚路径，事务所有权保留至原生流程结束。
- 连接选项要求控制器可用，TUN 模式还需运行时确认开启；连续两次探测通过才显示，避免只凭保存的 TUN 开关短暂显示连接后的页面。

## 本地验证与边界

新增 13 项隔离测试覆盖真实本地 HTTP 发出响应头后不再结束响应体、底层忽略取消、前台取消、整条回退预算、计时器清理、响应元数据、无响应体、语义未变跳过写入、保护规则、无效订阅拒绝等。`pnpm test:startup-refresh` 已通过；刷新策略 5、受管显示 3、商业隔离 5 通过。TypeScript、ESLint 零警告、Biome 全库、web build、macOS cargo clippy-all 通过。新增测试加入 Frontend Check。

这些证据确认可导致长期等待和重复重载的代码缺陷已修复，不宣称已经在用户真实订阅/VPN环境重现并验收首次启动卡死。核心原有重启/恢复动作不人为截断，不承诺所有原生操作合计固定秒数。真实首次打开、断开后刷新、VPN开启时更新、切换提取码待新包实机反馈。

## 构建发布与恢复

仅在 `codex/startup-refresh-20261028` 运行 Frontend、三平台 Clippy 和 Mac arm64/Windows x64/ARM64 开发包；Linux 不发测试包。以构建准确源提交创建非 v 标签的独立 Pre-release，验证完整下载和哈希后交付；不合 main、不改 latest/updater/Dufs，不发正式版本。Mac 包名仍受 #241 正式发布兼容门禁限制。

恢复点为源 7921a81b / fix240 DMG，SHA256 `7cc4bddc81c09704a0e0341996ce9a7cdf9eebffde5b5a807e06281223f81931`。退出新测试客户端后可恢复旧测试包，不删除历史应用、共享配置、凭据或用户数据。不自动覆盖已安装客户端。最终 CI、源提交、版本、下载 URL、完整包核验与公开回下载回执写入后续交付记录及 `rc/ops/startup-refresh243-20261028/`。

## 可复用验证资产

`scripts/test-http-request-deadline.mjs`、`scripts/test-subscription-content.mjs` 随源码 Git 保存，前提 Node 24.16+、pnpm 依赖安装完成；执行 `pnpm test:startup-refresh`。只读源码与 localhost 临时 HTTP 服务，无真实订阅、用户配置或凭据访问，不写线上系统；进程结束即清理服务。验证失败时停止交付并回到本报告恢复点。最终公开证据归档记录文件哈希、源版本、前提/范围/风险/回退，不包含用户日志或配置。
