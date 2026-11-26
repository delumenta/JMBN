const URL="https://fcegavhipeaeihxegsnw.supabase.co";
const KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZWdhdmhpcGVhZWloeGVnc253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMjk3NTcsImV4cCI6MjA3NzcwNTc1N30.i-ZjOlKc89-uA7fqOIvmAMv60-C2_NmKikRI_78Jei8";
const sb=window.jmbnClient||(window.jmbnClient=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,flowType:"pkce",autoRefreshToken:true}}));
let coalitionOrgs=new Map(),coalitionMembers=new Map();
let state={missions:[],crew:[],certs:[],announcements:[],profile:null,mySignups:[]};
function missionEnd(m){const start=new Date(m?.start_time||0);const hrs=Math.max(Number(m?.hours)||0,0);return new Date(start.getTime()+hrs*3600000)}
function missionLocked(m){return !!m?.start_time&&new Date()>=missionEnd(m)}
function isAttendingSignup(s){return s?.attendance_confirmed===true}
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function base(){const p=location.pathname.split("/").filter(Boolean);return /github\.io$/.test(location.hostname)&&p.length?"/"+p[0]+"/":"/"}
function isMobileManifest(){return navigator.userAgentData?.mobile===true||/Android|iPhone|iPod|Windows Phone/i.test(navigator.userAgent||"")||(window.matchMedia("(pointer: coarse) and (max-width: 900px)").matches)}
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2200)}
let fleetRequestedMissionId=null;
function showView(id){$$(".view").forEach(v=>v.classList.toggle("active",v.id===id));$$(".nav").forEach(n=>n.classList.toggle("active",n.dataset.view===id));$("#pageTitle").textContent={command:"COMMAND DECK",operations:"OPERATIONS",fleet:"FLEET DEPLOYMENT",crew:"CREW MANIFEST",academy:"ACADEMY",records:"RECORDS",profile:"PERSONNEL DOSSIER"}[id]||"JMBN";history.replaceState(null,"",location.pathname+location.search+"#"+id);scrollTo(0,0);if(id==="fleet")fleetInit().catch(e=>fleetNotice(e.message))}
function img(bucket,name){return URL+"/storage/v1/object/public/"+encodeURIComponent(bucket)+"/"+name.split("/").map(encodeURIComponent).join("/")}
function fmtDate(v){if(!v)return"TBD";return new Date(v).toLocaleDateString("en-SG",{day:"2-digit",month:"short",year:"2-digit"}).toUpperCase()}
function fmtTime(v){if(!v)return"";return new Date(v).toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit",hour12:false})}
function crewCallsign(p){return String(p?.callsign||"").trim()||"CALLSIGN NOT SET"}
function crewHandle(p){return String(p?.discord_handle||p?.discord_username||p?.handle||"").trim()}
function updateMemberNotices(){
 const upcoming=state.missions.filter(m=>!m.start_time||new Date(m.start_time).getTime()>=Date.now());
 const mine=state.mySignups||[];
 const pending=upcoming.filter(m=>!mine.some(x=>x.mission_id===m.id&&["going","maybe","not_going"].includes(String(x.status||"").toLowerCase())));
 const unassigned=upcoming.filter(m=>mine.some(x=>x.mission_id===m.id&&String(x.status||"").toLowerCase()==="going"&&(!x.operational_role||!x.operational_station)));
 const notices=[
  ...pending.map(m=>({title:"RSVP needed",detail:m.title||"Upcoming mission",id:m.id})),
  ...unassigned.map(m=>({title:"Assignment incomplete",detail:(m.title||"Upcoming mission")+" — role or station not assigned",id:m.id}))
 ].slice(0,20);
 const count=$("#memberNoticeCount"),list=$("#memberNoticeList");
 if(count)count.textContent=String(notices.length);
 if(!list)return;
 list.replaceChildren();
 if(!notices.length){
  const p=document.createElement("p");
  p.textContent="You're up to date. No outstanding mission actions.";
  list.append(p);
  return;
 }
 notices.forEach(n=>{
  const b=document.createElement("button");
  const title=document.createElement("strong"),detail=document.createElement("small");
  title.textContent=n.title;detail.textContent=n.detail;b.append(title,detail);
  b.addEventListener("click",()=>{
   $("#memberNoticePanel").hidden=true;
   showView("operations");
   requestAnimationFrame(()=>{
    const card=document.querySelector('[data-mission="'+CSS.escape(String(n.id))+'"]');
    if(card)card.click();
   });
  });
  list.append(b);
 });
}
function missionRows(items,n=4){if(!items.length)return'<div class="empty">No operations in the manifest yet.</div>';return items.slice(0,n).map(m=>'<div class="op-row" data-mission="'+esc(m.id)+'" tabindex="0"><span class="op-date">'+fmtDate(m.start_time)+'</span><div><b>'+esc(m.title||"Untitled operation")+'</b><small>'+esc([m.origin,m.destination].filter(Boolean).join(" → ")||m.type||"Mission")+'</small></div><span class="tag">'+esc(m.category||m.status||"OP")+'</span></div>').join("")}
function missionCards(items){if(!items.length)return'<div class="empty">No matching operations.</div>';return items.map(m=>{const locked=missionLocked(m);return '<article class="mission-card '+(locked?'mission-locked':'')+'" data-mission="'+esc(m.id)+'" tabindex="0"><span class="tag">'+esc(m.category||"operation")+'</span><h3>'+esc(m.title||"Untitled operation")+'</h3><div class="route"><span>'+esc(m.origin||"TBD")+'</span><span>→</span><span>'+esc(m.destination||"TBD")+'</span></div><div class="mission-meta"><span>'+fmtDate(m.start_time)+' / '+fmtTime(m.start_time)+'</span><span>'+(locked?'COMPLETED · LOCKED':esc(m.status||"PLANNED"))+'</span></div></article>'}).join("")}
function crewCards(items){
 const groups=new Map();
 for(const p of items){const org=coalitionOrgs.get(coalitionMembers.get(p.user_id));if(!org)continue;if(!groups.has(org.id))groups.set(org.id,{org,people:[]});groups.get(org.id).people.push(p)}
 if(!groups.size)return '<div class="empty">No matching approved personnel.</div>';
 return [...groups.values()].map(({org,people})=>{const color=/^#[0-9a-f]{6}$/i.test(org.accent_color)?org.accent_color:"#d8b662";return '<section class="ssc-crew-group" style="--org-color:'+color+'"><header><h3>'+esc(org.tag)+'</h3><small>'+people.length+' PERSONNEL</small></header><div class="ssc-crew-cards">'+people.map(p=>'<article class="crew-card" data-user="'+esc(p.user_id)+'" tabindex="0"><span class="ssc-avatar">'+(p.discord_avatar_url?'<img src="'+esc(p.discord_avatar_url)+'" alt="" onerror="this.remove()">':'')+esc(crewCallsign(p).slice(0,1))+'</span><div><h3>'+esc(crewCallsign(p))+'</h3><p>['+esc(org.tag)+']</p><small>'+esc(p.role||"Member")+' · '+esc(p.missions_attended||0)+' missions</small></div><i class="status-dot '+(p.availability_status==="awol"?"red":"green")+'"></i></article>').join("")+'</div></section>'}).join("");
}
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
 const certificationGrid=$("#certGrid");
 if(!certificationGrid)return;
 const items=state.certs.filter(c=>filter==="all"||(["BMT","SOC"].includes((c.certification_code||"").toUpperCase())?"core":["GUNNERY","ENGINEERING"].includes((c.certification_code||"").toUpperCase())?"specialisation":"support")===filter);
 certificationGrid.innerHTML=items.map(c=>{const code=(c.certification_code||c.code||"").toUpperCase(),done=earnedSet.has(code),total=reqs.filter(r=>(r.certification_code||"").toUpperCase()===code).length,kind=["BMT","SOC"].includes(code)?"CORE PATHWAY":["GUNNERY","ENGINEERING"].includes(code)?"SPECIALISATION PATHWAY":"SUPPORT PATHWAY",art=c.big_art_cover||c.image_url||img("certification","BMT.png");let status=done?"CERTIFIED":code==="SOC"&&!earnedSet.has("BMT")?"LOCKED":["GUNNERY","ENGINEERING"].includes(code)&&assignment?.specialisation_code!==code?"ASSIGNMENT REQUIRED":"AVAILABLE";return '<article class="academy-programme '+status.toLowerCase().replaceAll(" ","-")+'"><div class="academy-programme-art"><img src="'+esc(art)+'"><span>'+esc(code)+'</span></div><div class="academy-programme-body"><small>'+kind+'</small><h3>'+esc(c.name||code)+'</h3><p>'+esc(c.description||"JMBN Academy certification programme.")+'</p><div class="academy-programme-foot"><b>'+status+'</b><span>'+total+' TRAINING REQUIREMENTS</span></div></div></article>'}).join("")||'<div class="empty">No Academy programmes in this category.</div>';
}
async function loadWelcomeProgress(uid){
 const [{data:profile},{data:ranks},{data:signups},{data:missions},{data:certs}]=await Promise.all([
  sb.from("profiles").select("rank_code,rank_category,current_rank_id").eq("user_id",uid).maybeSingle(),
  sb.from("ranks").select("id,code,name,category,paygrade,sort_order,missions_target,hours_target,certification_target").eq("is_active",true).order("sort_order"),
  sb.from("mission_signups").select("mission_id,attendance_confirmed").eq("user_id",uid).eq("attendance_confirmed",true),
  sb.from("missions").select("id,start_time,hours"),
  sb.from("user_certifications").select("certification_code").eq("user_id",uid)
 ]);
 const list=(ranks||[]).slice().sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
 const current=list.find(r=>String(r.id)===String(profile?.current_rank_id))||list.find(r=>r.code===profile?.rank_code);
 const track=list.filter(r=>!current?.category||r.category===current.category);
 const next=current?track.find(r=>Number(r.sort_order)>Number(current.sort_order)):track[0];
 const ended=new Map((missions||[]).filter(m=>m.start_time&&new Date(new Date(m.start_time).getTime()+Number(m.hours||0)*3600000)<=new Date()).map(m=>[String(m.id),m]));
 const attended=[...new Set((signups||[]).map(x=>String(x.mission_id)).filter(id=>ended.has(id)))];
 const missionsAttended=attended.length;
 const hoursTotal=attended.reduce((sum,id)=>sum+Number(ended.get(id)?.hours||0),0);
 const missionsTarget=Number(next?.missions_target||0),hoursTarget=Number(next?.hours_target||0),certTarget=Number(next?.certification_target||0);
 const vals=[missionsTarget?missionsAttended/missionsTarget:1,hoursTarget?hoursTotal/hoursTarget:1,certTarget?(certs||[]).length/certTarget:1].map(v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0)));
 const pct=Math.round(Math.min(...vals)*100);
 $("#welcomeProgress").hidden=false;$("#welcomeCurrentRank").textContent=current?.code||profile?.rank_code||state.profile?.rank_code||"—";$("#welcomeNextRank").textContent=next?.code||"MAX RANK";$("#welcomeProgressPct").textContent=pct+"%";$("#welcomeProgressBar").style.width=pct+"%";
 $("#welcomeRequirements").innerHTML="<span>MISSIONS <b>"+esc(missionsAttended)+"/"+esc(missionsTarget||"—")+"</b></span><span>HOURS <b>"+esc(hoursTotal)+"/"+esc(hoursTarget||"—")+"</b></span><span>CERTS <b>"+esc((certs||[]).length)+"/"+esc(certTarget||"—")+"</b></span>";
}
function renderPendingAccess(session,profile){
 const name=profile?.display_name||profile?.handle||session.user.user_metadata?.full_name||session.user.user_metadata?.name||"CREW";
 const mobilePending=isMobileManifest();
 const pendingSummary=mobilePending?"Your JMBN account has not been verified yet. Please wait for Command approval.":"Identity verified. Your JMBN personnel clearance is awaiting Command approval.";
 const pendingDetails=mobilePending?'<span>Your account is registered, but access has not been approved yet.</span><span>Please wait while Command reviews your status. You can check back later.</span>':'<span>Command is attempting to recover your security clearance after a pack of Kopions ate our network cables.</span><span>A recovery team was dispatched. Unfortunately, they have stopped responding too.</span>';
 if(!document.querySelector('link[data-jmbn-guest-styles]')){
  const sheet=document.createElement("link");
  sheet.rel="stylesheet";sheet.href=base()+"guest-access.css?v=20261118-brand-match20";sheet.dataset.jmbnGuestStyles="1";
  document.head.appendChild(sheet);
 }
 document.body.innerHTML=`<main class="jmbn-guest-screen">
  <div class="jmbn-guest-scanline" aria-hidden="true"></div>
  <div class="jmbn-guest-shell">
   <header class="jmbn-guest-brand" aria-label="JMBN Manifest System">
    <img src="assets/jmbn.png" alt="JMBN emblem">
    <div class="jmbn-guest-brand-text">
     <b>JMBN</b>
     <small>MANIFEST SYSTEM</small>
    </div>
   </header>
   <section class="jmbn-guest-panel" aria-labelledby="guestWelcome">
    <i class="guest-notch guest-nw" aria-hidden="true"></i><i class="guest-notch guest-ne" aria-hidden="true"></i>
    <i class="guest-notch guest-sw" aria-hidden="true"></i><i class="guest-notch guest-se" aria-hidden="true"></i>
    <p class="jmbn-guest-kicker">PERSONNEL ACCESS</p>
    <h1 id="guestWelcome">WELCOME, ${esc(name.toUpperCase())}</h1>
    <div class="jmbn-guest-title-rule" aria-hidden="true"></div>
    <p class="jmbn-guest-summary">${pendingSummary}</p>
    <div class="jmbn-guest-warning" role="status">
     <div class="jmbn-guest-warning-icon" aria-hidden="true">⌛</div>
     <div class="jmbn-guest-warning-content">
      <b>${mobilePending?"NOT VERIFIED YET":"ACCESS PENDING"}</b>
      ${pendingDetails}
      <span class="jmbn-guest-standby">Please stand by.</span>
     </div>
    </div>
    <div class="jmbn-guest-social"><span class="jmbn-guest-social-symbol" aria-hidden="true">◈</span>
     <p>While Command sorts that out, join us on Discord and say hello to the crew!</p>
    </div>
    <div class="jmbn-guest-actions">
     <a class="jmbn-guest-discord" href="https://discord.gg/4z49bCXv5B" target="_blank" rel="noopener noreferrer" aria-label="Join the JMBN Discord (opens in a new tab)">
      <svg viewBox="0 0 127.14 96.36" aria-hidden="true"><path d="M104.4 8.19A101.7 101.7 0 0 0 79.1.3a70.7 70.7 0 0 0-3.2 6.6 94.2 94.2 0 0 0-28.7 0A70.7 70.7 0 0 0 44 .3a101.7 101.7 0 0 0-25.3 7.9C2.7 32.1-1.6 55.4.6 78.4a102.4 102.4 0 0 0 31 15.7c2.5-3.4 4.7-7 6.6-10.8-3.6-1.4-7.1-3.1-10.4-5.1.9-.6 1.7-1.3 2.5-2a72.5 72.5 0 0 0 66.5 0c.8.7 1.6 1.4 2.5 2-3.3 2-6.8 3.7-10.4 5.1 1.9 3.8 4.1 7.4 6.6 10.8a102.4 102.4 0 0 0 31-15.7c2.7-26.6-4.6-49.7-19.1-70.2ZM42.4 64.4c-6.3 0-11.4-5.8-11.4-13s5-13 11.4-13c6.4 0 11.5 5.8 11.4 13 0 7.2-5 13-11.4 13Zm42.3 0c-6.3 0-11.4-5.8-11.4-13s5-13 11.4-13c6.4 0 11.5 5.8 11.4 13 0 7.2-5 13-11.4 13Z"/></svg>
      JOIN OUR DISCORD <span aria-hidden="true">↗</span>
     </a>
     <button id="pendingLogout" class="jmbn-guest-signout" type="button">SIGN OUT</button>
    </div>
   </section>
   <p class="jmbn-guest-meta">JMBN // SECURE PERSONNEL NETWORK · AWAITING COMMAND APPROVAL</p>
  </div>
 </main>`;
 // Guest panel replaces the portal before it is allowed to become visible.
 // Match MANIFEST SYSTEM's rendered width to JMBN, across browser sizes and fonts.
 const matchGuestBrandWidth=()=>{
  const title=document.querySelector(".jmbn-guest-brand-text b");
  const subtitle=document.querySelector(".jmbn-guest-brand-text small");
  if(!title||!subtitle)return;
  subtitle.style.letterSpacing="0px";
  const target=title.getBoundingClientRect().width;
  const natural=subtitle.getBoundingClientRect().width;
  const glyphs=subtitle.textContent.length||1;
  subtitle.style.letterSpacing=Math.max(0,Math.min(9,(target-natural)/glyphs)).toFixed(2)+"px";
 };
 matchGuestBrandWidth();
 document.fonts?.ready.then(matchGuestBrandWidth);
 document.documentElement.classList.remove("jmbn-session-pending");
 document.getElementById("pendingLogout")?.addEventListener("click",async()=>{await sb.auth.signOut();location.replace(base()+"auth.html")});
}



// Render the signed-in member's actual Discord photo; fall back only on load failure.
// Discord avatar URLs can become stale after profile changes, so check identity metadata
// and try an alternative Discord media host before giving up.
async function showDiscordIdentityPhoto(host,session,linkedAvatar){
 const user=session?.user||{};
 const initial=host.textContent||"J";
 const urls=[];
 const add=url=>{
  if(typeof url!=="string"||!url.trim())return;
  try{
   const parsed=new URL(url);
   if(parsed.protocol!=="https:")return;
   const href=parsed.href;
   if(!urls.includes(href))urls.push(href);
   if(parsed.hostname==="cdn.discordapp.com"&&parsed.pathname.startsWith("/avatars/")){
    const resized=parsed.origin+parsed.pathname+"?size=128";
    if(!urls.includes(resized))urls.push(resized);
    const alternate="https://media.discordapp.net"+parsed.pathname+"?size=128";
    if(!urls.includes(alternate))urls.push(alternate);
   }
  }catch{}
 };
 const identity=(user.identities||[]).find(entry=>entry.provider==="discord");
 add(linkedAvatar);
 add(identity?.identity_data?.avatar_url);
 add(user.user_metadata?.avatar_url);
 add(user.user_metadata?.picture);
 // getSession() may contain stale user metadata; getUser() fetches the current record.
 try{
  const {data,error}=await sb.auth.getUser();
  if(!error&&data?.user?.id===user.id){
   const current=data.user;
   const discord=(current.identities||[]).find(entry=>entry.provider==="discord");
   add(discord?.identity_data?.avatar_url);
   add(current.user_metadata?.avatar_url);
   add(current.user_metadata?.picture);
  }
 }catch(error){console.warn("[JMBN] Could not refresh avatar metadata",error)}
 for(const url of urls){
  const picture=await new Promise(resolve=>{
   const img=new Image();
   img.alt="";
   img.decoding="async";
   img.referrerPolicy="no-referrer";
   img.onload=()=>resolve(img);
   img.onerror=()=>resolve(null);
   img.src=url;
  });
  if(picture){
   // Guard against a subsequent logout / navigation before the image returns.
   if(!host.isConnected)return;
   host.replaceChildren(picture);
   host.setAttribute("aria-label","Discord profile photo");
   return;
  }
 }
 console.warn("[JMBN] Discord profile picture unavailable from stored URLs; displaying callsign initial.");
 if(host.isConnected)host.textContent=initial;
}

async function load(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){location.replace(base()+"auth.html");return}
 const uid=session.user.id;
 // Resolve the access role before loading any member-only Manifest data.
 const prof=await sb.from("profiles").select("*").eq("user_id",uid).maybeSingle();
 if(prof.error)throw prof.error;
 if(!prof.data||String(prof.data.role||"Guest").toLowerCase()==="guest"){
  state.profile=prof.data||null;
  renderPendingAccess(session,state.profile);
  return;
 }
 // Use the same server-side elevation check as admins.html; never expose the nav by default.
 const adminAccessNav=$("#adminAccessNav");
 if(adminAccessNav){
  adminAccessNav.hidden=true;
  try{
   const {data:isElevated,error:elevationError}=await sb.rpc("is_elevated",{u:uid});
   if(elevationError)console.warn("[JMBN] Admin navigation clearance check failed",elevationError);
   adminAccessNav.hidden=!!elevationError||isElevated!==true;
  }catch(e){
   console.warn("[JMBN] Unable to verify Admin navigation clearance",e);
   adminAccessNav.hidden=true;
  }
 }
 const [missions,crew,discordLinks,certs,ann,mySignups]=await Promise.all([
  sb.from("missions").select("*").order("start_time",{ascending:true}),
  sb.from("profiles").select("*").order("display_name",{ascending:true}),
  sb.from("discord_links").select("*"),
  sb.from("certifications").select("*"),
  sb.from("announcements").select("*").order("created_at",{ascending:false}).limit(5),
  sb.from("mission_signups").select("mission_id,status,operational_role,operational_station,overlay_readiness,attendance_confirmed,created_at").eq("user_id",uid)
 ]);
 const handleByUser=new Map((discordLinks.data||[]).map(x=>[x.user_id,x.handle]));
 const avatarByUser=new Map((discordLinks.data||[]).map(x=>[x.user_id,x.avatar_url||""]));
 state.profile={...(prof.data||{}),discord_handle:handleByUser.get(uid)||""};state.missions=missions.data||[];state.crew=(crew.data||[]).map(p=>({...p,discord_handle:handleByUser.get(p.user_id)||"",discord_avatar_url:avatarByUser.get(p.user_id)||""}));state.certs=certs.data||[];state.announcements=ann.data||[];state.mySignups=mySignups.data||[];
 const [orgResult,memberResult]=await Promise.all([sb.from("coalition_organisations").select("id,tag,name,emblem_url,accent_color"),sb.from("coalition_memberships").select("user_id,organisation_id")]);if(orgResult.error||memberResult.error)throw orgResult.error||memberResult.error;coalitionOrgs=new Map(orgResult.data.map(o=>[o.id,o]));coalitionMembers=new Map(memberResult.data.map(m=>[m.user_id,m.organisation_id]));state.crew=state.crew.filter(p=>coalitionMembers.has(p.user_id));
 updateMemberNotices();
 const name=state.profile.display_name||state.profile.handle||session.user.user_metadata?.full_name||session.user.email?.split("@")[0]||"CREW";
 $("#userName").textContent=name.toUpperCase();
 const identityAvatar=$("#userBtn .avatar");
 if(identityAvatar){
  identityAvatar.textContent=name[0]?.toUpperCase()||"J";
  // Image loading is asynchronous: keep the initial only if every image source fails.
  // Do not put the fallback letter behind a potentially transparent Discord PNG.
  // Use the same exact discord_links row that #profile uses.
  // Fetch by authenticated user ID rather than relying on the roster map.
  void (async()=>{
   const {data: discord, error} = await sb.from("discord_links")
     .select("avatar_url")
     .eq("user_id",uid)
     .maybeSingle();
   if(error) console.warn("[JMBN] Header Discord avatar lookup",error);
   if(!identityAvatar.isConnected)return;
   const url=String(discord?.avatar_url||"").trim();
   if(!url){identityAvatar.textContent=name[0]?.toUpperCase()||"J";return;}
   const image=document.createElement("img");
   image.alt="";
   image.decoding="async";
   image.onload=()=>{
    if(!identityAvatar.isConnected)return;
    identityAvatar.replaceChildren(image);
    identityAvatar.setAttribute("aria-label","Discord profile photo");
   };
   image.onerror=()=>{
    if(!identityAvatar.isConnected)return;
    identityAvatar.textContent=name[0]?.toUpperCase()||"J";
   };
   image.src=url;
  })();
 }
 $("#net").textContent="SECURE";
 const rankName=state.profile.rank_code||state.profile.rank_category||"CREW", rankArt=state.profile.rank_image_url||(state.profile.rank_code?img("Ranks",state.profile.rank_code+".png"):"");
 $("#welcomeName").textContent=name.toUpperCase();$("#welcomeRank").textContent=rankName.toUpperCase();$("#welcomeRankArt").innerHTML=rankArt?'<img src="'+esc(rankArt)+'" alt="">':'<span>'+esc((state.profile.rank_code||"J").slice(0,3))+'</span>';{const org=coalitionOrgs.get(coalitionMembers.get(uid));if(org){$("#welcomeRank").textContent="";$("#welcomeRankArt").innerHTML=org.emblem_url?'<img src="'+esc(org.emblem_url)+'" alt="'+esc(org.tag)+'">':'<span>'+esc(org.tag)+'</span>';$("#sscWelcomeOrg").textContent=org.tag+" / "+(state.profile.role||"Member");$("#sscWelcomeOrg").style.color=org.accent_color;}}syncDutyUI(state.profile.availability_status||"active");await loadWelcomeProgress(uid);$("#syncText").textContent="Live sync · "+new Date().toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit"});
 render();
 // Show the Command Deck only after a non-Guest profile was verified and painted.
 document.documentElement.classList.remove("jmbn-session-pending");
 document.getElementById("jmbn-auth-gate")?.remove();
 // Academy moved to its own page; do not initialize missing Academy UI here.
 if(document.getElementById("academy")&&document.getElementById("certGrid")) await loadAcademy();
}

function syncDutyUI(status){
 const s=status==="awol"?"awol":"active";
 const online=s==="active";
 $("#myDutyLabel").textContent=online?"ONLINE":"AWOL";
 $("#dutyToggleText").textContent=online?"ONLINE":"AWOL";
 $("#dutyToggle").classList.toggle("active",online);
 $("#dutyToggle").classList.toggle("awol",!online);
 $("#dutyToggle").setAttribute("aria-pressed",String(online));
 $("#welcomePanel").classList.toggle("is-awol",!online);
}
async function setDutyStatus(status){
 if(!["active","awol"].includes(status))return;
 const {data:{session},error:sessionError}=await sb.auth.getSession();
 if(sessionError||!session){toast("Secure session required");return}
 const uid=session.user.id;
 const previous=state.profile?.availability_status==="awol"?"awol":"active";
 if(previous===status)return;
 const button=$("#dutyToggle");
 if(button)button.disabled=true;
 syncDutyUI(status);

 let savedStatus=null;
 let saveError=null;
 try{
  const {data,error}=await sb.from("profiles")
   .update({availability_status:status})
   .eq("user_id",uid)
   .select("user_id,availability_status")
   .maybeSingle();
  if(error)throw error;
  if(!data?.availability_status)throw new Error("No updated profile row was returned.");
  savedStatus=data.availability_status;
 }catch(error){
  saveError=error;
  console.error("Duty status save:",error);
 }

 // A request can reach Supabase and commit even if the response is lost,
 // or the returned-row query can fail after the update. Re-read the profile
 // before deciding what the toggle should display.
 if(!savedStatus){
  try{
   const {data,error}=await sb.from("profiles")
    .select("availability_status")
    .eq("user_id",uid)
    .maybeSingle();
   if(error)throw error;
   if(!["active","awol"].includes(data?.availability_status)){
    throw new Error("Could not confirm the saved duty status.");
   }
   savedStatus=data.availability_status;
  }catch(readError){
   state.profile.availability_status=previous;
   const mine=state.crew.find(x=>x.user_id===uid);
   if(mine)mine.availability_status=previous;
   syncDutyUI(previous);
   toast("Duty status couldn't be confirmed");
   if(button)button.disabled=false;
   console.error("Duty status read-back:",readError,saveError);
   return;
  }
 }

 state.profile.availability_status=savedStatus;
 const mine=state.crew.find(x=>x.user_id===uid);
 if(mine)mine.availability_status=savedStatus;
 syncDutyUI(savedStatus);
 try{render()}catch(renderError){console.error("Duty status saved; manifest render failed:",renderError)}

 if(savedStatus===status){
  toast(savedStatus==="active"?"Duty status set to ONLINE.":"Duty status set to AWOL.");
 }else{
  toast("Duty status remains "+(savedStatus==="active"?"ONLINE.":"AWOL."));
  if(saveError)console.error("Requested status was not confirmed.",saveError);
 }
 if(button)button.disabled=false;
}

function render(){
 const active=state.crew.filter(p=>p.availability_status!=="awol").length, awol=state.crew.length-active, pct=state.crew.length?Math.round(active/state.crew.length*100):0;
 $("#mCrew").textContent=state.crew.length;$("#mActive").textContent=active;$("#mOps").textContent=state.missions.filter(m=>!m.start_time||new Date(m.start_time)>=new Date()).length;$("#mCerts").textContent=state.certs.length;
 $("#opCount").textContent=state.missions.length+" FILE"+(state.missions.length===1?"":"S");$("#crewCount").textContent=state.crew.length+" RECORD"+(state.crew.length===1?"":"S");
 const upcoming=state.missions.filter(m=>!m.start_time||new Date(m.start_time)>=new Date()).sort((a,b)=>new Date(a.start_time||8640000000000000)-new Date(b.start_time||8640000000000000))[0];
 $("#nextOpTitle").textContent=upcoming?.title||"NO DEPLOYMENT SCHEDULED";$("#nextOpTitle").dataset.mission=upcoming?.id||"";$("#nextOpTitle").disabled=!upcoming;$("#nextOpWhen").textContent=upcoming?.start_time?(fmtDate(upcoming.start_time)+" / "+fmtTime(upcoming.start_time)):"STANDING BY";$("#nextOpOpen").dataset.mission=upcoming?.id||"";$("#nextOpOpen").style.visibility=upcoming?"visible":"hidden";
 $("#activeCount").textContent=active;$("#awolCount").textContent=awol;$("#readyPct").textContent=pct+"%";$("#crewOnline").textContent=active;$("#readyRing").style.background="conic-gradient(var(--gold) "+(pct*3.6)+"deg,#24271f 0deg)";
 $("#opPreview").classList.remove("skeleton");$("#opPreview").innerHTML=missionRows(state.missions.filter(m=>!m.start_time||new Date(m.start_time)>=new Date()),4);
 filterOps();$("#crewGrid").innerHTML=crewCards(state.crew);const certificationGrid=$("#certGrid");if(certificationGrid)certificationGrid.innerHTML=certCards(state.certs);const creditedIds=new Set(state.mySignups.filter(isAttendingSignup).map(x=>String(x.mission_id)));const credited=state.missions.filter(m=>missionLocked(m)&&creditedIds.has(String(m.id))).sort((a,b)=>new Date(b.start_time)-new Date(a.start_time));$("#recordMissions").innerHTML=missionRows(credited,50);
 $("#announcements").classList.remove("skeleton");$("#announcements").innerHTML=state.announcements.length?state.announcements.map(a=>'<div class="feed-item"><b>'+esc(a.title||"Command notice")+'</b><p>'+esc(a.body||a.message||a.content||"")+'</p></div>').join(""):'<div class="empty">No current signal traffic.</div>';
}

function openDrawer(html,mode="personnel"){$("#detailBody").innerHTML=html;$("#detailDrawer").classList.toggle("mission-command",mode==="mission");$("#detailDrawer").classList.toggle("personnel-modal",mode==="member");$("#detailDrawer").classList.add("open");$("#detailBackdrop").classList.add("open")}
function closeDrawer(){activeMissionId=null;$("#detailDrawer").classList.remove("open","mission-command","personnel-modal");$("#detailBackdrop").classList.remove("open")}
async function openCrew(userId){
 const p=state.crew.find(x=>x.user_id===userId);if(!p)return;
 openDrawer('<div class="loading-detail">LOADING PERSONNEL FILE…</div>',"member");
 const [certs,attendance,role,rank,rsvps,certCatalogue]=await Promise.all([
  sb.from("user_certifications").select("certification_code,awarded_at").eq("user_id",userId),
  sb.from("mission_signups").select("mission_id,status,operational_role,operational_station,attendance_confirmed,created_at").eq("user_id",userId).eq("attendance_confirmed",true),
  p.ingame_role_id?sb.from("ingame_roles").select("*").eq("id",p.ingame_role_id).maybeSingle():Promise.resolve({data:null}),
  p.current_rank_id?sb.from("ranks").select("*").eq("id",p.current_rank_id).maybeSingle():Promise.resolve({data:null}),
  sb.from("mission_signups").select("mission_id,status,operational_role,operational_station").eq("user_id",userId).eq("status","going"),
  sb.from("certifications").select("certification_code,name,image_url,small_art_cover,big_art_cover,hero_art_cover")
 ]);
 const r=rank.data||{},ig=role.data||{},cs=certs.data||[],at=attendance.data||[];
 const certLookup=new Map((certCatalogue.data||[]).map(x=>[String(x.certification_code||"").toUpperCase(),x]));
 const certBadge=x=>{const code=String(x.certification_code||"").toUpperCase(),meta=certLookup.get(code)||{},art=meta.small_art_cover||meta.image_url||meta.big_art_cover||meta.hero_art_cover||img("certification",({BMT:"BMT.png",SOC:"SOC.png",MED:"MED.png",PIL:"PIL.png"})[code]||"BMT.png");return '<div class="personnel-cert-badge"><img src="'+esc(art)+'" alt="'+esc(meta.name||code)+'" loading="lazy" onerror="this.style.display=\'none\'"><b>'+esc(code)+'</b></div>'};
 const rankUrl=p.rank_image_url||r.image_url||(p.rank_code?img("Ranks",p.rank_code+".png"):"");
 const roleCounts=new Map();
 at.forEach(x=>{const unique=new Set();const role=String(x.operational_role||"").trim();const station=x.operational_station?stationLabel(x.operational_station):"";if(role&&role.toLowerCase()!=="unassigned")unique.add(role);if(station&&station!=="UNASSIGNED")unique.add(station);unique.forEach(label=>roleCounts.set(label,(roleCounts.get(label)||0)+1))});
 const favorite=[...roleCounts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]||null;

 const next=(rsvps.data||[]).map(x=>({signup:x,mission:state.missions.find(m=>String(m.id)===String(x.mission_id))})).filter(x=>x.mission?.start_time&&new Date(x.mission.start_time)>new Date()).sort((a,b)=>new Date(a.mission.start_time)-new Date(b.mission.start_time))[0];
 const memberSince=p.created_at||p.joined_at||p.member_since||null;
 const deploymentRole=x=>x?.signup.operational_station?stationLabel(x.signup.operational_station):x?.signup.operational_role||"Role not assigned";
 const dossierIcon=(name)=>{const paths={shield:'<path d="M12 2 21 6v6c0 5-9 10-9 10S3 17 3 12V6Z"/><path d="m8 11 3 3 5-6"/>',helm:'<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5M4 4l4 4m8 8 4 4M4 20l4-4m8-8 4-4"/>',chevrons:'<path d="m3 7 9 8 9-8M3 13l9 8 9-8M12 2l-3 5 3 4 3-4Z"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 18h2"/>',members:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',history:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5M2 7h2M2 12h2M2 17h2"/>'};return '<svg class="personnel-gold-icon" viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.calendar)+'</svg>'};
 const serviceItem=(icon,title,main,sub)=>'<article class="personnel-info-item"><span class="personnel-info-emblem">'+dossierIcon(icon)+'</span><div class="personnel-info-copy"><small>'+title+'</small><strong>'+esc(main)+'</strong><span>'+esc(sub)+'</span></div></article>';
 const serviceInfo='<section class="personnel-service-section personnel-info-section"><div class="personnel-info-grid">'+serviceItem("calendar","MEMBER SINCE",memberSince?fmtDate(memberSince):"Not recorded","")+serviceItem("chevrons","OPERATIONS ATTENDED",String(at.length),"")+serviceItem("calendar","UPCOMING MISSION",next?.mission?.title||"None scheduled",next?fmtDate(next.mission.start_time)+" · "+fmtTime(next.mission.start_time):"No upcoming Going RSVP")+'</div></section>';
 const favoriteRoles=[...roleCounts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 const history=at.slice().sort((a,b)=>{const ma=state.missions.find(m=>String(m.id)===String(a.mission_id)),mb=state.missions.find(m=>String(m.id)===String(b.mission_id));return new Date(mb?.start_time||b.created_at||0)-new Date(ma?.start_time||a.created_at||0)}).slice(0,3).map(x=>{const m=state.missions.find(z=>String(z.id)===String(x.mission_id));return '<div class="personnel-history-row"><span class="personnel-history-emblem" aria-hidden="true">✦</span><div class="personnel-history-name"><b>'+esc(m?.title||"Operation")+'</b><small>'+esc(m?.start_time?fmtDate(m.start_time):"Date unavailable")+'</small></div><div class="personnel-history-role"><b>'+esc(x.operational_station?stationLabel(x.operational_station):x.operational_role||"Role unassigned")+'</b><small>'+esc(x.operational_station&&x.operational_role?x.operational_role:"Confirmed deployment")+'</small></div><span class="personnel-attended">✓ ATTENDED</span></div>'}).join("");

 $("#detailBody").innerHTML='<div class="personnel-service"><header class="personnel-service-head"><div class="personnel-rank-mark">'+(rankUrl?'<img class="rank-img" src="'+esc(rankUrl)+'" alt="Rank insignia">':'<span class="personnel-rank-fallback">✦</span>')+'</div><div class="personnel-head-identity"><h2>'+esc(crewCallsign(p))+'</h2><p>'+esc(r.name||p.rank_code||p.rank_category||"JMBN CREW")+'</p><span class="personnel-duty '+(String(p.availability_status).toLowerCase()==="awol"?'is-awol':'')+'">'+(String(p.availability_status).toLowerCase()==="awol"?'AWOL':'ONLINE')+'</span></div></header><div class="personnel-side-panels"><section class="personnel-service-section"><h3><span class="personnel-section-icon">'+dossierIcon("shield")+'</span> CERTIFICATIONS</h3><div class="personnel-certs">'+(cs.length?cs.map(certBadge).join(""):'<p class="personnel-exp-empty">No certifications recorded.</p>')+'</div></section><section class="personnel-service-section personnel-favorite-section"><h3><span class="personnel-section-icon">'+dossierIcon("helm")+'</span> FAVORITE ROLE</h3><div class="personnel-favorite-single"><strong>'+esc(favorite?.[0]||"Not recorded")+'</strong><small>'+esc(favoriteRoles[1]?"Secondary · "+favoriteRoles[1][0]:favorite?"Most frequently assigned role":"No attended assignments yet")+'</small></div></section></div>'+serviceInfo+'<section class="personnel-service-section"><h3><span class="personnel-section-icon">'+dossierIcon("history")+'</span> OPERATIONS HISTORY <span>Latest 3 operations</span></h3><div class="personnel-history" role="list">'+(history||'<p class="personnel-exp-empty">No attended operations recorded.</p>')+'</div></section></div>';

}

function openReadiness(){
 const active=state.crew.filter(p=>p.availability_status!=="awol"),awol=state.crew.filter(p=>p.availability_status==="awol");
 const rows=(items,status)=>items.length?items.map(p=>{const code=p.rank_code||p.rank?.code||"",rank=p.rank_image_url||(code?img("Ranks",code+".png"):"");return '<button class="readiness-person" data-user="'+esc(p.user_id)+'"><span class="readiness-person-rank">'+(rank?'<img src="'+esc(rank)+'" alt="">':'')+'</span><span><b>'+esc(crewCallsign(p))+'</b>'+'<small>'+esc(code||p.rank_category||p.role||"JMBN CREW")+'</small></span><i class="status-dot '+status+'"></i></button>'}).join(""):'<div class="readiness-empty">NO PERSONNEL</div>';
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
 const assignedVessel=(m.attachments||[]).find(a=>a?.name==='__jmbn_assigned_vessel__')?.vessel||'';const missionVesselName=assignedVessel==='perseus'?'RSI PERSEUS':assignedVessel==='starfish'?'RSI POLARIS':'UNASSIGNED VESSEL';
 const roles=["Command","Pilot","Co-Pilot","Engineer","Turret Gunner","Fighter Pilot","Medical","Security / Boarding","Cargo / Logistics","Ground Team","Support"];
 const officer=await sb.rpc("is_elevated",{u:uid});const canAssign=officer.data===true&&!officer.error;
 const stationOptions=(current,userId)=>'<option value="">Unassigned</option>'+(assignedVessel==='perseus'?PERSEUS_STATIONS:POLARIS_STATIONS).map(s=>{const occupied=s.id!=='stations_pending'&&signups.some(x=>x.user_id!==userId&&x.operational_station===s.id);return '<option value="'+s.id+'" '+(current===s.id?'selected':'')+' '+(occupied?'disabled':'')+'>'+esc(s.label)+(occupied?' · OCCUPIED':'')+'</option>'}).join("");
 let overlayState=null;try{const q=await sb.from("overlay_operation_state").select("mission_id").eq("singleton",true).maybeSingle();overlayState=q.data}catch(e){console.warn("Overlay state unavailable",e)}
 const isOverlayActive=String(overlayState?.mission_id||"")===String(id);
 const locked=missionLocked(m);

 const roleSelect=x=>'<select aria-label="Operational role for '+esc(x.user_id)+'" data-assign-user="'+esc(x.user_id)+'"><option value="">Unassigned</option>'+roles.map(r=>'<option value="'+esc(r)+'" '+(x.operational_role===r?'selected':'')+'>'+esc(r)+'</option>').join("")+'</select>';
 const stationSelect=x=>'<select aria-label="'+missionVesselName+' station for '+esc(x.user_id)+'" data-station-user="'+esc(x.user_id)+'">'+stationOptions(x.operational_station,x.user_id)+'</select>';
 const going=[...people.values()].filter(x=>x.status==="going");
 const others=[...people.values()].filter(x=>x.status!=="going");
 const crewRow=x=>{const p=state.crew.find(z=>z.user_id===x.user_id);const name=esc(p?crewCallsign(p):"Crew");const mark=canAssign&&!locked?'<input class="op-attendance-tick" type="checkbox" aria-label="Mark '+name+' attended" title="Mark attended" data-attendance-user="'+esc(x.user_id)+'" '+(x.attendance_confirmed?'checked':'')+'>':'<span class="op-attendance-static '+(x.attendance_confirmed?'yes':'')+'" title="'+(x.attendance_confirmed?'Attended':'Not marked')+'">'+(x.attendance_confirmed?'✓':'○')+'</span>';return '<div class="op-roster-row"><div class="op-roster-person"><span class="op-roster-avatar">'+(p?.discord_avatar_url?'<img src="'+esc(p.discord_avatar_url)+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">':'')+'<span>'+name.slice(0,1).toUpperCase()+'</span></span>'+mark+'<b>'+name+'</b></div><div class="op-roster-field">'+(canAssign&&!locked?roleSelect(x):'<span>'+esc(x.operational_role||"Unassigned")+'</span>')+'</div><div class="op-roster-field">'+(canAssign&&!locked?stationSelect(x):'<span>'+esc(x.operational_station?stationLabel(x.operational_station):"Unassigned")+'</span>')+'</div></div>'};
 const rsvp=locked?'<p class="op-muted">This operation is complete. RSVP is locked.</p>':'<div class="op-rsvp-actions"><button data-rsvp="going" class="'+(mine?.status==="going"?'selected':'')+'">GOING</button><button data-rsvp="maybe" class="'+(mine?.status==="maybe"?'selected':'')+'">MAYBE</button><button data-rsvp="not_going" class="'+(mine?.status==="not_going"?'selected':'')+'">NOT GOING</button><button data-rsvp="withdraw" class="op-withdraw">WITHDRAW</button></div>';
 const myRole=mine?.operational_role||"Unassigned",myStation=mine?.operational_station?stationLabel(mine.operational_station):"Unassigned";
 const opHeading=(icon,label)=>'<span class="op-section-emblem" aria-hidden="true">'+icon+'</span>'+label;
 $("#detailBody").innerHTML='<div class="op-new"><header class="op-new-header"><p class="eyebrow">OPERATION // JMBN MANIFEST</p><div class="op-heading"><h2>'+esc(m.title||"Untitled operation")+'</h2><span class="op-status">'+(locked?'COMPLETED · LOCKED':esc((m.status||"PLANNED").toUpperCase()))+'</span></div><p class="op-meta">'+fmtDate(m.start_time)+' · '+fmtTime(m.start_time)+' · '+esc(m.origin||"ORIGIN TBD")+' → '+esc(m.destination||"DESTINATION TBD")+'</p></header><div class="op-top-cards"><section class="op-new-card"><div class="op-card-heading">'+opHeading('⌖','YOUR ASSIGNMENT')+'</div><strong>'+esc(myRole)+'</strong><p>'+esc(myStation)+'</p></section><section class="op-new-card"><div class="op-card-heading">'+opHeading('◷','OPERATION DURATION')+'</div><strong>'+esc(m.hours?m.hours+" HRS":"—")+'</strong>'+(canAssign&&!locked?'<div class="op-duration-edit"><input type="number" min="0.1" step="0.1" aria-label="Mission duration hours" data-mission-hours="'+esc(id)+'" value="'+esc(m.hours??"")+'"><button data-save-mission-hours="'+esc(id)+'">UPDATE</button></div>':'')+'</section></div><div class="op-new-columns"><section class="op-new-card op-brief"><h3>'+opHeading('▧','MISSION BRIEF')+'</h3><div class="op-brief-text">'+esc(m.notes||"No briefing notes filed.")+'</div><div class="op-rsvp"><h3>'+opHeading('♢','YOUR RSVP')+'</h3>'+rsvp+'</div></section><section class="op-new-card op-roster"><div class="op-roster-head"><h3>'+opHeading('♧','GOING')+' <span>'+going.length+' CREW</span></h3><p>Confirmed RSVP · Command manages assignments and attendance.</p></div><div class="op-roster-labels"><span>CREW</span><span>OPERATIONAL ROLE</span><span>POLARIS STATION</span></div><div class="op-roster-list">'+(going.length?going.map(crewRow).join(""):'<p class="op-muted">No crew marked Going yet.</p>')+'</div>'+(others.length?'<details class="op-other-signups"><summary>OTHER RESPONSES ('+others.length+')</summary>'+others.map(x=>'<div class="op-other-row">'+esc(state.crew.find(z=>z.user_id===x.user_id)?crewCallsign(state.crew.find(z=>z.user_id===x.user_id)):"Crew")+' · '+esc(x.status.toUpperCase())+'</div>').join("")+'</details>':'')+'</section></div><footer class="op-new-footer"><span>Assignments and attendance are managed by Command.</span><div class="op-footer-actions"><button class="op-deployment-link" type="button" data-open-mission-deployment="'+esc(m.id)+'">VIEW FLEET DEPLOYMENT ↗</button><button class="op-close-action" type="button" data-close-op>CLOSE</button></div></footer></div>';

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
  const signupIndex=state.mySignups.findIndex(x=>String(x.mission_id)===String(missionId));
  const existingRole=signupIndex>=0?state.mySignups[signupIndex]?.operational_role:null;
  if(status==="withdraw"){
   if(signupIndex>=0)state.mySignups.splice(signupIndex,1);
  }else if(signupIndex>=0){
   state.mySignups[signupIndex].status=status;
  }else{
   state.mySignups.push({mission_id:missionId,status,operational_role:existingRole||null,operational_station:null});
  }
  updateMemberNotices();
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
document.addEventListener("click",e=>{const deployment=e.target.closest("#detailBody [data-open-mission-deployment]");if(deployment){e.preventDefault();e.stopPropagation();fleetRequestedMissionId=deployment.dataset.openMissionDeployment;closeDrawer();showView("fleet");return}const closeOp=e.target.closest("#detailBody [data-close-op]");if(closeOp){closeDrawer();return}const attendance=e.target.closest("#detailBody [data-attendance-user]");if(attendance){e.stopPropagation();if(activeMissionId&&!attendance.disabled)setMissionAttendance(activeMissionId,attendance.dataset.attendanceUser,attendance.checked,attendance);return}const t=e.target.closest("button,[data-mission],[data-user]");if(!t)return;const hoursBtn=t.closest("#detailBody [data-save-mission-hours]");if(hoursBtn){e.preventDefault();e.stopPropagation();if(!hoursBtn.disabled)updateMissionHours(hoursBtn.dataset.saveMissionHours,hoursBtn);return}const overlay=t.closest("#detailBody [data-overlay-mission]");if(overlay){e.preventDefault();e.stopPropagation();if(!overlay.disabled)setOverlayOperation(overlay.dataset.overlayMission,overlay.dataset.overlayAction==="activate",overlay);return}const r=t.closest("#detailBody [data-rsvp]");if(r){e.preventDefault();e.stopPropagation();if(!r.disabled&&activeMissionId)setRsvp(activeMissionId,r.dataset.rsvp);return}const role=t.closest("#detailBody [data-role]");if(role){e.preventDefault();e.stopPropagation();if(!role.disabled&&activeMissionId)toast("Command assigns operational roles.");return}const mission=t.closest("[data-mission]");if(mission?.dataset.mission){openMission(mission.dataset.mission);return}const crew=t.closest("[data-user]");if(crew?.dataset.user)openCrew(crew.dataset.user)});
document.addEventListener("keydown",e=>{if(e.key==="Enter"){const x=e.target.closest("[data-mission],[data-user]");if(x){x.dataset.mission?openMission(x.dataset.mission):openCrew(x.dataset.user)}}if(e.key==="Escape")closeDrawer()});
$("#detailClose").onclick=closeDrawer;$("#detailBackdrop").onclick=closeDrawer;


async function loadMyProfile(){
 const host=$("#profileView");if(!host)return;host.innerHTML='<div class="loading-detail">LOADING PERSONNEL DOSSIER…</div>';
 const {data:{session}}=await sb.auth.getSession();if(!session)return;const uid=session.user.id;
 const [profile,attendance,discord]=await Promise.all([sb.from("profiles").select("user_id,callsign,handle,role,availability_status,missions_attended").eq("user_id",uid).maybeSingle(),sb.from("mission_signups").select("*").eq("user_id",uid).eq("attendance_confirmed",true),sb.from("discord_links").select("handle,avatar_url").eq("user_id",uid).maybeSingle()]);
 if(profile.error){host.textContent=profile.error.message;return}
 const p={...(state.profile||{}),...(profile.data||{})},dl=discord.data||{},name=crewCallsign(p),org=coalitionOrgs.get(coalitionMembers.get(uid)),at=(attendance.data||[]).filter(x=>state.missions.some(m=>String(m.id)===String(x.mission_id)&&missionLocked(m))),ids=[...new Set(at.map(x=>x.mission_id))];
 host.innerHTML='<div class="profile-identity"><div class="profile-avatar">'+(dl.avatar_url?'<img src="'+esc(dl.avatar_url)+'" alt="">':esc(name.slice(0,2)))+'</div><div class="profile-name"><p class="eyebrow">COALITION PERSONNEL IDENTIFICATION</p><h2>'+esc(name)+'</h2><div class="profile-rank">'+(org?.emblem_url?'<img src="'+esc(org.emblem_url)+'" alt="">':'')+'<span>'+esc(org?.tag||"UNASSIGNED")+' / '+esc(p.role||"Member")+'</span></div></div></div><div class="profile-metrics"><div><b>'+ids.length+'</b><small>MISSIONS</small></div><div><b>'+ids.reduce((n,id)=>n+Number(state.missions.find(m=>String(m.id)===String(id))?.hours||0),0)+'</b><small>OPERATIONAL HOURS</small></div></div><div class="profile-layout" style="grid-template-columns:1fr"><section class="panel"><div class="panel-head"><div><p class="eyebrow">01 // PERSONNEL</p><h3>Service Record</h3></div></div><div class="profile-rows"><p><span>HANDLE</span><b>'+esc(dl.handle||p.handle||"—")+'</b></p><p><span>CALLSIGN</span><b id="profileCallsignDisplay">'+esc(name)+'</b></p><div class="profile-callsign-editor"><label for="profileCallsignInput">Change your callsign</label><div class="profile-callsign-control"><input id="profileCallsignInput" maxlength="40" value="'+esc(p.callsign||"")+'"><button type="button" class="primary" id="saveProfileCallsign">SAVE</button></div><small id="profileCallsignStatus">Shown on the Crew roster and in Operations.</small></div><p><span>ORGANISATION</span><b>'+esc(org?.name||"—")+'</b></p><p><span>SERVICE STATUS</span><b>'+esc((p.availability_status||"ACTIVE").toUpperCase())+'</b></p></div></section></div><section class="panel profile-wide"><div class="panel-head"><h3>Operations History</h3></div>'+ (at.length?at.map(x=>{const m=state.missions.find(z=>String(z.id)===String(x.mission_id));return '<div class="op-row"><span class="op-date">'+fmtDate(m?.start_time)+'</span><div><b>'+esc(m?.title||"Mission")+'</b></div></div>'}).join(""):'<div class="empty">No operational history recorded.</div>')+'</section><div class="profile-actions"><button class="ghost" id="profileSignout">SIGN OUT OF MANIFEST</button></div>';
 const fleetPanel=document.createElement("section");fleetPanel.className="panel profile-wide";fleetPanel.innerHTML='<div class="panel-head"><div><p class="eyebrow">PERSONAL HANGAR</p><h3>My Fleet</h3></div><button class="primary" type="button" id="sscAddFleet">+ ADD FLEET</button></div><form id="sscFleetForm" hidden style="display:none;gap:10px;margin-bottom:16px"><label>Ship model<input name="model" required maxlength="100" placeholder="e.g. RSI Galaxy"></label><label>Ship name (optional)<input name="shipname" maxlength="100"></label><label>Quantity<input name="quantity" type="number" min="1" max="100" value="1" required></label><label><input name="available" type="checkbox"> Available for operations</label><button class="primary" type="submit">SAVE SHIP</button><button class="ghost" type="button" id="sscCancelFleet">CANCEL</button></form><p id="sscFleetStatus" role="status"></p><div id="sscFleetList"></div>';host.querySelector(".profile-actions").before(fleetPanel);
 const form=fleetPanel.querySelector("form"),status=fleetPanel.querySelector("#sscFleetStatus"),list=fleetPanel.querySelector("#sscFleetList");let editing=null;
 const toggle=show=>{form.hidden=!show;form.style.display=show?"grid":"none"};
 const refreshFleet=async()=>{const {data,error}=await sb.from("coalition_personal_fleet").select("*").eq("user_id",uid).order("ship_model");if(error){status.textContent=error.message;return}list.replaceChildren();if(!data.length){list.textContent="No ships registered yet.";return}for(const ship of data){const row=document.createElement("div");row.className="op-row";row.innerHTML='<div><b>'+esc(ship.ship_model)+(ship.quantity>1?' × '+ship.quantity:'')+'</b><small>'+esc(ship.ship_name||"")+' · '+(ship.available_for_operations?"Available for operations":"Personal fleet")+'</small></div><div><button type="button" class="ghost">EDIT</button> <button type="button" class="ghost">REMOVE</button></div>';const [edit,remove]=row.querySelectorAll("button");edit.onclick=()=>{editing=ship.id;form.elements.model.value=ship.ship_model;form.elements.shipname.value=ship.ship_name||"";form.elements.quantity.value=ship.quantity;form.elements.available.checked=ship.available_for_operations;toggle(true)};remove.onclick=async()=>{if(!confirm("Remove this ship from your fleet?"))return;const {error}=await sb.from("coalition_personal_fleet").delete().eq("id",ship.id);status.textContent=error?error.message:"Ship removed.";await refreshFleet()};list.append(row)}};
 fleetPanel.querySelector("#sscAddFleet").onclick=()=>{editing=null;form.reset();toggle(true)};fleetPanel.querySelector("#sscCancelFleet").onclick=()=>toggle(false);form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;try{const payload={ship_model:form.elements.model.value.trim(),ship_name:form.elements.shipname.value.trim()||null,quantity:Number(form.elements.quantity.value),available_for_operations:form.elements.available.checked};const {error}=await(editing?sb.from("coalition_personal_fleet").update(payload).eq("id",editing):sb.from("coalition_personal_fleet").insert(Array.from({length:payload.quantity},()=>({...payload,quantity:1}))));if(error)throw error;status.textContent="Ship saved.";toggle(false);await refreshFleet()}catch(e){status.textContent=e.message}finally{button.disabled=false}};const importButton=document.createElement("button");importButton.type="button";importButton.className="ghost";importButton.textContent="IMPORT FROM HANGAR.LINK";fleetPanel.querySelector("#sscAddFleet").before(importButton);const fileInput=document.createElement("input");fileInput.type="file";fileInput.accept=".csv,text/csv";fileInput.hidden=true;fleetPanel.append(fileInput);importButton.onclick=()=>fileInput.click();
 function parseHangarCsv(raw){const rows=[];let row=[],field="",quoted=false;raw=raw.replace(/^\uFEFF/,"");for(let i=0;i<raw.length;i++){const c=raw[i];if(c==='"'){if(quoted&&raw[i+1]==='"'){field+='"';i++}else quoted=!quoted}else if(!quoted&&c===','){row.push(field);field=""}else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&raw[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field=""}else field+=c}if(quoted)throw Error("Invalid CSV quoting");if(row.length||field){row.push(field);rows.push(row)}return rows}
 fileInput.onchange=async()=>{const file=fileInput.files[0];if(!file)return;importButton.disabled=true;try{if(file.size>10000000)throw Error("CSV exceeds 10 MB");const rows=parseHangarCsv(await file.text()),header=rows.shift()||[],source=header.indexOf("Source"),type=header.indexOf("Type"),items=header.indexOf("Items");if([source,type,items].some(i=>i<0))throw Error("Not a recognised Hangar.link CSV export");const counts=new Map();for(const row of rows){if(row[source]?.trim().toLowerCase()!=="active"||row[type]?.trim().toLowerCase()==="upgrade")continue;for(const m of (row[items]||"").matchAll(/\[\|TITLE\|\s*([^|\]]+?)\s*\|KIND\|\s*Ship\s*(?=\||\])/gi)){const model=m[1].trim();if(model.length>100)continue;counts.set(model,(counts.get(model)||0)+1)}}if(!counts.size)throw Error("No active ships found");const {data:existing,error:readError}=await sb.from("coalition_personal_fleet").select("ship_model,quantity").eq("user_id",uid);if(readError)throw readError;const known=new Map();for(const x of existing){const key=x.ship_model.trim().toLowerCase();known.set(key,(known.get(key)||0)+Number(x.quantity||1))}const payload=[...counts].flatMap(([ship_model,quantity])=>Array.from({length:Math.max(0,quantity-(known.get(ship_model.toLowerCase())||0))},()=>({ship_model,quantity:1,available_for_operations:false})));const total=[...counts.values()].reduce((a,b)=>a+b,0);if(!payload.length){status.textContent="All detected ship quantities are already registered.";return}if(!confirm("Detected "+total+" ships/vehicles across "+counts.size+" models. Import "+payload.length+" additional individual ships? Existing ships and names will be left unchanged."))return;const {error}=await sb.from("coalition_personal_fleet").insert(payload);if(error)throw error;status.textContent="Imported "+payload.length+" individual ships.";await refreshFleet()}catch(e){status.textContent=e.message}finally{fileInput.value="";importButton.disabled=false}};
void refreshFleet();
 const callsignInput=$("#profileCallsignInput"),callsignButton=$("#saveProfileCallsign"),callsignStatus=$("#profileCallsignStatus");
 callsignButton.onclick=async()=>{
  const callsign=callsignInput.value.trim();
  callsignButton.disabled=true;
  callsignStatus.textContent="Saving…";
  try{
   const {data,error}=await sb.from("profiles").update({callsign:callsign||null}).eq("user_id",uid).select("callsign").maybeSingle();
   if(error)throw error;
   if(!data)throw new Error("No profile was updated. Please sign in again and retry.");
   p.callsign=data.callsign||"";
   state.profile={...(state.profile||{}),callsign:p.callsign};
   const member=state.crew.find(x=>x.user_id===uid);if(member)member.callsign=p.callsign;
   $("#profileCallsignDisplay").textContent=crewCallsign(p);
   callsignStatus.textContent="Saved. Your callsign is updated across the roster.";
  }catch(err){
   callsignStatus.textContent="Could not save: "+(err.message||err);
  }finally{
   callsignButton.disabled=false;
  }
 };
 callsignInput.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();callsignButton.click()}});
 $("#profileSignout").onclick=async()=>{if(confirm("Sign out of JMBN Manifest?")){await sb.auth.signOut();location.replace(base()+"auth.html")}}
}

function filterOps(){let q=$("#opSearch").value.toLowerCase(),f=$("[data-opfilter].active")?.dataset.opfilter||"all";let x=state.missions.filter(m=>(f==="all"||(f==="operations"?String(m.category||"operations").toLowerCase()!=="resource":String(m.category||"").toLowerCase()==="resource"))&&JSON.stringify(m).toLowerCase().includes(q));const newestFirst=(a,b)=>{const at=Date.parse(a.start_time||"")||0,bt=Date.parse(b.start_time||"")||0;return bt-at};const ongoing=x.filter(m=>!missionLocked(m)).sort(newestFirst),completed=x.filter(m=>missionLocked(m)).sort(newestFirst);const section=(name,items,key)=>'<section class="op-status-section"><div class="op-status-head"><div><span class="eyebrow">MISSION ARCHIVE // '+key+'</span><h3>'+name+'</h3></div><span class="op-status-count">'+items.length+' OPERATIONS</span></div><div class="cards op-status-cards">'+(items.length?missionCards(items):'<div class="empty">No '+name.toLowerCase()+' operations.</div>')+'</div></section>';$("#operationsGrid").innerHTML=section("ONGOING",ongoing,"ACTIVE & UPCOMING")+section("COMPLETED",completed,"MISSION HISTORY")}
function filterCrew(){let q=$("#crewSearch").value.toLowerCase(),f=$("[data-crewfilter].active")?.dataset.crewfilter||"all";let x=state.crew.filter(p=>(f==="all"||(f==="awol"?p.availability_status==="awol":p.availability_status!=="awol"))&&JSON.stringify(p).toLowerCase().includes(q));$("#crewGrid").innerHTML=crewCards(x)}
document.querySelectorAll(".nav[data-view]").forEach(b=>b.onclick=()=>{showView(b.dataset.view);if(b.dataset.view==="profile")loadMyProfile()});
$("#memberNoticeToggle")?.addEventListener("click",()=>{
 const panel=$("#memberNoticePanel");if(!panel)return;
 panel.hidden=!panel.hidden;
 $("#memberNoticeToggle").setAttribute("aria-expanded",String(!panel.hidden));
});
$$("[data-go]").forEach(b=>b.onclick=()=>showView(b.dataset.go));
$("#opSearch").oninput=filterOps;$("#crewSearch").oninput=filterCrew;$$("[data-opfilter]").forEach(b=>b.onclick=()=>{$$("[data-opfilter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");filterOps()});$$("[data-crewfilter]").forEach(b=>b.onclick=()=>{$$("[data-crewfilter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");filterCrew()});
$("#refreshOps").onclick=()=>{toast("Refreshing manifest…");load()};$("#readinessPanel").onclick=()=>openReadiness();$("#readinessPanel").onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openReadiness()}};$("#userBtn").onclick=()=>{showView("profile");loadMyProfile()};$("#welcomeProfile").onclick=()=>{showView("profile");loadMyProfile()};$("#railLogout").onclick=async()=>{if(confirm("Sign out of JMBN Manifest?")){await sb.auth.signOut();location.replace(base()+"auth.html")}};$("#dutyToggle").onclick=()=>{
 const current=state.profile?.availability_status==="awol"?"awol":"active";
 setDutyStatus(current==="awol"?"active":"awol");
};
setInterval(()=>{$("#clock").textContent=new Date().toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit",hour12:false})},1000);
const initialView=location.hash.replace("#","")==="deployments"?"fleet":location.hash.replace("#","");
if(["command","operations","fleet","crew","academy","records","profile"].includes(initialView)){
 showView(initialView);
 if(initialView==="profile")loadMyProfile();
}
let liveTimer;function liveRefresh(){clearTimeout(liveTimer);liveTimer=setTimeout(()=>load().then(()=>toast("Manifest updated")).catch(()=>{}),450)}
sb.channel("jmbn-manifest-live").on("postgres_changes",{event:"*",schema:"public",table:"missions"},liveRefresh).on("postgres_changes",{event:"*",schema:"public",table:"profiles"},liveRefresh).on("postgres_changes",{event:"*",schema:"public",table:"announcements"},liveRefresh).on("postgres_changes",{event:"*",schema:"public",table:"mission_signups"},liveRefresh).subscribe();
load().catch(e=>{console.error(e);if(document.documentElement.classList.contains("jmbn-session-pending")){
 const n=document.getElementById("jmbn-auth-gate-note");
 if(isMobileManifest()){
  if(n)n.textContent="We could not complete verification right now. Please wait a moment, then try again.";
  const gate=document.getElementById("jmbn-auth-gate");
  if(gate&&!document.getElementById("jmbn-mobile-verification-actions")){
   const controls=document.createElement("div");controls.id="jmbn-mobile-verification-actions";controls.style.cssText="display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap;margin-top:18px";
   const retry=document.createElement("button");retry.type="button";retry.textContent="TRY AGAIN";retry.style.cssText="padding:10px 15px;border:1px solid #d4b65b;background:#d4b65b;color:#070806;font:700 11px Play,sans-serif;letter-spacing:.08em;border-radius:6px";retry.addEventListener("click",()=>location.reload());
   const signIn=document.createElement("a");signIn.href=base()+"auth.html";signIn.textContent="GO TO LOGIN";signIn.style.cssText="padding:10px 15px;border:1px solid #d4b65b;color:#d4b65b;text-decoration:none;font:700 11px Play,sans-serif;letter-spacing:.08em;border-radius:6px";
   controls.append(retry,signIn);gate.append(controls);
  }
 }else if(n)n.textContent="Unable to verify clearance. Refresh the page to retry.";
}else toast("Manifest sync failed")});
document.addEventListener("change",e=>{const role=e.target.closest?.("#detailBody select[data-assign-user]");if(role&&activeMissionId){assignCrewRole(activeMissionId,role.dataset.assignUser,role.value,role);return}const station=e.target.closest?.("#detailBody select[data-station-user]");if(station&&activeMissionId)assignCrewStation(activeMissionId,station.dataset.stationUser,station.value,station)});

// Bottom JMBN operations ticker
(()=>{const el=$("#opsTicker"),chip=$("#opsChip"),msg=$("#opsMsg"),prev=$("#opsPrev"),next=$("#opsNext"),pause=$("#opsPause"),close=$("#opsClose"),restore=$("#opsRestore");if(!el)return;const lines=[
"CONTACT: [user] joined the Frontier Fighters.",
"OPS: [user] caused a “minor” power shortage.",
"COMMS: [user] broadcast karaoke on all channels. Again.",
"SECURITY: [user] “poked” a pirate Idris. Backup requested.",
"CARGO: [user] mislabeled 300 SCU of scrap as platinum.",
"ALERT: [user] installed Windows on the ship radar. It crashed.",
"OPS: [user] tried “turning it off and on again.” Success.",
"SYSTEM: Update failed successfully. Classic.",
"OPS: [user1] vs [user2] over the last power cell.",
"SECURITY: [user1] blamed [user2] for the missing Pico.",
"OPS: [user1] told [user2] “I know a shortcut.” Navigation is investigating.",
"SECURITY: [user1] challenged [user2] to a race through the hangar. Security would like a word.",
"CARGO: [user] stacked crates into a “fortress of solitude.”",
"ENGINEERING: Someone touched the component that clearly said DO NOT TOUCH.",
"COMMS: Open mic detected. Heavy breathing and snack consumption confirmed.",
"SECURITY: Boarding party ready. Nobody remembered the door code.",
"OPS: Mission plan updated from “careful” to “send it.”",
"SYSTEM: Coffee reserves below operational minimum.",
"CARGO: Cargo grid is full. Somehow there is still one box left.",
"ALERT: Unscheduled rapid disassembly detected.",
"OPS: Crew reports the landing was technically survivable.",
"COMMS: Whoever is playing music in Engineering has excellent taste.",
"SECURITY: [user] identified a suspicious individual. It was a mirror.",
"ENGINEERING: Power restored. Cause of failure classified as “[user].”",
"SYSTEM: [user] reports the quantum drive is emotionally unavailable. Try again later.",
"OPS: Command confirms ramming is still not an approved docking procedure.",
"CARGO: [user] found the missing box. A different box is now missing.",
"COMMS: Reminder: proximity chat is not a private channel.",
"ALERT: [user] said “watch this.” Medical team placed on standby.",
"OPS: Route recalculated after someone ignored the route.",
"ENGINEERING: Fuse replaced. Nobody ask where the spare came from.",
"SECURITY: Weapons tight. Yes, that includes you.",
"SYSTEM: Radar contact classified as “probably fine.”",
"CARGO: 96 SCU loaded. 104 SCU of opinions also loaded.",
"OPS: Formation looking excellent from at least one angle.",
"COMMS: [user], Command channel is for command traffic, not dinner orders.",
"ALERT: Gravity remains operational. Crew member confirmed personally.",
"ENGINEERING: Coolers nominal. Engineer suspicious.",
"OPS: Polaris fully crewed. Corridor traffic now critical.",
"SYSTEM: Server stable. Please do not acknowledge this message.",
"SECURITY: Pirate requested surrender. Crew requested clarification on whose surrender.",
"CARGO: Tractor beam privileges temporarily under review.",
"COMMS: Mic check successful. Volume check regrettable.",
"OPS: [user] successfully rebranded a tactical withdrawal as “repositioning.”",
"ENGINEERING: Reactor status: green. Engineer status: questionable.",
"ALERT: [user] acquired a torpedo solution. Wallet has left the chat.",
"SYSTEM: Ship systems nominal-ish.",
"OPS: Briefing complete. Half the crew definitely listened.",
"SECURITY: Airlock discipline reminder issued for reasons we will not discuss.",
"CARGO: Manifest says 40 crates. Eyes say 39. Nobody move.",
"COMMS: Unknown transmission received: “o7”. Diplomatic response sent: “o7”.",
"OPS: Captain has a plan. Details remain a developing situation.",
"OPS: Johnny reports the landing gear is fine. Engineering would like a second opinion.",
"SYSTEM: Johnny has landed successfully. No further details will be provided.",
"COMMS: Has anyone seen Sam/Freezern?",
"COMMS: Stand down. Check the loo first.",
"CONTACT: Beans has disappeared from the manifest.",
"CONTACT: Update: Beans has been located on microTech. Again.",
"CARGO: Beans said he would be “right back.” That was two quantum jumps ago.",
"ALERT: Johnny is approaching the hangar. Maintenance crews have been notified.",
"COMMS: Sam/Freezern is AFK. Search pattern begins at the nearest toilet.",
"ALERT: WEAPONS HOLD!! Why is someone still firing? Sam/Freezern forgot.",
"COMMS: AshenShrike reports a temporary crew assignment: “Hey guys, my baby is on my lap.”",
"OPS: Group photo delayed. Nomad: “You on the side! Five more steps!! GODD!!!”",
"COMMS: AshenShrike: “Head to S4-2.” — Sam/Freezern: “Where is it?”",
"COMMS: Sam/Freezern: “Give me five more minutes, guys… I’m in the toilet.”",
"ALERT: Johnny: “Guys… I can’t move. I think I’m stuck in the seat.”",
"COMMS: AshenShrike: “OOD, come about!!” — DeLumenta: “Beans, come about!” — AshenShrike shakes his head.",
"COMMS: “Who’s the Helmsman?” — Silence on all channels.",
"ALERT: “CONTACT!” — Stand down. It’s a rock.",
"ENGINEERING: “Who turned that off?” — Investigation suspended due to nobody admitting anything.",
"COMMS: [user1]: “Are you following me?” — [user2]: “I thought you were following me.”",
"SECURITY: AshenShrike: “Weapons hold.” — Sam/Freezern continues firing.",
"COMMS: OOD requested a status report. Engineering replied: “Yes.”",
"SECURITY: Boarding team assembled. Jesric is holding a fire extinguisher.",
"OPS: Captain: “Come about!” — Five minutes later, OOD: “Come about!” — Helmsman: “???”.",
"COMMS: “Set Condition One.” — Sam/Freezern is still talking about food.",
"SYSTEM: JMBN network operational. Competence not guaranteed."
];const styles={ALERT:"var(--gold2)",OPS:"var(--gold2)",COMMS:"#9ecbff",SECURITY:"tomato",CARGO:"#a0f0c0",SYSTEM:"#f7f1d0",CONTACT:"#f7f1d0"};let i=0,timer,playing=true;const type=line=>(line.match(/^([A-Z]+):/)||[])[1]||"OPS";function render(){const raw=lines[i],members=(state.crew||[]).filter(p=>String(p?.callsign||"").trim()),pick=exclude=>{const pool=members.filter(p=>crewCallsign(p)!==exclude);const p=(pool.length?pool:members)[Math.floor(Math.random()*Math.max((pool.length?pool:members).length,1))];return p?crewCallsign(p):"CREW"},user1=pick(),user2=pick(user1),user=pick(),line=raw.replaceAll("[user1]",user1).replaceAll("[user2]",user2).replaceAll("[user]",user),t=type(line);chip.textContent=`[${t}]`;chip.style.background=styles[t]||"var(--gold2)";chip.style.color="#000";msg.style.opacity=0;setTimeout(()=>{msg.textContent=line;msg.style.opacity=1},180);pause.textContent=playing?"Pause":"Play"}function nextL(){i=(i+1)%lines.length;render()}function prevL(){i=(i-1+lines.length)%lines.length;render()}function start(){if(timer)return;playing=true;timer=setInterval(nextL,4000);render()}function stop(){playing=false;clearInterval(timer);timer=null;render()}next.onclick=()=>{stop();nextL()};prev.onclick=()=>{stop();prevL()};pause.onclick=()=>playing?stop():start();function hideTicker(){el.style.display="none";if(restore)restore.hidden=false;sessionStorage.setItem("opsClosed","1");stop()}function showTicker(){el.style.display="";if(restore)restore.hidden=true;sessionStorage.removeItem("opsClosed");start()}close.onclick=hideTicker;if(restore)restore.onclick=showTicker;if(sessionStorage.getItem("opsClosed")==="1"){el.style.display="none";if(restore)restore.hidden=false;return}start()})();



/* Fleet Deployment: native Manifest view; uses the same authenticated Supabase client and mission_signups as Operations. */
const PERSEUS_STATIONS=[{id:"ood",label:"OOD"},{id:"helmsman",label:"HELMSMAN"},{id:"command_chair",label:"COMMAND CHAIR"},{id:"stations_pending",label:"STATIONS PENDING"}];
const FLEET_STATIONS=[["air","AIR"],["helmsman","HELMSMAN"],["surface","SURFACE"],["ood","OOD"],["command_chair","COMMAND CHAIR"],["engineering_duty_officer","ENGINEER"],["torpedo_director","TORPEDO DIRECTOR"],["mount_3_1","MOUNT 3-1"],["mount_3_2","MOUNT 3-2"],["mount_4_1","MOUNT 4-1"],["mount_4_2","MOUNT 4-2"],["mount_6_1","MOUNT 6-1"]];
const FLEET_ROLES=["Command","Pilot","Co-Pilot","Engineer","Turret Gunner","Fighter Pilot","Medical","Security / Boarding","Cargo / Logistics","Ground Team","Support"];
let fleetInitialized=false,fleetCanEdit=false,fleetSignups=[],fleetCurrent=null;
function fleetNotice(msg){const e=$("#fleetMessage");if(e)e.textContent=msg}
function fleetName(id){const p=state.crew.find(x=>x.user_id===id);return p?.callsign||p?.display_name||p?.handle||"Crew member"}
function fleetMetric(label,value){return '<div class="fleet-metric"><div class="eyebrow">'+esc(label)+'</div><b>'+esc(String(value))+'</b></div>'}
async function fleetInit(){
 const sel=$("#fleetMission");if(!sel)return;
 const {data:{session}}=await sb.auth.getSession();
 if(!session){$("#fleetConnection").textContent="Sign in required";fleetNotice("Please sign in to JMBN Manifest.");return}
 const auth=await sb.rpc("is_elevated",{u:session.user.id});fleetCanEdit=auth.data===true&&!auth.error;
 const q=await sb.from("missions").select("id,title,status,start_time").order("start_time",{ascending:false}).limit(100);
 if(q.error){$("#fleetConnection").textContent="Connection error";fleetNotice(q.error.message);return}
 const previous=sel.value;const missions=q.data||[];
 sel.replaceChildren(new Option("Select an operation",""));
 missions.forEach(m=>sel.add(new Option((m.title||"Untitled")+" · "+(m.start_time?new Date(m.start_time).toLocaleDateString("en-SG"):"TBD"),m.id)));
 const requested=fleetRequestedMissionId;fleetRequestedMissionId=null;const selected=missions.find(m=>m.id===requested)||missions.find(m=>m.id===previous)||missions.find(m=>m.start_time&&new Date(m.start_time)>=new Date())||missions[0];
 if(selected)sel.value=selected.id;
 $("#fleetConnection").textContent=fleetCanEdit?"COMMAND ACCESS · EDITING ENABLED":"CREW ACCESS · VIEW ONLY";
 fleetInitialized=true;await fleetLoad();
}
async function fleetLoad(){
 const id=$("#fleetMission")?.value;if(!id){$("#fleetRoster").textContent="No operation selected.";return}
 $("#fleetConnection").textContent="SYNCING OPERATIONS";
 const [q,vesselResult]=await Promise.all([sb.from("mission_signups").select("mission_id,user_id,status,operational_role,operational_station").eq("mission_id",id),sb.from("missions").select("attachments").eq("id",id).single()]);
 if(!vesselResult.error){const configured=(vesselResult.data?.attachments||[]).find(a=>a?.name==="__jmbn_assigned_vessel__")?.vessel;fleetSelectedShip=configured==="perseus"?"perseus":"starfish";fleetAssignedVessel=configured||"";const vesselSel=document.getElementById("fleetVesselSelect");if(vesselSel)vesselSel.value=fleetSelectedShip;}
 if(q.error){fleetNotice("Unable to load crew: "+q.error.message);$("#fleetConnection").textContent="SYNC ERROR";return}
 fleetSignups=(q.data||[]).filter(x=>String(x.status).toLowerCase()==="going");
 const opt=document.querySelector('#fleetMission option:checked');const label=opt?.textContent||'—';const name=label.split(' · ')[0];const date=label.includes(' · ')?label.split(' · ').slice(1).join(' · '):'—';const ov=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};ov('fleetOverviewOperation',name);ov('fleetOverviewSchedule',date);ov('fleetOverviewGoing',fleetSignups.length);ov('fleetOverviewAssigned',fleetSignups.filter(x=>x.operational_station&&(fleetSelectedShip==='perseus'?PERSEUS_STATIONS.some(s=>s.id===x.operational_station):FLEET_STATIONS.some(s=>s[0]===x.operational_station))).length);ov('fleetOverviewStatus','SELECTED');
 const [standingResult,reviewResult]=await Promise.all([sb.from("fleet_standing_assignments").select("*").eq("vessel","JCS Starfish").order("priority",{ascending:true}),sb.from("fleet_mission_reviews").select("standing_id,decision,assigned_user_id,assigned_station").eq("mission_id",id)]);
 const standing=fleetSelectedShip==="starfish"?(standingResult.data||[]):[],reviewed=new Map((reviewResult.data||[]).map(x=>[x.standing_id,x]));
 const proposed=new Map(),reserved=new Set(fleetSignups.map(x=>x.operational_station).filter(Boolean));
 for(const item of standing){
  if(item.priority!==1)continue;
  const decision=reviewed.get(item.id);
  if(decision?.decision==="reject")continue;
  const uid=item.crew_user_id||fleetFindCrew(item.crew_label);
  const member=fleetSignups.find(x=>x.user_id===uid);
  if(!member||member.operational_station||proposed.has(uid)||reserved.has(item.station))continue;
  proposed.set(uid,{station:item.station,role:item.role,label:item.crew_label});
  reserved.add(item.station);
 }
 const validStations=new Set((fleetSelectedShip==="perseus"?PERSEUS_STATIONS.map(x=>x.id):FLEET_STATIONS.map(x=>x[0])));const used=fleetSignups.filter(x=>x.operational_station&&validStations.has(x.operational_station));
 $("#fleetMetrics").innerHTML=fleetMetric("GOING",fleetSignups.length)+fleetMetric("STATIONS ASSIGNED",used.length+" / "+(fleetSelectedShip==="perseus"?PERSEUS_STATIONS.length:FLEET_STATIONS.length))+fleetMetric("UNASSIGNED CREW",fleetSignups.filter(x=>!x.operational_station||!validStations.has(x.operational_station)).length);
 fleetSyncPolaris();fleetUpdateShipView();
 const roster=$("#fleetRoster");roster.replaceChildren();
 if(!fleetSignups.length){const empty=document.createElement("div");empty.className="fleet-empty";empty.textContent="No crew marked GOING for this operation.";roster.append(empty)}
 const stationOptions=fleetSelectedShip==="perseus"?PERSEUS_STATIONS.map(x=>[x.id,x.label]):FLEET_STATIONS;const stationOrder=new Map(stationOptions.map(([id],i)=>[id,i]));const orderedCrew=[...fleetSignups].sort((a,b)=>(stationOrder.get(a.operational_station)??999)-(stationOrder.get(b.operational_station)??999)||fleetName(a.user_id).localeCompare(fleetName(b.user_id)));
 for(const member of orderedCrew){
  const card=document.createElement("div");card.className="fleet-person-card";
  const identity=document.createElement("div");identity.className="fleet-person-identity";const stationTitle=document.createElement("strong");stationTitle.className="fleet-person-station";stationTitle.textContent=stationOptions.find(([id])=>id===member.operational_station)?.[1]||"STATION UNASSIGNED";const name=document.createElement("span");name.className="fleet-person-callsign";name.textContent=member.operational_station?"● "+fleetName(member.user_id):"○ "+fleetName(member.user_id);identity.append(stationTitle,name);
  const suggestion=proposed.get(member.user_id);
  if(suggestion&&fleetSelectedShip==="starfish"){const hint=document.createElement("div");hint.className="fleet-autofill-hint";hint.textContent="SUGGESTED FROM STANDING ROSTER · "+(FLEET_STATIONS.find(x=>x[0]===suggestion.station)?.[1]||suggestion.station);card.append(hint)}
  const fields=document.createElement("div");fields.className="fleet-person-fields";
  for(const [key,values,fn,arg] of [["operational_role",FLEET_ROLES.map(x=>[x,x]),"command_assign_mission_role","p_role"],["operational_station",fleetSelectedShip==="perseus"?PERSEUS_STATIONS.map(x=>[x.id,x.label]):FLEET_STATIONS,"command_assign_mission_station","p_station"]]){
   const select=document.createElement("select");
   select.add(new Option(key==="operational_role"?"ROLE · UNASSIGNED":"STATION · UNASSIGNED",""));
   for(const [value,label] of values){const o=new Option(label,value);o.selected=(member[key]||((fleetSelectedShip==='starfish')?suggestion?.[key==="operational_role"?"role":"station"]:null))===value;if(key==="operational_station"&&value!=="stations_pending"&&value!==member[key]&&fleetSignups.some(x=>x.user_id!==member.user_id&&x.operational_station===value))o.disabled=true;select.add(o)}
   select.disabled=!fleetCanEdit;select.setAttribute("aria-label",key+" for "+fleetName(member.user_id));
   select.addEventListener("change",async()=>{select.disabled=true;fleetNotice("Saving assignment…");const {error}=await sb.rpc(fn,{p_mission_id:$("#fleetMission").value,p_user_id:member.user_id,[arg]:select.value||null});if(error)fleetNotice("Save failed: "+error.message);else fleetNotice("Assignment saved to Operations.");await fleetLoad()});
   fields.append(select);
  }
  card.prepend(identity);card.append(fields);card.tabIndex=0;card.title="Focus this crew member's station on the ship blueprint";const focus=()=>{const station=card.querySelector('select[aria-label^="operational_station"]')?.value;if(!station){fleetNotice("Assign a station to this crew member first.");return}if(fleetSelectedShip!=="starfish"){fleetNotice("Perseus station focus will be available when its tactical station map is configured.");return}const frame=document.getElementById('fleetPolarisFrame');frame?.contentWindow?.postMessage({type:'jmbn-fleet-focus-station',station},location.origin);document.querySelectorAll('#fleetRoster .fleet-person-card').forEach(el=>el.classList.toggle('fleet-focused',el===card))};card.addEventListener('click',event=>{if(event.target.closest('select,button'))return;focus()});card.addEventListener('keydown',event=>{if(event.target===card&&(event.key==='Enter'||event.key===' ')){event.preventDefault();focus()}});if(suggestion&&fleetSelectedShip==="starfish"&&fleetCanEdit){const apply=document.createElement("button");apply.type="button";apply.className="fleet-apply-suggestion";apply.textContent="ACCEPT SUGGESTION";apply.onclick=async()=>{apply.disabled=true;const item=standing.find(x=>x.priority===1&&(x.crew_user_id||fleetFindCrew(x.crew_label))===member.user_id&&x.station===suggestion.station);if(item)await fleetSaveReview(item,"accept",member.user_id,suggestion.station,suggestion.role);else fleetNotice("Standing assignment not found.");};card.append(apply)}roster.append(card);
 }
 $("#fleetConnection").textContent=fleetCanEdit?"COMMAND ACCESS · LIVE":"CREW ACCESS · LIVE";

}
$("#fleetMission")?.addEventListener("change",fleetLoad);
$("#fleetRefresh")?.addEventListener("click",fleetInit);



/* Standing and Ready Deployment: persisted decisions, never alter the standing roster on mission review. */
function fleetFindCrew(label){
 const l=String(label||"").toLowerCase();
 return state.crew.find(p=>[p.callsign,p.display_name,p.handle].some(v=>String(v||"").toLowerCase()===l))?.user_id||null;
}
async function fleetRenderReady(){
 const review=$("#fleetReview");if(!review)return;
 const missionId=$("#fleetMission").value;
 const [a,b]=await Promise.all([sb.from("fleet_standing_assignments").select("*").eq("vessel","JCS Starfish").order("priority",{ascending:true}).order("id",{ascending:true}),sb.from("fleet_mission_reviews").select("*").eq("mission_id",missionId)]);
 if(a.error||b.error){fleetNotice("Ready Deployment unavailable: "+(a.error?.message||b.error?.message));return}
 const defaults=a.data||[],decisions=new Map((b.data||[]).map(x=>[x.standing_id,x]));
 review.replaceChildren();
 const primary=defaults.filter(x=>x.priority===1);
 for(const item of primary){
  const saved=decisions.get(item.id),userId=item.crew_user_id||fleetFindCrew(item.crew_label);
  const attending=!!userId&&fleetSignups.some(x=>x.user_id===userId);
  const card=document.createElement("article");card.className="fleet-review-card"+(saved?" reviewed":"");
  const top=document.createElement("div");top.className="fleet-review-top";
  const left=document.createElement("div");const name=document.createElement("b");name.textContent=item.crew_label+" · "+(FLEET_STATIONS.find(x=>x[0]===item.station)?.[1]||item.station);
  const meta=document.createElement("div");meta.className="fleet-review-meta";meta.textContent=(attending?"GOING":"NOT GOING / NOT REGISTERED")+" · "+(item.notes||"Standing assignment");left.append(name,meta);
  const status=document.createElement("span");status.className="fleet-review-status";status.textContent=saved?saved.decision.toUpperCase():"PENDING";top.append(left,status);card.append(top);
  const actions=document.createElement("div");actions.className="fleet-review-actions";
  const act=(label,fn,disabled=false)=>{const btn=document.createElement("button");btn.type="button";btn.textContent=label;btn.disabled=disabled||!fleetCanEdit;btn.onclick=fn;actions.append(btn)};
  act("ACCEPT",()=>fleetSaveReview(item,"accept",userId,item.station,item.role),!attending);
  act("EDIT",()=>{
    const old=card.querySelector(".fleet-edit-fields");if(old){old.remove();return}
    const fields=document.createElement("div");fields.className="fleet-edit-fields";
    const person=document.createElement("select");person.add(new Option("SELECT GOING CREW",""));fleetSignups.forEach(x=>person.add(new Option(fleetName(x.user_id),x.user_id)));person.value=attending?userId:"";
    const station=document.createElement("select");FLEET_STATIONS.forEach(x=>station.add(new Option(x[1],x[0])));station.value=item.station;
    const save=document.createElement("button");save.textContent="SAVE MISSION CHANGE";save.type="button";save.className="primary";save.style.cssText="grid-column:1/-1;padding:11px";save.onclick=()=>fleetSaveReview(item,"edit",person.value,station.value,item.role);
    fields.append(person,station,save);card.append(fields);
  },!fleetSignups.length);
  act("REJECT",()=>fleetSaveReview(item,"reject",null,null,null));
  card.append(actions);review.append(card);
 }
 if(!primary.length){review.textContent="No standing deployment has been configured."}
}
async function fleetSaveReview(item,decision,userId,station,role){
 const missionId=$("#fleetMission").value;if(!missionId||!fleetCanEdit)return;
 if(decision!=="reject"&&!userId){fleetNotice("Choose a crew member who RSVP'd GOING.");return}
 if(decision!=="reject"&&!fleetSignups.some(x=>x.user_id===userId)){fleetNotice("Only GOING crew can be assigned.");return}
 if(decision!=="reject"&&fleetSignups.some(x=>x.user_id!==userId&&x.operational_station===station)){fleetNotice("That station is already occupied. Change the existing assignment first.");return}
 fleetNotice("Saving "+decision+" decision…");
 const old=fleetSignups.find(x=>x.user_id===item.crew_user_id);
 if(decision!=="reject"){
  const roleResult=await sb.rpc("command_assign_mission_role",{p_mission_id:missionId,p_user_id:userId,p_role:role||null});
  if(roleResult.error){fleetNotice(roleResult.error.message);return}
  const stationResult=await sb.rpc("command_assign_mission_station",{p_mission_id:missionId,p_user_id:userId,p_station:station});
  if(stationResult.error){fleetNotice(stationResult.error.message);return}
 }else if(old&&old.operational_station===item.station){
  const clear=await sb.rpc("command_assign_mission_station",{p_mission_id:missionId,p_user_id:old.user_id,p_station:null});
  if(clear.error){fleetNotice(clear.error.message);return}
 }
 const {error}=await sb.from("fleet_mission_reviews").upsert({mission_id:missionId,standing_id:item.id,decision,assigned_user_id:decision==="reject"?null:userId,assigned_station:decision==="reject"?null:station,assigned_role:decision==="reject"?null:role,updated_at:new Date().toISOString()},{onConflict:"mission_id,standing_id"});
 if(error){fleetNotice("Mission assignment saved but review status failed: "+error.message);return}
 await fleetLoad();fleetNotice("Mission deployment "+decision+" saved. Standing roster unchanged.");
}

/* Two-ship fleet selector on the native Manifest. */
let fleetSelectedShip='starfish',fleetAssignedVessel='';
function fleetUpdateShipView(){const pol=fleetSelectedShip==='starfish';const set=(id,value)=>{const x=document.getElementById(id);if(x)x.textContent=value};set('fleetFeatureName',pol?'RSI POLARIS':'RSI PERSEUS');set('fleetFeatureBadge',pol?'FLAGSHIP':'GUNSHIP');set('fleetFeatureTitle',pol?'RSI POLARIS':'RSI PERSEUS');set('fleetFeatureType',pol?'CAPITAL SHIP · FLAGSHIP':'CAPITAL SHIP · GUNSHIP');set('fleetFeatureDescription',pol?'JCS Starfish · Command / Mobile Base':'Heavy Combat / Escort');const assigned=fleetSignups.filter(x=>x.operational_station&&(pol?!String(x.operational_role||'').toLowerCase().includes('perseus'):String(x.operational_role||'').toLowerCase().includes('perseus'))).length;set('fleetFeatureCrew',assigned+' crew assigned for selected operation');const art=document.getElementById('fleetFeatureArt');if(art)art.className='fleet-native-art '+(pol?'is-polaris':'is-perseus');const active=document.getElementById('fleetActiveShip'),perseus=document.getElementById('fleetPerseusShip');if(active)active.hidden=!pol;if(perseus)perseus.hidden=pol;const vesselSelect=document.getElementById('fleetVesselSelect');if(vesselSelect){vesselSelect.value=fleetSelectedShip;vesselSelect.disabled=!fleetCanEdit||!document.getElementById('fleetMission')?.value;}set('fleetCurrentName',pol?'RSI POLARIS':'RSI PERSEUS');set('fleetCurrentDescription',!fleetAssignedVessel?'NOT ASSIGNED · Showing Polaris preview':pol?'JCS Starfish · Command / Mobile Base':'Heavy Combat / Escort');}
document.getElementById('fleetVesselSelect')?.addEventListener('change',async event=>{const selected=event.target.value,missionId=document.getElementById('fleetMission')?.value;if(!missionId||!fleetCanEdit){event.target.value=fleetSelectedShip;fleetNotice('Command access and a selected operation are required to change vessels.');return}if(selected===fleetSelectedShip)return;if(fleetSignups.some(x=>x.operational_station)&&!confirm('Switching vessels will clear all crew station assignments for this mission. RSVP and operational roles will be preserved. Continue?')){event.target.value=fleetSelectedShip;return}event.target.disabled=true;const saved=await sb.rpc('command_set_mission_vessel',{p_mission_id:missionId,p_vessel:selected});event.target.disabled=false;if(saved.error){fleetNotice('Unable to save vessel: '+saved.error.message);event.target.value=fleetSelectedShip;return}fleetAssignedVessel=selected;fleetSelectedShip=selected;fleetSignups.forEach(x=>x.operational_station=null);fleetUpdateShipView();await fleetLoad();fleetNotice('Vessel saved. Crew stations cleared for reassignment.')});const fleetBlueprintPanel=document.getElementById('fleetBlueprintWrap');const fleetBlueprintButton=document.getElementById('fleetBlueprintToggle');const FLEET_TACTICAL_ORDER=["command_chair","ood","helmsman","surface","air","mount_6_1","mount_4_1","mount_4_2","mount_3_1","mount_3_2","icc","engineering_duty_officer","torpedo_director","stations_pending"];
function fleetRenderStationRoster(){const root=document.getElementById('fleetRoster');if(!root||document.getElementById('fleetBlueprintWrap')?.hidden)return;const options=fleetSelectedShip==='perseus'?PERSEUS_STATIONS.map(x=>[x.id,x.label]):FLEET_STATIONS;const sorted=[...options].sort((a,b)=>FLEET_TACTICAL_ORDER.indexOf(a[0])-FLEET_TACTICAL_ORDER.indexOf(b[0]));root.replaceChildren();for(const [station,label] of sorted){const current=fleetSignups.find(x=>x.operational_station===station);const row=document.createElement('div');row.className='fleet-station-row';row.dataset.station=station;row.tabIndex=0;const heading=document.createElement('strong');heading.textContent=label;const callsign=document.createElement('span');callsign.className='fleet-station-callsign';callsign.textContent=current?'● '+fleetName(current.user_id):'○ Unassigned';const select=document.createElement('select');select.setAttribute('aria-label','Assign crew to '+label);select.disabled=!fleetCanEdit;select.add(new Option('UNASSIGNED',''));for(const member of [...fleetSignups].sort((a,b)=>fleetName(a.user_id).localeCompare(fleetName(b.user_id))))select.add(new Option(fleetName(member.user_id),member.user_id));select.value=current?.user_id||'';select.addEventListener('change',async()=>{const next=select.value;if(next===(current?.user_id||''))return;select.disabled=true;fleetNotice('Saving '+label+' assignment…');const missionId=document.getElementById('fleetMission')?.value;const save=async(user,stationId)=>sb.rpc('command_assign_mission_station',{p_mission_id:missionId,p_user_id:user,p_station:stationId});let error=null;if(current&&current.user_id!==next){const result=await save(current.user_id,null);error=result.error}if(!error&&next){const result=await save(next,station);error=result.error}if(error)fleetNotice('Assignment failed: '+error.message);else fleetNotice('Station assignment saved to both crew views.');await fleetLoad()});row.append(heading,callsign,select);const focus=()=>{if(fleetSelectedShip!=='starfish')return;document.getElementById('fleetPolarisFrame')?.contentWindow?.postMessage({type:'jmbn-fleet-focus-station',station},location.origin);root.querySelectorAll('.fleet-station-row').forEach(el=>el.classList.toggle('fleet-focused',el===row))};row.addEventListener('click',e=>{if(e.target!==select)focus()});row.addEventListener('keydown',e=>{if(e.target===row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();focus()}});root.append(row)}}
function fleetSetBlueprintOpen(open){if(!fleetBlueprintPanel)return;const home=document.querySelector('#fleet .fleet-board-layout'),roster=document.getElementById('fleetRosterSection'),aside=home?.querySelector('.fleet-board-aside');home?.classList.remove('fleet-board-blueprint-open');if(home&&roster&&!home.contains(roster))home.insertBefore(roster,aside||null);if(aside)aside.hidden=false;if(home&&fleetBlueprintPanel.parentElement===home)home.after(fleetBlueprintPanel);fleetBlueprintPanel.hidden=!open;fleetBlueprintButton?.setAttribute('aria-expanded',String(open));if(fleetBlueprintButton)fleetBlueprintButton.textContent=open?'HIDE BLUEPRINT ▴':'VIEW BLUEPRINT ▾';if(open){fleetUpdateShipView();fleetSyncPolaris();}else if(fleetInitialized)fleetLoad();}
fleetBlueprintButton?.addEventListener('click',()=>fleetSetBlueprintOpen(fleetBlueprintPanel?.hidden));document.getElementById('fleetBlueprintClose')?.addEventListener('click',()=>fleetSetBlueprintOpen(false));
/* Native fleet page ↔ interactive Polaris station reference. Live mission data only. */
function fleetSyncPolaris(){
 const frame=document.getElementById("fleetPolarisFrame");if(!frame?.contentWindow)return;
 const mapping={helmsman:"helm",command_chair:"cmd",ood:"ood",air:"air",surface:"surface",mount_4_1:"41",mount_4_2:"42",mount_3_1:"31",mount_3_2:"32",mount_6_1:"61",torpedo_director:"torp",engineering_duty_officer:"edo"};
 const assignments={};
 for(const member of fleetSignups){const station=mapping[member.operational_station];if(station)assignments[station]=fleetName(member.user_id)}
 frame.contentWindow.postMessage({type:"jmbn-fleet-roster",assignments},location.origin);
}
document.getElementById("fleetPolarisFrame")?.addEventListener("load",()=>fleetSyncPolaris());
window.addEventListener("message",event=>{
 if(event.origin!==location.origin||event.source!==document.getElementById("fleetPolarisFrame")?.contentWindow||event.data?.type!=="jmbn-fleet-station")return;
 const station=event.data.station;if(!station)return;
 const row=[...document.querySelectorAll("#fleetRoster .fleet-station-row")].find(el=>el.dataset.station===station);
 if(row){row.scrollIntoView({behavior:"smooth",block:"nearest"});document.querySelectorAll("#fleetRoster .fleet-station-row").forEach(el=>el.classList.toggle("fleet-focused",el===row));return}
 const card=[...document.querySelectorAll("#fleetRoster .fleet-person-card")].find(el=>el.querySelector('select[aria-label^="operational_station"]')?.value===station);
 if(card){card.scrollIntoView({behavior:"smooth",block:"center"});card.style.outline="1px solid var(--gold)";setTimeout(()=>card.style.outline="",1800)}
 else fleetNotice("Station selected: "+(FLEET_STATIONS.find(x=>x[0]===station)?.[1]||station)+". Assign a GOING crew member below.");
});
