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


export function verifyCoachingHTML(html) {
  const cal = 'https://cal.com/slayerkey/perf-accelerator-application';
  assert.ok(html.includes('Slayerkey Performance Accelerator'), 'Coaching offer name mismatch');
  assert.ok(html.includes('Three months of personalized coaching'), 'Coaching duration copy mismatch');
  assert.ok(html.includes('8 private 1:1 coaching sessions'), 'Coaching session count mismatch');
  assert.ok(html.includes("Slayerkey's Improvement System — $249 value, included at no additional cost"), 'Coaching included-value mismatch');
  assert.ok(html.includes('Diagnose') && html.includes('Prioritize') && html.includes('Implement') && html.includes('Adjust'),
    'Coaching process copy mismatch');
  assert.ok(html.includes('Ready to Stop Guessing What to Fix Next?'), 'Coaching final CTA heading mismatch');
  assert.ok((html.match(/>Apply for Accelerator<\/a>/g) || []).length >= 7, 'Coaching application CTA label mismatch');
  assert.equal((html.match(/data-sk-cta="performance_accelerator_apply"/g) || []).length, 9,
    'Performance Accelerator CTA count mismatch');
  assert.equal(html.split('href="' + cal + '"').length - 1, 9,
    'Performance Accelerator destination count mismatch');
  assert.doesNotMatch(html, /buy\.stripe\.com/, 'Coaching page must not expose direct Stripe checkout');
  assert.doesNotMatch(html, /Private Mentorship|Performance Mentorship|Start Your Mentorship|Apply for Mentorship|\$1,200|\$325|four-month|4 months/i,
    'Stale coaching offer copy remains');
  assert.match(html, /id="showcase"/, 'Student result proof must remain');
  assert.match(html, /id="proof-wall"/, 'Discord proof wall must remain');
  assert.match(html, /id="reviews"/, 'Reviews section must remain');
  assert.match(html, /id="about"/, 'About section must remain');
  assert.match(html, /id="faq"/, 'FAQ section must remain');
}
