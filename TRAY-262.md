# 262 PC托盘两项菜单与NAS更新入口

PC **2.5.48** 已正式发布并同步NAS，产品源 `97ede8d77492485f781eb5d26b527ae63616ffed`，唯一标签 `v2.5.48`，Release `428016900`。本报告是发布后的文档提交，标签继续指向产品源。Android仍 **2.11.51 / 211051**。记录来源：Codex / 任务262 / 2026-10-29T23:59:10+08:00；评估359、360、361。

## 最终行为

- Windows/macOS/Linux托盘右键一级菜单仅“更多、退出”，没有一级分隔符或代理模式、TUN、节点、配置项。打开窗口、目录、轻量模式及原维护功能放在“更多”内；退出仍走原清理逻辑，macOS保留Cmd+Q，左键遵循原设置。
- 菜单构建不再查询核心节点、订阅配置、受管凭据或服务/管理员权限，仅保留本地菜单/快捷键设置；tooltip和图标仍显示原运行状态。
- macOS首页更新与设置页统一：现有 `getAppArch` + `macosDufsDownloadUrl`，Apple芯片下载NAS `神仙云.dmg`，Intel下载 `神仙云-Intel.dmg`；架构未知或原生调用失败打开对应版本的GitHub备用发布页。继续手动安装，不就地安装或自动重启。
- Windows保持NAS `update.json` 优先、失败回GitHub并验签。已有简洁首页、到期时间、setting本机配置入口和订阅恢复功能继承2.5.47。

## 可编辑文件与验证

主要修改 `src-tauri/src/core/tray/mod.rs`、`menu_def.rs` 和 `src/pages/home.tsx`；删除仅旧托盘使用且未注册的 `cmd/profile.rs::patch_profiles_config_by_profile_index` 及 `feat/profile.rs` 两个旧切换桥，实际UI `patch_profiles_config` 保留。版本四载体 `package.json`、`Cargo.lock`、`src-tauri/Cargo.toml`、`tauri.conf.json` 同为2.5.48；更新说明在 `Changelog.md`。

真实Home回调/地址函数的AST测试覆盖两芯片、未知/调用失败及不安装/重启；updater5、商业隔离5、启动17、订阅恢复27、SQLite定点事务3项均通过。正常本地pre-push、类型、lint、格式通过。准确产品源Frontend40884077593、三平台Clippy40884084092、正式40897831367全13任务成功。完整匿名下载23原件核GitHub大小/SHA，8个Minisign验签通过，双Mac只读DMG/原生身份 `de.sxnn.shenxianyun.desktop`/版本/架构/deep签名和归档Info通过，WindowsPE通过；四公开updater JSON对应本版平台、原签名和固定运行库分流正确。

## 分发、后台与回退

[正式发布](https://github.com/abxian/shenxianyun/releases/tag/v2.5.48)，[正式构建](https://github.com/abxian/shenxianyun/actions/runs/40897831367)。NAS `/vol1/dufs/data/sxy` 六PC别名和版本化updater由标准工具同步，`update.json` 最后发布，运行 `runs/v2.5.48-20261029-235125` exit0；源码工具SHA `631baf7e2314631eb72fc752288a6e826e934bcfd2fcfc7c9bd33c58a6f23509`。

公开入口 `https://sxy.sxnn.de:5443/sxy/`，校验=GitHub匿名全文原件+密码学签名、NAS每个文件完整SHA，再默认DNS/原Host/SNI/TLS逐14 URL总长度及首尾Range、完整签名和JSON。沿评估358/361避免重复搬大包挤占生产隧道；没有声称再次全文下载PC Dufs大包，也未改DNS/代理/反代。

后台 `/api/desktop-version` 与数据库仅7个desktop版本/地址/说明键更新到2.5.48，SQLite integrity与subfile healthy、部署app.py SHA保持；无业务源码/schema/订单/设备/期限额度/订阅数据变化，无服务重启。Android完整公开API、原Release427791384及两NAS APK全SHA不变。

旧2.5.47六安装包备份 `/vol2/docker-projects-backups/shenxianyun-release-sync-v2.5.48-20261029-235640-334525`，旧 `update.json` SHA `cd17e8b3d9131a7f20041db8d7ef47e3ea81417163c17c64b7fcdb22cc213ad4`，原六别名和保留四旧版本updater均核SHA。七份旧GH渠道/Release元数据已全文归档读回。Web备份 `/vol2/docker-projects-backups/vpn-web-release262-20261029-235736-839618`，数据库SHA `4e0f0f69fe90948441e18296045a32e1ccbd0ad581f654c12de5833304a7be75`；回退只对这7键CAS，拒覆盖后续管理员编辑，不整库恢复覆盖新业务。旧正式原件、261等保护里程碑保留，无裁剪；NAS备份卷预检193GB可用，本地137GB可用。

## 使用与限制

桌面交付 `/Users/cgnay/Desktop/神仙云PC-2.5.48-20261029` 六正式包及SHA/说明均核验；仅交付，没有安装、替换或启动用户App，也没有修改VPN。安装2.5.48后菜单生效；Mac仍ad-hoc签名、未公证。真实设备菜单交互、VPN与支付体验单列未验，不能把编译/原件检查当成设备验收。

审计 `/Users/cgnay/Desktop/claude/rc/ops/tray262-20261029/`；可复用工具与旧渠道均在本轮vol2 release-tools归档全文读回。GH读取遇临时EOF/SSL，`verify-channels-retry.py`仅逐请求有限重试，原匿名全文/版本/平台/签名断言保留，不跳检查。早期完整Clippy发现删菜单后的死代码，删除未使用桥后最终三平台通过；Home采用现有cmds而无新增OS插件依赖。Trilium当前态/架构/运维/功能/构建/记忆/实际AI账本与Web对应页另作本轮最终回读，Web仓库保持私有。
