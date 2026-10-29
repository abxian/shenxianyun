# 续费、额度恢复与文件迁移同步（256）

Windows/macOS共用桌面源码，保留fix255的原生线程派发与正圆按钮。启动页在到期或流量限制时提供续费入口；网站付款、后台加时/补满额度后，使用原设备凭据和随机订阅地址更新原配置。原生Apple工程继续冻结；安卓按用户另行确认纳入257。

客户端打开时即检查，前台约24–36秒、后台约48–72秒轻量轮询，回前台/网络恢复立即检查；不依赖VPN状态。每次只有一个检查，focus/online合并，服务端Retry-After不被唤醒绕过，网络错误指数退避至5分钟。只在版本、opaque revision、期限、限制恢复或进程启动需要时下载。低版本/同秒跨文件迁移由revision识别。服务端无新字段时保留旧时间版本兼容。

本地记录账户限制并绑定提取码，网络或5xx/429不能冒充到期、不能清限制。启动即使本地期限已过也复核服务端；未确认恢复时禁止使用过期/受限缓存。下载/校验/落地成功后才消费版本，失败保留旧配置并继续检查；手动编辑的配置继续保护，不强行接管。原占位配置恢复原管理UID并清理，只在缺旧凭据的升级路径自动签票，常规恢复不轮换设备授权；撤销授权不会用自动签票绕过。手动断开的VPN不自动启动。

修改入口：src/pages/home.tsx、src/services/subscription-monitor.ts、src/utils/access-recovery.ts；package.json的test:subscription-refresh接入scripts/test-access-recovery.mjs。新测试通过TypeScript AST加载实际Home业务回调，以隔离IO端口验证，不复制实现；纯调度器用假时钟验证并发、取消、限流。旧startup截止/保护规则/自动首位测试继续运行。

配套Web开发分支增加update-state结构化限制原因和HMAC revision，保留200/404权限语义/no-store；既有managed URL动态跟随当前文件。Web源码7c4b45b，完整298项及迁移13项隔离通过，实际部署/安装包/真实VPN验收分开记录，未验证不写已完成。

源码基线87a640e3和已发布fix255保留恢复点。私有用户配置不入Git/公开工件；部署前备份并仅改sxnn后台。正式客户端main/updater/Dufs/52nm/iOS不在本次测试交付范围。后续CI/包来源/哈希与上线回执待补。
