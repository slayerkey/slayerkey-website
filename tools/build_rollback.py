"""Package only the verified pre-incident homepage runtime with current delivery safeguards.

No checkout, deploy or live cache mutation. Never accepts an arbitrary rollback revision.
"""
import argparse
import hashlib
from pathlib import Path
import shutil
import re
import subprocess
from build_deploy import build

PARENT = '0ff5f81f6337650e47b3d1a0e18e38117466f2e7'
PREFIX = 'wordpress/slayerkey-website/'
parser=argparse.ArgumentParser()
parser.add_argument('--output',type=Path,default=Path('build/rollback'))
output=parser.parse_args().output
source = output/'source'
if source.exists():
    raise SystemExit('Use a clean, separate rollback build directory')
shutil.copytree(PREFIX, source)
for relative in ('assets/js/tracking.js', 'previews/dojo-v3/dojo.js',
                 'previews/dojo-v3/dojo.css', 'previews/dojo-v3/index.html'):
    data = subprocess.check_output(['git', 'show', PARENT + ':' + PREFIX + relative])
    (source / relative).write_bytes(data)
assert hashlib.sha256((source / 'assets/js/tracking.js').read_bytes()).hexdigest() == \
    'e9017b212800d49b303644360eb00cd8bcc75f015a382e06847af0ee313c3f78'
assert b'updateLeadMagnetCopy' not in (source / 'assets/js/tracking.js').read_bytes()
# The removed PHP attribution observer used to repair these legacy literals.
# Derive them once from authored pricing instead; never restore that observer.
script=source/'previews/dojo-v3/dojo.js'
code=script.read_text(encoding='utf-8')
for plan in ('monthly','annual'):
    code,count=re.subn(r"var " + plan + r"Checkout = '[^']+';",
        "var " + plan + "Checkout = document.querySelector('[data-sk-location=\"pricing_" + plan + "\"]').href;",code)
    assert count==1, 'Pinned rollback initializer changed'
script.write_text(code,encoding='utf-8')
build(source, output/'plugin', PARENT)
print('Prepared pre-incident runtime with fingerprinted assets; release approval and rollback verification remain required.')
