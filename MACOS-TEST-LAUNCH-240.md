# macOS测试版启动修复 #240

2026-10-28 / Codex。用户附件显示吾爱云旧页；本机只读证据：/Applications/Clash Verge.app已是2.5.46+deploytest.1027.13a1ad4，实际运行/Applications/吾爱云.app为2.5.34，两者Bundle ID均io.github.clash-verge-rev.clash-verge-rev。当前源码单实例使用33331，端口占用时会唤起既有窗口后退出且不核对产品身份。Computer Use按该Bundle ID选择应用也实测返回多应用歧义。旧进程随后已退出，补探测未监听，未取得旧版端口实际响应；不将该端口占用记为已实测。已确定的安装/启动问题是重复Bundle ID和运行旧应用，单实例旧逻辑同时存在跨品牌误唤窗口风险。包内容正确不等于启动过程正确。

## 修复

代码71727bab（codex/macos-launch-fix-20261028）。src-tauri/tauri.macos.conf.json改应用名神仙云、独立Bundle ID de.sxnn.shenxianyun.desktop，只注册shenxianyun链接。配置目录APP_ID和privileged helper标识保持原值，不复制/删除/重置用户配置。新Mac启动查询本机/commands/identity，只有同产品同构建才唤醒现有窗口；未知、旧版、其他品牌占用时原生提示先退出旧客户端，然后停止本次启动，避免同时操作共享核心/配置。没有结束现有吾爱云进程或改变系统代理/VPN。

实现：src-tauri/src/utils/macos_instance.rs、utils/server.rs、utils/mod.rs、lib.rs；回归scripts/test-shenxianyun-commercial-isolation.mjs，Dev workflow增加Mac策略测试。Windows/Linux不启用这段Mac启动识别。Clash-Client/iOS源码保持8fd29aa冻结。

## 验证

本地Clippy全目标全特性零警告；Rust策略3项（未知/旧品牌拒绝、同品牌旧构建拒绝、同构建唤醒）通过；商业隔离5项通过，含Bundle ID/品牌/深链与历史配置/服务标识不变；Git提交推送hook通过。CI：Development Test40623153156仅Mac选中，Frontend40623153519、Clippy40623153232；本文件编写时构建中，最终结果另记。

## 安装与使用

从修复DMG拖入“应用程序”，包内应叫“神仙云.app”。如果提示旧客户端运行，先在菜单栏退出“吾爱云/Clash Verge”，再打开“神仙云”。原有软件/配置保留，新标识有独立WebView存储，可能需重新输入提取码。不能同时运行两个共用此历史运行目录的客户端。未经公证，按系统隐私安全界面的提示允许打开即可。

## 回退与发布边界

独立修复测试标签/包保留239原件作恢复点；退出新版后可打开原应用。无需数据库回滚，不删旧应用、不清用户配置。本次不改main/latest/updater/Dufs或正式发布，不改Android/Windows测试包。正式Mac包名兼容工作须在未来正式合main/发版前完成：Release Build表、macos-intel复用、NAS同步脚本精确匹配Clash.Verge；不得直接用本分支发正式版。后续由内部任务跟踪。

没有可复用的新本机运维脚本；零散只读ps/Info.plist核对无凭据，方法与结果保存在本报告。回归Rust源码和CI门禁随Git提交长期保存；用户截图不再公开上传。

## 用户现场确认

2026-10-28用户答复：显式打开当前测试版后看到“神仙云简洁首页：提取码和启动按钮”。此为用户确认的当前13a1ad4页面结果；不等同于71727bab修复DMG已经安装、VPN在线更新或连接后行为通过。旧程序退出后新测试版运行路径已为/Applications/Clash Verge.app；Agent没有结束旧进程或点击启动VPN。

## 最终构建与包核验

Mac Development40623153156、Frontend40623153519、三平台Clippy40623153232全部success，源71727bab。原artifact12789020537为archive:false DMG，70073725B；SHA256 7cc4bddc81c09704a0e0341996ce9a7cdf9eebffde5b5a807e06281223f81931与CI digest一致。hdiutil verify/只读挂载、God.app/CFBundleName/DisplayName=神仙云、Bundle ID=de.sxnn.shenxianyun.desktop、版本2.5.46+deploytest.1028.71727ba、arm64、codesign深度严格校验通过。ad-hoc未公证，未安装或启动新包，不冒充新包运行/VPN验收。只读挂载已卸载。新测试入口macos-home-fix-20261028，旧239文件保留回退；公开下载验收另见回执。
