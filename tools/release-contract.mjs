import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const assetKeys = ['dojo_js', 'dojo_css', 'tracking_js'];
export function verifyHTML(html, manifest, commit, rollback=false) {
  assert.equal(manifest.commit, commit, 'Manifest release mismatch');
  assert.ok(html.includes('Slayerkey Website ') && html.includes('.' + commit.slice(0, 8) + ' active'),
    'Cached HTML release marker mismatch');
  for (const key of assetKeys) assert.ok(html.includes(manifest[key]), 'HTML asset reference mismatch: ' + key);
  if (rollback) assert.equal(commit,'0ff5f81f6337650e47b3d1a0e18e38117466f2e7','Only the pinned pre-regression runtime is eligible');
  else {
    assert.match(html, /<a[^>]*id="dojoVideoFacade"[^>]*href="https:\/\/www.youtube.com\/watch\?v=H7hYaHnT6ko"/);
    assert.match(html, /data-embed-src="https:\/\/www.youtube.com\/embed\/H7hYaHnT6ko\?autoplay=1&amp;mute=0/);
    assert.doesNotMatch(html, /<iframe[^>]*id="dojoVideo"/,'YouTube iframe must not load before interaction');
  }
}
export function verifyBytes(body, expected, label) {
  const actual = createHash('sha256').update(body).digest('hex');
  assert.equal(actual, expected, 'Browser bytes mismatch: ' + label);
  return actual;
}
