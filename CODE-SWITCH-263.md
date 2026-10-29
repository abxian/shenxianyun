# PC运行中切码先断开 · 263

2026-10-30 / Codex，用户报告开启VPN时切换提取码停在检测。采用用户明确给出的“点击切码先关闭当前系统代理”方案，同时解除本App的TUN，避免只关系统代理但流量仍被隧道接管。属于本轮开发，正式NAS/后台/2.5.48和Android2.11.51没有更新。

产品 `12b37af392e786d9679e6d7bee9d781f19c0943b`，分支 `codex/code-switch-20261030`，恢复点cdf345cec83e930e7f401adfbf68d52a31704bb5。

## 行为与修改入口

`src/pages/home.tsx::openCodeImport`统一首页已绑定、连接后/高级、到期提示三处切码按钮。先占有UI互斥、暂停后台监控与断开刷新、取消旧账号只读；若正在运行或配置仍开系统代理，await原生patchVergeConfig关闭system proxy/TUN，成功后更新本地缓存并await stopCore，清旧核心fallback URL，再打开输入。连接后的按钮明确写“断开并切换提取码”。当前停止状态只开弹窗，不额外操作网络。

不会先对新码发验证、不会清除原账号或订阅、不会以节点延迟/出口预检作为导入门槛。取消弹窗保持断开、不自动重连，原码/配置仍可手动启动。停止失败给出可重试错误且不开弹窗；不对不可取消的原生写操作套Promise超时造成UI提前解锁，旁路读刷新不阻止入口。`useSystemProxyState.toggleSystemProxy`可能在另一次切换忙时提前返回，故本入口等待原生patch本身完成，不依赖乐观状态作为已停止证明。

`codeEntryActiveRef`阻止输入期间原订阅监控及本次人为断开触发自动刷新；`previousRunningRef`与旧代理fallback清除避免旧状态抢占。`importByCode`入口再检查running/systemProxyConfigOn，防止弹窗打开后外部重新连接时替换live凭据。配置保存/refreshApply持有期间不抢写，只提示稍后再试。

## 验证与边界

`scripts/test-code-switch.mjs`通过TypeScript AST执行真实callback：停止顺序、未完成写不开弹窗、代理/核心停止失败、已停止不动网络、现有配置操作互斥、外部重新启动导入拒绝、三处入口收口，共7项；CI新增`test:code-switch`。27恢复/17启动、类型/lint/format/web build通过。准确源Frontend40916060520 success，四平台临时Development40916071381（Windows x64/ARM64、macOS arm64、Linux amd64）均success，不当成正式发布。本轮Rust/Cargo.lock/pnpm-lock与正式97ede准确原生源完全无差异，按评估364复用三平台Clippy40884084092而不伪称本轮新跑Clippy；TS精准门禁及完整Dev未省略。

未用真实提取码复现服务端网络，不声称根因已在用户设备实证；本轮验证已实现用户选定的规避行为。本机当前App/VPN未动，不把测试mock当成真实系统代理/TUN已经切过。Windows/macOS/Linux共用此逻辑；Dev工作流仅临时工件，不改版本/正式tag/NAS/API。

## Apple和仓库对齐

Apple产品 `3948487782dd22429a7c0e34f159313fd39f8770`，已推 `codex/code-entry-20261030`；Client upstream/main=e3e647283b1593a61dba622f13cd499deeda9b8b是业务HEAD祖先，对应官方1.0.13(151)。Client本次与所有先前业务更改在开发分支；自有origin/main仍3b8ea95，未合主干、未签名/商店发布。Clash/Clash-Adapter自有origin/main与本次fetch的upstream/main均0/0（5365826544dd6f2ac7ce694d540fa533301591e2 / d47c04a3556a67f95929aaa15ae624c7df631e74）；Client锁4b7d5f53/09fbc0d7正式配对，不等同SDK任取更晚HEAD。

Apple首页改钥匙玻璃按钮复用真实输入sheet、无码启动打开sheet；停止状态显示到期/未知待同步，普通首页隐藏流量。运行中不呈现切码入口，handleImported原有停止保护保留。iOS有生命周期限制，尚无PC `setting`命令或桌面NAS更新；详见Apple CODE-ENTRY-263.md，不能写全平台功能完全一致。

## 生效、回退与证据

需从本分支构建并安装新开发包才生效，当前正式2.5.48原件不含此改动；本轮不自动安装/修改用户系统网络。按commit revert本轮源码/测试/CI步后重建即可回退，不改本地账号schema或生产数据。旧源码、正式包与已验证NAS备份保留，不裁剪。

审计 `/Users/cgnay/Desktop/claude/rc/ops/code-switch263-20261030`，实际CI/构建回执与最终Trilium记录后续补齐；可编辑脚本与检索型证据同仓归档，临时原始构建日志只在.build/ops，禁止提交用户数据/签名材料。首次命令误用rc相对目录/pnpm外层版本入口未写产品，改在正确仓执行；gh对fork必须显式 `-R abxian/Clash-Client`，不能默认误选ProjectClash上游。评估362、PC/Apple变更日志code263-plan-20261030先行。
