#!/usr/bin/env python3
"""Safely publish one Shenxianyun GitHub Release to the NAS Dufs directory.

GitHub Actions remains responsible for compiling and signing release assets.
This script runs on the NAS and pulls the immutable Release assets locally,
verifies their GitHub size/SHA-256 metadata, then atomically publishes Dufs
aliases and update.json.  It is intentionally locked to abxian/shenxianyun.
"""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


REPOSITORY = "abxian/shenxianyun"
API_ROOT = "https://api.github.com"
DEFAULT_DUFS_ROOT = Path("/vol1/dufs/data/sxy")
DEFAULT_BACKUP_ROOT = Path("/vol1/1000/docker-projects/backups")
DEFAULT_WORK_ROOT = Path("/vol1/1000/docker-projects/shenxianyun-release-sync/work")
DEFAULT_PUBLIC_BASE = "https://sxy.sxnn.de:5443/sxy"
DEFAULT_DOWNLOAD_MIRROR = ""
STABLE_TAG_RE = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")
CHUNK_SIZE = 1024 * 1024


class SyncError(RuntimeError):
    """A release cannot be safely synchronized."""


@dataclass(frozen=True)
class PublishFile:
    source: Path
    relative_target: Path
    source_asset: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Pull and atomically publish a Shenxianyun Release to Dufs.",
    )
    parser.add_argument(
        "--tag",
        help="Stable tag, for example v2.5.29; omitted means GitHub latest stable release",
    )
    parser.add_argument(
        "--dufs-root",
        type=Path,
        default=DEFAULT_DUFS_ROOT,
        help=f"Dufs Shenxianyun directory (default: {DEFAULT_DUFS_ROOT})",
    )
    parser.add_argument(
        "--backup-root",
        type=Path,
        default=DEFAULT_BACKUP_ROOT,
        help=f"Recoverable backup directory (default: {DEFAULT_BACKUP_ROOT})",
    )
    parser.add_argument(
        "--work-root",
        type=Path,
        default=DEFAULT_WORK_ROOT,
        help=f"Private staging/lock directory (default: {DEFAULT_WORK_ROOT})",
    )
    parser.add_argument(
        "--public-base",
        default=DEFAULT_PUBLIC_BASE,
        help=f"Public Dufs URL written to update.json (default: {DEFAULT_PUBLIC_BASE})",
    )
    parser.add_argument(
        "--download-mirror",
        default=DEFAULT_DOWNLOAD_MIRROR,
        help=(
            "Verified Release download mirror tried before direct GitHub "
            f"(default: {DEFAULT_DOWNLOAD_MIRROR})"
        ),
    )
    parser.add_argument(
        "--allow-downgrade",
        action="store_true",
        help="Allow replacing a newer Dufs update.json (normally rejected).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate GitHub metadata and print the plan without downloading large assets.",
    )
    parser.add_argument("--retries", type=int, default=4, help="Download retry count.")
    parser.add_argument(
        "--timeout",
        type=int,
        default=120,
        help="Per-request socket timeout in seconds.",
    )
    return parser.parse_args()


def version_tuple(value: str) -> tuple[int, int, int]:
    match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)", value.strip())
    if not match:
        raise SyncError(f"unsupported stable version: {value!r}")
    return tuple(int(part) for part in match.groups())


def request_headers(*, api: bool) -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json" if api else "application/octet-stream",
        "User-Agent": "shenxianyun-nas-release-sync/1",
    }
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if api and token:
        headers["Authorization"] = f"Bearer {token}"
        headers["X-GitHub-Api-Version"] = "2022-11-28"
    return headers


def open_url(url: str, *, api: bool, timeout: int):
    request = urllib.request.Request(url, headers=request_headers(api=api))
    return urllib.request.urlopen(request, timeout=timeout)


def fetch_json(url: str, *, timeout: int, retries: int) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            with open_url(url, api=True, timeout=timeout) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code in {401, 403, 404, 422}:
                break
        except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
            last_error = exc
        if attempt < retries:
            delay = min(2**attempt, 15)
            print(
                f"[GitHub API retry {attempt}/{retries} in {delay}s] "
                f"{last_error}",
                file=sys.stderr,
            )
            time.sleep(delay)
    raise SyncError(f"failed to read GitHub API {url}: {last_error}") from last_error


def expected_sha256(asset: dict[str, Any]) -> str:
    digest = asset.get("digest")
    if not isinstance(digest, str) or not digest.startswith("sha256:"):
        raise SyncError(f"GitHub asset has no SHA-256 digest: {asset.get('name')}")
    value = digest.removeprefix("sha256:")
    if not re.fullmatch(r"[0-9a-f]{64}", value):
        raise SyncError(f"invalid GitHub SHA-256 digest for {asset.get('name')}")
    return value


def verify_download(path: Path, asset: dict[str, Any]) -> None:
    expected_size = asset.get("size")
    if not isinstance(expected_size, int) or expected_size <= 0:
        raise SyncError(f"invalid GitHub size for {asset.get('name')}")
    actual_size = path.stat().st_size
    if actual_size != expected_size:
        raise SyncError(
            f"size mismatch for {asset.get('name')}: {actual_size}/{expected_size}",
        )
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    actual_digest = digest.hexdigest()
    expected_digest = expected_sha256(asset)
    if actual_digest != expected_digest:
        raise SyncError(
            f"SHA-256 mismatch for {asset.get('name')}: "
            f"{actual_digest}/{expected_digest}",
        )


def candidate_download_urls(asset: dict[str, Any], mirror: str) -> list[str]:
    official = asset["browser_download_url"]
    urls: list[str] = []
    mirror = mirror.rstrip("/")
    if mirror:
        urls.append(f"{mirror}/{official}")
    urls.append(official)
    return urls


def asset_request_headers(offset: int) -> dict[str, str]:
    headers = request_headers(api=False)
    if offset > 0:
        headers["Range"] = f"bytes={offset}-"
    return headers


def download_asset(
    asset: dict[str, Any],
    target: Path,
    *,
    download_mirror: str,
    retries: int,
    timeout: int,
) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_name(target.name + ".part")
    last_error: Exception | None = None
    expected_size = asset.get("size")
    if not isinstance(expected_size, int) or expected_size <= 0:
        raise SyncError(f"invalid GitHub size for {asset.get('name')}")
    candidates = candidate_download_urls(asset, download_mirror)
    for attempt in range(1, retries + 1):
        for url in candidates:
            try:
                offset = partial.stat().st_size if partial.exists() else 0
                if offset > expected_size:
                    partial.unlink()
                    offset = 0
                host = urllib.parse.urlparse(url).netloc
                print(
                    f"[download {attempt}/{retries} via {host} from {offset}] "
                    f"{asset['name']}",
                    flush=True,
                )
                request = urllib.request.Request(
                    url,
                    headers=asset_request_headers(offset),
                )
                with urllib.request.urlopen(request, timeout=timeout) as response:
                    resumed = offset > 0 and getattr(response, "status", None) == 206
                    mode = "ab" if resumed else "wb"
                    with partial.open(mode) as output:
                        shutil.copyfileobj(response, output, length=CHUNK_SIZE)
                        output.flush()
                        os.fsync(output.fileno())
                actual_size = partial.stat().st_size
                if actual_size < expected_size:
                    raise SyncError(
                        f"incomplete download for {asset['name']}: "
                        f"{actual_size}/{expected_size}",
                    )
                verify_download(partial, asset)
                os.replace(partial, target)
                return
            except (OSError, urllib.error.URLError, SyncError) as exc:
                last_error = exc
                print(f"[download failed via {host}] {exc}", file=sys.stderr)
        if attempt < retries:
            time.sleep(min(2**attempt, 15))
    raise SyncError(f"download failed for {asset['name']}: {last_error}")


def download_asset_bytes(
    asset: dict[str, Any],
    *,
    download_mirror: str,
    retries: int,
    timeout: int,
) -> bytes:
    with tempfile.TemporaryDirectory(prefix="sxy-release-json-") as temporary:
        target = Path(temporary) / asset["name"]
        download_asset(
            asset,
            target,
            download_mirror=download_mirror,
            retries=retries,
            timeout=timeout,
        )
        return target.read_bytes()


def index_assets(release: dict[str, Any]) -> dict[str, dict[str, Any]]:
    indexed: dict[str, dict[str, Any]] = {}
    for asset in release.get("assets", []):
        name = asset.get("name")
        if not isinstance(name, str) or not name:
            raise SyncError("release contains an asset without a name")
        if name in indexed:
            raise SyncError(f"release contains duplicate asset name: {name}")
        expected_sha256(asset)
        indexed[name] = asset
    return indexed


def single_asset(
    assets: dict[str, dict[str, Any]],
    *,
    label: str,
    predicate,
) -> dict[str, Any]:
    matches = [asset for name, asset in assets.items() if predicate(name)]
    if len(matches) != 1:
        names = ", ".join(asset["name"] for asset in matches) or "none"
        raise SyncError(f"{label}: expected exactly one asset, found {names}")
    return matches[0]


def updater_asset_name(url: str, *, tag: str) -> str:
    parsed = urllib.parse.urlparse(url)
    expected_prefix = f"/{REPOSITORY}/releases/download/{tag}/"
    if parsed.scheme != "https" or parsed.netloc != "github.com":
        raise SyncError(f"updater URL is not an official GitHub Release URL: {url}")
    if not parsed.path.startswith(expected_prefix):
        raise SyncError(f"updater URL points outside {REPOSITORY} {tag}: {url}")
    name = urllib.parse.unquote(parsed.path.removeprefix(expected_prefix))
    if not name or "/" in name:
        raise SyncError(f"invalid updater asset URL: {url}")
    return name


def build_plan(
    *,
    tag: str,
    release_assets: dict[str, dict[str, Any]],
    update_data: dict[str, Any],
    public_base: str,
    staging: Path,
) -> tuple[list[PublishFile], dict[str, Any], set[str]]:
    version = tag.removeprefix("v")
    if update_data.get("version") != version:
        raise SyncError(
            f"updater version {update_data.get('version')!r} does not match {tag}",
        )
    platforms = update_data.get("platforms")
    if not isinstance(platforms, dict) or not platforms:
        raise SyncError("updater JSON has no platforms")

    required_platforms = {
        "win64",
        "windows-x86_64",
        "darwin-aarch64",
        "darwin",
        "darwin-intel",
        "darwin-x86_64",
    }
    missing_platforms = sorted(required_platforms - platforms.keys())
    if missing_platforms:
        raise SyncError(
            "updater JSON is missing required platforms: "
            + ", ".join(missing_platforms),
        )

    rewritten = json.loads(json.dumps(update_data))
    needed_assets: set[str] = set()
    updater_targets: dict[str, str] = {}
    public_base = public_base.rstrip("/")
    for platform, value in rewritten["platforms"].items():
        if not isinstance(value, dict):
            raise SyncError(f"invalid updater platform entry: {platform}")
        url = value.get("url")
        signature = value.get("signature")
        if not isinstance(url, str) or not url:
            raise SyncError(f"updater platform has no URL: {platform}")
        if not isinstance(signature, str) or not signature.strip():
            raise SyncError(f"updater platform has no signature: {platform}")
        source_name = updater_asset_name(url, tag=tag)
        if source_name not in release_assets:
            raise SyncError(f"updater references missing Release asset: {source_name}")
        needed_assets.add(source_name)
        versioned_name = updater_targets.setdefault(
            source_name,
            f"{tag}-{source_name}",
        )
        value["url"] = (
            f"{public_base}/updater/"
            f"{urllib.parse.quote(versioned_name, safe='._-')}"
        )

    aliases: list[tuple[str, dict[str, Any]]] = [
        (
            "神仙云.exe",
            single_asset(
                release_assets,
                label="Windows x64 installer",
                predicate=lambda name: name
                == f"Clash.Verge_{version}_x64-setup.exe",
            ),
        ),
        (
            "神仙云-arm64.exe",
            single_asset(
                release_assets,
                label="Windows ARM64 installer",
                predicate=lambda name: name
                == f"Clash.Verge_{version}_arm64-setup.exe",
            ),
        ),
        (
            "神仙云.dmg",
            single_asset(
                release_assets,
                label="macOS Apple Silicon DMG",
                predicate=lambda name: name
                == f"Clash.Verge_{version}_aarch64.dmg",
            ),
        ),
        (
            "神仙云-Intel.dmg",
            single_asset(
                release_assets,
                label="macOS Intel DMG",
                predicate=lambda name: name
                == f"Clash.Verge_{version}_x64.dmg",
            ),
        ),
        (
            "神仙云.deb",
            single_asset(
                release_assets,
                label="Linux amd64 DEB",
                predicate=lambda name: name
                == f"Clash.Verge_{version}_amd64.deb",
            ),
        ),
        (
            "神仙云.rpm",
            single_asset(
                release_assets,
                label="Linux x86_64 RPM",
                predicate=lambda name: name
                == f"Clash.Verge-{version}-1.x86_64.rpm",
            ),
        ),
    ]

    for source_name in list(needed_assets):
        signature_name = source_name + ".sig"
        if signature_name in release_assets:
            needed_assets.add(signature_name)

    publish_files: list[PublishFile] = []
    for source_name, target_name in sorted(updater_targets.items()):
        publish_files.append(
            PublishFile(
                source=staging / "downloads" / source_name,
                relative_target=Path("updater") / target_name,
                source_asset=source_name,
            ),
        )
        signature_name = source_name + ".sig"
        if signature_name in release_assets:
            publish_files.append(
                PublishFile(
                    source=staging / "downloads" / signature_name,
                    relative_target=Path("updater") / (target_name + ".sig"),
                    source_asset=signature_name,
                ),
            )

    for alias_name, asset in aliases:
        needed_assets.add(asset["name"])
        publish_files.append(
            PublishFile(
                source=staging / "downloads" / asset["name"],
                relative_target=Path(alias_name),
                source_asset=asset["name"],
            ),
        )
    return publish_files, rewritten, needed_assets


def current_version(dufs_root: Path) -> str | None:
    update_path = dufs_root / "update.json"
    if not update_path.exists():
        return None
    try:
        value = json.loads(update_path.read_text(encoding="utf-8")).get("version")
    except (OSError, json.JSONDecodeError) as exc:
        raise SyncError(f"cannot read current Dufs update.json: {exc}") from exc
    if not isinstance(value, str):
        raise SyncError("current Dufs update.json has no version")
    version_tuple(value)
    return value


def fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def copy_and_fsync(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    with target.open("rb") as handle:
        os.fsync(handle.fileno())


def publish_atomically(
    *,
    dufs_root: Path,
    backup_root: Path,
    tag: str,
    staging: Path,
    publish_files: list[PublishFile],
    update_data: dict[str, Any],
) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    backup_dir = backup_root / f"shenxianyun-release-sync-{tag}-{timestamp}"
    backup_dir.mkdir(parents=True, exist_ok=False)
    backup_dir.chmod(0o700)

    update_source = staging / "publish" / "update.json"
    update_source.parent.mkdir(parents=True, exist_ok=True)
    update_source.write_text(
        json.dumps(update_data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    with update_source.open("rb") as handle:
        os.fsync(handle.fileno())

    ordered = publish_files + [
        PublishFile(
            source=update_source,
            relative_target=Path("update.json"),
            source_asset="updater/update.json",
        ),
    ]
    overwritten: list[Path] = []
    created: list[Path] = []
    manifest: dict[str, Any] = {
        "repository": REPOSITORY,
        "tag": tag,
        "created_at": datetime.now().astimezone().isoformat(),
        "files": [],
    }

    for item in ordered:
        target = dufs_root / item.relative_target
        backup = backup_dir / item.relative_target
        existed = target.exists()
        if existed:
            copy_and_fsync(target, backup)
        manifest["files"].append(
            {
                "target": str(item.relative_target),
                "source_asset": item.source_asset,
                "previous_file_backed_up": existed,
            },
        )

    manifest_path = backup_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    try:
        for item in ordered:
            target = dufs_root / item.relative_target
            target.parent.mkdir(parents=True, exist_ok=True)
            incoming = target.with_name(f".{target.name}.incoming-{os.getpid()}")
            copy_and_fsync(item.source, incoming)
            existed = target.exists()
            os.replace(incoming, target)
            fsync_directory(target.parent)
            (overwritten if existed else created).append(item.relative_target)
            print(f"[publish] {item.relative_target} <- {item.source_asset}")
    except Exception:
        print("[rollback] publish failed; restoring previous Dufs files", file=sys.stderr)
        for relative in reversed(overwritten):
            target = dufs_root / relative
            backup = backup_dir / relative
            if backup.exists():
                copy_and_fsync(backup, target.with_name(f".{target.name}.rollback"))
                os.replace(target.with_name(f".{target.name}.rollback"), target)
        for relative in reversed(created):
            (dufs_root / relative).unlink(missing_ok=True)
        raise
    return backup_dir


def main() -> int:
    args = parse_args()
    if args.tag and not STABLE_TAG_RE.fullmatch(args.tag):
        raise SyncError("--tag must be a stable vX.Y.Z tag")
    if args.retries < 1 or args.timeout < 1:
        raise SyncError("--retries and --timeout must be positive")

    release_url = (
        f"{API_ROOT}/repos/{REPOSITORY}/releases/tags/{args.tag}"
        if args.tag else f"{API_ROOT}/repos/{REPOSITORY}/releases/latest"
    )
    release = fetch_json(
        release_url,
        timeout=args.timeout,
        retries=args.retries,
    )
    tag = args.tag or str(release.get("tag_name") or "")
    if not STABLE_TAG_RE.fullmatch(tag):
        raise SyncError("GitHub latest is not a stable vX.Y.Z release")
    if release.get("tag_name") != tag:
        raise SyncError("GitHub returned a different release tag")
    if release.get("draft") or release.get("prerelease"):
        raise SyncError("only a published, non-prerelease Release may be synchronized")
    release_assets = index_assets(release)

    updater_release = fetch_json(
        f"{API_ROOT}/repos/{REPOSITORY}/releases/tags/updater",
        timeout=args.timeout,
        retries=args.retries,
    )
    updater_assets = index_assets(updater_release)
    updater_asset = updater_assets.get("update.json")
    if updater_asset is None:
        raise SyncError("updater Release has no update.json asset")
    raw_update = download_asset_bytes(
        updater_asset,
        download_mirror=args.download_mirror,
        retries=args.retries,
        timeout=args.timeout,
    )
    try:
        update_data = json.loads(raw_update)
    except json.JSONDecodeError as exc:
        raise SyncError(f"updater update.json is invalid: {exc}") from exc

    current = current_version(args.dufs_root)
    if (
        current is not None
        and version_tuple(current) > version_tuple(tag)
        and not args.allow_downgrade
    ):
        raise SyncError(
            f"Dufs is already newer ({current}); use --allow-downgrade to override",
        )

    staging_parent = args.work_root
    staging = staging_parent / f"{tag}-{os.getpid()}"
    publish_files, rewritten_update, needed_assets = build_plan(
        tag=tag,
        release_assets=release_assets,
        update_data=update_data,
        public_base=args.public_base,
        staging=staging,
    )

    print(f"Repository: {REPOSITORY}")
    print(f"Release: {tag}")
    print(f"Current Dufs version: {current or 'none'}")
    print(f"Dufs root: {args.dufs_root}")
    print("Assets:")
    for name in sorted(needed_assets):
        asset = release_assets[name]
        print(f"  - {name} ({asset['size']} bytes, {asset['digest']})")
    print("Targets (update.json is always published last):")
    for item in publish_files:
        print(f"  - {item.relative_target} <- {item.source_asset}")
    if args.dry_run:
        print("DRY RUN: metadata validated; no large assets downloaded or files changed.")
        return 0

    args.dufs_root.mkdir(parents=True, exist_ok=True)
    args.work_root.mkdir(parents=True, exist_ok=True)
    args.work_root.chmod(0o700)
    staging.mkdir(parents=True, exist_ok=False)
    staging.chmod(0o700)
    lock_path = args.work_root / "sync.lock"
    try:
        with lock_path.open("a+", encoding="utf-8") as lock:
            try:
                fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise SyncError("another Dufs release synchronization is running") from exc

            for name in sorted(needed_assets):
                download_asset(
                    release_assets[name],
                    staging / "downloads" / name,
                    download_mirror=args.download_mirror,
                    retries=args.retries,
                    timeout=args.timeout,
                )
            backup_dir = publish_atomically(
                dufs_root=args.dufs_root,
                backup_root=args.backup_root,
                tag=tag,
                staging=staging,
                publish_files=publish_files,
                update_data=rewritten_update,
            )
            print(f"SUCCESS: {tag} published; backup: {backup_dir}")
    finally:
        shutil.rmtree(staging, ignore_errors=True)
        try:
            staging_parent.rmdir()
        except OSError:
            pass
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SyncError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
