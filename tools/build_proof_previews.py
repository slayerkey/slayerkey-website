"""Build faithful responsive copies; keep original WordPress PNGs for the lightbox."""
import hashlib
import io
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "wordpress/slayerkey-website/previews/dojo-v3"
html = (PAGE / "index.html").read_text(encoding="utf-8")
out = PAGE / "assets/proof"
out.mkdir(parents=True, exist_ok=True)
manifest = []
for url in dict.fromkeys(re.findall(r'data-proof-src="([^"]+)"', html)):
    cached = ROOT / "artifacts/proof-originals" / url.rsplit("/", 1)[-1]
    if cached.exists():
        data = cached.read_bytes()
    else:
        request = Request(url, headers={"User-Agent": "Mozilla/5.0 Slayerkey asset build"})
        with urlopen(request, timeout=30) as response:
            data = response.read()
    source = Image.open(io.BytesIO(data)).convert("RGB")
    name = url.rsplit("/", 1)[-1].removesuffix(".png")
    variants = []
    # 600w covers Lighthouse's standard mobile DPR; 960w and 1080w cover the
    # tested 390px/430px viewports at high DPR without forcing a 1200px download.
    for width in sorted({min(w, source.width) for w in (400, 600, 800, 960, 1080, 1200)}):
        target = source.resize((width, round(source.height * width / source.width)), Image.Resampling.LANCZOS)
        filename = f"{name}-{width}.webp"
        target.save(out / filename, "WEBP", quality=90, method=6)
        variants.append({"file": filename, "width": width, "bytes": (out / filename).stat().st_size})
    sizes = "(max-width:700px) calc(100vw - 70px), (max-width:1120px) 90vw, 1120px" if name == "lazy-site" else "(max-width:700px) calc(100vw - 70px), 360px"
    attrs = (f'src="assets/proof/{variants[1 if len(variants)>1 else 0]["file"]}" '
             f'srcset="' + ", ".join(f'assets/proof/{v["file"]} {v["width"]}w' for v in variants) +
             f'" sizes="{sizes}" width="{source.width}" height="{source.height}"')
    def update_image(match):
        tag = match[0]
        if not re.search(r'\ssrc="(?:' + re.escape(url) + '|assets/proof/' + re.escape(name) + r'-\d+\.webp)"', tag):
            return tag
        tag = re.sub(r'\s(?:src|srcset|sizes|width|height)="[^"]*"', '', tag)
        return tag[:-1] + ' ' + attrs + '>'
    # Match image attributes, never the lightbox's data-proof-src attribute.
    html = re.sub(r'<img\b[^>]*>', update_image, html)
    manifest.append({"original": url, "original_sha256": hashlib.sha256(data).hexdigest(),
                     "original_bytes": len(data), "width": source.width, "height": source.height, "variants": variants})
# This media is below the hero. Native lazy loading works without JavaScript.
html = html.replace('loading="eager" decoding="async"', 'loading="lazy" decoding="async"')
(PAGE / "index.html").write_text(html, encoding="utf-8")
(out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(json.dumps(manifest, indent=2))
