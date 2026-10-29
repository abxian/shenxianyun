# 续费、额度恢复与文件迁移同步（256）

Windows/macOS共用桌面源码，保留fix255的原生线程派发与正圆按钮。启动页在到期或流量限制时提供续费入口；网站付款、后台加时/补满额度后，使用原设备凭据和随机订阅地址更新原配置。原生Apple工程继续冻结；安卓按用户另行确认纳入257。

客户端打开时即检查，前台约24–36秒、后台约48–72秒轻量轮询，回前台/网络恢复立即检查；不依赖VPN状态。每次只有一个检查，focus/online合并，服务端Retry-After不被唤醒绕过，网络错误指数退避至5分钟。只在版本、opaque revision、期限、限制恢复或进程启动需要时下载。低版本/同秒跨文件迁移由revision识别。服务端无新字段时保留旧时间版本兼容。

本地记录账户限制并绑定提取码，网络或5xx/429不能冒充到期、不能清限制。启动即使本地期限已过也复核服务端；未确认恢复时禁止使用过期/受限缓存。下载/校验/落地成功后才消费版本，失败保留旧配置并继续检查；手动编辑的配置继续保护，不强行接管。原占位配置恢复原管理UID并清理，只在缺旧凭据的升级路径自动签票，常规恢复不轮换设备授权；撤销授权不会用自动签票绕过。手动断开的VPN不自动启动。

修改入口：src/pages/home.tsx、src/services/subscription-monitor.ts、src/utils/access-recovery.ts；package.json的test:subscription-refresh接入scripts/test-access-recovery.mjs。新测试通过TypeScript AST加载实际Home业务回调，以隔离IO端口验证，不复制实现；纯调度器用假时钟验证并发、取消、限流。旧startup截止/保护规则/自动首位测试继续运行。

配套Web增加update-state结构化限制原因和HMAC revision，保留200/404权限语义/no-store；既有managed URL动态跟随当前文件。Web源码7c4b45b，完整298项及迁移13项隔离通过，实际部署/安装包/真实VPN验收分开记录，未验证不写已完成。

源码基线87a640e3和已发布fix255保留恢复点。私有用户配置不入Git/公开工件；部署前备份并仅改sxnn后台。正式客户端main/updater/Dufs/52nm/iOS不在本次测试交付范围。最终CI/包来源/哈希与上线回执见下文。


## 2026-10-29测试交付与验证

准确产品源：PC `731cce62453e5d68b7d4bd3a57ad8070483c137e`；Android `991c617895a2be36c8d2a0936e8973c708cd55fb`；Web `f4eba974e38f77ca003d6cab68872cc2b7e8ceea`（业务7c4b45b）。此后文档提交不改变已构建二进制。

PC Frontend40803513399、三平台Clippy40803516602、Mac ARM64/Windows x64/ARM64 Development40803519924全部成功；Android40804837373 assembleMetaRelease与lintVital成功。Android首次570dee5编译错误为Throwable.message可空，357修复后991增加检查互斥与429/503 Retry-After冷却；仅交最终991包。

已部署sxnn subfile5010，宿主/容器app.py SHA256 `218dfbeb4b27e4c89b4baee0853483b8ae7aab661893efdc2e04fbd03b6a08df`一致；Docker healthy/restart0，公网严格TLS状态404/invalid_code/no-store及endpoints200，数据库只读integrityok。部署前禁网无生产挂载298项全过；私有备份/vol2/docker-projects-backups/vpn-web-recovery256-20261029-100219的源码/compose/SQLite在线备份已完整性/SHA校验，23M；vol1约18GiB/vol2约182GiB空闲，无裁剪恢复点。52nm/订单/额度数据/模式schema不改。回退仅恢复旧app.py并标准compose重建，不用旧数据库覆盖现网新订单。复用工具ops/task256/deploy.sh+README准确Git源已下载回读核验。

验证：客户端实际Home回调+调度器17项、原有17项、本地TS/完整lint/Biome/web构建；Android实际纯Kotlin策略8项及静态集成守卫；后台本地与NAS298项/迁移13项；实际Web端点与实际Home回调隔离联调（到期→后台加时、真实额度用尽→补满、A→B低时间戳迁移）通过，原token/device计数均1且imports0，未自动启动VPN。未使用生产码做数据改动，未验证真实付款或真实VPN。

公开独立Pre-release：

- abxian/shenxianyun: https://github.com/abxian/shenxianyun/releases/tag/access-recovery-test-20261029（427413824）
- abxian/shenxianyun-android: https://github.com/abxian/shenxianyun-android/releases/tag/access-recovery-test-20261029（427414224）

非v标签access-recovery-test-20261029；准确产品提交、prerelease/latest=false，正式PC v2.5.46/383155547与Android v2.11.50/380915365保持，不合PC/Android main，不改updater/Dufs。原生Apple仍8fd29aa冻结，正式Mac命名兼容仍241。

| 包 | 字节 | SHA256 |
|---|---:|---|
| Shenxianyun-test-20261029-Windows-ARM64-recovery256.exe | 48251291 | 4470d227e558f6476402eaccc2434858e5132749b5c2911396d41dd24f3aab06 |
| Shenxianyun-test-20261029-macOS-AppleSilicon-recovery256.dmg | 70107673 | 8e2b08af09421eedf13b295eaac51af1615ff5f07c8cbcd5c4fe31fe6ed41344 |
| Shenxianyun-test-20261029-Windows-x64-recovery256.exe | 54228232 | 23fac06c15d714db3f10df49dfb5819a639f499c40f5ebcf203ea3c28d62a37b |
| Shenxianyun-test-20261029-Android-ARM64-recovery257.apk | 24457029 | e922c5c0a0ae5311778a20b309fe3245ab20f24e76703532252009c107184da9 |
| Shenxianyun-test-20261029-Android-universal-recovery257.apk | 72430554 | 2629514c041b782497212e6540f874af15b1f3b79db700c4ca931046926aceb6 |

Mac包神仙云.app / de.sxnn.shenxianyun.desktop / arm64 / 2.5.46+deploytest.1029.731cce6，通过DMG完整性、深度严格签名；ad-hoc无公证。Windows安装器PE结构与CI目标核对；尚无Windows执行证据。Android com.jc116.shenxianyun/2.11.50/211050，ARM64和通用ABI核对，v1/v2/v3验签及正式证书f30240ae494e087087490729f21b804f1b46b4474d1ec2f642ea6e1eb58ca410一致；同版本覆盖安装请核SHA，勿卸载清数据。

下载核验：13个公开初始资产已匿名完整HTTP200/字节/SHA/Release digest一致，结果见公开public-download-receipt.json；回执也上传两页并分别匿名回下载一致。白名单recovery256-257-evidence.zip包含修改源码快照、公开校验/联调/部署工具、前提/参数/范围/回退/manifest哈希，无用户配置/原始凭据日志/私有备份库。工具固定输入变化会使检查失效，修改后需重验。

本机桌面 /Users/cgnay/Desktop/神仙云测试版-20261029/续费恢复与订阅同步-256-257 已复制9文件并SHA回读。当前安装/运行Mac仍fix255，本轮未替换或中断用户App；用户需覆盖安装新包生效。旧fix255/239与源码保留，约142GiB空闲，不裁剪里程碑。实机验收还需网站续费/后台加时补满/切文件/VPN下更新/断网重试/手动断开保持测试；未把构建与模拟标为设备验收。

回执SHA256 `77ecaa1bb198b22ea85dd20c06c6bcfab93348d4d64eae4d36abd4464641eeeb`；证据ZIP SHA256 `78b3ac6a512bc99d43897ce96d3103565492887af814fbace39827d4c315c25a`。
