import json,base64,random
from bake import *
ms=['gpt-5-5-pro','gpt-5','gpt-5-mini','gpt-6-astra']; random.seed(3); random.shuffle(ms)
c=[{'type':'text','text':'Blind judge. Prompt was: "exploded-view diagram of single-handle kitchen faucet cartridge replacement, labeled parts (handle, retaining nut, cartridge, O-rings), 3 numbered steps". Score each image 1-10 for accuracy of parts, legible correct labels, usefulness. Images are in order A,B,C,D. Reply ONLY JSON {"A":n,...}.'}]
for m in ms: c.append({'type':'image_url','image_url':{'url':'data:image/jpeg;base64,'+base64.b64encode(open(f'gen_{m}.jpg','rb').read()).decode()}})
r=neon.chat.completions.create(model='gemini-3-1-pro',messages=[{'role':'user','content':c}])
s=json.loads(re.search(r'\{.*\}',r.choices[0].message.content,re.S).group(0))
out={m:s[chr(65+i)] for i,m in enumerate(ms)}; print(out); json.dump(out,open('img_scores.json','w'))
