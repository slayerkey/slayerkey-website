"""Publish review evidence without HAR response bodies, cookies or request queries."""
import argparse
import json
from pathlib import Path
import shutil
from urllib.parse import urlsplit, urlunsplit

parser=argparse.ArgumentParser()
parser.add_argument('source',type=Path)
parser.add_argument('destination',type=Path)
args=parser.parse_args()
args.destination.mkdir(parents=True,exist_ok=True)

def without_query(url):
    parts=urlsplit(url)
    return urlunsplit((parts.scheme,parts.netloc,parts.path,'',''))

for source in args.source.iterdir():
    target=args.destination/source.name
    if source.suffix in ('.png','.cpuprofile'):
        shutil.copyfile(source,target)
    elif source.suffix=='.json':
        data=json.loads(source.read_text(encoding='utf-8'))
        if isinstance(data,list):
            for scenario in data:
                for failure in scenario.get('failures',[]):
                    if 'url' in failure: failure['url']=without_query(failure['url'])
        target.write_text(json.dumps(data,indent=2),encoding='utf-8')
    elif source.suffix=='.har':
        data=json.loads(source.read_text(encoding='utf-8'))
        for entry in data['log']['entries']:
            request=entry['request'];response=entry['response']
            request['url']=without_query(request['url'])
            for key in ('headers','cookies','queryString'): request[key]=[]
            request.pop('postData',None)
            response['cookies']=[]
            response['headers']=[h for h in response.get('headers',[]) if h['name'].lower() in
                ('content-type','cache-control','cf-cache-status','x-cache','age','content-length')]
            response.get('content',{}).pop('text',None)
            response.get('content',{}).pop('encoding',None)
            if response.get('redirectURL'): response['redirectURL']=without_query(response['redirectURL'])
            entry.pop('_securityDetails',None)
        target.write_text(json.dumps(data,separators=(',',':')),encoding='utf-8')
