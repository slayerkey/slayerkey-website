"""Exercise the publisher against fake SFTP/HTTP boundaries, never production."""
import contextlib
import io
import json
from pathlib import Path
import runpy
import shlex
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path('tools').resolve()))
from build_deploy import build


class Publishing(unittest.TestCase):
    def exercise(self, corrupt=None):
        with tempfile.TemporaryDirectory() as temp:
            artifact=Path(temp)/'plugin'
            build(Path('wordpress/slayerkey-website'),artifact,'a'*40)
            events=[]
            def sftp(args, **kwargs):
                for line in kwargs['input'].splitlines():
                    tokens=shlex.split(line)
                    if not tokens or tokens[0] in ('set','bye','cls'): continue
                    events.append(('sftp',tokens))
                    self.assertNotIn('--delete',tokens)
                    if tokens[0]=='mirror' and '--reverse' not in tokens:
                        shutil.copytree(artifact,tokens[-1],dirs_exist_ok=True)
                        if corrupt=='staged': (Path(tokens[-1])/'assets/js/tracking.js').write_text('corrupt')
                    if tokens[0]=='get':
                        relative=tokens[1].split('/slayerkey-website/',1)[1]
                        shutil.copyfile(artifact/relative,tokens[3])
                return subprocess.CompletedProcess(args,0)
            def http(request, **kwargs):
                relative=request.full_url.split('/slayerkey-website/',1)[1]
                events.append(('http',relative))
                return io.BytesIO(b'corrupt' if corrupt=='http' else (artifact/relative).read_bytes())
            with patch('sys.argv',['publish_deploy.py','--artifact',str(artifact)]), \
                 patch.dict('os.environ',{k:'test' for k in ['EASYWP_HOST','EASYWP_USER','EASYWP_PASSWORD','EASYWP_PORT']}), \
                 patch('subprocess.run',side_effect=sftp), patch('urllib.request.urlopen',side_effect=http), \
                 patch('time.sleep'), contextlib.redirect_stdout(io.StringIO()):
                if corrupt:
                    with self.assertRaises(SystemExit): runpy.run_path('tools/publish_deploy.py',run_name='__main__')
                else: runpy.run_path('tools/publish_deploy.py',run_name='__main__')
            return events

    def test_assets_verified_before_any_reference_is_published(self):
        events=self.exercise()
        http=[i for i,e in enumerate(events) if e[0]=='http']
        puts=[i for i,e in enumerate(events) if e[0]=='sftp' and e[1][0]=='put']
        self.assertGreater(min(puts),max(http))
        self.assertGreater(len(http),3)  # Also verifies responsive proof variants.
        php=[e[1][-1] for e in events if e[0]=='sftp' and e[1][0]=='put' and e[1][-1].endswith('.php')]
        self.assertTrue(php[-1].endswith('/slayerkey-website.php'))

    def test_corrupt_staging_or_public_cache_cannot_publish_php(self):
        for layer in ('staged','http'):
            with self.subTest(layer=layer):
                self.assertFalse(any(e[0]=='sftp' and e[1][0]=='put' for e in self.exercise(layer)))


if __name__=='__main__': unittest.main()
