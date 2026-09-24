/* Fade-in even if other JS hiccups */
document.addEventListener('DOMContentLoaded', () => { document.body.style.opacity = 1; });

/* ===== Background stars + glow + shooters ===== */
(function(){
  const c=document.getElementById('goldDust'),ctx=c.getContext('2d',{alpha:true});
  let W,H,DPR=Math.min(window.devicePixelRatio,2);
  const stars=[],shooting=[];
  const STARCOUNT=900,LAYERS=4,BASE_SPEED=0.05,MAX_SIZE=1.8,MIN_SIZE=0.2;

  function resize(){ W=c.width=innerWidth*DPR; H=c.height=innerHeight*DPR; c.style.width=innerWidth+'px'; c.style.height=innerHeight+'px'; }
  resize(); addEventListener('resize',resize);

  for(let i=0;i<STARCOUNT;i++){
    const l=Math.floor(Math.random()*LAYERS)+1, d=l/LAYERS;
    stars.push({ x:Math.random()*W, y:Math.random()*H, z:d, r:(Math.random()*(MAX_SIZE-MIN_SIZE)+MIN_SIZE)*DPR*d, tw:Math.random()*6.28, spd:BASE_SPEED*d });
  }

  function sunGlow(t){
    const g1=ctx.createRadialGradient(W/2,H*1.15,H*0.3,W/2,H,H*1.1);
    g1.addColorStop(0,"rgba(0,10,20,0.25)");
    g1.addColorStop(0.4,"rgba(0,5,10,0.5)");
    g1.addColorStop(1,"rgba(0,0,0,1)");
    ctx.fillStyle=g1; ctx.fillRect(0,0,W,H);
    const gy=H*0.95, g2=ctx.createRadialGradient(W/2,gy,0,W/2,gy,H*0.6);
    const p=0.15+0.05*Math.sin(t/800);
    g2.addColorStop(0,`rgba(255,220,160,${0.35+p})`);
    g2.addColorStop(0.3,`rgba(255,210,120,${0.18+p/2})`);
    g2.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=g2; ctx.fillRect(0,0,W,H);
  }

  function addShooter(){
    const startX=Math.random()*W, startY=Math.random()*H*0.3;
    const angle=(Math.random()<0.5?1:-1)*(Math.random()*Math.PI/4+Math.PI/8);
    const depth=Math.random();
    const speed=3+depth*4, length=60+depth*80;
    shooting.push({x:startX,y:startY,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,length,depth,life:1});
  }

  function draw(){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
    const t=Date.now()/1000;
    ctx.globalCompositeOperation='lighter';
    const swirlX=Math.sin(t/8)*0.5, swirlY=Math.cos(t/10)*0.5;
    for(const s of stars){
      s.x+=Math.cos(t*0.08+s.tw+swirlX)*s.spd*1.2;
      s.y+=Math.sin(t*0.06+s.tw+swirlY)*s.spd*1.2;
      if(s.x<0)s.x+=W; if(s.x>W)s.x-=W; if(s.y<0)s.y+=H; if(s.y>H)s.y-=H;
      const f=0.4+0.6*Math.abs(Math.sin(t*5+s.tw));
      ctx.beginPath();
      ctx.fillStyle=`hsla(45,100%,${60+20*f}%,.8)`;
      ctx.arc(s.x,s.y,s.r,0,6.283); ctx.fill();
    }
    for(let i=shooting.length-1;i>=0;i--){
      const s=shooting[i];
      s.x+=s.vx; s.y+=s.vy; s.life-=0.02;
      const grad=ctx.createLinearGradient(s.x,s.y,s.x-s.vx*s.length,s.y-s.vy*s.length);
      grad.addColorStop(0,`hsla(45,95%,${70+s.depth*20}%,${s.life})`);
      grad.addColorStop(1,`hsla(45,95%,${50+s.depth*20}%,0)`);
      ctx.strokeStyle=grad; ctx.lineWidth=(1.5+s.depth*1.5)*DPR;
      ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(s.x-s.vx*s.length,s.y-s.vy*s.length); ctx.stroke();
      if(s.life<=0||s.x>W||s.y>H) shooting.splice(i,1);
    }
    ctx.globalCompositeOperation='screen'; sunGlow(Date.now());
    requestAnimationFrame(draw);
  }
  draw();
  (function loop(){ setTimeout(()=>{ if(Math.random()<0.85) addShooter(); loop(); }, 5000+Math.random()*5000); })();
})();

/* ===== Boot loader ===== */
const boot=document.getElementById('boot'), log=document.getElementById('bootLog'), skip=document.getElementById('skipBoot');
const bootLines=[
  'JMBN SYSTEM BOOTING...',
  '> Initializing OPS modules ... <span class="ok">OK</span>',
  '> Loading Fleet / Ship Hangar ... <span class="ok">OK</span>',
  '> Linking Contracts Manifest ... <span class="ok">OK</span>',
  '> Mounting Components Registry ... <span class="ok">OK</span>',
  '> Verifying local storage bindings ... <span class="ok">OK</span>',
  '> Applying gold-accent theme ... <span class="ok">OK</span>',
  '> Standby... preparing dashboard ...',
  'READY.'
];
function printLine(t){const r=document.createElement('div');r.innerHTML=t;log.appendChild(r);log.scrollTop=log.scrollHeight;}
function finishBoot(){sessionStorage.setItem('seenBoot','1');boot.classList.add('hidden');setTimeout(()=>boot.style.display='none',550);}
function runBoot(){let i=0;(function step(){if(i>=bootLines.length)return finishBoot();printLine(bootLines[i++]);setTimeout(step,220)})()}
skip.onclick=finishBoot; if(sessionStorage.getItem('seenBoot')!=='1'){runBoot()}else{boot.style.display='none'}

/* ===== OPS ticker ===== */
(function(){
  const el=document.getElementById('opsTicker'),chip=document.getElementById('opsChip'),msg=document.getElementById('opsMsg'),
        prev=document.getElementById('opsPrev'),next=document.getElementById('opsNext'),
        pause=document.getElementById('opsPause'),close=document.getElementById('opsClose');
  const lines=[
    'CONTACT: AshenShrike joined the Frontier Fighters.',
    'OPS: FloatinTiger caused a “minor” power shortage.',
    'COMMS: Hendra broadcast karaoke on all channels. Again.',
    'SECURITY: Jeneral “poked” a pirate Idris. Backup requested.',
    'CARGO: Ricojes mislabeled 300 SCU of scrap as platinum.',
    'ALERT: Gerald installed Windows on the ship radar. It crashed.',
    'OPS: AshenShrike tried “turning it off and on again.” Success.',
    'SYSTEM: Update failed successfully. Classic.',
    'OPS: Nomad vs FloatinTiger over the last power cell.',
    'CARGO: Shrike stacked crates into a “fortress of solitude.”'
  ];
  const typeStyles={ALERT:'var(--accent)',OPS:'var(--accent)',COMMS:'#9ecbff',SECURITY:'tomato',CARGO:'#a0f0c0',SYSTEM:'#f7f1d0',CONTACT:'#f7f1d0'};
  function typeFrom(line){const m=line.match(/^([A-Z]+):/);return m?m[1]:'OPS'}
  let i=0,timer=null,playing=true;
  function setChipFor(line){const t=typeFrom(line);chip.textContent=`[${t}]`;chip.style.background=typeStyles[t]??'var(--accent)';chip.style.color='#000'}
  function fade(txt){msg.style.opacity=0;setTimeout(()=>{msg.textContent=txt;msg.style.opacity=1},200)}
  function render(){const line=lines[i];setChipFor(line);fade(line);pause.textContent=playing?'Pause':'Play'}
  function nextL(){i=(i+1)%lines.length;render()} function prevL(){i=(i-1+lines.length)%lines.length;render()}
  function start(){if(timer)return; playing=true; timer=setInterval(nextL,4000); render()}
  function stop(){playing=false; clearInterval(timer); timer=null; render()}
  next.onclick=()=>{stop();nextL()}; prev.onclick=()=>{stop();prevL()}; pause.onclick=()=>playing?stop():start();
  close.onclick=()=>{el.style.display='none'; sessionStorage.setItem('opsClosed','1')}
  if(sessionStorage.getItem('opsClosed')==='1'){ el.style.display='none'; return }
  start()
})();
