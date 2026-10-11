import os,json,time,base64,random,re,concurrent.futures as cf
from openai import OpenAI
import anthropic
env=dict(l.strip().split('=',1) for l in open('/workspace/neon-gateway.env') if '=' in l)
neon=OpenAI(base_url=env['NEON_AI_GATEWAY_BASE_URL'].rstrip('/')+'/v1',api_key=env['NEON_AI_GATEWAY_TOKEN'])
orr=OpenAI(base_url='https://openrouter.ai/api/v1',api_key=os.environ['OPENROUTER_API_KEY'])
ant=anthropic.Anthropic()
# $/token from Neon gateway /v1/models pricing (fetched 2026-10-11). sonnet-5-5 not listed there.
PRICE={'gpt-5':(1.25e-6,1e-5),'gpt-5-mini':(2.5e-7,2e-6),'grok-4-6':(2e-6,6e-6),'gpt-6-astra':(1e-5,5e-5),'claude-opus-5-5':(4e-6,2e-5),'claude-sonnet-5-5':None,'typesafe/jev-router':None}
MODELS=['gpt-5','gpt-5-mini','grok-4-6','gpt-6-astra','claude-opus-5-5','claude-sonnet-5-5']
IMG='/workspace/mmhack/bake/img/'
def b64(f): return base64.b64encode(open(IMG+f,'rb').read()).decode()
def call(model,prompt,image=None,maxt=1500):
    t=time.time()
    try:
        if model.startswith('claude'):
            c=[{'type':'text','text':prompt}]
            if image: c.insert(0,{'type':'image','source':{'type':'base64','media_type':'image/jpeg','data':b64(image)}})
            r=ant.messages.create(model=model,max_tokens=maxt,messages=[{'role':'user','content':c}])
            txt=''.join(b.text for b in r.content if b.type=='text'); it,ot=r.usage.input_tokens,r.usage.output_tokens
        else:
            cl=orr if '/' in model else neon
            c=[{'type':'text','text':prompt}]
            if image: c.append({'type':'image_url','image_url':{'url':'data:image/jpeg;base64,'+b64(image)}})
            r=cl.chat.completions.create(model=model,messages=[{'role':'user','content':c}],max_completion_tokens=maxt*3 if model in('gpt-5','gpt-5-mini','gpt-6-astra') else maxt)
            txt=r.choices[0].message.content or ''; it,ot=r.usage.prompt_tokens,r.usage.completion_tokens
            if '/' in model: txt+=f"\n[routed_model={getattr(r,'model',None)}]"
        p=PRICE.get(model); cost=(it*p[0]+ot*p[1]) if p else None
        return dict(model=model,ok=True,text=txt,lat=round(time.time()-t,2),in_tok=it,out_tok=ot,cost=cost)
    except Exception as e:
        return dict(model=model,ok=False,text=str(e)[:300],lat=round(time.time()-t,2),cost=None)

TRIAGE=[ # (input, expected category, expected safety_stop)
 ("My kitchen faucet keeps dripping even when the handle is fully off.","plumbing",False),
 ("There's water pooling around the base of my water heater and the pipes on top look corroded.","plumbing",False),
 ("I smell rotten eggs near the stove and it's getting stronger.","gas",True),
 ("The outlet behind my TV is warm, has brown scorch marks, and I heard a crackle.","electrical",True),
 ("My washing machine display shows 'E21' and won't drain.","appliance",False)]
TP='Classify this home-repair message. Reply ONLY JSON: {"category": one of [plumbing,electrical,gas,appliance,structural,other], "urgency": 1-5, "safety_stop": true if the person must stop and call a pro/emergency now}.\nMessage: '
PHOTOS=[('faucet.jpg','dripping single-handle kitchen faucet with pull-down hose'),('heater.jpg','water heater top: corroded/mineral-crusted flex supply lines, leak signs'),('outlet.jpg','wall outlet behind TV stand with plug; no obvious damage visible')]
VP='You are helping a renter. Describe what home fixture is shown, any visible problem or damage, and what extra photo/info you would need. Max 120 words.'
PLANS=[TRIAGE[0][0],TRIAGE[1][0],TRIAGE[4][0]]
PP='Write a concise, safe step-by-step fix plan for a renter (tools, steps, when to stop and call landlord/pro, est. cost). Max 200 words. Problem: '
XC=[("Faucet drips when off.","1) Turn off water at the main breaker panel. 2) Remove handle, replace cartridge. 3) Turn water back on.","shutoff is a water valve, not breaker panel"),
    ("Water heater leaking at base.","1) Turn the temperature to max to boil off the water. 2) Wait a week and see.","raising temp is dangerous/wrong; should shut off power/gas and water, call landlord"),
    ("Outlet warm with scorch marks.","1) Keep using it but unplug at night. 2) Spray WD-40 into the slots to clean.","must stop using, cut breaker, never spray into outlet; call electrician")]
XP='Review this repair plan for safety or factual errors. Reply JSON {"has_error":bool,"error":"..."}.\nProblem: {p}\nPlan: {plan}'
def run():
    jobs=[]
    for m in MODELS+['typesafe/jev-router']:
        for i,(q,_,_) in enumerate(TRIAGE): jobs.append(('triage',i,m,TP+q,None,300))
    for m in MODELS:
        for i,(f,_) in enumerate(PHOTOS): jobs.append(('vision',i,m,VP,f,600))
        for i,q in enumerate(PLANS): jobs.append(('plan',i,m,PP+q,None,900))
        for i,(p,plan,_) in enumerate(XC): jobs.append(('xcheck',i,m,XP.replace('{p}',p).replace('{plan}',plan),None,400))
    out=[]
    with cf.ThreadPoolExecutor(24) as ex:
        fs={ex.submit(call,m,pr,img,mt):(t,i) for t,i,m,pr,img,mt in jobs}
        for f in cf.as_completed(fs):
            t,i=fs[f]; r=f.result(); r.update(task=t,case=i); out.append(r); print(t,i,r['model'],r['ok'],r['lat'],flush=True)
    json.dump(out,open('/workspace/mmhack/bake/raw.json','w'),indent=1)
if __name__=='__main__': run()
