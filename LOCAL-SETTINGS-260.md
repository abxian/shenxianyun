# 260 PC本机高级模式与到期时间

2026-10-29 / Codex。用户要求首页只保留必要信息但显示到期时间，以及不启动VPN进入配置管理，导入其他配置并启动。

首次提取码框或已绑定时的“切换提取码”弹窗输入`setting`并提交，大小写/首尾空格兼容；进入本机高级模式且打开高级设置，不调用verify/ticket/exchange、不改原提取码和设备凭据、不启动核心/代理。顶部有配置管理/高级设置/退出高级模式，整个应用UI会话有效（退出程序后失效，无持久化口令）。`setting`只是本机功能入口，不是NAS管理员密码或安全认证；不放宽服务器授权/套餐限制。

高级模式即使VPN断开仍保留界面/弹窗/编辑器；主动退出恢复简洁页，运行中的网络不因退出被中断。配置管理支持现有订阅URL、新建/编辑/切换，新增本地.yaml/.yml文件导入：上限8MB、YAML根必须字典、原生校验切换成功才选中，失败只清理本轮新文件保留旧配置；手动文件导入不自动开启VPN。运行代理时先停止再导入/切换，防止计量串号。管理写入与受管后台更新互斥并取消旧读取，保存过程仍持有写锁；原受管文件被手改后沿已有detached保护不覆盖。

原currentCode只随实际受管UID/到期占位UID生效，自定义配置按自身节点/规则启动，不伪报原提取码账号；旧异步账号响应通过activeCodeRef身份闸门丢弃，不能在选中手动配置后因旧账号限额停掉它。切回受管配置仍检查到期/额度/授权，不通过setting绕过。其他客户端和服务器权限不变。

到期时间：PC首页（连接/停止均显示）和高级设置账户区展示当前受管码期限，与用量可见性解耦；没有期限显示待同步，不假称长期。手动配置不展示旧账号到期时间。PC“账号用量”保留在高级设置，按既有后台show_usage_status显示，首页不增加流量统计；未提供套餐总额度时不伪造剩余量。安卓独立仓只修到期展示，与PC本机入口分开构建。

入口src/pages/home.tsx、src/utils/local-workspace.ts；复用FileInput/原生createProfile+patchProfilesConfig，未新增接口/数据迁移。scripts/test-local-workspace.mjs通过TypeScript AST执行真实Home回调，验证setting不联网/不启核心/不写账号、写事务不能打断、手动文件创建选择/失败回滚/运行时拒切换、旧限额响应不停止手动配置。已有17恢复测试增加activeCodeRef端口保持真实回调验证，新8项合计25；原startup17另过，类型/lint/web编译单独检查。package.json将此测试接入Frontend CI原有test:subscription-refresh门禁。

分支codex/local-settings-20261029，基线ddf085c7/已交recovery256包保留，Android基线6024a0f/旧257包保留。回退revert任务提交并旧包覆盖，不清数据/不裁剪旧恢复点；没有NAS部署/iOS/52nm改动、不改正式latest/updater/Dufs/Client main。风险适配沿用户先测独立开发包，CI验证与测试分发/实际安装/真机VPN分开记录。完整Frontend/Clippy/三平台打包走Actions，结果/哈希/签名与交付待补。无用户数据/凭据出现在测试和工件。
