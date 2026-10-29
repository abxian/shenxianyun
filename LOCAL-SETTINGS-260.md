# 260 PC本机高级模式与到期时间

2026-10-29 / Codex。用户要求首页只保留必要信息但显示到期时间，以及不启动VPN进入配置管理，导入其他配置并启动。

首次提取码框或已绑定时的“切换提取码”弹窗输入`setting`并提交，大小写/首尾空格兼容；进入本机高级模式且打开高级设置，不调用verify/ticket/exchange、不改原提取码和设备凭据、不启动核心/代理。顶部有配置管理/高级设置/退出高级模式，整个应用UI会话有效（退出程序后失效，无持久化口令）。`setting`只是本机功能入口，不是NAS管理员密码或安全认证；不放宽服务器授权/套餐限制。

高级模式即使VPN断开仍保留界面/弹窗/编辑器；主动退出恢复简洁页，运行中的网络不因退出被中断。配置管理支持现有订阅URL、新建/编辑/切换，新增本地.yaml/.yml文件导入：上限8MB、YAML根必须字典、原生校验切换成功才选中，失败只清理本轮新文件保留旧配置；手动文件导入不自动开启VPN。运行代理时先停止再导入/切换，防止计量串号。管理写入与受管后台更新互斥并取消旧读取，保存过程仍持有写锁；原受管文件被手改后沿已有detached保护不覆盖。

原currentCode只随实际受管UID/到期占位UID生效，自定义配置按自身节点/规则启动，不伪报原提取码账号；旧异步账号响应通过activeCodeRef身份闸门丢弃，不能在选中手动配置后因旧账号限额停掉它。切回受管配置仍检查到期/额度/授权，不通过setting绕过。其他客户端和服务器权限不变。

到期时间：PC首页（连接/停止均显示）和高级设置账户区展示当前受管码期限，与用量可见性解耦；没有期限显示待同步，不假称长期。手动配置不展示旧账号到期时间。PC“账号用量”保留在高级设置，按既有后台show_usage_status显示，首页不增加流量统计；未提供套餐总额度时不伪造剩余量。安卓独立仓只修到期展示，与PC本机入口分开构建。

入口src/pages/home.tsx、src/utils/local-workspace.ts；复用FileInput/原生createProfile+patchProfilesConfig，未新增接口/数据迁移。scripts/test-local-workspace.mjs通过TypeScript AST执行真实Home回调，验证setting不联网/不启核心/不写账号、写事务不能打断、手动文件创建选择/失败回滚/运行时拒切换、旧限额响应不停止手动配置。已有17恢复测试增加activeCodeRef端口保持真实回调验证，新10项合计27（包括手动配置启动不查询旧账号、断开状态保留本机高级弹窗）；原startup17另过，类型/lint/web编译单独检查。package.json将此测试接入Frontend CI原有test:subscription-refresh门禁。

分支codex/local-settings-20261029，基线ddf085c7/已交recovery256包保留，Android基线6024a0f/旧257包保留。回退revert任务提交并旧包覆盖，不清数据/不裁剪旧恢复点；没有NAS部署/iOS/52nm改动、不改正式latest/updater/Dufs/Client main。风险适配沿用户先测独立开发包，CI验证与测试分发/实际安装/真机VPN分开记录。完整Frontend/Clippy/三平台打包走Actions，准确CI与包验证已完成，最终交付见下文。无用户数据/凭据出现在测试和工件。

## 2026-10-29 最终构建与交付核验

产品源8bfe7ab715e8e8b8710dca20b913e081270e6624（含管理弹窗内错误提示），扩展测试源6c33ebc313dcf3aa8aa086d93fd078208c2bb0ae仅额外修改scripts/test-local-workspace.mjs，运行代码/依赖/CI不变。Frontend40852121655、Clippy40852187637、Development40852126766全部success且准确产品源；扩展测试Frontend40852246704同样success。早期40851616722取消，没有用于交付；Linux未选构建，不列入安装包。

交付版本2.5.46+deploytest.1029.8bfe7ab：Windows x64、Windows ARM64、macOS Apple Silicon三包。原始Actions工件digest/完整字节/SHA逐一一致；DMG只读挂载核de.sxnn.shenxianyun.desktop/版本/arm64/严格deep签名，ad-hoc未公证；Windows核PE结构/准确CI目标，未在Windows实机运行。安卓独立产品87c84c9，两APK另记。

发布与下载证据位于[本轮PC测试页](https://github.com/abxian/shenxianyun/releases/tag/local-settings-test-20261029)附件verification.json、SHA256SUMS和local-settings260-evidence.zip。测试说明写清首次setting/已绑定切换码入口、导入回滚、手动/受管边界及安装版本识别。公开ZIP仅任务修改文件/验证工具/无秘密结果，含准确产品快照8bfe与扩展测试快照6c；不是完整工程，重建应检出准确Git源。笔记维护工具归档状态以ops/local-settings260-20261029/trilium-final-receipt.json及archive-sync-notes.py.json回执为准。

桌面目录/Users/cgnay/Desktop/神仙云测试版-20261029/本机设置与到期时间-260已放五包/说明/校验/证据逐文件核SHA；没有覆盖安装或停止当前用户App。真机VPN/网站支付与后台加时恢复、目标设备视觉交互仍待安装验收，隔离真实Home回调测试不能代替。正式241命名兼容和既有其他平台问题未借此宣称完成。本轮无NAS/后端部署、无iOS/52nm/生产数据改变。

公开下载补充：两仓非v标签local-settings-test-20261029，PC Release427723255/Android427724174。匿名完整HTTP200下载13个初始附件，全部大小/SHA256/GitHub digest一致；另将public-download-receipt.json上传两处并匿名全文回读一致，共15次下载核验。正式latest仍PC v2.5.46/id383155547、Android v2.11.50/id380915365。两仓标签准确指向各自产品源，不移动main或旧包。
