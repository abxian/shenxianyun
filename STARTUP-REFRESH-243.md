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

## 用户追加电脑端 UI 与自动选择 #254

2026-10-28：Windows/macOS 电脑端连接后节点改为每行两张可点卡片，独立 `src/components/home/node-selection-panel.tsx`，长名称换行、两列 `minmax(0,1fr)`、选中状态、延迟/超时、受限滚动和键盘操作。操作按钮移到下方整行，宽度不足时换行而不将按钮文字拆行。未连接保留提取码/切换码和启动，`glass-power-button.tsx` 将首页和已连接的电源入口统一为圆形玻璃按钮。首页随窗口伸展，收紧外边距；常规成功/刷新状态隐藏，异常和未知原生错误保留，用量/设备信息收进高级设置。

`src/utils/home-node-order.ts` 只对真正 URLTest/Fallback/LoadBalance 自动策略置顶，不将名字相似的普通节点当成自动组；测速仅重排手动节点。`use-profiles.ts` 不再将自动组上次实际出站成员恢复成手工固定值，父选择组仍恢复用户选择。排序/提示新增4项，连同243请求/内容测试共17项。

`src-tauri/src/enhance/automatic.rs` 在每次运行配置生成时处理自动组，源订阅和用户规则不改写：60秒主动健康检查，5秒检查超时，失败阈值1，url-test容差50ms；使用provider的自动组同时打开相关provider检查。没有自动组时，只从主要节点选择组明确引用的叶子节点/provider生成；不把其他组、DIRECT、本地回环/过期占位节点当作可用出口；避免同名覆盖和组循环，不注入不相关选择组，不改变已保存手动节点选择。已有fallback/load-balance保留其原类型。

依据 [Mihomo url-test](https://wiki.metacubex.one/config/proxy-groups/url-test/) 与 [通用字段](https://wiki.metacubex.one/config/proxy-groups/)（2026-10-28核对）；不是用随机均衡代替健康检查。全部节点失效/订阅过期/本机断网时不能承诺联网，不做DIRECT绕过或虚假成功。

验证：640×480、860×620、1280×800模拟数据浏览器检查两列、无横向溢出、长名称、鼠标/键盘选择、测速/忙碌禁用通过；证据使用生产节点组件但周边是隔离模拟布局，不等同完整桌面实机。后续圆形玻璃按钮/全高布局接入后，Computer Use明确返回“Local browser use is disabled in Work settings”，没有绕过该限制，新增视觉验收仍待测试包。旧截图仅代表第一版两列卡片，不能冒充最终玻璃页。

`scripts/test-automatic-policy.py --deps target/debug/deps --core src-tauri/sidecar/verge-mihomo-aarch64-apple-darwin`：需要rustc、已编译serde_yaml_ng rlib、Python3和当前核心；5个纯Rust策略测试通过，并用当前Mihomo v1.19.30验证准确生产配置。仅localhost假SOCKS节点、临时目录、随机控制端口、TUN关闭，无系统代理变更/真实订阅/公网探测；A故障/B恢复时实际内核自动组从A切到B通过。只在模拟fixture中把健康检查URL/间隔改为本地测试参数，生产仍用上述60秒/5秒。finally停止自己的临时核心/服务器并清理；异常时不影响已安装客户端。Mac开发包在上传前执行同一门禁。

旧Development40692001850因用户追加UI已取消，不交付该构件；4d3bb78d的Frontend40692053172和Clippy40692019569通过，但最终联合版本必须对准确新提交重新构建/检查。243与254一起交独立测试包，Android和原生Apple保持冻结约束；实际首次启动、在线订阅更新、视觉和真实网络切换等待用户测试。UI回退可只撤后续UI提交回4d3bb78d；完整包恢复fix240。

最后收口：更新入口也移入高级设置，首页不再常驻新版本横幅；当前版本号改为读取构建时package.json，避免仍上报/显示硬编码2.5.38。客户端类型标识保持兼容，不更改服务端接口。

取消事务最后收口：后台到期元数据、检测本地编辑/已脱离受管时的凭据写入也持有前台互斥；异步本地hash后再次检查取消/凭据身份，避免旧提取码状态与前台切换并发保存。该修正须用最终新提交重新构建，不交37dbe241旧包。

## Mac验证工具兼容修复

a85df40b的Development40699676172：Windows x64/ARM64打包上传成功，Mac Tauri/DMG打包成功但验证脚本直接链接release rlib编译测试时失败，日志没有保留原始rustc stderr，不能确认具体编译器原因，也不能当成自动切换失败或成功。评估336只调整验证工具，产品代码不变：使用独立临时Cargo harness编译真实automatic.rs，复制本仓库Cargo.lock，锁定serde_yaml_ng0.10.0，离线使用已缓存依赖，并逐一核对实际依赖版本/校验与源锁文件一致；工具失败输出本机无凭据诊断。5策略、准确生产配置、隔离A->B本机重测通过。原--deps仅兼容旧CI参数，不再链接release rlib。Mac新提交重建并通过门禁后才上传；已有Windows构件可依据严格产品代码无变化比较保留，平台各自构建源/版本必须如实记录，禁止冒充全部CI同源同版本。原生Clippy复用门禁仍按335；后续仅工具或文档变化时不重复产品构建。
