import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { verifyHTML, verifyBytes } from '../tools/release-contract.mjs';
const python=process.platform==='win32'?'python':'python3';
const hash=data=>createHash('sha256').update(data).digest('hex');

test('a healthy endpoint cannot disguise stale ordinary HTML or tracking bytes',()=>{
  const commit='a'.repeat(40);
  const manifest={commit,dojo_js:'dojo.123.js',dojo_css:'dojo.456.css',tracking_js:'tracking.789.js'};
  const html='<!-- Slayerkey Website 1.0.aaaaaaaa active --> dojo.123.js dojo.456.css tracking.789.js '+
    '<iframe id="dojoVideo" src="https://www.youtube.com/embed/H7hYaHnT6ko"></iframe>';
  verifyHTML(html,manifest,commit);
  assert.throws(()=>verifyHTML(html.replace('aaaaaaaa','601a2c09'),manifest,commit));
  assert.throws(()=>verifyHTML(html.replace('tracking.789.js','tracking.js'),manifest,commit));
  assert.throws(()=>verifyHTML(html,manifest,commit,true),'Rollback cannot bypass verification for an arbitrary revision');
  assert.throws(()=>verifyBytes(Buffer.from('cached regression'),hash('expected repair'),'tracking_js'));
  assert.equal(verifyBytes(Buffer.from('expected repair'),hash('expected repair'),'tracking_js'),hash('expected repair'));
});
test('release fingerprints actual bytes, rewrites enqueues, and leaves source untouched',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'slayerkey-build-test-'));
  const output=path.join(dir,'plugin'), sha='a'.repeat(40);
  const before=hash(fs.readFileSync('wordpress/slayerkey-website/slayerkey-website.php'));
  execFileSync(python,['tools/build_deploy.py','--output',output,'--commit',sha]);
  const manifest=JSON.parse(fs.readFileSync(path.join(output,'DEPLOYED_ASSETS.json')));
  const php=fs.readFileSync(path.join(output,'slayerkey-website.php'),'utf8');
  for(const key of ['dojo_js','dojo_css','tracking_js']){
    const digest=hash(fs.readFileSync(path.join(output,manifest[key])));
    assert.equal(digest,manifest[key+'_sha256']);
    assert.ok(manifest[key].includes('.'+digest.slice(0,16)+'.'));
    assert.ok(php.includes(manifest[key]));
  }
  const all=JSON.parse(fs.readFileSync(path.join(dir,'file-hashes.json')));
  for(const [name,digest] of Object.entries(all)) assert.equal(hash(fs.readFileSync(path.join(output,name))),digest);
  assert.equal(hash(fs.readFileSync('wordpress/slayerkey-website/slayerkey-website.php')),before);
  assert.equal(manifest.commit,sha);
  assert.throws(()=>execFileSync(python,['tools/build_deploy.py','--output',output,'--commit',sha],{stdio:'pipe'}));
});
test('runtime cannot reintroduce document mutation observers or animation-frame loops',()=>{
  for(const file of ['assets/js/tracking.js','previews/dojo-v3/dojo.js']){
    const code=fs.readFileSync('wordpress/slayerkey-website/'+file,'utf8');
    assert.doesNotMatch(code,/MutationObserver|requestAnimationFrame|stopImmediatePropagation/);
  }
  assert.doesNotMatch(fs.readFileSync('wordpress/slayerkey-website/slayerkey-website.php','utf8'),/MutationObserver/);
});
test('external watchdog catches the exact historical mutation loop',()=>{
  const output=execFileSync(process.execPath,['tools/negative-control.mjs'],{encoding:'utf8',timeout:20000});
  const result=JSON.parse(output.trim());
  assert.ok(result.records>1000,'Historical script must trigger a mutation storm');
  assert.equal(result.timerFired,false,'Mutation loop must starve its proposed disconnect timer');
});
