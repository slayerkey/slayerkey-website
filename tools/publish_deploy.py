"""Publish a verified build over SFTP. No remote deletes; PHP references publish last."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser()
parser.add_argument('--artifact', type=Path, default=Path('build/plugin'))
artifact = parser.parse_args().artifact.resolve()
manifest = json.loads((artifact / "DEPLOYED_ASSETS.json").read_text())
hashes = json.loads((artifact.parent / 'file-hashes.json').read_text())
sha = manifest["commit"]
host, user, password, port = (os.environ[k] for k in ("EASYWP_HOST", "EASYWP_USER", "EASYWP_PASSWORD", "EASYWP_PORT"))


def quote(value):
    # lftp has its own command parser; never interpret path/environment text as commands.
    if any(c in str(value) for c in '\n\r"\\'):
        raise ValueError("Unsupported lftp argument")
    return '"' + str(value) + '"'


def sftp(commands, check=True):
    result = subprocess.run(
        ["lftp", "-u", user + "," + password, "-p", port, "sftp://" + host],
        input="set sftp:auto-confirm yes\nset net:max-retries 2\nset net:timeout 20\nset cmd:fail-exit yes\n" +
              commands + "\nbye\n", text=True, check=False,
    )
    # CalledProcessError would include the credential-bearing command arguments.
    if check and result.returncode:
        raise SystemExit("SFTP operation failed; references may not have been published")
    return result


remote = None
for candidate in ("/wptbox/wp-content/plugins", "wp-content/plugins"):
    if sftp("cls -d " + quote(candidate), check=False).returncode == 0:
        remote = candidate + "/slayerkey-website"
        break
if remote is None:
    raise SystemExit("Cannot find EasyWP plugin directory")

staged = remote + "/.staged-" + sha
sftp("mirror --reverse --verbose " + quote(artifact.as_posix()) + " " + quote(staged))
with tempfile.TemporaryDirectory(prefix="slayerkey-verify-") as temp:
    sftp("mirror " + quote(staged) + " " + quote(Path(temp).as_posix()))
    for relative, expected in hashes.items():
        actual = hashlib.sha256((Path(temp) / relative).read_bytes()).hexdigest()
        if actual != expected:
            raise SystemExit("Staged SFTP hash mismatch: " + relative)

# Assets first; do not remove any preceding release's hashed assets.
sftp("mirror --reverse --verbose --exclude-glob=*.php --exclude-glob=index.html "
     "--exclude-glob=DEPLOYED_* " + quote(artifact.as_posix()) + " " + quote(remote))

public_base = "https://slayerkey.com/wp-content/plugins/slayerkey-website/"
immutable = [manifest[k] for k in ("dojo_js", "dojo_css", "tracking_js")]
immutable += [p for p in hashes if "/assets/proof/" in p and p.endswith(".webp")]
for relative in immutable:
    for attempt in range(6):
        try:
            request = Request(public_base + relative, headers={"User-Agent": "Slayerkey-Release-Verification"})
            with urlopen(request, timeout=20) as response:
                actual = hashlib.sha256(response.read()).hexdigest()
            if actual == hashes[relative]:
                break
        except Exception:
            pass
        if attempt == 5:
            raise SystemExit("Public asset hash mismatch before PHP publish: " + relative)
        time.sleep(5)

# HTML is backward compatible with the previous runtime. Publish it before new PHP.
critical = [p for p in hashes if p.endswith("/index.html")]
critical += [p for p in hashes if p.endswith(".php") and p != "slayerkey-website.php"]
critical += ["slayerkey-website.php"]
critical += [p for p in hashes if p.startswith("DEPLOYED_")]
commands = ["put " + quote((artifact / p).as_posix()) + " -o " + quote(remote + "/" + p) for p in critical]
sftp("\n".join(commands))
with tempfile.TemporaryDirectory(prefix="slayerkey-published-") as temp:
    for index, relative in enumerate(critical):
        target = Path(temp) / str(index)
        sftp("get " + quote(remote + "/" + relative) + " -o " + quote(target.as_posix()))
        if hashlib.sha256(target.read_bytes()).hexdigest() != hashes[relative]:
            raise SystemExit("Published SFTP hash mismatch: " + relative)
print("Published", sha, "; ordinary-URL browser verification is still required.")
