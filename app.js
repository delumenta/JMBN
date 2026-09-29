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
 $("#opCount").textContent=state.missions.length+" FILE"+(state.missions.length===1?"":"S");$("#crewCount").textContent=state.crew.length+" RECORD"+(state.crew.length===1?"":"S");
 const upcoming=state.missions.filter(m=>!m.start_time||new Date(m.start_time)>=new Date()).sort((a,b)=>new Date(a.start_time||8640000000000000)-new Date(b.start_time||8640000000000000))[0];
 $("#nextOpTitle").textContent=upcoming?.title||"NO DEPLOYMENT SCHEDULED";$("#nextOpWhen").textContent=upcoming?.start_time?(fmtDate(upcoming.start_time)+" / "+fmtTime(upcoming.start_time)):"STANDING BY";$("#nextOpOpen").dataset.mission=upcoming?.id||"";$("#nextOpOpen").style.visibility=upcoming?"visible":"hidden";
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
 const {data:{session}}=await sb.auth.getSession(); const uid=session?.user?.id;
 const [att,sign]=await Promise.all([sb.from("mission_attendees").select("*").eq("mission_id",id),sb.from("mission_signups").select("*").eq("mission_id",id)]);
 const attendance=att.data||[], signups=sign.data||[], mine=signups.find(x=>x.user_id===uid);
 const people=new Map(); attendance.forEach(x=>people.set(x.user_id,{...x,_source:"attendance"})); signups.forEach(x=>people.set(x.user_id,{...(people.get(x.user_id)||{}),...x,_source:"signup"}));
 const counts={going:0,maybe:0,not_going:0};signups.forEach(x=>{if(counts[x.status]!==undefined)counts[x.status]++});
 const rsvp='<section class="detail-section rsvp-section"><div class="rsvp-head"><div><h4>YOUR RSVP</h4><p>Set your availability for this operation.</p></div><span id="rsvpCurrent">'+esc((mine?.status||"NO RESPONSE").replaceAll("_"," ").toUpperCase())+'</span></div><div class="rsvp-actions"><button data-rsvp="going" class="'+(mine?.status==="going"?"active going":"")+'"><b>✓</b> GOING</button><button data-rsvp="maybe" class="'+(mine?.status==="maybe"?"active maybe":"")+'"><b>?</b> MAYBE</button><button data-rsvp="not_going" class="'+(mine?.status==="not_going"?"active no":"")+'"><b>×</b> NOT GOING</button><button data-rsvp="withdraw" class="withdraw"><b>↶</b> WITHDRAW</button></div><div class="rsvp-tally"><span><i class="dot green"></i><b>'+counts.going+'</b> Going</span><span><i class="dot amber"></i><b>'+counts.maybe+'</b> Maybe</span><span><i class="dot red"></i><b>'+counts.not_going+'</b> Not Going</span></div></section>';
 $("#detailBody").innerHTML='<p class="eyebrow">OPERATION FILE // '+esc((m.category||"OPERATION").toUpperCase())+'</p><div class="detail-hero"><div><h2>'+esc(m.title||"Untitled operation")+'</h2><p>'+esc((m.status||"PLANNED").toUpperCase())+'</p></div></div><section class="detail-section"><h4>MISSION DATA</h4><div class="detail-grid"><div class="detail-stat"><small>START</small><b>'+fmtDate(m.start_time)+' '+fmtTime(m.start_time)+'</b></div><div class="detail-stat"><small>DURATION</small><b>'+esc(m.hours?m.hours+" HRS":"—")+'</b></div><div class="detail-stat"><small>ORIGIN</small><b>'+esc(m.origin||"TBD")+'</b></div><div class="detail-stat"><small>DESTINATION</small><b>'+esc(m.destination||"TBD")+'</b></div></div></section><section class="detail-section"><h4>BRIEFING</h4><div class="detail-copy">'+esc(m.notes||"No briefing notes filed.")+'</div></section>'+rsvp+'<section class="detail-section"><h4>CREW / SIGNUPS</h4><div class="detail-list">'+(people.size?[...people.values()].map(x=>{const p=state.crew.find(z=>z.user_id===x.user_id);const st=(x.status||x.attendance||"recorded").replaceAll("_"," ");return '<div class="detail-item signup-person"><div><b>'+esc(p?.display_name||p?.handle||"Crew")+'</b><small>'+(x.role_in_mission?esc(x.role_in_mission):"JMBN CREW")+'</small></div><span class="signup-state '+esc(x.status||"")+'">'+esc(st.toUpperCase())+'</span></div>'}).join(""):'<div class="detail-item"><small>No crew signups recorded.</small></div>')+'</div></section>';
 $$("#detailBody [data-rsvp]").forEach(btn=>btn.onclick=()=>setRsvp(id,btn.dataset.rsvp));
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
$("#refreshOps").onclick=()=>{toast("Refreshing manifest…");load()};$("#userBtn").onclick=()=>{showView("profile");loadMyProfile()};
setInterval(()=>{$("#clock").textContent=new Date().toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit",hour12:false})},1000);
const initialView=location.hash.replace("#","");if(["command","operations","crew","academy","records","profile"].includes(initialView))showView(initialView);
let liveTimer;function liveRefresh(){clearTimeout(liveTimer);liveTimer=setTimeout(()=>load().then(()=>toast("Manifest updated")).catch(()=>{}),450)}
sb.channel("jmbn-manifest-live").on("postgres_changes",{event:"*",schema:"public",table:"missions"},liveRefresh).on("postgres_changes",{event:"*",schema:"public",table:"profiles"},liveRefresh).on("postgres_changes",{event:"*",schema:"public",table:"announcements"},liveRefresh).on("postgres_changes",{event:"*",schema:"public",table:"mission_signups"},liveRefresh).subscribe();
load().catch(e=>{console.error(e);toast("Manifest sync failed")});