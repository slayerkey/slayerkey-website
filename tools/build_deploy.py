"""Build a release without modifying authored source. Run from the repository root."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess


def build(source, output, commit):
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        raise ValueError("A full commit SHA is required")
    if output.exists():
        raise ValueError("Output must be a new directory")
    shutil.copytree(source, output)
    php_path = output / "slayerkey-website.php"
    php = php_path.read_text(encoding="utf-8")
    manifest = {"commit": commit}
    for key, relative in (
        ("dojo_js", "previews/dojo-v3/dojo.js"),
        ("dojo_css", "previews/dojo-v3/dojo.css"),
        ("tracking_js", "assets/js/tracking.js"),
    ):
        asset = output / relative
        digest = hashlib.sha256(asset.read_bytes()).hexdigest()
        fingerprinted = asset.with_name(f"{asset.stem}.{digest[:16]}{asset.suffix}")
        shutil.copyfile(asset, fingerprinted)
        target = fingerprinted.relative_to(output).as_posix()
        pattern = (r"(define\( 'SLAYERKEY_TRACKING_ASSET', )'" if key == "tracking_js" else
                   r"('" + ("style" if key == "dojo_css" else "script") + r"'\s*=>\s*)'")
        php, replaced = re.subn(pattern + re.escape(relative) + "'", lambda m: m[1] + "'" + target + "'", php)
        if replaced != 1:
            raise ValueError(f"Expected one authored PHP enqueue reference: {relative}")
        manifest[key] = target
        manifest[key + "_sha256"] = digest
    php, count = re.subn(
        r"define\( 'SLAYERKEY_WEBSITE_VERSION', '([^']+)' \);",
        lambda m: f"define( 'SLAYERKEY_WEBSITE_VERSION', '{m[1]}.{commit[:8]}' );",
        php,
    )
    if count != 1:
        raise ValueError("Plugin version stamp missing")
    php_path.write_text(php, encoding="utf-8")
    for suffix in ("", "." + commit[:8]):
        (output / f"DEPLOYED_COMMIT{suffix}.txt").write_text(commit + "\n", encoding="utf-8")
        (output / f"DEPLOYED_ASSETS{suffix}.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    # Includes proof variants and unchanged plugin resources, not just JS/CSS.
    files = {p.relative_to(output).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
             for p in sorted(output.rglob("*")) if p.is_file()}
    (output.parent / "file-hashes.json").write_text(json.dumps(files, indent=2) + "\n", encoding="utf-8")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("wordpress/slayerkey-website"))
    parser.add_argument("--output", type=Path, default=Path("build/plugin"))
    parser.add_argument("--commit", default=None)
    args = parser.parse_args()
    commit = args.commit or subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    print(json.dumps(build(args.source, args.output, commit), indent=2))
