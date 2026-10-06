const URL="https://fcegavhipeaeihxegsnw.supabase.co";
const KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZWdhdmhpcGVhZWloeGVnc253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMjk3NTcsImV4cCI6MjA3NzcwNTc1N30.i-ZjOlKc89-uA7fqOIvmAMv60-C2_NmKikRI_78Jei8";
const sb=window.jmbnClient||(window.jmbnClient=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,flowType:"pkce",autoRefreshToken:true}}));
let state={missions:[],crew:[],certs:[],announcements:[],profile:null,mySignups:[]};
function missionEnd(m){const start=new Date(m?.start_time||0);const hrs=Math.max(Number(m?.hours)||0,0);return new Date(start.getTime()+hrs*3600000)}
function missionLocked(m){return !!m?.start_time&&new Date()>=missionEnd(m)}
function isAttendingSignup(s){return s?.attendance_confirmed===true}
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function base(){const p=location.pathname.split("/").filter(Boolean);return /github\.io$/.test(location.hostname)&&p.length?"/"+p[0]+"/":"/"}
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2200)}
function showView(id){$$(".view").forEach(v=>v.classList.toggle("active",v.id===id));$$(".nav").forEach(n=>n.classList.toggle("active",n.dataset.view===id));$("#pageTitle").textContent={command:"COMMAND DECK",operations:"OPERATIONS",crew:"CREW MANIFEST",academy:"ACADEMY",records:"RECORDS",profile:"PERSONNEL DOSSIER"}[id]||"JMBN";history.replaceState(null,"","#"+id);scrollTo(0,0)}
function img(bucket,name){return URL+"/storage/v1/object/public/"+encodeURIComponent(bucket)+"/"+name.split("/").map(encodeURIComponent).join("/")}
function fmtDate(v){if(!v)return"TBD";return new Date(v).toLocaleDateString("en-SG",{day:"2-digit",month:"short",year:"2-digit"}).toUpperCase()}
function fmtTime(v){if(!v)return"";return new Date(v).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit",hour12:false})}
function missionRows(items,n=4){if(!items.length)return'<div class="empty">No operations in the manifest yet.</div>';return items.slice(0,n).map(m=>'<div class="op-row" data-mission="'+esc(m.id)+'" tabindex="0"><span class="op-date">'+fmtDate(m.start_time)+'</span><div><b>'+esc(m.title||"Untitled operation")+'</b><small>'+esc([m.origin,m.destination].filter(Boolean).join(" → ")||m.type||"Mission")+'</small></div><span class="tag">'+esc(m.category||m.status||"OP")+'</span></div>').join("")}
function missionCards(items){if(!items.length)return'<div class="empty">No matching operations.</div>';return items.map(m=>{const locked=missionLocked(m);return '<article class="mission-card '+(locked?'mission-locked':'')+'" data-mission="'+esc(m.id)+'" tabindex="0"><span class="tag">'+esc(m.category||"operation")+'</span><h3>'+esc(m.title||"Untitled operation")+'</h3><div class="route"><span>'+esc(m.origin||"TBD")+'</span><span>→</span><span>'+esc(m.destination||"TBD")+'</span></div><div class="mission-meta"><span>'+fmtDate(m.start_time)+' / '+fmtTime(m.start_time)+'</span><span>'+(locked?'COMPLETED · LOCKED':esc(m.status||"PLANNED"))+'</span></div></article>'}).join("")}
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
 document.querySelectorAll("#academy [data-acfilter]").forEach(b=>b.onclick=()=>{document.querySelectorAll("#academy [data-acfilter]").forEach(x=>x.classList.toggle("active",x===b));renderAcademyProgrammes(b.dataset.acfilter,earnedSet,reqs,assignment)});
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
function renderPendingAccess(session,profile){
 const name=profile?.display_name||profile?.handle||session.user.user_metadata?.full_name||session.user.user_metadata?.name||"CREW";
 document.body.innerHTML='<div style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#070806;color:#e8e5d8;font-family:Play,sans-serif"><section style="width:min(620px,100%);border:1px solid #665b2c;background:#0b0c09;padding:38px;box-shadow:0 0 60px #000"><p style="margin:0 0 12px;color:#bda54c;font-size:11px;letter-spacing:.18em">JMBN // PERSONNEL ACCESS</p><h1 style="margin:0 0 14px;font-size:32px;letter-spacing:.05em">WELCOME, '+esc(name.toUpperCase())+'</h1><p style="color:#aaa896;line-height:1.65">Your Discord identity has been verified and your JMBN personnel record has been created.</p><div style="margin:26px 0;padding:18px;border-left:2px solid #c6aa45;background:#11120d"><b style="display:block;color:#d8bf60;letter-spacing:.1em">ACCESS PENDING</b><span style="display:block;margin-top:8px;color:#aaa896;line-height:1.5">Command approval is required before the Manifest, Operations and Academy network becomes available.</span></div><button id="pendingLogout" style="border:1px solid #665b2c;background:transparent;color:#d8bf60;padding:11px 18px;font:700 12px Play,sans-serif;letter-spacing:.12em;cursor:pointer">SIGN OUT</button></section></div>';
 document.getElementById("pendingLogout")?.addEventListener("click",async()=>{await sb.auth.signOut();location.replace(base()+"auth.html")});
}

async function load(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){location.replace(base()+"auth.html");return}
 const uid=session.user.id;
 const [prof,missions,crew,certs,ann,mySignups]=await Promise.all([
  sb.from("profiles").select("*").eq("user_id",uid).maybeSingle(),
  sb.from("missions").select("*").order("start_time",{ascending:true}),
  sb.from("profiles").select("*").order("display_name",{ascending:true}),
  sb.from("certifications").select("*"),
  sb.from("announcements").select("*").order("created_at",{ascending:false}).limit(5),
  sb.from("mission_signups").select("mission_id,status,operational_role,operational_station,overlay_readiness,attendance_confirmed,created_at").eq("user_id",uid)
 ]);
 state.profile=prof.data||{};state.missions=missions.data||[];state.crew=crew.data||[];state.certs=certs.data||[];state.announcements=ann.data||[];state.mySignups=mySignups.data||[];
 if(!prof.data||String(state.profile.role||"Guest").toLowerCase()==="guest"){renderPendingAccess(session,state.profile);return}
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
 filterOps();$("#crewGrid").innerHTML=crewCards(state.crew);$("#certGrid").innerHTML=certCards(state.certs);const creditedIds=new Set(state.mySignups.filter(isAttendingSignup).map(x=>String(x.mission_id)));const credited=state.missions.filter(m=>missionLocked(m)&&creditedIds.has(String(m.id))).sort((a,b)=>new Date(b.start_time)-new Date(a.start_time));$("#recordMissions").innerHTML=missionRows(credited,50);
 $("#announcements").classList.remove("skeleton");$("#announcements").innerHTML=state.announcements.length?state.announcements.map(a=>'<div class="feed-item"><b>'+esc(a.title||"Command notice")+'</b><p>'+esc(a.body||a.message||a.content||"")+'</p></div>').join(""):'<div class="empty">No current signal traffic.</div>';
}

function openDrawer(html,mode="personnel"){$("#detailBody").innerHTML=html;$("#detailDrawer").classList.toggle("mission-command",mode==="mission");$("#detailDrawer").classList.add("open");$("#detailBackdrop").classList.add("open")}
function closeDrawer(){activeMissionId=null;$("#detailDrawer").classList.remove("open","mission-command");$("#detailBackdrop").classList.remove("open")}
async function openCrew(userId){
 const p=state.crew.find(x=>x.user_id===userId);if(!p)return;
 openDrawer('<div class="loading-detail">LOADING PERSONNEL FILE…</div>');
 const [certs,attendance,role,rank]=await Promise.all([
  sb.from("user_certifications").select("certification_code,awarded_at").eq("user_id",userId),
  sb.from("mission_signups").select("mission_id,status,operational_role,operational_station,created_at").eq("user_id",userId),
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
let activeMissionId=null;
const POLARIS_STATIONS=[
 {id:"air",label:"AIR",x:21.2,y:77.9},{id:"helmsman",label:"HELMSMAN",x:12.4,y:87.0},
 {id:"surface",label:"SURFACE",x:16.9,y:71.7},{id:"ood",label:"OOD",x:10.4,y:79.0},
 {id:"command_chair",label:"COMMAND CHAIR",x:14.0,y:77.4},{id:"engineering_duty_officer",label:"ENGINEER",x:71.5,y:40.2},
 {id:"torpedo_director",label:"TORPEDO DIRECTOR",x:35.3,y:72.4},{id:"mount_3_1",label:"MOUNT 3-1",x:78.8,y:61.2},
 {id:"mount_3_2",label:"MOUNT 3-2",x:45.7,y:37.0},{id:"mount_4_1",label:"MOUNT 4-1",x:50.6,y:54.7},
 {id:"mount_4_2",label:"MOUNT 4-2",x:38.3,y:46.8},{id:"mount_6_1",label:"MOUNT 6-1",x:29.7,y:88.5}
];
function stationLabel(id){return POLARIS_STATIONS.find(s=>s.id===id)?.label||"UNASSIGNED"}
function polarisMap(signups,canAssign){
 const assigned=new Map(signups.filter(x=>x.operational_station).map(x=>[x.operational_station,x]));
 const markers=POLARIS_STATIONS.map(s=>{const x=assigned.get(s.id),p=x&&state.crew.find(z=>z.user_id===x.user_id),name=x?(p?.display_name||p?.handle||"Crew"):"";return '<div class="polaris-marker '+(name?'manned':'empty')+'" style="left:'+s.x+'%;top:'+s.y+'%"><i></i>'+(name?'<b>'+esc(name)+'</b>':'<small>'+esc(s.label)+'</small>')+'</div>'}).join("");
 return '<section class="detail-section polaris-section"><div class="polaris-head"><div><h4>POLARIS // CREW STATIONS</h4><p>Live manning plan · '+(canAssign?'Command assignment enabled':'View only')+'</p></div><span>'+assigned.size+' / '+POLARIS_STATIONS.length+' MANNED</span></div><div class="polaris-map"><img src="assets/polaris-stations.jpg" alt="Polaris station plan" onerror="this.classList.add(\'map-missing\')"><div class="polaris-markers">'+markers+'</div></div></section>';
}

async function openMission(id){
 const m=state.missions.find(x=>String(x.id)===String(id));if(!m){toast("Mission not found. Refresh Operations.");return}activeMissionId=m.id;
 openDrawer('<div class="loading-detail">INITIALIZING MISSION COMMAND…</div>',"mission");
 const {data:{session},error:authError}=await sb.auth.getSession();if(authError||!session){$("#detailBody").textContent="Sign in to view operations.";return}const uid=session.user.id;
 const sign=await sb.from("mission_signups").select("*").eq("mission_id",id);
 if(sign.error){console.error("Operation signups:",sign.error);$("#detailBody").textContent="Unable to load this mission. Please try again.";return}const signups=sign.data||[], mine=signups.find(x=>x.user_id===uid);
 const people=new Map(); signups.forEach(x=>people.set(x.user_id,{...x,status:String(x.status||"").toLowerCase(),_source:"signup"}));
 const counts={going:0,maybe:0,not_going:0};signups.forEach(x=>{const s=String(x.status||"").toLowerCase();if(counts[s]!==undefined)counts[s]++});
 const roles=["Command","Pilot","Co-Pilot","Engineer","Turret Gunner","Fighter Pilot","Medical","Security / Boarding","Cargo / Logistics","Ground Team","Support"];
 const officer=await sb.rpc("is_elevated",{u:uid});const canAssign=officer.data===true&&!officer.error;
 const stationOptions=(current,userId)=>'<option value="">Unassigned</option>'+POLARIS_STATIONS.map(s=>{const occupied=signups.some(x=>x.user_id!==userId&&x.operational_station===s.id);return '<option value="'+s.id+'" '+(current===s.id?'selected':'')+' '+(occupied?'disabled':'')+'>'+esc(s.label)+(occupied?' · OCCUPIED':'')+'</option>'}).join("");
 let overlayState=null;try{const q=await sb.from("overlay_operation_state").select("mission_id").eq("singleton",true).maybeSingle();overlayState=q.data}catch(e){console.warn("Overlay state unavailable",e)}
 const isOverlayActive=String(overlayState?.mission_id||"")===String(id);
 const overlayControl=canAssign?'<section class="detail-section"><div class="rsvp-head"><div><h4>OVERLAY OPERATION</h4><p>Command controls which operation every crew overlay loads.</p></div><span>'+(isOverlayActive?'ACTIVE':'STANDBY')+'</span></div><div class="rsvp-actions"><button data-overlay-mission="'+esc(id)+'" data-overlay-action="'+(isOverlayActive?'clear':'activate')+'" class="'+(isOverlayActive?'active going':'')+'">'+(isOverlayActive?'STOP OVERLAY OPERATION':'LOAD TO CREW OVERLAY')+'</button></div></section>':'';
 const durationControl=canAssign?'<section class="detail-section"><div class="rsvp-head"><div><h4>MISSION DURATION</h4><p>Command can extend or correct duration. Updating hours moves the automatic lock time.</p></div><span>'+esc(m.hours??0)+' HRS</span></div><div class="crew-assignment-fields"><label class="assignment-label"><span>Mission hours:</span><input data-mission-hours="'+esc(id)+'" type="number" min="0.1" step="0.1" value="'+esc(m.hours??"")+'"></label><button class="primary" data-save-mission-hours="'+esc(id)+'">UPDATE DURATION</button></div></section>':'';
 const role='<section class="detail-section role-section"><div class="rsvp-head"><div><h4>YOUR ASSIGNMENT</h4><p>'+(canAssign?'Command team can assign roles and Polaris stations below.':'Crew station plan is view only.')+'</p></div><span id="roleCurrent">'+esc((mine?.operational_station?stationLabel(mine.operational_station):mine?.operational_role||"UNASSIGNED").toUpperCase())+'</span></div></section>';
 const locked=missionLocked(m);
 const rsvp=locked?'<section class="detail-section rsvp-section mission-locked-notice"><div class="rsvp-head"><div><h4>MISSION COMPLETE</h4><p>This manifest is locked. Historical corrections require Command/Admin.</p></div><span>LOCKED</span></div></section>':'<section class="detail-section rsvp-section"><div class="rsvp-head"><div><h4>YOUR RSVP</h4><p>Set your availability for this operation.</p></div><span id="rsvpCurrent">'+esc((mine?.status||"NO RESPONSE").replaceAll("_"," ").toUpperCase())+'</span></div><div class="rsvp-actions"><button data-rsvp="going" class="'+(mine?.status==="going"?"active going":"")+'"><b>✓</b> GOING</button><button data-rsvp="maybe" class="'+(mine?.status==="maybe"?"active maybe":"")+'"><b>?</b> MAYBE</button><button data-rsvp="not_going" class="'+(mine?.status==="not_going"?"active no":"")+'"><b>×</b> NOT GOING</button><button data-rsvp="withdraw" class="withdraw"><b>↶</b> WITHDRAW</button></div><div class="rsvp-tally"><span><i class="dot green"></i><b>'+counts.going+'</b> Going</span><span><i class="dot amber"></i><b>'+counts.maybe+'</b> Maybe</span><span><i class="dot red"></i><b>'+counts.not_going+'</b> Not Going</span></div></section>';
 $("#detailBody").innerHTML='<p class="eyebrow">OPERATION FILE // '+esc((m.category||"OPERATION").toUpperCase())+'</p><div class="detail-hero"><div><h2>'+esc(m.title||"Untitled operation")+'</h2><p>'+(locked?'COMPLETED · LOCKED':esc((m.status||"PLANNED").toUpperCase()))+'</p></div></div><section class="detail-section"><h4>MISSION DATA</h4><div class="detail-grid"><div class="detail-stat"><small>START</small><b>'+fmtDate(m.start_time)+' '+fmtTime(m.start_time)+'</b></div><div class="detail-stat"><small>DURATION</small><b>'+esc(m.hours?m.hours+" HRS":"—")+'</b></div><div class="detail-stat"><small>ORIGIN</small><b>'+esc(m.origin||"TBD")+'</b></div><div class="detail-stat"><small>DESTINATION</small><b>'+esc(m.destination||"TBD")+'</b></div></div></section><section class="detail-section"><h4>BRIEFING</h4><div class="detail-copy">'+esc(m.notes||"No briefing notes filed.")+'</div></section>'+rsvp+durationControl+overlayControl+role+'<section class="detail-section"><h4>CREW / SIGNUPS</h4><div class="detail-list">'+(people.size?[...people.values()].map(x=>{const p=state.crew.find(z=>z.user_id===x.user_id);const st=(x.status||x.attendance||"recorded").replaceAll("_"," ");return '<div class="detail-item signup-person crew-assignment-card"><div class="crew-assignment-head"><div class="attendance-name"><b>'+esc(p?.display_name||p?.handle||"Crew")+'</b>'+(canAssign&&String(x.status||"").toLowerCase()==="going"?'<label class="attendance-check"><input type="checkbox" data-attendance-user="'+esc(x.user_id)+'" '+(x.attendance_confirmed?"checked":"")+'> ATTENDED</label>':'')+'</div><span class="signup-state '+esc(x.status||"")+'">'+esc(st.toUpperCase())+'</span></div>'+(canAssign&&["going","maybe"].includes(String(x.status||"").toLowerCase())?'<div class="crew-assignment-fields"><label class="assignment-label"><span>Role:</span><select data-assign-user="'+esc(x.user_id)+'"><option value="">Unassigned</option>'+roles.map(r=>'<option value="'+esc(r)+'" '+(x.operational_role===r?'selected':'')+'>'+esc(r)+'</option>').join("")+'</select></label><label class="assignment-label"><span>Polaris Station:</span><select data-station-user="'+esc(x.user_id)+'">'+stationOptions(x.operational_station,x.user_id)+'</select></label></div>':'<div class="crew-assignment-readonly"><span>Role: <b>'+esc(x.operational_role||"Unassigned")+'</b></span><span>Polaris Station: <b>'+esc(x.operational_station?stationLabel(x.operational_station):"Unassigned")+'</b></span></div>')+'</div>'}).join(""):'<div class="detail-item"><small>No crew signups recorded.</small></div>')+'</div></section>';
}
async function setMissionAttendance(missionId,userId,attended,control){control.disabled=true;try{const {error}=await sb.rpc("command_set_mission_attendance",{p_mission_id:missionId,p_user_id:userId,p_attended:attended});if(error)throw error;toast(attended?"Attendance confirmed":"Attendance removed");await openMission(missionId)}catch(e){console.error(e);control.checked=!attended;toast("Attendance update failed");control.disabled=false}}
async function assignCrewRole(missionId,userId,role,control){
 control.disabled=true;try{const {error}=await sb.rpc("command_assign_mission_role",{p_mission_id:missionId,p_user_id:userId,p_role:role||null});if(error)throw error;toast(role?"Assigned: "+role:"Role cleared");await openMission(missionId)}catch(e){console.error(e);toast("Assignment failed: "+(e.message||"try again"));control.disabled=false}
}
async function assignCrewStation(missionId,userId,station,control){
 control.disabled=true;try{const {error}=await sb.rpc("command_assign_mission_station",{p_mission_id:missionId,p_user_id:userId,p_station:station||null});if(error)throw error;toast(station?"Station: "+stationLabel(station):"Station cleared");await openMission(missionId)}catch(e){console.error(e);toast("Station failed: "+(e.message||"try again"));control.disabled=false}
}

async function setRsvp(missionId,status){
 const buttons=[...document.querySelectorAll("#detailBody [data-rsvp]")];
 buttons.forEach(b=>b.disabled=true);
 try{
  const {data:{session},error:sessionError}=await sb.auth.getSession();
  if(sessionError||!session){toast("Secure session required");return}
  const uid=session.user.id;
  let error;
  if(status==="withdraw"){
   ({error}=await sb.from("mission_signups").delete().eq("mission_id",missionId).eq("user_id",uid));
  }else{
   const {data:existing,error:lookupError}=await sb.from("mission_signups").select("operational_role").eq("mission_id",missionId).eq("user_id",uid).maybeSingle();
   if(lookupError)throw lookupError;
   ({error}=await sb.from("mission_signups").upsert({mission_id:missionId,user_id:uid,status,...(existing?.operational_role?{operational_role:existing.operational_role}:{})},{onConflict:"mission_id,user_id"}));
  }
  if(error)throw error;
  toast(status==="withdraw"?"RSVP withdrawn":"RSVP: "+status.replaceAll("_"," ").toUpperCase());
  await openMission(missionId);
 }catch(error){
  console.error("Mission RSVP failed:",error);
  toast("RSVP failed: "+(error.message||"please try again"));
 }finally{buttons.forEach(b=>b.disabled=false)}
}

async function updateMissionHours(missionId,control){
 const input=document.querySelector('#detailBody [data-mission-hours="'+CSS.escape(String(missionId))+'"]');
 const hours=Number(input?.value);
 if(!Number.isFinite(hours)||hours<=0){toast("Enter mission hours greater than 0");return}
 control.disabled=true;
 try{
  const {error}=await sb.from("missions").update({hours}).eq("id",missionId);
  if(error)throw error;
  const m=state.missions.find(x=>String(x.id)===String(missionId));if(m)m.hours=hours;
  toast("Mission duration updated to "+hours+" hrs");
  await openMission(missionId);render();
 }catch(e){console.error(e);toast("Duration update failed: "+(e.message||"try again"));control.disabled=false}
}
async function setOverlayOperation(missionId,activate,control){
 control.disabled=true;try{const {error}=await sb.rpc("command_set_active_overlay_operation",{p_mission_id:activate?missionId:null});if(error)throw error;toast(activate?"Operation loaded to crew overlay":"Overlay operation stopped");await openMission(missionId)}catch(e){console.error(e);toast("Overlay command failed: "+(e.message||"try again"));control.disabled=false}
}
document.addEventListener("click",e=>{const attendance=e.target.closest("#detailBody [data-attendance-user]");if(attendance){e.stopPropagation();if(activeMissionId&&!attendance.disabled)setMissionAttendance(activeMissionId,attendance.dataset.attendanceUser,attendance.checked,attendance);return}const t=e.target.closest("button,[data-mission],[data-user]");if(!t)return;const hoursBtn=t.closest("#detailBody [data-save-mission-hours]");if(hoursBtn){e.preventDefault();e.stopPropagation();if(!hoursBtn.disabled)updateMissionHours(hoursBtn.dataset.saveMissionHours,hoursBtn);return}const overlay=t.closest("#detailBody [data-overlay-mission]");if(overlay){e.preventDefault();e.stopPropagation();if(!overlay.disabled)setOverlayOperation(overlay.dataset.overlayMission,overlay.dataset.overlayAction==="activate",overlay);return}const r=t.closest("#detailBody [data-rsvp]");if(r){e.preventDefault();e.stopPropagation();if(!r.disabled&&activeMissionId)setRsvp(activeMissionId,r.dataset.rsvp);return}const role=t.closest("#detailBody [data-role]");if(role){e.preventDefault();e.stopPropagation();if(!role.disabled&&activeMissionId)toast("Command assigns operational roles.");return}const mission=t.closest("[data-mission]");if(mission?.dataset.mission){openMission(mission.dataset.mission);return}const crew=t.closest("[data-user]");if(crew?.dataset.user)openCrew(crew.dataset.user)});
document.addEventListener("keydown",e=>{if(e.key==="Enter"){const x=e.target.closest("[data-mission],[data-user]");if(x){x.dataset.mission?openMission(x.dataset.mission):openCrew(x.dataset.user)}}if(e.key==="Escape")closeDrawer()});
$("#detailClose").onclick=closeDrawer;$("#detailBackdrop").onclick=closeDrawer;


async function loadMyProfile(){
 const host=$("#profileView");if(!host)return;host.innerHTML='<div class="loading-detail">LOADING PERSONNEL DOSSIER…</div>';
 const {data:{session}}=await sb.auth.getSession();if(!session)return;const uid=session.user.id,p=state.crew.find(x=>x.user_id===uid)||state.profile||{};
 const [rank,prog,certs,attendance,discord,userRoles,specs,allRanks,allCerts]=await Promise.all([
  sb.from("v_profiles_with_rank").select("*").eq("user_id",uid).maybeSingle(),
  sb.from("v_user_rank_progress").select("*").eq("user_id",uid).maybeSingle(),
  sb.from("user_certifications").select("*").eq("user_id",uid),
  sb.from("mission_signups").select("*").eq("user_id",uid).eq("attendance_confirmed",true),
  sb.from("discord_links").select("*").eq("user_id",uid).maybeSingle(),
  sb.from("user_roles").select("role_id").eq("user_id",uid),
  sb.from("academy_specialisation_ranks").select("*").eq("user_id",uid),
  sb.from("ranks").select("id,code,name,category,paygrade,sort_order,image_url").eq("is_active",true).order("sort_order"),
  sb.from("certifications").select("certification_code,name,image_url,sort_order").order("sort_order")
 ]);
 const rr=rank.data||{}, pr=prog.data||{}, cs=certs.data||[], at=(attendance.data||[]).filter(x=>{const m=state.missions.find(z=>String(z.id)===String(x.mission_id));return m&&missionLocked(m)}), dl=discord.data||{}, ur=userRoles.data||[], sp=specs.data||[];
 let roleNames=[];if(ur.length){const {data}=await sb.from("roles").select("*").in("id",ur.map(x=>x.role_id));roleNames=(data||[]).map(x=>x.name)}
 const name=p.display_name||p.handle||session.user.email?.split("@")[0]||"CREW", avatar=dl.avatar_url||"", rankArt=rr.rank_image_url||p.rank_image_url||"";
 const ranks=allRanks.data||[], currentCode=pr.current_code||rr.rank_code||p.rank_code||"", nextCode=pr.next_code||"";
 const currentRank=ranks.find(x=>x.code===currentCode)||{code:currentCode,name:pr.current_name||rr.rank_name||"",paygrade:pr.current_paygrade||"",image_url:rankArt,category:pr.current_category||rr.category||""};
 const trackRanks=ranks.filter(x=>!currentRank.category||String(x.category).toLowerCase()===String(currentRank.category).toLowerCase()), currentIndex=trackRanks.findIndex(x=>x.code===currentCode);
 const nextRank=ranks.find(x=>x.code===nextCode)||(currentIndex>=0?trackRanks[currentIndex+1]:null);
 const rankRail=trackRanks.map((x,i)=>'<div class="profile-rank-step '+(x.code===currentCode?"current":(currentIndex>=0&&i<currentIndex?"earned":"future"))+'">'+(x.image_url?'<img src="'+esc(x.image_url)+'" alt="'+esc(x.code)+'">':'<span class="rank-step-fallback">◇</span>')+'<b>'+esc(x.code)+'</b><small>'+esc(x.paygrade||"")+'</small></div>').join("");
 const pct=Math.round(Math.min(100,Math.max(0,Math.min(Number(pr.pct_missions??100),Number(pr.pct_hours??100),Number(pr.pct_certs??100)))));
 host.innerHTML='<div class="profile-identity"><div class="profile-avatar">'+(avatar?'<img src="'+esc(avatar)+'">':esc(name.slice(0,2).toUpperCase()))+'</div><div class="profile-name"><p class="eyebrow">JMBN PERSONNEL IDENTIFICATION</p><h2>'+esc(name)+'</h2><div class="profile-rank">'+(rankArt?'<img src="'+esc(rankArt)+'">':'')+'<span>'+esc(rr.rank_name||pr.current_name||p.rank_code||"JMBN CREW")+(pr.current_paygrade?" // "+esc(pr.current_paygrade):"")+'</span></div><div class="profile-tags">'+roleNames.map(x=>'<span>'+esc(x)+'</span>').join("")+(p.availability_status?'<span>'+esc(p.availability_status.toUpperCase())+'</span>':'')+'</div></div><div class="verified-block"><i class="pulse"></i><b>IDENTITY VERIFIED</b><small>'+(dl.discord_id?"DISCORD LINKED":"JMBN ACCOUNT")+'</small></div></div>'+
 '<div class="profile-kpis"><div><b>'+esc(pr.missions_attended??p.missions_attended??at.length)+'</b><small>MISSIONS</small></div><div><b>'+esc(pr.hours_total??0)+'</b><small>OPERATIONAL HOURS</small></div><div><b>'+cs.length+'</b><small>CERTIFICATIONS</small></div><div><b>'+esc(pr.current_code||rr.rank_code||p.rank_code||"—")+'</b><small>CURRENT RANK</small></div></div>'+
 '<div class="profile-layout"><section class="panel"><div class="panel-head"><div><p class="eyebrow">01 // PERSONNEL</p><h3>Service Record</h3></div></div><div class="profile-rows"><p><span>HANDLE</span><b>'+esc(p.handle||dl.handle||"—")+'</b></p><p><span>SERVICE STATUS</span><b>'+esc((p.availability_status||"ACTIVE").toUpperCase())+'</b></p><p><span>RANK</span><b>'+esc(rr.rank_name||pr.current_name||"—")+'</b></p><p><span>RANK CODE</span><b>'+esc(rr.rank_code||pr.current_code||"—")+'</b></p><p><span>TRACK</span><b>'+esc(pr.current_category||pr.admin_track||p.rank_track||"—")+'</b></p></div></section>'+
 '<section class="panel profile-advancement"><div class="panel-head"><div><p class="eyebrow">ADVANCEMENT PATH</p><h3>Current Rank → Next Rank</h3></div></div><div class="profile-rank-route"><div class="profile-rank-box current">'+(currentRank.image_url?'<img src="'+esc(currentRank.image_url)+'" alt="'+esc(currentRank.code||"Current rank")+'">':'')+'<div><small>CURRENT RANK</small><b>'+esc(currentRank.name||currentRank.code||"—")+'</b><span>'+esc(currentRank.code||"—")+(currentRank.paygrade?" // PG: "+esc(currentRank.paygrade):"")+'</span></div></div><div class="profile-rank-arrow"><b>→</b><small>ADVANCE</small></div><div class="profile-rank-box next">'+(nextRank?.image_url?'<img src="'+esc(nextRank.image_url)+'" alt="'+esc(nextRank.code||"Next rank")+'">':'')+'<div><small>NEXT RANK</small><b>'+esc(nextRank?.name||nextRank?.code||"MAXIMUM RANK")+'</b><span>'+esc(nextRank?.code||"MAX")+(nextRank?.paygrade?" // PG: "+esc(nextRank.paygrade):"")+'</span></div></div></div><div class="profile-rank-rail-wrap"><div class="profile-rank-rail-title"><span>'+esc(currentRank.category||"JMBN")+' RANK PATH</span><small>CURRENT RANK HIGHLIGHTED</small></div><div class="profile-rank-rail">'+rankRail+'</div></div><div class="profile-progress"><i style="width:'+pct+'%"></i></div><div class="profile-progress-label">'+pct+'% MINIMUM REQUIREMENT PROGRESS</div><div class="profile-requirements"><span>MISSIONS <b>'+esc(pr.missions_attended??0)+' / '+esc(pr.missions_target??"—")+'</b></span><span>HOURS <b>'+esc(pr.hours_total??0)+' / '+esc(pr.hours_target??"—")+'</b></span><span>CERTS <b>'+esc(pr.certifications_total??cs.length)+' / '+esc(pr.certification_target??"—")+'</b></span></div></section></div>'+
 '<section class="panel profile-wide profile-cert-record"><div class="panel-head"><div><p class="eyebrow">QUALIFICATIONS</p><h3>Certification Record</h3></div><span class="tag">'+cs.length+' VERIFIED</span></div><div class="profile-cert-medals">'+(certMedals||'<div class="empty">No certifications configured.</div>')+'</div><p class="profile-cert-hint">Dim medals are not yet earned.</p></section>'+
 (sp.length?'<section class="panel profile-wide"><div class="panel-head"><div><p class="eyebrow">ACADEMY</p><h3>Specialisation Ranks</h3></div></div><div class="profile-cert-grid">'+sp.map(x=>'<div class="profile-cert"><b>'+esc(x.specialisation_code)+'</b><small>RANK '+esc(x.rank_id)+'</small></div>').join("")+'</div></section>':'')+
 '<section class="panel profile-wide"><div class="panel-head"><div><p class="eyebrow">SERVICE HISTORY</p><h3>Operational History</h3></div></div><div class="op-list">'+(at.length?at.slice().reverse().slice(0,10).map(x=>{const m=state.missions.find(z=>z.id===x.mission_id);return '<div class="op-row" data-mission="'+esc(x.mission_id)+'"><span class="op-date">'+fmtDate(m?.start_time||x.joined_at)+'</span><div><b>'+esc(m?.title||"Mission")+'</b><small>'+esc(x.role_in_mission||x.position_in_mission||"Crew")+'</small></div><span class="tag">'+esc((x.attendance||"RECORDED").toUpperCase())+'</span></div>'}).join(""):'<div class="empty">No operational history recorded.</div>')+'</div></section>'+
 '<div class="profile-actions"><button class="ghost" id="profileSignout">SIGN OUT OF MANIFEST</button></div>';
 $("#profileSignout").onclick=async()=>{if(confirm("Sign out of JMBN Manifest?")){await sb.auth.signOut();location.replace(base()+"auth.html")}}
}

function filterOps(){let q=$("#opSearch").value.toLowerCase(),f=$("[data-opfilter].active")?.dataset.opfilter||"all";let x=state.missions.filter(m=>(f==="all"||(f==="operations"?String(m.category||"operations").toLowerCase()!=="resource":String(m.category||"").toLowerCase()==="resource"))&&JSON.stringify(m).toLowerCase().includes(q));$("#operationsGrid").innerHTML=missionCards(x)}
function filterCrew(){let q=$("#crewSearch").value.toLowerCase(),f=$("[data-crewfilter].active")?.dataset.crewfilter||"all";let x=state.crew.filter(p=>(f==="all"||(f==="awol"?p.availability_status==="awol":p.availability_status!=="awol"))&&JSON.stringify(p).toLowerCase().includes(q));$("#crewGrid").innerHTML=crewCards(x)}
document.querySelectorAll(".nav[data-view]").forEach(b=>b.onclick=()=>{showView(b.dataset.view);if(b.dataset.view==="profile")loadMyProfile()});$$("[data-go]").forEach(b=>b.onclick=()=>showView(b.dataset.go));
$("#opSearch").oninput=filterOps;$("#crewSearch").oninput=filterCrew;$$("[data-opfilter]").forEach(b=>b.onclick=()=>{$$("[data-opfilter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");filterOps()});$$("[data-crewfilter]").forEach(b=>b.onclick=()=>{$$("[data-crewfilter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");filterCrew()});
$("#refreshOps").onclick=()=>{toast("Refreshing manifest…");load()};$("#readinessPanel").onclick=()=>openReadiness();$("#readinessPanel").onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openReadiness()}};$("#userBtn").onclick=()=>{showView("profile");loadMyProfile()};$("#welcomeProfile").onclick=()=>{showView("profile");loadMyProfile()};$("#railLogout").onclick=async()=>{if(confirm("Sign out of JMBN Manifest?")){await sb.auth.signOut();location.replace(base()+"auth.html")}};$("#dutyActive").onclick=()=>setDutyStatus("active");$("#dutyAwol").onclick=()=>setDutyStatus("awol");
setInterval(()=>{$("#clock").textContent=new Date().toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit",hour12:false})},1000);
const initialView=location.hash.replace("#","");if(["command","operations","crew","academy","records","profile"].includes(initialView))showView(initialView);
let liveTimer;function liveRefresh(){clearTimeout(liveTimer);liveTimer=setTimeout(()=>load().then(()=>toast("Manifest updated")).catch(()=>{}),450)}
sb.channel("jmbn-manifest-live").on("postgres_changes",{event:"*",schema:"public",table:"missions"},liveRefresh).on("postgres_changes",{event:"*",schema:"public",table:"profiles"},liveRefresh).on("postgres_changes",{event:"*",schema:"public",table:"announcements"},liveRefresh).on("postgres_changes",{event:"*",schema:"public",table:"mission_signups"},liveRefresh).subscribe();
load().catch(e=>{console.error(e);toast("Manifest sync failed")});
document.addEventListener("change",e=>{const role=e.target.closest?.("#detailBody select[data-assign-user]");if(role&&activeMissionId){assignCrewRole(activeMissionId,role.dataset.assignUser,role.value,role);return}const station=e.target.closest?.("#detailBody select[data-station-user]");if(station&&activeMissionId)assignCrewStation(activeMissionId,station.dataset.stationUser,station.value,station)});

// Bottom JMBN operations ticker
(()=>{const el=$("#opsTicker"),chip=$("#opsChip"),msg=$("#opsMsg"),prev=$("#opsPrev"),next=$("#opsNext"),pause=$("#opsPause"),close=$("#opsClose");if(!el)return;const lines=["CONTACT: AshenShrike joined the Frontier Fighters.","OPS: FloatinTiger caused a “minor” power shortage.","COMMS: Hendra broadcast karaoke on all channels. Again.","SECURITY: Jeneral “poked” a pirate Idris. Backup requested.","CARGO: Ricojes mislabeled 300 SCU of scrap as platinum.","ALERT: Gerald installed Windows on the ship radar. It crashed.","OPS: AshenShrike tried “turning it off and on again.” Success.","SYSTEM: Update failed successfully. Classic.","OPS: Nomad vs FloatinTiger over the last power cell.","CARGO: Shrike stacked crates into a “fortress of solitude.”"];const styles={ALERT:"var(--gold2)",OPS:"var(--gold2)",COMMS:"#9ecbff",SECURITY:"tomato",CARGO:"#a0f0c0",SYSTEM:"#f7f1d0",CONTACT:"#f7f1d0"};let i=0,timer,playing=true;const type=line=>(line.match(/^([A-Z]+):/)||[])[1]||"OPS";function render(){const line=lines[i],t=type(line);chip.textContent=`[${t}]`;chip.style.background=styles[t]||"var(--gold2)";chip.style.color="#000";msg.style.opacity=0;setTimeout(()=>{msg.textContent=line;msg.style.opacity=1},180);pause.textContent=playing?"Pause":"Play"}function nextL(){i=(i+1)%lines.length;render()}function prevL(){i=(i-1+lines.length)%lines.length;render()}function start(){if(timer)return;playing=true;timer=setInterval(nextL,4000);render()}function stop(){playing=false;clearInterval(timer);timer=null;render()}next.onclick=()=>{stop();nextL()};prev.onclick=()=>{stop();prevL()};pause.onclick=()=>playing?stop():start();close.onclick=()=>{el.style.display="none";sessionStorage.setItem("opsClosed","1")};if(sessionStorage.getItem("opsClosed")==="1"){el.style.display="none";return}start()})();
