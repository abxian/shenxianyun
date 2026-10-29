# 261 正式发布 · 2026-10-29 / Codex

用户明确要求“发布新版本”，承接260测试版的首页/到期显示、本机setting、续费额度恢复和订阅迁移、Mac卡住/圆形按钮、两列节点与自动项置顶。本轮PC和Android独立发布，不含Apple商店或52nm。

PC2.5.47，准确产品63b562783c5f8c5dba50a5b79a9fe1dd6785540e，隔离codex/release-20261029验证后推main并创建唯一v2.5.47标签。package.json / src-tauri/tauri.conf.json / src-tauri/Cargo.toml / Cargo.lock根包及Changelog同步，服务IPC2.3.0一致。产品源包含此前260/256/255/254的修复，不能将旧测试包改名冒称新构建。

241 Mac发布兼容已闭环：原生神仙云.app/de.sxnn.shenxianyun.desktop，保留Clash.Verge_2.5.47_aarch64.dmg/x64.dmg下载名，更新归档带版本和架构，仅外层改名原签名字节不变；独立Intel复用兼容历史名字。准确源Frontend40865699291、三平台Clippy40865703806、正式Release40866623071全部成功（正式13jobs），实际Intel复用40875140305成功；本地兼容5/NAS10、updater2+3、恢复/Home27、旧启动17、AndroidXML/守卫通过。

[正式Release](https://github.com/abxian/shenxianyun/releases/tag/v2.5.47)，ID427786482，非draft/非prerelease，GitHub latest2.5.47。23初始资产全部匿名全文HTTP200/size/SHA/GitHub digest一致；8个实际更新/安装对象密码学签名使用客户端同库minisign-verify0.2.5及发布公钥通过，篡改对照被拒。两Mac只读DMG验证arm64/x86_64、身份、2.5.47和严格deep签名；两个更新归档Info.plist核身份版本；WindowsPE/准确CI架构。Mac仍ad-hoc未公证，Windows与真实VPN/付款不当作实机验收。四GitHub updater JSON匿名全文SHA、每个平台/架构/版本/原签名和普通/固定WebView2通道均核验。

标准NAS工具源码631baf7e...全文回读一致、dry-run通过后发布，update.json最后切换；NAS同步exit0，旧六安装器与旧metadata备份/vol2/docker-projects-backups/shenxianyun-release-sync-v2.5.47-20261029-204706-215511。旧六包和保留旧四更新原件全SHA与旧2.5.46官方元数据一致、旧update SHA与发布前记录一致；旧Release/四份GitHub updater原字节也保存。没有裁剪255/256/257/260或Git/NAS里程碑。

公网验收发现既有sxy DNS只剩坏112入口。仅旧jiaocheng-healthcheck的sxy候选增加现有健康NPS221，另16项原值和源字节不变，复用真实同步函数3隔离测试、最后A保护/先加后删/未知A不删；其余域名和CDN配置未修改。脚本/DNS/unit私有恢复点/vol2/docker-projects-backups/sxy-download-route261-20261029-210808-063382；旧源d465780d...→新166064a6...，服务正常active，A由Cloudflare/Google回读221。首次普通用户restart被拒，源码自动恢复旧基线；v2使用已授权账号sudo仅固定systemctl命令，密码只内存/加密stdin，未落日志/文件。原始备份/Runbook/用户数据不公开。

352–358记录影响及风险适配：全部准确GitHub原件已全文下载/验签、NAS发布文件全SHA；重复经低带宽NPS搬约700MB会饱和生产下载并拖慢新握手，所以取消4并发全量重复验证，不将其算成功。最终分发门禁采用默认DNS/TLS、每大包总长度/首尾Range对原件、完整sig/update JSON与NAS全SHA结合，不称Dufs全部大包全文重传通过；映射或反代改变须重新验证整包。源码操作/工具/参数/前提/范围/回退/核验方法详见rc/ops/release261-20261029/TOOLS.md和公开白名单证据ZIP。

用户桌面/Users/cgnay/Desktop/神仙云正式版-20261029已放PC六平台别名对应原件与安卓两包，逐文件SHA一致。本轮未替换/停止当前用户App，实际覆盖安装、VPN/网站支付恢复与网络体验需另行设备验收。不要声称模拟/CI/发行等于设备验收。

版本API/项目记忆与完整发布收尾见本报告末尾及ops/release261-20261029最终JSON回执。

## 最终公开入口与升级提示验收

PC下载站已原子切到2.5.47，默认DNS及TLS下14个PC安装器/更新文件URL验证，完整update与sig一致、大包Content-Range总长度/首尾对原件，NAS全文件SHA与准确GitHub匿名全文原件一致。按评估358不再通过受限生产NPS重复搬运约700MB；此前重复Dufs全传输已取消，不算通过。Android两包此前完整公共HTTP200/SHA通过，GitHub四updater最新原件签名/版本/架构一致。默认域名与NAS均可返回新版metadata，Cloudflare/GoogleDoH回读健康221，旧112如自愈仍按原健康阈值管理；没有永久禁用其它站点。

升级提示已同步：PC2.5.47 / 安卓2.11.51(211051)。site_config只更新desktop七项/app四项，写前在线SQLite备份完整性/SHA，BEGIN IMMEDIATE内再次核旧值再单事务写11键；无schema/业务源码/期限额度/设备/订单变更，不重启subfile。公开/api/desktop-version和/api/app-version、NAS只读11键/DB完整性和容器healthy、app.py源SHA一致均通过。备份/vol2/docker-projects-backups/vpn-web-release261-20261029-212430-632330，DB SHA256 eead86b28ddd43c69647736137e2bdaf4476bc502d5622492649182cbdb1570f；回滚只按私有manifest恢复11键且拒覆盖后续管理员更改，禁止整库覆盖新业务数据。原PC元数据实际为2.5.41，升级到2.5.47；不是假定从2.5.46变。

准确源产品标签保持63b56278/f06b0c6；后续仅报告和公开工具文档提交。发布工具与范围/前置/参数/风险/回滚见证据ZIP，工具下载/归档只在回读SHA后写成功。Trilium项目/实际AI记忆和基础设施记录以本次最终marker及回执为准，内部只读审核与用户设备验收独立。
