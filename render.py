from PIL import Image,ImageDraw,ImageFont
import textwrap
F='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; FB=F.replace('Sans.ttf','Sans-Bold.ttf')
def render(title,cols,rows,widths,fn,sub=''):
    f=ImageFont.truetype(F,22); fb=ImageFont.truetype(FB,22); ft=ImageFont.truetype(FB,34); fs=ImageFont.truetype(F,18)
    cw=[w*13 for w in widths]; W=sum(cw)+80
    def wrap(s,w,font): 
        n=max(5,int(w/ (font.getlength('x')*1.05)));return textwrap.wrap(s,n) or ['']
    allr=[cols]+rows; H=[max(len(wrap(c,cw[i]-24,fb if r==0 else f)) for i,c in enumerate(row))*30+24 for r,row in enumerate(allr)]
    img=Image.new('RGB',(W,sum(H)+150),'#0d1117'); d=ImageDraw.Draw(img)
    d.text((40,30),title,font=ft,fill='#e6edf3'); d.text((40,75),sub,font=fs,fill='#8b949e'); y=115
    for r,row in enumerate(allr):
        x=40; d.rectangle([40,y,W-40,y+H[r]],fill='#1f6feb' if r==0 else ('#161b22' if r%2 else '#0d1117'),outline='#30363d')
        for i,c in enumerate(row):
            for k,l in enumerate(wrap(c,cw[i]-24,fb if r==0 else f)): d.text((x+12,y+12+k*30),l,font=fb if (r==0 or i==0) else f,fill='#7ee787' if (i==1 and r>0) else '#e6edf3')
            x+=cw[i]; d.line([x,y,x,y+H[r]],fill='#30363d')
        y+=H[r]
    img.save(fn)
M=[["Safety triage","gpt-5-mini","4/5 correct · 1.7s · $0.00007","Sonnet: 5/5 · 1.2s · $0.00052","Caught every gas/electrical stop at 1/7 Sonnet's cost; only miss was a disputed label"],
["Photo understanding","gpt-5","8.0/10 · 3.6s · $0.0025","Opus: 8.3/10 · 6.9s · $0.0132","96% of Opus quality at 1/5 the cost, 2x faster"],
["Fix plan","claude-sonnet-5-5","8.7/10 · 5.7s · $0.0061","Astra: 9.0/10 · 9.5s · $0.0200","96% of the top score at 1/3 the cost, 1.7x faster"],
["Safety cross-check","gpt-5-mini","3/3 caught · 1.9s · $0.0003","gpt-5: 3/3 · 2.0s · $0.0014","All models caught 3/3 planted errors; this one is cheapest and fastest"],
["Repair diagram (image)","gpt-6-astra","10/10 · 24.9s (n=1)","gpt-5-mini: 9/10 · 25.6s","Top score and fastest; image-tool $ not measured"],
["Excluded: grok-4-6","—","Triage 0/5 at a 300-token cap (reasoning ate the budget); 4/5 at 3000 tokens but 5.6s p50","—","3-10x slower than the winner on every task"]]
render("FixIt: which model does each task, and why",["Task","Winner","Winner: quality · p50 latency · $/call","Runner-up","Why this one"],M,[20,17,30,26,40],'justification_models.png',"Measured 2026-10-11 · same inputs for every model · blind judge: gemini-3-1-pro (not a competitor) · prices: Neon gateway /v1/models + Anthropic docs")
S=[["Jev (TypeSafe; not a listed sponsor)","Picks the model for each step in under a second","Each step's model is hardcoded or picked by a slow LLM","Router chip on every trace row"],
["Anbaric","Audited job with human, agent and code steps: who approved what","Approval is just a button, with no record","'Audit' drawer: HUMAN / AGENT / CODE timeline"],
["Swytchcode","Agent can only call allow-listed APIs, with a dry-run first","Agent could send anything; nothing stops it","Approval card: 'Swytchcode dry-run' preview → Exec ✓"],
["Actual AI","Routing table kept as a versioned ADR that coding agents follow","Routing rules drift as agents edit the code","'Why this model?' link opens ADR-002"],
["Prelint","Each PR checked against those ADRs","ADR violations (e.g. a direct API call) get merged","'Built with' slide: Prelint comment on PR"],
["Base44: WEAK (cut unless it has a prize)","Landlord inbox that receives the approved request","Only a mock confirmation in the app","2nd screen: request lands in Base44 app"]]
render("FixIt: why each sponsor",["Sponsor","Problem only it solves here","Without it","Visible on screen"],S,[28,38,34,34],'justification_sponsors.png',"Planned integrations; none of these is built yet")
