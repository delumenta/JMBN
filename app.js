const URL="https://fcegavhipeaeihxegsnw.supabase.co";
const KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZWdhdmhpcGVhZWloeGVnc253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMjk3NTcsImV4cCI6MjA3NzcwNTc1N30.i-ZjOlKc89-uA7fqOIvmAMv60-C2_NmKikRI_78Jei8";
const sb=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,flowType:"pkce",autoRefreshToken:true}});
let state={missions:[],crew:[],certs:[],announcements:[],profile:null};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function base(){const p=location.pathname.split("/").filter(Boolean);return /github\.io$/.test(location.hostname)&&p.length?"/"+p[0]+"/":"/"}
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2200)}
function showView(id){$$(".view").forEach(v=>v.classList.toggle("active",v.id===id));$$(".nav").forEach(n=>n.classList.toggle("active",n.dataset.view===id));$("#pageTitle").textContent={command:"COMMAND DECK",operations:"OPERATIONS",crew:"CREW MANIFEST",academy:"ACADEMY",records:"RECORDS"}[id]||"JMBN";scrollTo(0,0)}
function img(bucket,name){return URL+"/storage/v1/object/public/"+encodeURIComponent(bucket)+"/"+name.split("/").map(encodeURIComponent).join("/")}
function fmtDate(v){if(!v)return"TBD";return new Date(v).toLocaleDateString("en-SG",{day:"2-digit",month:"short",year:"2-digit"}).toUpperCase()}
function fmtTime(v){if(!v)return"";return new Date(v).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit",hour12:false})}
function missionRows(items,n=4){if(!items.length)return'<div class="empty">No operations in the manifest yet.</div>';return items.slice(0,n).map(m=>'<div class="op-row" data-mission="'+esc(m.id)+'" tabindex="0"><span class="op-date">'+fmtDate(m.start_time)+'</span><div><b>'+esc(m.title||"Untitled operation")+'</b><small>'+esc([m.origin,m.destination].filter(Boolean).join(" → ")||m.type||"Mission")+'</small></div><span class="tag">'+esc(m.category||m.status||"OP")+'</span></div>').join("")}
function missionCards(items){if(!items.length)return'<div class="empty">No matching operations.</div>';return items.map(m=>'<article class="mission-card" data-mission="'+esc(m.id)+'" tabindex="0"><span class="tag">'+esc(m.category||"operation")+'</span><h3>'+esc(m.title||"Untitled operation")+'</h3><div class="route"><span>'+esc(m.origin||"TBD")+'</span><span>→</span><span>'+esc(m.destination||"TBD")+'</span></div><div class="mission-meta"><span>'+fmtDate(m.start_time)+' / '+fmtTime(m.start_time)+'</span><span>'+esc(m.status||"PLANNED")+'</span></div></article>').join("")}
function crewCards(items){if(!items.length)return'<div class="empty">No matching personnel.</div>';return items.map(p=>{const code=p.rank_code||p.rank?.code||"";const rankUrl=p.rank_image_url||(code?img("Ranks",code+".png"):"");return '<article class="crew-card" data-user="'+esc(p.user_id)+'" tabindex="0">'+(rankUrl?'<img class="rank-img" src="'+esc(rankUrl)+'" onerror="this.style.visibility=\'hidden\'">':'<div class="rank-img"></div>')+'<div><h3>'+esc(p.display_name||p.handle||"Crew")+'</h3><p>'+esc(code||p.rank_category||p.role||"JMBN")+'</p><small>'+esc(p.role||"Member")+' · '+esc(p.missions_attended||0)+' missions</small></div><i class="status-dot '+(p.availability_status==="awol"?"red":"green")+'"></i></article>'}).join("")}
function certCards(items){if(!items.length)return'<div class="empty">Certification catalogue unavailable.</div>';return items.map(c=>{let code=(c.code||c.short_code||c.name||"").toUpperCase();let map={BMT:"BMT.png",MED:"MED.png",PIL:"PIL.png",SOC:"SOC.png"};let art=c.image_url||img("certification",map[code]||"APBmt1234.png");return '<article class="cert"><img src="'+esc(art)+'" onerror="this.src=\''+img("certification","BMT.png")+'\'"><h3>'+esc(c.name||c.title||code||"Certification")+'</h3><p>'+esc(c.description||c.category||"JMBN qualification pathway")+'</p></article>'}).join("")}
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
 $("#userName").textContent=name.toUpperCase();$(".avatar").textContent=name[0]?.toUpperCase()||"J";$("#net").textContent="SECURE";$("#syncText").textContent="Live sync · "+new Date().toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"});
 render();
}
function render(){
 const active=state.crew.filter(p=>p.availability_status!=="awol").length, awol=state.crew.length-active, pct=state.crew.length?Math.round(active/state.crew.length*100):0;
 $("#mCrew").textContent=state.crew.length;$("#mActive").textContent=active;$("#mOps").textContent=state.missions.filter(m=>!m.start_time||new Date(m.start_time)>=new Date()).length;$("#mCerts").textContent=state.certs.length;
 $("#activeCount").textContent=active;$("#awolCount").textContent=awol;$("#readyPct").textContent=pct+"%";$("#crewOnline").textContent=active;$("#readyRing").style.background="conic-gradient(var(--gold) "+(pct*3.6)+"deg,#24271f 0deg)";
 $("#opPreview").classList.remove("skeleton");$("#opPreview").innerHTML=missionRows(state.missions.filter(m=>!m.start_time||new Date(m.start_time)>=new Date()),4);
 $("#operationsGrid").innerHTML=missionCards(state.missions);$("#crewGrid").innerHTML=crewCards(state.crew);$("#certGrid").innerHTML=certCards(state.certs);$("#recordMissions").innerHTML=missionRows([...state.missions].reverse(),8);
 $("#announcements").classList.remove("skeleton");$("#announcements").innerHTML=state.announcements.length?state.announcements.map(a=>'<div class="feed-item"><b>'+esc(a.title||"Command notice")+'</b><p>'+esc(a.body||a.message||a.content||"")+'</p></div>').join(""):'<div class="empty">No current signal traffic.</div>';
}

function openDrawer(html){$("#detailBody").innerHTML=html;$("#detailDrawer").classList.add("open");$("#detailBackdrop").classList.add("open")}
function closeDrawer(){$("#detailDrawer").classList.remove("open");$("#detailBackdrop").classList.remove("open")}
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
async function openMission(id){
 const m=state.missions.find(x=>x.id===id);if(!m)return;
 openDrawer('<div class="loading-detail">LOADING OPERATION FILE…</div>');
 const [att,sign]=await Promise.all([sb.from("mission_attendees").select("*").eq("mission_id",id),sb.from("mission_signups").select("*").eq("mission_id",id)]);
 const people=[...(att.data||[]),...(sign.data||[])];
 $("#detailBody").innerHTML='<p class="eyebrow">OPERATION FILE // '+esc((m.category||"OPERATION").toUpperCase())+'</p><div class="detail-hero"><div><h2>'+esc(m.title||"Untitled operation")+'</h2><p>'+esc((m.status||"PLANNED").toUpperCase())+'</p></div></div><section class="detail-section"><h4>MISSION DATA</h4><div class="detail-grid"><div class="detail-stat"><small>START</small><b>'+fmtDate(m.start_time)+' '+fmtTime(m.start_time)+'</b></div><div class="detail-stat"><small>DURATION</small><b>'+esc(m.hours?m.hours+" HRS":"—")+'</b></div><div class="detail-stat"><small>ORIGIN</small><b>'+esc(m.origin||"TBD")+'</b></div><div class="detail-stat"><small>DESTINATION</small><b>'+esc(m.destination||"TBD")+'</b></div></div></section><section class="detail-section"><h4>BRIEFING</h4><div class="detail-copy">'+esc(m.notes||"No briefing notes filed.")+'</div></section><section class="detail-section"><h4>CREW / SIGNUPS</h4><div class="detail-list">'+(people.length?people.map(x=>{const p=state.crew.find(z=>z.user_id===x.user_id);return '<div class="detail-item"><b>'+esc(p?.display_name||p?.handle||"Crew")+'</b><small>'+esc((x.attendance||x.status||"going").replaceAll("_"," ").toUpperCase())+(x.role_in_mission?" · "+esc(x.role_in_mission):"")+'</small></div>'}).join(""):'<div class="detail-item"><small>No crew signups recorded.</small></div>')+'</div></section>';
}
document.addEventListener("click",e=>{const mission=e.target.closest("[data-mission]"),crew=e.target.closest("[data-user]");if(mission)openMission(mission.dataset.mission);else if(crew)openCrew(crew.dataset.user)});
document.addEventListener("keydown",e=>{if(e.key==="Enter"){const x=e.target.closest("[data-mission],[data-user]");if(x){x.dataset.mission?openMission(x.dataset.mission):openCrew(x.dataset.user)}}if(e.key==="Escape")closeDrawer()});
$("#detailClose").onclick=closeDrawer;$("#detailBackdrop").onclick=closeDrawer;

function filterOps(){let q=$("#opSearch").value.toLowerCase(),f=$("[data-opfilter].active")?.dataset.opfilter||"all";let x=state.missions.filter(m=>(f==="all"||m.category===f)&&JSON.stringify(m).toLowerCase().includes(q));$("#operationsGrid").innerHTML=missionCards(x)}
function filterCrew(){let q=$("#crewSearch").value.toLowerCase(),f=$("[data-crewfilter].active")?.dataset.crewfilter||"all";let x=state.crew.filter(p=>(f==="all"||(f==="awol"?p.availability_status==="awol":p.availability_status!=="awol"))&&JSON.stringify(p).toLowerCase().includes(q));$("#crewGrid").innerHTML=crewCards(x)}
$$(".nav").forEach(b=>b.onclick=()=>showView(b.dataset.view));$$("[data-go]").forEach(b=>b.onclick=()=>showView(b.dataset.go));
$("#opSearch").oninput=filterOps;$("#crewSearch").oninput=filterCrew;$$("[data-opfilter]").forEach(b=>b.onclick=()=>{$$("[data-opfilter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");filterOps()});$$("[data-crewfilter]").forEach(b=>b.onclick=()=>{$$("[data-crewfilter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");filterCrew()});
$("#refreshOps").onclick=()=>{toast("Refreshing manifest…");load()};$("#userBtn").onclick=async()=>{if(confirm("Sign out of JMBN Manifest?")){await sb.auth.signOut();location.replace(base()+"auth.html")}};
setInterval(()=>{$("#clock").textContent=new Date().toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit",hour12:false})},1000);
load().catch(e=>{console.error(e);toast("Manifest sync failed")});