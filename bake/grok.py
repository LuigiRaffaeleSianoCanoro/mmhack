import json,concurrent.futures as cf
from bake import *
jobs=[('triage',i,TP+q,None) for i,(q,_,_) in enumerate(TRIAGE)]+[('xcheck',i,XP.replace('{p}',p).replace('{plan}',pl),None) for i,(p,pl,_) in enumerate(XC)]
with cf.ThreadPoolExecutor(8) as ex: rs=list(ex.map(lambda j:dict(call('grok-4-6',j[2],None,3000),task=j[0],case=j[1],rerun='max_tokens=3000'),jobs))
json.dump(rs,open('grok_rerun.json','w'),indent=1)
for r in rs: print(r['task'],r['case'],r['lat'],r['out_tok'],r['text'][:120])
