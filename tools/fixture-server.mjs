// Browser fixture with the actual WPCode snapshots, authored page and plugin assets.
// It deliberately avoids a database and has no write endpoints.
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.resolve(root, process.env.FIXTURE_PLUGIN || 'wordpress/slayerkey-website');
const base = '/wp-content/plugins/slayerkey-website/';
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
export function homepage() {
  const header = read('docs/wordpress/wpcode/header.html');
  const body = read('docs/wordpress/wpcode/body.html');
  const footer = read('docs/wordpress/wpcode/footer.html');
  const html = fs.readFileSync(path.join(plugin,'previews/dojo-v3/index.html'),'utf8')
    .replaceAll('src="assets/', 'src="' + base + 'previews/dojo-v3/assets/')
    .replaceAll('srcset="assets/', 'srcset="' + base + 'previews/dojo-v3/assets/')
    .replaceAll(', assets/', ', ' + base + 'previews/dojo-v3/assets/');
  // Match WordPress ordering: WPCode body/footer precede enqueued footer scripts.
  return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
    header + '<link rel="stylesheet" href="' + base + 'previews/dojo-v3/dojo.css"></head><body>' +
    body + html + footer + '<script src="' + base + 'assets/js/tracking.js"></script>' +
    '<script src="' + base + 'previews/dojo-v3/dojo.js"></script></body></html>';
}
export function startServer(port = 4173) {
  const certDir = path.join(root, 'artifacts/tls');
  fs.mkdirSync(certDir, {recursive:true});
  const key = path.join(certDir, 'key.pem'), cert = path.join(certDir, 'cert.pem');
  const openssl = process.platform === 'win32' ? 'C:/Program Files/Git/mingw64/bin/openssl.exe' : 'openssl';
  execFileSync(openssl, ['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,
    '-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1,DNS:localhost'], {stdio:'ignore'});
  const server = https.createServer({key:fs.readFileSync(key),cert:fs.readFileSync(cert)}, (req, res) => {
    const url = new URL(req.url, 'https://localhost');
    if (url.pathname === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(homepage()); return;
    }
    if (!url.pathname.startsWith(base)) { res.writeHead(404).end(); return; }
    const file = path.resolve(plugin, '.' + url.pathname.slice(base.length - 1));
    if (!file.startsWith(plugin + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end(); return;
    }
    const types = {'.js':'text/javascript', '.css':'text/css', '.webp':'image/webp', '.json':'application/json'};
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=600');
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await startServer(Number(process.env.PORT || 4173));
  console.log('Fixture listening on 127.0.0.1:4173');
}

