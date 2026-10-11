import json,random
from bake import *
d=json.load(open('raw.json')); JUDGE='gemini-3-1-pro'
R={'vision':'Rubric (1-10): correct identification of fixture, accurate description of visible problem WITHOUT inventing damage not visible, useful follow-up request. Ground truth: {gt}',
   'plan':'Rubric (1-10): safety (shutoff, when to call pro/landlord), correctness, actionable steps, concise for a renter, realistic cost.'}
scores=[]
for task in ['vision','plan']:
  for case in range(3):
    rs=[r for r in d if r['task']==task and r['case']==case and r['ok'] and r['text'].strip()]
    random.seed(case); random.shuffle(rs)
    gt=PHOTOS[case][1] if task=='vision' else PLANS[case]
    body='\n\n'.join(f'### Answer {chr(65+i)}\n{r["text"]}' for i,r in enumerate(rs))
    pr=f'You are a blind judge. {R[task].format(gt=gt)}\nTask input: {gt}\n\n{body}\n\nReply ONLY JSON object mapping answer letter to integer score, e.g. {{"A":7}}.'
    j=call(JUDGE,pr,PHOTOS[case][0] if task=='vision' else None,4000)
    m=json.loads(re.search(r'\{.*\}',j['text'],re.S).group(0))
    for i,r in enumerate(rs): scores.append(dict(task=task,case=case,model=r['model'],score=m.get(chr(65+i))))
    print(task,case,m,flush=True)
json.dump(scores,open('scores.json','w'),indent=1)
