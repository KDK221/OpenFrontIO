import json,statistics,hashlib
from pathlib import Path
p=Path('tests/perf/balance');new=json.load(open(p/'warringstates-relocated-final-run-20261111/results.json'));old=json.load(open(p/'warringstates-results-2026-11-11.json'));lang=json.load(open('resources/lang/ko.json'))
assert len(new['runs']) == 16, "Wait for all 16 relocation runs before comparing"
for run in new['runs']:
    assert not run.get('error'), run
    assert run['actualDifficulty'] == run['difficulty'].title()
    assert len(run['capitals']) == 21
    assert all(len(c['history']) == 11 and c['history'][-1]['tick'] == 6000 for c in run['capitals'])
valid=[f'balance{i:02}' for i in range(1,9) if all(any(x['seed']==f'balance{i:02}' and x['difficulty']==d and not x.get('error') and not x['missing'] for x in r['runs']) for r in [old,new] for d in ['medium','hard'])]
result={'baseCommit':'9712a36dbb5df9dee31e3e4a7ae5fccd93ede109','mapManifestSha256':hashlib.sha256(Path('resources/maps/warringstates/manifest.json').read_bytes()).hexdigest(),'pairedSeeds':valid,'excluded':[{k:x[k] for k in ['seed','difficulty','missing']} for x in new['runs'] if x.get('missing')],'difficulties':{}}
for d in ['medium','hard']:
 groups=[[x for x in r['runs'] if x['difficulty']==d and x['seed'] in valid] for r in [old,new]]
 rows=[]
 for c in groups[0][0]['capitals']:
  row={'flag':c['flag'],'name':c['name']}
  for label,runs in zip(['before','after'],groups):
   finals=[next(z for z in x['capitals'] if z['flag']==c['flag'])['history'][-1] for x in runs]
   row[label]={'alive':sum(x['alive'] for x in finals),'medianLand':statistics.median(x['land'] if x['alive'] else 0 for x in finals),'firstPlace':sum(x['topCities'][0]['name']==c['name'] for x in runs)}
  rows.append(row)
 result['difficulties'][d]={'n':len(valid),'rows':rows,'medianLargestCityBefore':statistics.median(x['topCities'][0]['land'] for x in groups[0]),'medianLargestCityAfter':statistics.median(x['topCities'][0]['land'] for x in groups[1]),'newOutpostFirstPlaces':sum(x['topCities'][0]['name'].startswith('China') and x['topCities'][0]['name'].endswith('Outpost') for x in groups[1])}
(p/'warringstates-relocation-comparison-2026-11-11.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
new['baseCommit']=result['baseCommit'];assert new['mapManifestSha256']==result['mapManifestSha256']
(p/'warringstates-relocated-results-2026-11-11.json').write_text(json.dumps(new,ensure_ascii=False,separators=(',',':'))+'\n')
for d,a in result['difficulties'].items():
 print(d,'n',a['n'],'largest',a['medianLargestCityBefore'],'->',a['medianLargestCityAfter'],'outpost firsts',a['newOutpostFirstPlaces'])
 for r in a['rows']:
  if r['flag'] in ['LiuBei','CaoCao','YuanShao','ZhangXiu','MaTeng','LiuZhang','GongsunDu']:print(r)
