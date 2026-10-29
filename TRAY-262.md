# 262 PC托盘两项菜单与Mac首页NAS更新

2026-10-29 / Codex，用户要求程序右键菜单只保留更多/退出，核对NAS更新来源。基线为正式2.5.47产品63b56278/文档a19e72c8；Android2.11.51不改。

src-tauri/src/core/tray/mod.rs共用Windows/macOS/Linux入口的一级菜单严格仅更多、退出；打开窗口、打开目录、轻量模式及原维护项收至更多，退出仍沿feat::quit/清理与Cmd+Q，左键行为仍沿配置。删除一级代理模式/系统代理/TUN/节点/订阅配置及对应不可达菜单事件，菜单构建不再查询Mihomo节点/运行配置、服务/管理员权限或受管凭据，避免未启动时等这些IO。更多内主动点维护项仍执行原动作，不自动开启代理。不持久化/迁移用户菜单设置或账号，原旧布局开关不再改变一级菜单。

src-tauri/src/core/tray/menu_def.rs移除废弃菜单定义；原受管配置名称遮盖测试改为断言托盘不读取/渲染任何配置名，覆盖更严格隐私边界，版本/tooltip品牌测试保留。托盘tooltip和图标仍反映原运行状态，任务没有要求修改它们。

当前Windows在core/updater.rs的Dufs主源先读NAS update.json并下载NAS版本化包、失败回GitHub，均验签；macOS设置页update-viewer.tsx原本就是按CPU下载NAS DMG。Home doUpdate先前仍开GitHub latest，本轮统一复用现有services/update.ts的macosDufsDownloadUrl及cmds.getAppArch，Apple aarch64→神仙云.dmg、Intel x86_64→神仙云-Intel.dmg，未知架构/原生调用失败→本次版本的GitHub Release；继续手动安装不就地更新/重启。没有新增plugin-os依赖，首次误用不存在模块已由typecheck发现并改为工程现有cmds函数。

scripts/test-updater-fallback.mjs新增TypeScript AST执行真实Home更新回调和真实地址函数，覆盖两芯片NAS路径、未知/取架构失败回退准确版本且不自动安装/重启。5项updater回归+5项商业隔离、typecheck、Rust格式通过，完整Clippy/Frontend/发行编译与真实包验收另外记录，不把源码改好说成现有安装包已包含。旧2.5.47资产/标签不覆盖，新版重新构建；旧正式/测试/恢复点保留。无Android/Apple商店/用户代理或账号配置变化。
