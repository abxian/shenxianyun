# NAS 拉取 GitHub Release 并发布到 Dufs

GitHub Actions 只负责编译、签名并上传 GitHub Release/updater Release。
NAS 使用 `nas-sync-release-to-dufs.py` 主动拉取正式资产，不再由 Actions
向 Dufs 上传大文件。

## 发布前提

1. `Release Build` 已全部成功，正式 Release 是 published、非 prerelease。
2. `Updater` 工作流已成功，`updater` Release 的 `update.json` 与正式 tag
   版本一致，并包含 Windows、macOS Apple Silicon 和 macOS Intel。
3. 只允许同步公开仓库 `abxian/shenxianyun`；吾爱云仓库不得写入这里。

## NAS 安装位置

脚本部署到：

```text
/vol1/1000/docker-projects/shenxianyun-release-sync/nas-sync-release-to-dufs.py
```

脚本不保存 GitHub、Dufs 或 NAS 凭据。公开仓库通常不需要
`GITHUB_TOKEN`；如果 GitHub API 提示限流，可以仅在当前命令环境临时设置
只读 token，不得写进脚本、Git 或日志。

NAS 当前可访问 `api.github.com`，但直连 `github.com` 的 Release 文件可能
超时。脚本默认先使用
`https://gh-proxy.org/<GitHub 官方 Release URL>`，失败后再尝试 GitHub
直连。无论下载来源如何，每个文件都必须通过 GitHub API 原始大小和
SHA-256 digest 校验，否则不会发布。

## 使用

先只检查 GitHub 元数据、版本和资产完整性，不下载大文件、不修改 Dufs：

```bash
sudo python3 /vol1/1000/docker-projects/shenxianyun-release-sync/nas-sync-release-to-dufs.py \
  --tag v2.5.29 \
  --dry-run
```

dry-run 成功后正式同步：

```bash
sudo python3 /vol1/1000/docker-projects/shenxianyun-release-sync/nas-sync-release-to-dufs.py \
  --tag v2.5.29
```

脚本会完成：

- 校验 GitHub Release tag、published 状态、资产大小和 SHA-256；
- 拒绝缺少 Intel updater、错误仓库、预览版和默认版本回退；
- 使用
  `/vol1/1000/docker-projects/shenxianyun-release-sync/work` 私有目录暂存和加锁，
  临时文件不会出现在 Dufs 公网目录；
- 将 updater 资产改为带 tag 的版本化文件名，避免覆盖当前签名对应文件；
- 备份旧文件到
  `/vol1/1000/docker-projects/backups/shenxianyun-release-sync-<tag>-<时间>`；
- 使用文件锁和原子替换，最后才切换 `update.json`；
- 中途失败自动恢复已经替换的文件。

只有明确需要回退时才可使用 `--allow-downgrade`，并应先在 NAS 笔记记录原因。

## 验收

同步成功不等于客户端已验收。仍需分别确认：

1. Dufs 根目录安装包、`updater/` 版本化资产和 `update.json` 可访问；
2. `update.json.version` 等于 tag，URL 均指向
   `https://sxy.sxnn.de:5443/sxy/updater/`；
3. Windows、macOS Apple Silicon、macOS Intel 的 URL 与签名均非空；
4. 公网文件大小/SHA-256 与 GitHub Release 一致；
5. 客户端检查更新和安装包下载正常；
6. 把备份路径、脚本输出和客户端验收结果回写 Trilium。
