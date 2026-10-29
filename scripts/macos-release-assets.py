#!/usr/bin/env python3
"""Mac release compatibility, Codex241/261, 2026-10-29.

Python3 only. stage copies one DMG, updater tar and signature from --bundle-root
to --out with ASCII release names; bytes/signatures are never rewritten. select
reads --metadata GitHub release JSON and chooses the matching-version ASCII
assets, with pre-2.5.47 updater-name fallbacks. No network/install/config writes.
Use --version X.Y.Z --arch x64|aarch64. Output is JSON; stage writes only --out.
Conflicting outputs or missing/ambiguous inputs fail. Rollback remove only the
new staging directory; published assets require the release rollback procedure.
"""
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path


def names(version, arch):
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:-rc\.\d+)?", version):
        raise ValueError("invalid release version")
    if arch not in ("x64", "aarch64"):
        raise ValueError("unsupported Mac architecture")
    return {
        "DMG": f"Clash.Verge_{version}_{arch}.dmg",
        "UPDATER": f"Clash.Verge_{version}_{arch}.app.tar.gz",
        "SIG": f"Clash.Verge_{version}_{arch}.app.tar.gz.sig",
    }


def select(metadata, version, arch):
    canonical = names(version, arch)
    if metadata.get("tag_name") != "v" + version:
        raise ValueError("release tag does not match version")
    assets = [x["name"] for x in metadata["assets"]]
    if len(assets) != len(set(assets)):
        raise ValueError("duplicate release assets")
    if canonical["DMG"] not in assets:
        raise ValueError("matching-version DMG is missing")
    candidates = [canonical["UPDATER"], f"Clash.Verge_{arch}.app.tar.gz"]
    if arch == "x64":
        candidates.append("Clash.Verge.app.tar.gz")
    for updater in candidates:
        if updater in assets and updater + ".sig" in assets:
            return {"DMG": canonical["DMG"], "UPDATER": updater, "SIG": updater + ".sig"}
    raise ValueError("matching-architecture updater and signature are missing")


def stage(bundle_root, out, version, arch):
    canonical = names(version, arch)
    files = {}
    for key, directory, suffix in [("DMG", "dmg", ".dmg"), ("UPDATER", "macos", ".app.tar.gz")]:
        matches = list((bundle_root / directory).glob("*" + suffix))
        if len(matches) != 1:
            raise ValueError("expected exactly one " + key)
        files[key] = matches[0]
    files["SIG"] = Path(str(files["UPDATER"]) + ".sig")
    # Validate the full set before creating output; never pair an unrelated sig.
    for path in files.values():
        if not path.is_file() or not path.stat().st_size:
            raise ValueError("missing or empty bundle/signature")
    for key, path in files.items():
        target = out / canonical[key]
        if target.exists() and target.read_bytes() != path.read_bytes():
            raise ValueError("refusing to overwrite conflicting staging asset")
    out.mkdir(parents=True, exist_ok=True)
    result = {}
    for key, path in files.items():
        target = out / canonical[key]
        shutil.copy2(path, target)
        if hashlib.sha256(path.read_bytes()).digest() != hashlib.sha256(target.read_bytes()).digest():
            raise ValueError("copy digest mismatch")
        result[key] = str(target.resolve())
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["select", "stage"])
    parser.add_argument("--version", required=True)
    parser.add_argument("--arch", required=True, choices=["x64", "aarch64"])
    parser.add_argument("--metadata", type=Path)
    parser.add_argument("--bundle-root", type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    if args.mode == "select":
        if not args.metadata:
            parser.error("select requires --metadata")
        result = select(json.loads(args.metadata.read_text()), args.version, args.arch)
    else:
        if not args.bundle_root or not args.out:
            parser.error("stage requires --bundle-root and --out")
        result = stage(args.bundle_root, args.out, args.version, args.arch)
    print(json.dumps(result))
