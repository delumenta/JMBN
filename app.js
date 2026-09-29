const URL="https://fcegavhipeaeihxegsnw.supabase.co";
const KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZWdhdmhpcGVhZWloeGVnc253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMjk3NTcsImV4cCI6MjA3NzcwNTc1N30.i-ZjOlKc89-uA7fqOIvmAMv60-C2_NmKikRI_78Jei8";
const sb=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,flowType:"pkce",autoRefreshToken:true}});
let state={missions:[],crew:[],certs:[],announcements:[],profile:null};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function base(){const p=location.pathname.split("/").filter(Boolean);return /github\.io$/.test(location.hostname)&&p.length?"/"+p[0]+"/":"/"}
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2200)}
function showView(id){$$(".view").forEach(v=>v.classList.toggle("active",v.id===id));$$(".nav").forEach(n=>n.classList.toggle("active",n.dataset.view===id));$("#pageTitle").textContent={command:"COMMAND DECK",operations:"OPERATIONS",crew:"CREW MANIFEST",academy:"ACADEMY",records:"RECORDS",profile:"PERSONNEL DOSSIER"}[id]||"JMBN";history.replaceState(null,"","#"+id);scrollTo(0,0)}
function img(bucket,name){return URL+"/storage/v1/object/public/"+encodeURIComponent(bucket)+"/"+name.split("/").map(encodeURIComponent).join("/")}
function fmtDate(v){if(!v)return"TBD";return new Date(v).toLocaleDateString("en-SG",{day:"2-digit",month:"short",year:"2-digit"}).toUpperCase()}
function fmtTime(v){if(!v)return"";return new Date(v).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit",hour12:false})}
function missionRows(items,n=4){if(!items.length)return'<div class="empty">No operations in the manifest yet.</div>';return items.slice(0,n).map(m=>'<div class="op-row" data-mission="'+esc(m.id)+'" tabindex="0"><span class="op-date">'+fmtDate(m.start_time)+'</span><div><b>'+esc(m.title||"Untitled operation")+'</b><small>'+esc([m.origin,m.destination].filter(Boolean).join(" → ")||m.type||"Mission")+'</small></div><span class="tag">'+esc(m.category||m.status||"OP")+'</span></div>').join("")}
function missionCards(items){if(!items.length)return'<div class="empty">No matching operations.</div>';return items.map(m=>'<article class="mission-card" data-mission="'+esc(m.id)+'" tabindex="0"><span class="tag">'+esc(m.category||"operation")+'</span><h3>'+esc(m.title||"Untitled operation")+'</h3><div class="route"><span>'+esc(m.origin||"TBD")+'</span><span>→</span><span>'+esc(m.destination||"TBD")+'</span></div><div class="mission-meta"><span>'+fmtDate(m.start_time)+' / '+fmtTime(m.start_time)+'</span><span>'+esc(m.status||"PLANNED")+'</span></div></article>').join("")}
function crewCards(items){if(!items.length)return'<div class="empty">No matching personnel.</div>';return items.map(p=>{const code=p.rank_code||p.rank?.code||"";const rankUrl=p.rank_image_url||(code?img("Ranks",code+".png"):"");return '<article class="crew-card" data-user="'+esc(p.user_id)+'" tabindex="0">'+(rankUrl?'<img class="rank-img" src="'+esc(rankUrl)+'" onerror="this.style.visibility=\'hidden\'">':'<div class="rank-img"></div>')+'<div><h3>'+esc(p.display_name||p.handle||"Crew")+'</h3><p>'+esc(code||p.rank_category||p.role||"JMBN")+'</p><small>'+esc(p.role||"Member")+' · '+esc(p.missions_attended||0)+' missions</small></div><i class="status-dot '+(p.availability_status==="awol"?"red":"green")+'"></i></article>'}).join("")}
function certCards(items){if(!items.length)return'<div class="empty">Certification catalogue unavailable.</div>';return items.map(c=>{let code=(c.code||c.short_code||c.name||"").toUpperCase();let map={BMT:"BMT.png",MED:"MED.png",PIL:"PIL.png",SOC:"SOC.png"};let art=c.image_url||img("certification",map[code]||"APBmt1234.png");return '<article class="cert"><img src="'+esc(art)+'" onerror="this.src=\''+img("certification","BMT.png")+'\'"><h3>'+esc(c.name||c.title||code||"Certification")+'</h3><p>'+esc(c.description||c.category||"JMBN qualification pathway")+'</p></article>'}).join("")}

async function loadAcademy(){
 const {data:{session}}=await sb.auth.getSession();if(!session)return;
 const uid=session.user.id;
 const [earnedReq,reqReq,assignReq]=await Promise.all([
  sb.from("user_certifications").select("certification_code,awarded_at").eq("user_id",uid),
  sb.from("certification_requirements").select("*"),
  sb.from("academy_specialisation_assignments").select("*").eq("user_id",uid).maybeSingle()
 ]);
 const earned=earnedReq.data||[], reqs=reqReq.data||[], assignment=assignReq.data||null, earnedSet=new Set(earned.map(x=>(x.certification_code||"").toUpperCase()));
 const type=code=>["BMT","SOC"].includes(code)?"core":["GUNNERY","ENGINEERING"].includes(code)?"specialisation":"support";
 const codeOf=x=>(x.certification_code||x.code||x.short_code||"").toUpperCase();
 $("#academyTotal").textContent=state.certs.length;$("#academyEarned").textContent=earned.length;$("#academyCurrent").textContent=(assignment?.specialisation_code||(!earnedSet.has("BMT")?"BMT":!earnedSet.has("SOC")?"SOC":"SUPPORT")).toUpperCase();
 const node=(code,label,done,locked=false)=>'<div class="academy-path-node '+(done?"done ":"")+(locked?"locked":"")+'"><span>'+esc(code)+'</span><b>'+esc(label)+'</b><small>'+(done?"CERTIFIED":locked?"LOCKED":"AVAILABLE")+'</small></div>';
 const bmt=earnedSet.has("BMT"),soc=earnedSet.has("SOC");
 $("#academyPathTrack").innerHTML=node("BMT","Basic Military Training",bmt)+ '<i>→</i>'+node("SOC","Standard Obstacle Course",soc,!bmt)+'<i>→</i><div class="academy-path-branches"><div><small>SUPPORT PATHWAYS</small>'+["MED","LOG","MIN","PILOT"].map(x=>node(x,x,earnedSet.has(x),!soc)).join("")+'</div><div><small>ACTIVE SPECIALISATION</small>'+node(assignment?.specialisation_code||"—",assignment?.specialisation_code||"Awaiting assignment",earnedSet.has((assignment?.specialisation_code||"").toUpperCase()),!assignment).replace("academy-path-node","academy-path-node special")+'</div></div>';
 renderAcademyProgrammes("all",earnedSet,reqs,assignment);
 $("#academy [data-acfilter]").forEach(b=>b.onclick=()=>{$("#academy [data-acfilter]").forEach(x=>x.classList.toggle("active",x===b));renderAcademyProgrammes(b.dataset.acfilter,earnedSet,reqs,assignment)});
}
function renderAcademyProgrammes(filter,earnedSet,reqs,assignment){
 const items=state.certs.filter(c=>filter==="all"||(["BMT","SOC"].includes((c.certification_code||"").toUpperCase())?"core":["GUNNERY","ENGINEERING"].includes((c.certification_code||"").toUpperCase())?"specialisation":"support")===filter);
 $("#certGrid").innerHTML=items.map(c=>{const code=(c.certification_code||c.code||"").toUpperCase(),done=earnedSet.has(code),total=reqs.filter(r=>(r.certification_code||"").toUpperCase()===code).length,kind=["BMT","SOC"].includes(code)?"CORE PATHWAY":["GUNNERY","ENGINEERING"].includes(code)?"SPECIALISATION PATHWAY":"SUPPORT PATHWAY",art=c.big_art_cover||c.image_url||img("certification","BMT.png");let status=done?"CERTIFIED":code==="SOC"&&!earnedSet.has("BMT")?"LOCKED":["GUNNERY","ENGINEERING"].includes(code)&&assignment?.specialisation_code!==code?"ASSIGNMENT REQUIRED":"AVAILABLE";return '<article class="academy-programme '+status.toLowerCase().replaceAll(" ","-")+'"><div class="academy-programme-art"><img src="'+esc(art)+'"><span>'+esc(code)+'</span></div><div class="academy-programme-body"><small>'+kind+'</small><h3>'+esc(c.name||code)+'</h3><p>'+esc(c.description||"JMBN Academy certification programme.")+'</p><div class="academy-programme-foot"><b>'+status+'</b><span>'+total+' TRAINING REQUIREMENTS</span></div></div></article>'}).join("")||'<div class="empty">No Academy programmes in this category.</div>';
}
async function loadWelcomeProgress(uid){
 const {data:p,error}=await sb.from("v_user_rank_progress").select("*").eq("user_id",uid).maybeSingle();
 if(error||!p){$("#welcomeProgress").hidden=true;return}
 const vals=[Number(p.pct_missions??1),Number(p.pct_hours??1),Number(p.pct_certs??1)].map(v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0);
 const pct=Math.round(Math.min(...vals)*100);
 $("#welcomeProgress").hidden=false;$("#welcomeCurrentRank").textContent=p.current_code||state.profile?.rank_code||"—";$("#welcomeNextRank").textContent=p.has_next_rank?(p.next_code||"—"):"MAX RANK";$("#welcomeProgressPct").textContent=pct+"%";$("#welcomeProgressBar").style.width=pct+"%";
 $("#welcomeRequirements").innerHTML="<span>MISSIONS <b>"+esc(p.missions_attended??0)+"/"+esc(p.missions_target??"—")+"</b></span><span>HOURS <b>"+esc(p.hours_total??0)+"/"+esc(p.hours_target??"—")+"</b></span><span>CERTS <b>"+esc(p.certifications_total??0)+"/"+esc(p.certification_target??"—")+"</b></span>";
}
async function load(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){location.replace(base()+"auth.html");return}
 const uid=session.user.id;
 const [prof,missions,crew,certs,ann]=await Promise.all([
  sb.from("profiles").select("*").eq("user_id",uid).maybeSingle(),
  sb.from("missions").select("*").order("start_time",{ascending:true}),
  sb.from("profiles").select("*").order("display_name",{ascending:true}),
  sb.from("certifications").select("*"),
  sb.from("announcements").select("*").order("created_at",{ascending:false}).limit(5)
 ]);
 state.profile=prof.data||{};state.missions=missions.data||[];state.crew=crew.data||[];state.certs=certs.data||[];state.announcements=ann.data||[];
 const name=state.profile.display_name||state.profile.handle||session.user.user_metadata?.full_name||session.user.email?.split("@")[0]||"CREW";
 $("#userName").textContent=name.toUpperCase();$(".avatar").textContent=name[0]?.toUpperCase()||"J";$("#net").textContent="SECURE";
 const rankName=state.profile.rank_code||state.profile.rank_category||"CREW", rankArt=state.profile.rank_image_url||(state.profile.rank_code?img("Ranks",state.profile.rank_code+".png"):"");
 $("#welcomeName").textContent=name.toUpperCase();$("#welcomeRank").textContent=rankName.toUpperCase();$("#welcomeRankArt").innerHTML=rankArt?'<img src="'+esc(rankArt)+'" alt="">':'<span>'+esc((state.profile.rank_code||"J").slice(0,3))+'</span>';syncDutyUI(state.profile.availability_status||"active");await loadWelcomeProgress(uid);$("#syncText").textContent="Live sync · "+new Date().toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"});
 render();await loadAcademy();
}

function syncDutyUI(status){
 const s=status==="awol"?"awol":"active";$("#myDutyLabel").textContent=s.toUpperCase();
 $("#dutyActive").classList.toggle("active",s==="active");$("#dutyAwol").classList.toggle("active",s==="awol");
 $("#welcomePanel").classList.toggle("is-awol",s==="awol");
}
async function setDutyStatus(status){
 if(!["active","awol"].includes(status))return;
 const {data:{session}}=await sb.auth.getSession();if(!session)return;
 const previous=state.profile?.availability_status||"active";if(previous===status)return;
 $$(".duty-toggle button").forEach(b=>b.disabled=true);syncDutyUI(status);
 const {data,error}=await sb.from("profiles").update({availability_status:status}).eq("user_id",session.user.id).select("user_id,availability_status").maybeSingle();
 if(error||!data){syncDutyUI(previous);toast("Duty status update failed");console.error(error);$$(".duty-toggle button").forEach(b=>b.disabled=false);return}
 state.profile.availability_status=status;const mine=state.crew.find(x=>x.user_id===session.user.id);if(mine)mine.availability_status=status;
 render();syncDutyUI(status);toast(status==="active"?"Welcome back. Status ACTIVE.":"Duty status set to AWOL.");$$(".duty-toggle button").forEach(b=>b.disabled=false);
}

function render(){
 const active=state.crew.filter(p=>p.availability_status!=="awol").length, awol=state.crew.length-active, pct=state.crew.length?Math.round(active/state.crew.length*100):0;
 $("#mCrew").textContent=state.crew.length;$("#mActive").textContent=active;$("#mOps").textContent=state.missions.filter(m=>!m.start_time||new Date(m.start_time)>=new Date()).length;$("#mCerts").textContent=state.certs.length;
 $("#opCount").textContent=state.missions.length+" FILE"+(state.missions.length===1?"":"S");$("#crewCount").textContent=state.crew.length+" RECORD"+(state.crew.length===1?"":"S");
 const upcoming=state.missions.filter(m=>!m.start_time||new Date(m.start_time)>=new Date()).sort((a,b)=>new Date(a.start_time||8640000000000000)-new Date(b.start_time||8640000000000000))[0];
 $("#nextOpTitle").textContent=upcoming?.title||"NO DEPLOYMENT SCHEDULED";$("#nextOpTitle").dataset.mission=upcoming?.id||"";$("#nextOpTitle").disabled=!upcoming;$("#nextOpWhen").textContent=upcoming?.start_time?(fmtDate(upcoming.start_time)+" / "+fmtTime(upcoming.start_time)):"STANDING BY";$("#nextOpOpen").dataset.mission=upcoming?.id||"";$("#nextOpOpen").style.visibility=upcoming?"visible":"hidden";
 $("#activeCount").textContent=active;$("#awolCount").textContent=awol;$("#readyPct").textContent=pct+"%";$("#crewOnline").textContent=active;$("#readyRing").style.background="conic-gradient(var(--gold) "+(pct*3.6)+"deg,#24271f 0deg)";
 $("#opPreview").classList.remove("skeleton");$("#opPreview").innerHTML=missionRows(state.missions.filter(m=>!m.start_time||new Date(m.start_time)>=new Date()),4);
 $("#operationsGrid").innerHTML=missionCards(state.missions);$("#crewGrid").innerHTML=crewCards(state.crew);$("#certGrid").innerHTML=certCards(state.certs);$("#recordMissions").innerHTML=missionRows([...state.missions].reverse(),8);
 $("#announcements").classList.remove("skeleton");$("#announcements").innerHTML=state.announcements.length?state.announcements.map(a=>'<div class="feed-item"><b>'+esc(a.title||"Command notice")+'</b><p>'+esc(a.body||a.message||a.content||"")+'</p></div>').join(""):'<div class="empty">No current signal traffic.</div>';
}

function openDrawer(html,mode="personnel"){$("#detailBody").innerHTML=html;$("#detailDrawer").classList.toggle("mission-command",mode==="mission");$("#detailDrawer").classList.add("open");$("#detailBackdrop").classList.add("open")}
function closeDrawer(){$("#detailDrawer").classList.remove("open","mission-command");$("#detailBackdrop").classList.remove("open")}
async function openCrew(userId){
 const p=state.crew.find(x=>x.user_id===userId);if(!p)return;
 openDrawer('<div class="loading-detail">LOADING PERSONNEL FILE…</div>');
 const [certs,attendance,role,rank]=await Promise.all([
  sb.from("user_certifications").select("certification_code,awarded_at").eq("user_id",userId),
  sb.from("mission_attendees").select("mission_id,attendance,role_in_mission,position_in_mission,joined_at").eq("user_id",userId),
  p.ingame_role_id?sb.from("ingame_roles").select("*").eq("id",p.ingame_role_id).maybeSingle():Promise.resolve({data:null}),
  p.current_rank_id?sb.from("ranks").select("*").eq("id",p.current_rank_id).maybeSingle():Promise.resolve({data:null})
 ]);
 const r=rank.data||{}, ig=role.data||{}, cs=certs.data||[], at=attendance.data||[];
 const rankUrl=p.rank_image_url||r.image_url||(p.rank_code?img("Ranks",p.rank_code+".png"):"");
 $("#detailBody").innerHTML='<p class="eyebrow">PERSONNEL FILE // '+esc(p.role||"MEMBER")+'</p><div class="detail-hero">'+(rankUrl?'<img class="rank-img" src="'+esc(rankUrl)+'">':'')+'<div><h2>'+esc(p.display_name||p.handle||"Crew")+'</h2><p>'+esc(r.name||p.rank_code||p.rank_category||"JMBN CREW")+'</p><small>'+esc(p.handle?"@"+p.handle:"")+'</small></div></div><section class="detail-section"><h4>SERVICE STATUS</h4><div class="detail-grid"><div class="detail-stat"><small>DUTY STATUS</small><b>'+esc((p.availability_status||"active").toUpperCase())+'</b></div><div class="detail-stat"><small>MISSIONS</small><b>'+esc(p.missions_attended||at.length)+'</b></div><div class="detail-stat"><small>STATION / ROLE</small><b>'+esc(ig.name||p.role||"—")+'</b></div><div class="detail-stat"><small>RANK TRACK</small><b>'+esc(p.rank_track||r.category||"—")+'</b></div></div></section><section class="detail-section"><h4>CERTIFICATIONS</h4><div class="detail-list">'+(cs.length?cs.map(x=>'<div class="detail-item"><b>'+esc(x.certification_code)+'</b><small>Awarded '+fmtDate(x.awarded_at)+'</small></div>').join(""):'<div class="detail-item"><small>No certifications recorded.</small></div>')+'</div></section><section class="detail-section"><h4>MISSION HISTORY</h4><div class="detail-list">'+(at.length?at.slice(0,8).map(x=>{const m=state.missions.find(z=>z.id===x.mission_id);return '<div class="detail-item"><b>'+esc(m?.title||"Mission")+'</b><small>'+esc((x.attendance||"recorded").toUpperCase())+(x.role_in_mission?" · "+esc(x.role_in_mission):"")+'</small></div>'}).join(""):'<div class="detail-item"><small>No mission attendance recorded.</small></div>')+'</div></section>';
}

function openReadiness(){
 const active=state.crew.filter(p=>p.availability_status!=="awol"),awol=state.crew.filter(p=>p.availability_status==="awol");
 const rows=(items,status)=>items.length?items.map(p=>{const code=p.rank_code||p.rank?.code||"",rank=p.rank_image_url||(code?img("Ranks",code+".png"):"");return '<button class="readiness-person" data-user="'+esc(p.user_id)+'"><span class="readiness-person-rank">'+(rank?'<img src="'+esc(rank)+'" alt="">':'')+'</span><span><b>'+esc(p.display_name||p.handle||"Crew")+'</b><small>'+esc(code||p.rank_category||p.role||"JMBN CREW")+'</small></span><i class="status-dot '+status+'"></i></button>'}).join(""):'<div class="readiness-empty">NO PERSONNEL</div>';
 openDrawer('<p class="eyebrow">PERSONNEL // READINESS ROSTER</p><div class="detail-hero"><h2>CREW READINESS</h2><p class="detail-status">'+active.length+' ACTIVE / '+awol.length+' AWOL</p></div><div class="readiness-roster"><section><div class="readiness-roster-head"><span><i class="dot green"></i> ACTIVE DUTY</span><b>'+active.length+'</b></div>'+rows(active,"green")+'</section><section><div class="readiness-roster-head"><span><i class="dot red"></i> AWOL</span><b>'+awol.length+'</b></div>'+rows(awol,"red")+'</section></div>');
}
async function openMission(id){
 const m=state.missions.find(x=>x.id===id);if(!m)return;
 openDrawer('<div class="loading-detail">INITIALIZING MISSION COMMAND…</div>',"mission");
 const {data:{session}}=await sb.auth.getSession(); const uid=session?.user?.id;
 const [att,sign]=await Promise.all([sb.from("mission_attendees").select("*").eq("mission_id",id),sb.from("mission_signups").select("*").eq("mission_id",id)]);
 const attendance=att.data||[], signups=sign.data||[], mine=signups.find(x=>x.user_id===uid);
 const people=new Map(); attendance.forEach(x=>people.set(x.user_id,{...x,_source:"attendance"})); signups.forEach(x=>people.set(x.user_id,{...(people.get(x.user_id)||{}),...x,_source:"signup"}));
 const counts={going:0,maybe:0,not_going:0};signups.forEach(x=>{if(counts[x.status]!==undefined)counts[x.status]++});
 const roles=["Command","Pilot","Co-Pilot","Engineer","Turret Gunner","Fighter Pilot","Medical","Security / Boarding","Cargo / Logistics","Ground Team","Support"];
 const role='<section class="detail-section role-section"><div class="rsvp-head"><div><h4>OPERATIONAL ROLE</h4><p>Select your preferred station for this operation.</p></div><span id="roleCurrent">'+esc((mine?.operational_role||"UNASSIGNED").toUpperCase())+'</span></div><div class="role-grid">'+roles.map(r=>'<button data-role="'+esc(r)+'" class="'+(mine?.operational_role===r?"active":"")+'">'+esc(r.toUpperCase())+'</button>').join("")+'</div></section>';
 const rsvp='<section class="detail-section rsvp-section"><div class="rsvp-head"><div><h4>YOUR RSVP</h4><p>Set your availability for this operation.</p></div><span id="rsvpCurrent">'+esc((mine?.status||"NO RESPONSE").replaceAll("_"," ").toUpperCase())+'</span></div><div class="rsvp-actions"><button data-rsvp="going" class="'+(mine?.status==="going"?"active going":"")+'"><b>✓</b> GOING</button><button data-rsvp="maybe" class="'+(mine?.status==="maybe"?"active maybe":"")+'"><b>?</b> MAYBE</button><button data-rsvp="not_going" class="'+(mine?.status==="not_going"?"active no":"")+'"><b>×</b> NOT GOING</button><button data-rsvp="withdraw" class="withdraw"><b>↶</b> WITHDRAW</button></div><div class="rsvp-tally"><span><i class="dot green"></i><b>'+counts.going+'</b> Going</span><span><i class="dot amber"></i><b>'+counts.maybe+'</b> Maybe</span><span><i class="dot red"></i><b>'+counts.not_going+'</b> Not Going</span></div></section>';
 $("#detailBody").innerHTML='<p class="eyebrow">OPERATION FILE // '+esc((m.category||"OPERATION").toUpperCase())+'</p><div class="detail-hero"><div><h2>'+esc(m.title||"Untitled operation")+'</h2><p>'+esc((m.status||"PLANNED").toUpperCase())+'</p></div></div><section class="detail-section"><h4>MISSION DATA</h4><div class="detail-grid"><div class="detail-stat"><small>START</small><b>'+fmtDate(m.start_time)+' '+fmtTime(m.start_time)+'</b></div><div class="detail-stat"><small>DURATION</small><b>'+esc(m.hours?m.hours+" HRS":"—")+'</b></div><div class="detail-stat"><small>ORIGIN</small><b>'+esc(m.origin||"TBD")+'</b></div><div class="detail-stat"><small>DESTINATION</small><b>'+esc(m.destination||"TBD")+'</b></div></div></section><section class="detail-section"><h4>BRIEFING</h4><div class="detail-copy">'+esc(m.notes||"No briefing notes filed.")+'</div></section>'+rsvp+'<section class="detail-section"><h4>CREW / SIGNUPS</h4><div class="detail-list">'+(people.size?[...people.values()].map(x=>{const p=state.crew.find(z=>z.user_id===x.user_id);const st=(x.status||x.attendance||"recorded").replaceAll("_"," ");return '<div class="detail-item signup-person"><div><b>'+esc(p?.display_name||p?.handle||"Crew")+'</b><small>'+(x.operational_role?esc(x.operational_role):(x.role_in_mission?esc(x.role_in_mission):"JMBN CREW"))+'</small></div><span class="signup-state '+esc(x.status||"")+'">'+esc(st.toUpperCase())+'</span></div>'}).join(""):'<div class="detail-item"><small>No crew signups recorded.</small></div>')+'</div></section>';
 $("#detailBody [data-rsvp]").forEach(btn=>btn.onclick=()=>setRsvp(id,btn.dataset.rsvp));$("#detailBody [data-role]").forEach(btn=>btn.onclick=()=>setOperationalRole(id,btn.dataset.role));
}

async function setOperationalRole(missionId,role){
 const {data:{session}}=await sb.auth.getSession();if(!session){toast("Secure session required");return}
 const {data:existing}=await sb.from("mission_signups").select("status").eq("mission_id",missionId).eq("user_id",session.user.id).maybeSingle();
 const {error}=await sb.from("mission_signups").upsert({mission_id:missionId,user_id:session.user.id,status:existing?.status||"going",operational_role:role},{onConflict:"mission_id,user_id"});
 if(error){console.error(error);toast("Role update failed: "+error.message);return}
 toast("Operational role: "+role.toUpperCase());await openMission(missionId);
}
async function setRsvp(missionId,status){
 const {data:{session}}=await sb.auth.getSession();if(!session){toast("Secure session required");return}
 $$("#detailBody [data-rsvp]").forEach(b=>b.disabled=true);
 let error;
 if(status==="withdraw"){({error}=await sb.from("mission_signups").delete().eq("mission_id",missionId).eq("user_id",session.user.id));}
 else {({error}=await sb.from("mission_signups").upsert({mission_id:missionId,user_id:session.user.id,status},{onConflict:"mission_id,user_id"}));}
 if(error){console.error(error);toast("RSVP failed: "+error.message);$$("#detailBody [data-rsvp]").forEach(b=>b.disabled=false);return}
 toast(status==="withdraw"?"RSVP withdrawn":("RSVP: "+status.replaceAll("_"," ").toUpperCase()));
 await openMission(missionId);
}
document.addEventListener("click",e=>{const mission=e.target.closest("[data-mission]"),crew=e.target.closest("[data-user]");if(mission)openMission(mission.dataset.mission);else if(crew)openCrew(crew.dataset.user)});
document.addEventListener("keydown",e=>{if(e.key==="Enter"){const x=e.target.closest("[data-mission],[data-user]");if(x){x.dataset.mission?openMission(x.dataset.mission):openCrew(x.dataset.user)}}if(e.key==="Escape")closeDrawer()});
$("#detailClose").onclick=closeDrawer;$("#detailBackdrop").onclick=closeDrawer;


async function loadMyProfile(){
 const host=$("#profileView");if(!host)return;host.innerHTML='<div class="loading-detail">LOADING PERSONNEL DOSSIER…</div>';
 const {data:{session}}=await sb.auth.getSession();if(!session)return;const uid=session.user.id,p=state.crew.find(x=>x.user_id===uid)||state.profile||{};
 const [rank,prog,certs,attendance,discord,userRoles,specs]=await Promise.all([
  sb.from("v_profiles_with_rank").select("*").eq("user_id",uid).maybeSingle(),
  sb.from("v_user_rank_progress").select("*").eq("user_id",uid).maybeSingle(),
  sb.from("user_certifications").select("*").eq("user_id",uid),
  sb.from("mission_attendees").select("*").eq("user_id",uid),
  sb.from("discord_links").select("*").eq("user_id",uid).maybeSingle(),
  sb.from("user_roles").select("role_id").eq("user_id",uid),
  sb.from("academy_specialisation_ranks").select("*").eq("user_id",uid)
 ]);
 const rr=rank.data||{}, pr=prog.data||{}, cs=certs.data||[], at=attendance.data||[], dl=discord.data||{}, ur=userRoles.data||[], sp=specs.data||[];
 let roleNames=[];if(ur.length){const {data}=await sb.from("roles").select("*").in("id",ur.map(x=>x.role_id));roleNames=(data||[]).map(x=>x.name)}
 const name=p.display_name||p.handle||session.user.email?.split("@")[0]||"CREW", avatar=dl.avatar_url||"", rankArt=rr.rank_image_url||p.rank_image_url||"";
 const pct=Math.round(Math.min(100,Math.max(0,Math.min(Number(pr.pct_missions??100),Number(pr.pct_hours??100),Number(pr.pct_certs??100)))));
 host.innerHTML='<div class="profile-identity"><div class="profile-avatar">'+(avatar?'<img src="'+esc(avatar)+'">':esc(name.slice(0,2).toUpperCase()))+'</div><div class="profile-name"><p class="eyebrow">JMBN PERSONNEL IDENTIFICATION</p><h2>'+esc(name)+'</h2><div class="profile-rank">'+(rankArt?'<img src="'+esc(rankArt)+'">':'')+'<span>'+esc(rr.rank_name||pr.current_name||p.rank_code||"JMBN CREW")+(pr.current_paygrade?" // "+esc(pr.current_paygrade):"")+'</span></div><div class="profile-tags">'+roleNames.map(x=>'<span>'+esc(x)+'</span>').join("")+(p.availability_status?'<span>'+esc(p.availability_status.toUpperCase())+'</span>':'')+'</div></div><div class="verified-block"><i class="pulse"></i><b>IDENTITY VERIFIED</b><small>'+(dl.discord_id?"DISCORD LINKED":"JMBN ACCOUNT")+'</small></div></div>'+
 '<div class="profile-kpis"><div><b>'+esc(pr.missions_attended??p.missions_attended??at.length)+'</b><small>MISSIONS</small></div><div><b>'+esc(pr.hours_total??0)+'</b><small>OPERATIONAL HOURS</small></div><div><b>'+cs.length+'</b><small>CERTIFICATIONS</small></div><div><b>'+esc(pr.current_code||rr.rank_code||p.rank_code||"—")+'</b><small>CURRENT RANK</small></div></div>'+
 '<div class="profile-layout"><section class="panel"><div class="panel-head"><div><p class="eyebrow">01 // PERSONNEL</p><h3>Service Record</h3></div></div><div class="profile-rows"><p><span>HANDLE</span><b>'+esc(p.handle||dl.handle||"—")+'</b></p><p><span>SERVICE STATUS</span><b>'+esc((p.availability_status||"ACTIVE").toUpperCase())+'</b></p><p><span>RANK</span><b>'+esc(rr.rank_name||pr.current_name||"—")+'</b></p><p><span>RANK CODE</span><b>'+esc(rr.rank_code||pr.current_code||"—")+'</b></p><p><span>TRACK</span><b>'+esc(pr.current_category||pr.admin_track||p.rank_track||"—")+'</b></p></div></section>'+
 '<section class="panel"><div class="panel-head"><div><p class="eyebrow">ADVANCEMENT</p><h3>Rank Progression</h3></div></div><div class="rank-progress-head"><b>'+esc(pr.current_code||"—")+'</b><span>→</span><b>'+esc(pr.next_code||"MAX")+'</b></div><div class="profile-progress"><i style="width:'+pct+'%"></i></div><div class="profile-progress-label">'+pct+'% MINIMUM REQUIREMENT PROGRESS</div><div class="profile-requirements"><span>MISSIONS <b>'+esc(pr.missions_attended??0)+' / '+esc(pr.missions_target??"—")+'</b></span><span>HOURS <b>'+esc(pr.hours_total??0)+' / '+esc(pr.hours_target??"—")+'</b></span><span>CERTS <b>'+esc(pr.certifications_total??cs.length)+' / '+esc(pr.certification_target??"—")+'</b></span></div></section></div>'+
 '<section class="panel profile-wide"><div class="panel-head"><div><p class="eyebrow">QUALIFICATIONS</p><h3>Certification Record</h3></div><span class="tag">'+cs.length+' VERIFIED</span></div><div class="profile-cert-grid">'+(cs.length?cs.map(x=>'<div class="profile-cert"><b>'+esc(x.certification_code||x.code||"CERT")+'</b><small>'+fmtDate(x.awarded_at||x.created_at)+'</small></div>').join(""):'<div class="empty">No certifications recorded.</div>')+'</div></section>'+
 (sp.length?'<section class="panel profile-wide"><div class="panel-head"><div><p class="eyebrow">ACADEMY</p><h3>Specialisation Ranks</h3></div></div><div class="profile-cert-grid">'+sp.map(x=>'<div class="profile-cert"><b>'+esc(x.specialisation_code)+'</b><small>RANK '+esc(x.rank_id)+'</small></div>').join("")+'</div></section>':'')+
 '<section class="panel profile-wide"><div class="panel-head"><div><p class="eyebrow">SERVICE HISTORY</p><h3>Operational History</h3></div></div><div class="op-list">'+(at.length?at.slice().reverse().slice(0,10).map(x=>{const m=state.missions.find(z=>z.id===x.mission_id);return '<div class="op-row" data-mission="'+esc(x.mission_id)+'"><span class="op-date">'+fmtDate(m?.start_time||x.joined_at)+'</span><div><b>'+esc(m?.title||"Mission")+'</b><small>'+esc(x.role_in_mission||x.position_in_mission||"Crew")+'</small></div><span class="tag">'+esc((x.attendance||"RECORDED").toUpperCase())+'</span></div>'}).join(""):'<div class="empty">No operational history recorded.</div>')+'</div></section>'+
 '<div class="profile-actions"><button class="ghost" id="profileSignout">SIGN OUT OF MANIFEST</button></div>';
 $("#profileSignout").onclick=async()=>{if(confirm("Sign out of JMBN Manifest?")){await sb.auth.signOut();location.replace(base()+"auth.html")}}
}

function filterOps(){let q=$("#opSearch").value.toLowerCase(),f=$("[data-opfilter].active")?.dataset.opfilter||"all";let x=state.missions.filter(m=>(f==="all"||m.category===f)&&JSON.stringify(m).toLowerCase().includes(q));$("#operationsGrid").innerHTML=missionCards(x)}
function filterCrew(){let q=$("#crewSearch").value.toLowerCase(),f=$("[data-crewfilter].active")?.dataset.crewfilter||"all";let x=state.crew.filter(p=>(f==="all"||(f==="awol"?p.availability_status==="awol":p.availability_status!=="awol"))&&JSON.stringify(p).toLowerCase().includes(q));$("#crewGrid").innerHTML=crewCards(x)}
$$(".nav").forEach(b=>b.onclick=()=>{showView(b.dataset.view);if(b.dataset.view==="profile")loadMyProfile()});$$("[data-go]").forEach(b=>b.onclick=()=>showView(b.dataset.go));
$("#opSearch").oninput=filterOps;$("#crewSearch").oninput=filterCrew;$$("[data-opfilter]").forEach(b=>b.onclick=()=>{$$("[data-opfilter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");filterOps()});$$("[data-crewfilter]").forEach(b=>b.onclick=()=>{$$("[data-crewfilter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");filterCrew()});
$("#refreshOps").onclick=()=>{toast("Refreshing manifest…");load()};$("#readinessPanel").onclick=()=>openReadiness();$("#readinessPanel").onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openReadiness()}};$("#userBtn").onclick=()=>{showView("profile");loadMyProfile()};$("#welcomeProfile").onclick=()=>{showView("profile");loadMyProfile()};$("#dutyActive").onclick=()=>setDutyStatus("active");$("#dutyAwol").onclick=()=>setDutyStatus("awol");
setInterval(()=>{$("#clock").textContent=new Date().toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit",hour12:false})},1000);
const initialView=location.hash.replace("#","");if(["command","operations","crew","academy","records","profile"].includes(initialView))showView(initialView);
let liveTimer;function liveRefresh(){clearTimeout(liveTimer);liveTimer=setTimeout(()=>load().then(()=>toast("Manifest updated")).catch(()=>{}),450)}
sb.channel("jmbn-manifest-live").on("postgres_changes",{event:"*",schema:"public",table:"missions"},liveRefresh).on("postgres_changes",{event:"*",schema:"public",table:"profiles"},liveRefresh).on("postgres_changes",{event:"*",schema:"public",table:"announcements"},liveRefresh).on("postgres_changes",{event:"*",schema:"public",table:"mission_signups"},liveRefresh).subscribe();
load().catch(e=>{console.error(e);toast("Manifest sync failed")});