import time,base64,json,requests,concurrent.futures as cf
env=dict(l.strip().split('=',1) for l in open('/workspace/neon-gateway.env') if '=' in l)
B=env['NEON_AI_GATEWAY_BASE_URL'].rstrip('/');H={'Authorization':'Bearer '+env['NEON_AI_GATEWAY_TOKEN']}
P="Clear instructional diagram: exploded view of a single-handle kitchen faucet cartridge replacement, labeled parts (handle, retaining nut, cartridge, O-rings), 3 numbered steps, flat illustration style."
def go(m):
  t=time.time()
  try:
    r=requests.post(B+'/openai/v1/responses',headers=H,json={'model':m,'input':P,'tools':[{'type':'image_generation','quality':'low','size':'1024x1024','output_format':'jpeg','output_compression':60}]},timeout=240); d=r.json()
    imgs=[o for o in d.get('output',[]) if o.get('type')=='image_generation_call' and o.get('result')]
    if imgs: open(f'gen_{m}.jpg','wb').write(base64.b64decode(imgs[0]['result']))
    return dict(model=m,status=r.status_code,ok=bool(imgs),lat=round(time.time()-t,1),usage=d.get('usage'),err=None if imgs else str(d)[:300])
  except Exception as e: return dict(model=m,ok=False,lat=round(time.time()-t,1),err=str(e)[:200])
with cf.ThreadPoolExecutor(4) as ex: res=list(ex.map(go,['gpt-5-5-pro','gpt-5','gpt-5-mini','gpt-6-astra']))
json.dump(res,open('img2.json','w'),indent=1);print(json.dumps(res,indent=1))
