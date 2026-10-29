# fix255 构建与本机验收 · 2026-10-29

源码与测试标签：f925380ab1c043f992b74692877d9b78cb816cfd / macos-deadlock-test-20261029。分支codex/macos-deadlock-20261029，未合main。

- Frontend Check 40760471009、三平台Clippy 40760477035、仅Mac Development Test 40760483042均准确本提交并成功。开发包的Windows/Linux jobs按选择跳过，不能视为重打包。
- Mac CI通过原生单实例3项、自动节点策略5项/准确配置core -t/假SOCKS A→B故障切换，以及本次真实notification模块线程/负载/窗口关闭回归。
- Artifact12848798349；Shenxianyun-test-20261029-macOS-AppleSilicon-fix255.dmg；70092254B；SHA256 `0f04c02f6d3fec18a5ab5b95480912030df6851a138ec1cdbeda8d19f92853ff`。原件API digest/DMG完整性/只读挂载/Info/arm64/codesign深度严格通过。版本2.5.46+deploytest.1029.f925380，de.sxnn.shenxianyun.desktop，最低macOS11，ad-hoc无公证。
- 已结束明确死锁的旧PID58229，先完整应用ZIP、停止后配置私有ZIP校验，再原位替换/签名复验。配置与配对加密密钥保留，旧应用放私有目录且不保留.app后缀以免启动歧义；没有清除用户数据。
- 本机新进程74266/74545/74796三次真实启动。每次首页“启动连接”“切换提取码”可用，中间Cmd-Q正常退出；第三次留在首页。新进程sample未出现旧get_webview↔emit_js等待链。原生截图确认正圆；IAB夹具三尺寸busy/idle测量同宽高。
- 网络系统代理/TUN维持关闭，没有替用户点击VPN。真实VPN连接、VPN下更新订阅、连接后节点UI仍待用户实测。不能以3次重开证明所有启动触发或网络情境均已验收。
- Windows/Android安装包不变；原生Apple/iOS/iPad/tv继续冻结；正式latest仍v2.5.46/383155547，main/Dufs/updater/后端未改。正式Mac兼容241仍保留。

源码入口和复现/回退见source/MACOS-DEADLOCK-255.md；工具参数/读写边界/图片失效条件见VERIFY-TOOLS.md。应用/配置恢复ZIP在本机私有Library/Application Support/Shenxianyun-Test-Recovery/20261029-fix255-before，绝不上传。本机约143GiB空间，保留相关里程碑，验收后复审，无裁剪。

风险适配：评估339/340/341/342。本次沿既有测试交付约定，用独立非v开发测试标签/原始CI包交付，不为测试合main/改正式下载；只在未来正式发布恢复main+正式版本/签名/241门禁。pre-commit把显式忽略的.github YAML交给Biome导致零文件失败，已按340以等价完整格式/lint/TS/YAML解析/Rust fmt+Clippy及正常pre-push代替，未更改hooks。

图片native-home-fix255.jpg是本机当前原生窗口，2026-10-29/2.5.46+deploytest.1029.f925380/焦点为简洁首页可操作与圆形按钮，无提取码/账号/节点凭据，无需遮挡；系统截图指示标记不是产品控件。组件/主题/布局/版本变化即失效，必须与JSON/AX和采样摘要一同使用，不证明VPN成功。

## 实际测试分发

- [Mac fix255 下载页](https://github.com/abxian/shenxianyun/releases/tag/macos-deadlock-test-20261029)，Pre-release427364773，非draft，测试标签准确f925380a。
- [完整匿名下载校验回执](https://github.com/abxian/shenxianyun/releases/download/macos-deadlock-test-20261029/public-download-receipt.json)：6初始资产HTTP200整包字节/大小/SHA与GitHub及本地一致；回执自身再上传和匿名回下载。正式latest ID383155547/v2.5.46不变，旧254页只为Mac加新链接，其他旧包保留。
- [代码与工具/脱敏证据ZIP](https://github.com/abxian/shenxianyun/releases/download/macos-deadlock-test-20261029/fix255-evidence.zip)：211523B，SHA256 aa4f46879fb87efc7a22b85eb656dd20ad459baea627f099ba5be07345187922，33条白名单工件，含GPL许可/原Cargo锁/修改源码、只读verifiers、夹具/线程回归、AX/截图/数据/CI来源。无用户配置、原始日志/采样或私有恢复备份。
- [本机原生首页截图](https://github.com/abxian/shenxianyun/releases/download/macos-deadlock-test-20261029/native-home-fix255.jpg)：85527B，SHA256 9770579c3b339f13fe06ce35c664662f014beb6523eea811bf565529d5740dbc，日期/焦点/失效条件见上文，证明本轮首页/圆度，不代表VPN连接。
- 本机桌面 `/Users/cgnay/Desktop/神仙云测试版-20261029/` 新包、说明、校验、证据、原生图与回执已回读一致；旧20261028目录增加fix255说明，未删除历史包。
- 源码 f925380a 是准确构建来源；本报告属于后续文档提交，不要求为文档重新打包。
