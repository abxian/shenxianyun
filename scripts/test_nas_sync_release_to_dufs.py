#!/usr/bin/env python3

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("nas-sync-release-to-dufs.py")
SPEC = importlib.util.spec_from_file_location("nas_sync_release_to_dufs", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
SYNC = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = SYNC
SPEC.loader.exec_module(SYNC)


def fake_asset(name: str) -> dict[str, object]:
    return {
        "name": name,
        "size": 100,
        "digest": "sha256:" + "a" * 64,
        "browser_download_url": (
            f"https://github.com/abxian/shenxianyun/releases/download/v1.2.3/{name}"
        ),
    }


class BuildPlanTests(unittest.TestCase):
    def test_tag_is_optional_for_latest_stable_release(self) -> None:
        previous = sys.argv
        try:
            sys.argv = [str(SCRIPT_PATH)]
            self.assertIsNone(SYNC.parse_args().tag)
        finally:
            sys.argv = previous

    def setUp(self) -> None:
        names = [
            "Clash.Verge_1.2.3_x64-setup.exe",
            "Clash.Verge_1.2.3_x64-setup.exe.sig",
            "Clash.Verge_1.2.3_arm64-setup.exe",
            "Clash.Verge_1.2.3_aarch64.dmg",
            "Clash.Verge_1.2.3_x64.dmg",
            "Clash.Verge_1.2.3_amd64.deb",
            "Clash.Verge-1.2.3-1.x86_64.rpm",
            "Clash.Verge_aarch64.app.tar.gz",
            "Clash.Verge_aarch64.app.tar.gz.sig",
            "Clash.Verge.app.tar.gz",
            "Clash.Verge.app.tar.gz.sig",
        ]
        self.assets = {name: fake_asset(name) for name in names}
        base = "https://github.com/abxian/shenxianyun/releases/download/v1.2.3"
        self.update_data = {
            "version": "1.2.3",
            "platforms": {
                "win64": {
                    "url": f"{base}/Clash.Verge_1.2.3_x64-setup.exe",
                    "signature": "win-signature",
                },
                "windows-x86_64": {
                    "url": f"{base}/Clash.Verge_1.2.3_x64-setup.exe",
                    "signature": "win-signature",
                },
                "darwin-aarch64": {
                    "url": f"{base}/Clash.Verge_aarch64.app.tar.gz",
                    "signature": "arm-signature",
                },
                "darwin": {
                    "url": f"{base}/Clash.Verge.app.tar.gz",
                    "signature": "intel-signature",
                },
                "darwin-intel": {
                    "url": f"{base}/Clash.Verge.app.tar.gz",
                    "signature": "intel-signature",
                },
                "darwin-x86_64": {
                    "url": f"{base}/Clash.Verge.app.tar.gz",
                    "signature": "intel-signature",
                },
            },
        }

    def test_build_plan_versions_updater_files_and_includes_aliases(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            publish, rewritten, needed = SYNC.build_plan(
                tag="v1.2.3",
                release_assets=self.assets,
                update_data=self.update_data,
                public_base="https://downloads.example/sxy/",
                staging=Path(temporary),
            )

        targets = {str(item.relative_target) for item in publish}
        self.assertIn("神仙云.exe", targets)
        self.assertIn("神仙云-arm64.exe", targets)
        self.assertIn("神仙云.dmg", targets)
        self.assertIn("神仙云-Intel.dmg", targets)
        self.assertIn("神仙云.deb", targets)
        self.assertIn("神仙云.rpm", targets)
        self.assertIn(
            "updater/v1.2.3-Clash.Verge.app.tar.gz",
            targets,
        )
        self.assertIn("Clash.Verge.app.tar.gz.sig", needed)
        self.assertEqual(
            rewritten["platforms"]["darwin-intel"]["url"],
            "https://downloads.example/sxy/updater/"
            "v1.2.3-Clash.Verge.app.tar.gz",
        )

    def test_build_plan_rejects_missing_intel_platforms(self) -> None:
        update_data = json.loads(json.dumps(self.update_data))
        del update_data["platforms"]["darwin-intel"]
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaisesRegex(SYNC.SyncError, "darwin-intel"):
                SYNC.build_plan(
                    tag="v1.2.3",
                    release_assets=self.assets,
                    update_data=update_data,
                    public_base="https://downloads.example/sxy",
                    staging=Path(temporary),
                )

    def test_download_mirror_is_tried_before_direct_github(self) -> None:
        asset = fake_asset("Clash.Verge.app.tar.gz")
        urls = SYNC.candidate_download_urls(asset, "https://mirror.example/")
        self.assertEqual(
            urls,
            [
                "https://mirror.example/"
                "https://github.com/abxian/shenxianyun/releases/download/"
                "v1.2.3/Clash.Verge.app.tar.gz",
                asset["browser_download_url"],
            ],
        )


class AtomicPublishTests(unittest.TestCase):
    def test_success_backs_up_previous_files(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            dufs = root / "dufs"
            backups = root / "backups"
            staging = dufs / ".release-sync-staging" / "test"
            dufs.mkdir(parents=True)
            staging.mkdir(parents=True)
            (dufs / "神仙云.exe").write_bytes(b"old-installer")
            (dufs / "update.json").write_text(
                '{"version":"1.2.2"}',
                encoding="utf-8",
            )
            source = staging / "new-installer"
            source.write_bytes(b"new-installer")

            backup = SYNC.publish_atomically(
                dufs_root=dufs,
                backup_root=backups,
                tag="v1.2.3-success",
                staging=staging,
                publish_files=[
                    SYNC.PublishFile(source, Path("神仙云.exe"), "installer.exe"),
                ],
                update_data={"version": "1.2.3", "platforms": {}},
            )

            self.assertEqual((dufs / "神仙云.exe").read_bytes(), b"new-installer")
            self.assertEqual(
                json.loads((dufs / "update.json").read_text())["version"],
                "1.2.3",
            )
            self.assertEqual(
                (backup / "神仙云.exe").read_bytes(),
                b"old-installer",
            )

    def test_failure_rolls_back_files_and_update_json(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            dufs = root / "dufs"
            backups = root / "backups"
            staging = dufs / ".release-sync-staging" / "test"
            dufs.mkdir(parents=True)
            staging.mkdir(parents=True)
            (dufs / "first.bin").write_bytes(b"old-first")
            (dufs / "second.bin").write_bytes(b"old-second")
            (dufs / "update.json").write_text(
                '{"version":"1.2.2"}',
                encoding="utf-8",
            )
            first = staging / "first.bin"
            first.write_bytes(b"new-first")
            missing = staging / "missing.bin"

            with self.assertRaises(FileNotFoundError):
                SYNC.publish_atomically(
                    dufs_root=dufs,
                    backup_root=backups,
                    tag="v1.2.3-rollback",
                    staging=staging,
                    publish_files=[
                        SYNC.PublishFile(first, Path("first.bin"), "first.bin"),
                        SYNC.PublishFile(missing, Path("second.bin"), "second.bin"),
                    ],
                    update_data={"version": "1.2.3", "platforms": {}},
                )

            self.assertEqual((dufs / "first.bin").read_bytes(), b"old-first")
            self.assertEqual((dufs / "second.bin").read_bytes(), b"old-second")
            self.assertEqual(
                json.loads((dufs / "update.json").read_text())["version"],
                "1.2.2",
            )


if __name__ == "__main__":
    unittest.main()
