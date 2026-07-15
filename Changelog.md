## v2.5.26-rc.1

### 修复问题

- 修复客户端无法访问 `api.sxnn.de:5443`，导致提取码、订阅、心跳和流量上报失败
- 修复官方接口证书异常时仍绕过证书校验的安全问题
- 同步 Mihomo 插件 0.5.4，改善日志连接与小写配置枚举兼容性

## v2.5.2

### 🐞 修复问题

- macOS 托盘速率可能的样式错误
- 修复订阅 TLS 1.0/1.1 等过旧协议时显示更明确错误原因
- 修复 gzip 压缩订阅响应被当作无效 YAML 导致导入失败的问题
- 修复订阅 URL 使用空密码 Basic Auth 时未发送认证信息的问题
- Linux 托盘可能与其他 tauri 程序托盘冲突导致图标异常
- 修复前端连接页面导致的内存泄漏
- macOS 12(Monterey) 首页 IP 卡兼容性

<details>
<summary><strong> ✨ 新增功能 </strong></summary>

- 增加 TrustTunnel, OpenVPN, Tailscale, GostRelay 节点显示支持

</details>

<details>
<summary><strong> 🚀 优化改进 </strong></summary>

- 关闭 autofill 弹出窗口

</details>
