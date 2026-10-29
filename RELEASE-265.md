# PC2.5.49切码修复正式发布 · 265

来源Codex / 2026-10-30 / 任务265，用户明确发布新版本。最终核验2026-10-30T05:54:58+08:00。产品`c2a856f13f94b031eb452f4704b06cbf996e53bd`，唯一标签`v2.5.49`，Release428395837，正式构建40955026018；本报告是后置文档提交，不移动产品标签。Android2.11.51/211051与Apple开发版本未发布。

## 用户行为

运行中点击“断开并切换提取码”，先关闭本App系统代理和TUN、停止当前核心，成功后才开新码输入。首页、连接后配置/高级与到期提示三入口统一，原生停止失败提示可重试、不验证新码。输入期间暂停旧订阅后台读与本次断开刷新；弹窗后若外部重连，导入边界再次阻止live凭据替换。取消保留原提取码/订阅，保持断开，不自动重连，需要时手动启动。用户明确选择本方案，避免旧代理影响新码检测；没有声称用户设备根因已实证。

核心逻辑`src/pages/home.tsx::openCodeImport`、`codeEntryActiveRef`和`importByCode`，测试`scripts/test-code-switch.mjs`执行真实callback；package.json命令/Frontend CI接线。263产品12b37af为实现基线，本次只增加四版本载体与Changelog2.5.49，不重新改其业务逻辑；CODE-SWITCH-263.md保留详细开发/功能差异记录。新版本正式构建/安装后生效，不是改笔记即生效。

## 准确源门禁

7切码、27恢复、17启动、类型本地通过；Frontend40953899747与三平台Clippy40953958361均准确c2a856f成功。正式40955026018全13任务success，包含Windows x64/ARM64/固定WebView2、Mac Apple/Intel、Linux x64/ARM64/ARMv7和两更新渠道任务。不是复用临时deploytest包发布。

匿名全文下载23正式原件比GitHub大小/SHA/digest，8个Minisign签名通过（复用261锁定minisign-verify0.2.5与公开key），双Mac只读DMG/原生神仙云.app、de.sxnn.shenxianyun.desktop/2.5.49/架构/deep签名与归档Info通过，WindowsPE通过。四公开updater JSON逐版本/架构/原签名和普通/固定运行库分流正确，最新PC2.5.49/Android2.11.51。

[正式下载](https://github.com/abxian/shenxianyun/releases/tag/v2.5.49) / [准确源正式构建](https://github.com/abxian/shenxianyun/actions/runs/40955026018)。Mac仍ad-hoc未公证、手动安装，Windows继续NAS优先GH备用并验签。

## NAS/后台与回退

NAS标准脚本全字节/SHA631baf7e2314631eb72fc752288a6e826e934bcfd2fcfc7c9bd33c58a6f23509与仓库一致，dry-run后detached同步exit0；六PC别名/版本化updater原子替换，update.json最后。验证链为GH匿名完整原件/密码学签名+NAS每发布文件全SHA+默认DNS/原Host/SNI/TLS十四URL首尾Range/总长度以及完整签名/JSON，沿358/361/365避免重复搬大包占生产隧道，不冒称Dufs大包再次全文下载；路由/映射改变应重验，没有本轮DNS/反代/代理系统设置变更。

旧2.5.48备份`/vol2/docker-projects-backups/shenxianyun-release-sync-v2.5.49-20261030-055357-330962`，旧update SHA`7b4943bd903150a4bc9a075205375c02423b098491f2a8da996e1358e71e9193`，旧六别名与保留四旧版本化updater全文SHA对原Release一致，旧四GH更新JSON及两Release/渠道元数据共七份全字节归档读回。

Web仅desktop七个版本/下载/说明键2.5.48→2.5.49，在线SQLite backup/integrity/SHA+BEGIN IMMEDIATE CAS旧值/新值事务。备份`/vol2/docker-projects-backups/vpn-web-release265-20261030-055420-505673`，DB SHA`c014f2c876edadeeaeb2227f5e9be75d88da838d5b37584fb4a7eff2a686dbdf`；公开desktop-version、DB七键/integrity/subfile healthy与原部署app.py SHA均通过，无业务源码/schema/期限流量/订阅/订单/设备改动，无服务restart。七键回退拒覆管理员后续编辑，不整库覆盖新业务。Android完整app-version/原Release427791384/两NAS APK全SHA不变。

旧正式2.5.48原件/tag、版本化updater和255–263等保护里程碑保留，不机械裁剪。备份卷预检约192GB可用，未执行清理；源码可正常revert本轮版本与263切码逻辑重建，设备可手动回退旧包保数据。

## 交付与真实设备边界

桌面`/Users/cgnay/Desktop/神仙云PC-2.5.49-20261030`六包+SHA/说明均重新全SHA核验，没有安装、替换或启动用户App，没有主动改变本机VPN/系统代理。真实设备系统代理/TUN切码、真实提取码网络、支付/VPN体验仍需用户设备测试，不能把callback mock、CI或包签名当真机验收。iOS按钮开发与264云端容量后补任务不在本PC正式发布范围，不冒发未签名IPA。

工具/精确源/CI/原件/回退/线上回执在`/Users/cgnay/Desktop/claude/rc/ops/release265-20261030`，TOOLS.md/docstring列用途、参数、依赖、读写范围、风险与回退。实际复用工具已vol2固定本轮目录完整下载SHA；最终笔记维护工具/精确summary/facts与报告生成工具作Trilium原生代码笔记全文GET核验，更新PC/Web实际AI账本及当前态/架构/运维/功能/构建/记忆。没有Runbook/凭据/DB/私钥/用户数据入Git，Web保持私有。

GitHub访问若遇198.18 fake-IP残留，仅本次Python/socket/单git -c用Google正常HTTPS DoH public A保原URL/Host/SNI/TLS，token仅内存API主机、redirect剥离授权，不改系统DNS/代理/VPN。第一次误叫clippy.yml被404拒，已改真实lint-clippy.yml运行到准确源success；首次工具适配继承错误日期模板已在执行/归档前修正，全部本轮目录为release265-20261030。

## 本轮备份保护回执

两份本轮回退点已校验后创建 `.keep`，防自动裁剪；未删除任何备份。备份卷实测可用 192269582336 字节。

- `/vol2/docker-projects-backups/shenxianyun-release-sync-v2.5.49-20261030-055357-330962`：433244705 字节，`.keep` 已读回。
- `/vol2/docker-projects-backups/vpn-web-release265-20261030-055420-505673`：22525845 字节，`.keep` 已读回。

只在后继版本已验收且重新评估空间后复审保护；不机械按三代删除。工具 `ops/release265-20261030/protect-backups.py` 已全文归档下载核SHA，完整回执在同目录 `backup-retention-verification.json`。
