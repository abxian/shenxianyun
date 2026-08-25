# Windows AI 测试唯一入口

本文件供 Windows 上的 AI 测试代理使用，目标为神仙云商业化加固隔离分支。用户说出精确触发词 **“开始测试”** 后才可执行测试；此前只能读取说明、检查环境和说明风险。

机器用例：`test-cases/windows-commercial.json`。统一执行器：`scripts/windows-ai-test.ps1`。

## 安全与范围边界

- 只测试 `codex/sync-commercial-hardening-20260825`，HEAD 必须包含用例声明的候选基线。
- 不修改源码，不创建 tag 或 Release，不合并分支，不上传测试代码。
- 原始日志和安装包只留在已忽略的 `.ai-test-results/`。
- GitHub Issue 只上传结构化状态、提交号、时长、Actions URL、构件哈希和脱敏摘要。
- 禁止上传订阅 URL、提取码、Token、Cookie、密码、密钥、MachineGuid、用户名、主机名、私人路径或业务地址。
- 后端商业归一分支尚未部署时，服务端设备/流量聚合必须写“待主审核验”，不能把客户端 API 成功写成数据库已通过。
- 安装、代理、断网和重装只可在备用机、虚拟机、Sandbox 或明确可回滚的测试机执行。

## 首次拉取

```powershell
git -c core.autocrlf=false clone `
  --branch codex/sync-commercial-hardening-20260825 --single-branch `
  https://github.com/abxian/shenxianyun.git
cd shenxianyun
git config core.autocrlf false
git status --short
git branch --show-current
git ls-files --eol | Select-String 'w/(crlf|mixed)'
```

要求工作树干净、分支正确、行尾检查无输出。环境为 Windows x64、Git、Node.js 24、pnpm 11.3.0，以及已登录并有 Actions/Issue 权限的 GitHub CLI。

```powershell
corepack enable
corepack prepare pnpm@11.3.0 --activate
gh auth login
```

## 收到“开始测试”后的固定流程

先执行自动门禁：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\windows-ai-test.ps1 -Mode Run
```

记住输出的 `Run ID`。任一自动项失败都必须停止 Build 和真机安装，并最终发布 FAIL；不能绕过。脚本会锁定本地/远端提交、分支、用例哈希、LF 行尾和环境版本。

自动项全部通过后构建并下载 Windows x64 临时安装包：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\windows-ai-test.ps1 -Mode Build -RunId <RUN_ID>
```

Build 会派发或恢复同一提交的 Development Test，只下载唯一 Windows x64 EXE，并核对 GitHub SHA-256、大小和 PE 文件头。它不是正式发行包。首次成功后立刻以同一 `RUN_ID` 再运行一次 Build；必须复用同一 Actions URL 和构件哈希，然后才记录 `WIN-BUILD-RESUME-001`。

随后严格按 JSON 中 `manualChecks` 的顺序逐项执行并立即记录：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\windows-ai-test.ps1 -Mode Record `
  -RunId <RUN_ID> -CaseId WIN-INSTALL-001 -Status pass `
  -Summary "安装成功，观察 60 秒无闪退" `
  -Evidence "界面目视检查；未上传截图"
```

状态只有 `pass`、`fail`、`blocked`、`not_run`。完成项必须有脱敏摘要与证据，且不能跳过前项。失败摘要写步骤、现象、复现性和回滚结果，但原始日志不上传。

`WIN-TRAFFIC-001` 只允许读取脱敏诊断 `shenxianyun.managedTrafficStatus.v1` 的 version、state、失败分类、确认序列和时间，不复制整个 localStorage 或请求内容。通过条件是产生少量双向流量后 60 秒内 `acknowledgedSequence` 严格增加且 `lastAcknowledgedAt` 更新；超时必须自动取消并用同一序列重试。Windows 报告只证明客户端行为，生产数据库归一必须由主审在后端部署后通过授权只读通道核验。

`WIN-REINSTALL-ID-001` 只能记录稳定设备键是否成功及重装前后是否相同，绝不能显示、保存或上传键值本身。

查看进度：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\windows-ai-test.ps1 -Mode Status -RunId <RUN_ID>
```

全部项目记录后上传标准 GitHub Issue：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\windows-ai-test.ps1 -Mode Publish -RunId <RUN_ID>
```

最终只回复：

```text
Windows 测试已完成并上传。
Issue: <GitHub Issue URL>
Development Test: <GitHub Actions URL>
Commit: <40 位提交号>
Verdict: PASS / FAIL / BLOCKED
本机原始日志未上传，保存在 .ai-test-results/<RUN_ID>/raw-logs-local-only。
```
