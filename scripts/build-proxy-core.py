#!/usr/bin/env python3
"""Build Windows accounting core from pinned upstream + audited local patch.
Python3/git/Go required; fail closed, never reuse an unmarked stock binary.
Usage: python scripts/build-proxy-core.py TARGET [--test-only]
No deployment/network settings; downloads public upstream/dependencies, writes
node_modules/.verge/proxy-core and Windows sidecars + SHA manifest. Remove those
build outputs to rebuild. Updating upstream requires patch/test/live fixture QA.
"""
import hashlib,json,os,subprocess,sys,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SHA='3f27ef39f8c96bbfbc8b0b9bb10f5c9ef60149d8'
target=sys.argv[1];arch={'x86_64-pc-windows-msvc':'amd64','aarch64-pc-windows-msvc':'arm64'}.get(target)
if arch is None:raise SystemExit('unsupported accounting target')
patch=ROOT/'scripts/mihomo/proxy-traffic.patch';digest=hashlib.sha256(patch.read_bytes()).hexdigest()
work=ROOT/'node_modules/.verge/proxy-core'/digest[:16];work.mkdir(parents=True,exist_ok=True)
def run(args,**kw):return subprocess.check_call(args,cwd=work,**kw)
if not (work/'.git').exists():
 run(['git','init']);run(['git','remote','add','origin','https://github.com/MetaCubeX/mihomo.git']);run(['git','fetch','--depth','1','origin',SHA]);run(['git','checkout','--detach','FETCH_HEAD']);assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=work,text=True).strip()==SHA
 run(['git','apply','--check',str(patch)]);run(['git','apply',str(patch)])
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=work,text=True).strip()==SHA
run(['git','apply','--reverse','--check',str(patch)])
# Real native Go tests include classification, upload/download, closed trackers,
# initial peek bytes, internal dialer exclusion, and resets.
run(['go','test','-tags','with_gvisor','./tunnel/statistic','./tunnel','-run','TestProxyAccounting','-count=1'])
if '--test-only' in sys.argv:raise SystemExit(0)
env=os.environ.copy();env.update(GOOS='windows',GOARCH=arch,CGO_ENABLED='0')
out=work/('proxy-'+arch+'.exe')
run(['go','build','-trimpath','-tags','with_gvisor','-ldflags','-s -w -X github.com/metacubex/mihomo/constant.Version=sxy-proxy270-'+SHA[:8],'-o',str(out),'.'],env=env)
sidecar=ROOT/'src-tauri/sidecar';sidecar.mkdir(exist_ok=True)
for name in ['verge-mihomo','verge-mihomo-alpha']:shutil.copyfile(out,sidecar/(name+'-'+target+'.exe'))
(sidecar/('proxy-accounting-'+target+'.json')).write_text(json.dumps({'upstream':SHA,'patch_sha256':digest,'binary_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'target':target},indent=2))
