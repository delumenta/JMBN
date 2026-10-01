// Member-specific layer. Reuses the live Supabase schema; never invents mission or signup data.
const API="https://fcegavhipeaeihxegsnw.supabase.co";
const KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZWdhdmhpcGVhZWloeGVnc253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMjk3NTcsImV4cCI6MjA3NzcwNTc1N30.i-ZjOlKc89-uA7fqOIvmAMv60-C2_NmKikRI_78Jei8";
const client=window.jmbnClient||(window.jmbnClient=window.supabase.createClient(API,KEY,{auth:{persistSession:true,flowType:"pkce",autoRefreshToken:true}}));
const el=id=>document.getElementById(id);
let selectedMission=null, currentUser=null, currentSignup=null, refreshing=false;let noticeItems=[];
function niceDate(s){if(!s)return"DATE TO BE CONFIRMED";const d=new Date(s);return isNaN(d)?"DATE TO BE CONFIRMED":d.toLocaleString("en-SG",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true,timeZone:"Asia/Singapore"})+" SGT"}
function text(id,v){if(el(id))el(id).textContent=v}
function responseLabel(s){return ({going:"GOING",maybe:"MAYBE",not_going:"NOT GOING",withdraw:"NOT RESPONDED"})[s]||"NOT RESPONDED"}
function setBusy(b){document.querySelectorAll("[data-member-rsvp]").forEach(x=>x.disabled=b)}
function showMessage(msg){text("memberRsvpMessage",msg)}
async function refreshMember(){
 if(refreshing)return;refreshing=true;
 try{
  const {data:{session},error:authError}=await client.auth.getSession();if(authError)throw authError;
  if(!session){text("memberSync","Sign in to view your manifest");text("memberNoticeCount","0");return}
  currentUser=session.user.id;
  const [missions,signups]=await Promise.all([
   client.from("missions").select("*").order("start_time",{ascending:true}),
   client.from("mission_signups").select("mission_id,status,operational_role,user_id").eq("user_id",currentUser)
  ]);
  if(missions.error)throw missions.error;
  if(signups.error)throw signups.error;
  const all=missions.data||[], mine=(signups.data||[]).filter(x=>x.user_id===currentUser), now=Date.now();
  const upcoming=all.filter(m=>!m.start_time||new Date(m.start_time).getTime()>=now);
  const joined=upcoming.filter(m=>mine.some(s=>s.mission_id===m.id&&s.status==="going"));
  const responded=upcoming.filter(m=>mine.some(s=>s.mission_id===m.id&&["going","maybe"].includes(s.status)));
  const next=responded[0]||upcoming[0]||null;
  updateNotices(upcoming,mine);
  selectedMission=next;currentSignup=next?mine.find(s=>s.mission_id===next.id)||null:null;
  text("memberSync","LIVE MANIFEST · "+new Date().toLocaleTimeString("en-SG",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Singapore"}));
  text("memberJoinedCount",String(joined.length).padStart(2,"0"));
  if(!next){
   text("memberNextTitle","No upcoming deployments");
   text("memberNextDate","STANDING BY");
   text("memberNextRoute","There are no scheduled missions in the live manifest.");
   text("memberRsvp","—");text("memberRole","—");
   text("memberActionTitle","You're all caught up");
   text("memberActionDescription","Check back when the command team posts the next operation.");
   el("memberMissionOpen").disabled=true;el("memberCalendar").disabled=true;el("memberReadiness").hidden=true;el("memberRsvpActions").hidden=true;el("memberAssignedRoles").textContent="No upcoming mission assignments.";return;
  }
  el("memberRsvpActions").hidden=false;
  text("memberNextTitle",next.title||"Untitled operation");
  text("memberNextDate",niceDate(next.start_time));
  text("memberNextRoute",[next.origin,next.destination].filter(Boolean).join(" → ")||next.description||next.type||"Mission briefing available");
  text("memberRsvp",responseLabel(currentSignup?.status));
  text("memberRole",currentSignup?.operational_role||"Not assigned");text("memberRoleHint",currentSignup?.operational_role?"Your confirmed station for this deployment.":"The command team will assign your station.");
  el("memberMissionOpen").disabled=false;el("memberCalendar").disabled=!next.start_time;renderReadiness();loadAssignedRoles(next.id);
  document.querySelectorAll("[data-member-rsvp]").forEach(x=>x.classList.toggle("selected",x.dataset.memberRsvp===currentSignup?.status));
  const pending=upcoming.filter(m=>!mine.some(s=>s.mission_id===m.id&&["going","maybe","not_going"].includes(s.status)));
  if(pending.length){text("memberActionTitle",pending.length+" mission"+(pending.length===1?"":"s")+" awaiting RSVP");text("memberActionDescription","Open Operations to respond to the missions you haven't answered yet.")}
  else if(!currentSignup?.operational_role&&currentSignup?.status==="going"){text("memberActionTitle","Awaiting role assignment");text("memberActionDescription","Your commander will assign your operational station.")}
  else{text("memberActionTitle","Your responses are up to date");text("memberActionDescription","Review the briefing and crew roster before deployment.")}
 }catch(e){console.error("Member manifest:",e);text("memberSync","Unable to sync personal manifest");text("memberNextTitle","Unable to load your operations");showMessage("Please refresh or try again shortly.");}
 finally{refreshing=false}
}
async function saveResponse(status){
 if(!selectedMission||!currentUser)return;
 setBusy(true);showMessage("");
 try{
  let result;
  if(status==="withdraw"){result=await client.from("mission_signups").delete().eq("mission_id",selectedMission.id).eq("user_id",currentUser)}
  else{result=await client.from("mission_signups").upsert({mission_id:selectedMission.id,user_id:currentUser,status, ...(currentSignup?.operational_role?{operational_role:currentSignup.operational_role}:{})},{onConflict:"mission_id,user_id"})}
  if(result.error)throw result.error;
  showMessage(status==="withdraw"?"Your response was withdrawn.":"Your response has been saved.");
  await refreshMember();
 }catch(e){console.error("RSVP:",e);showMessage("Couldn't save your response: "+(e.message||"please try again"))}
 finally{setBusy(false)}
}
document.querySelectorAll("[data-member-rsvp]").forEach(b=>b.addEventListener("click",()=>saveResponse(b.dataset.memberRsvp)));
el("memberMissionOpen")?.addEventListener("click",()=>{if(!selectedMission)return;const target=document.querySelector('[data-view="operations"]');target?.click();const row=document.querySelector('[data-mission="'+CSS.escape(String(selectedMission.id))+'"]');row?.click()});
el("memberActionButton")?.addEventListener("click",()=>document.querySelector('[data-view="operations"]')?.click());
client.channel("jmbn-member-home").on("postgres_changes",{event:"*",schema:"public",table:"missions"},refreshMember).on("postgres_changes",{event:"*",schema:"public",table:"mission_signups"},refreshMember).subscribe();
refreshMember();document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshMember()});

function readyKey(){return "jmbn:readiness:"+currentUser+":"+(selectedMission?.id||"none")}
function renderReadiness(){
 const panel=el("memberReadiness");if(!panel)return;
 panel.hidden=!selectedMission||currentSignup?.status!=="going";
 if(panel.hidden)return;
 let saved={};try{saved=JSON.parse(localStorage.getItem(readyKey())||"{}")}catch{}
 document.querySelectorAll("[data-ready]").forEach(x=>x.checked=!!saved[x.dataset.ready]);
 const done=Object.values(saved).filter(Boolean).length;
 text("memberReadyCount",Math.min(done,3)+" / 3");
}
document.querySelectorAll("[data-ready]").forEach(x=>x.addEventListener("change",()=>{
 if(!selectedMission||!currentUser)return;
 let saved={};try{saved=JSON.parse(localStorage.getItem(readyKey())||"{}")}catch{}
 saved[x.dataset.ready]=x.checked;localStorage.setItem(readyKey(),JSON.stringify(saved));renderReadiness();
}));
function updateNotices(upcoming,mine){
 const pending=upcoming.filter(m=>!mine.some(s=>s.mission_id===m.id&&["going","maybe","not_going"].includes(s.status)));
 const unassigned=upcoming.filter(m=>mine.some(s=>s.mission_id===m.id&&s.status==="going"&&!s.operational_role));
 noticeItems=[
 ...pending.map(m=>({title:"RSVP needed",detail:m.title||"Upcoming mission",id:m.id})),
 ...unassigned.map(m=>({title:"Awaiting commander role assignment",detail:m.title||"Upcoming mission",id:m.id}))
 ].slice(0,20);
 text("memberNoticeCount",String(noticeItems.length));
 const list=el("memberNoticeList");if(!list)return;list.replaceChildren();
 if(!noticeItems.length){const p=document.createElement("p");p.textContent="You're up to date. No outstanding mission actions.";list.append(p);return}
 noticeItems.forEach(n=>{const b=document.createElement("button");const title=document.createElement("strong");title.textContent=n.title;const detail=document.createElement("small");detail.textContent=n.detail;b.append(title,detail);b.addEventListener("click",()=>{el("memberNoticePanel").hidden=true;document.querySelector('[data-view="operations"]')?.click()});list.append(b)})
}
el("memberNoticeToggle")?.addEventListener("click",()=>{const p=el("memberNoticePanel");p.hidden=!p.hidden;el("memberNoticeToggle").setAttribute("aria-expanded",String(!p.hidden))});
function icsEscape(v){return String(v||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;")}
el("memberCalendar")?.addEventListener("click",()=>{
 if(!selectedMission?.start_time)return;
 const start=new Date(selectedMission.start_time);if(isNaN(start))return;
 const end=new Date(start.getTime()+120*60000);
 const stamp=d=>d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
 const content=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//JMBN//Member Manifest//EN","CALSCALE:GREGORIAN","BEGIN:VEVENT","UID:jmbn-"+selectedMission.id+"@manifest","DTSTAMP:"+stamp(new Date()),"DTSTART:"+stamp(start),"DTEND:"+stamp(end),"SUMMARY:"+icsEscape(selectedMission.title||"JMBN Operation"),"DESCRIPTION:"+icsEscape("JMBN deployment. Check your Manifest for the current briefing and assigned role. Calendar duration defaults to two hours; confirm against the mission briefing."),"END:VEVENT","END:VCALENDAR"].join("\r\n");
 const url=URL.createObjectURL(new Blob([content],{type:"text/calendar;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="JMBN-"+selectedMission.id+".ics";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});


async function loadAssignedRoles(missionId){
 const box=el("memberAssignedRoles");if(!box)return;
 box.textContent="Loading assigned roles…";
 try{
  const {data,error}=await client.from("mission_signups").select("user_id,operational_role,status").eq("mission_id",missionId).in("status",["going","maybe"]);
  if(error)throw error;
  if(selectedMission?.id!==missionId)return;
  const assigned=(data||[]).filter(x=>x.operational_role);
  if(!assigned.length){box.textContent="No crew roles selected yet.";return}
  const counts=new Map();assigned.forEach(x=>counts.set(x.operational_role,(counts.get(x.operational_role)||0)+1));
  box.replaceChildren();
  [...counts].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([role,count])=>{
   const row=document.createElement("div");row.className="member-assigned-row";
   const name=document.createElement("span");name.textContent=role;
   const qty=document.createElement("b");qty.textContent=count+" "+(count===1?"crew":"crew");
   row.append(name,qty);box.append(row)
  });
 }catch(e){box.textContent="Crew assignments unavailable. Open the mission briefing for the full roster.";console.error("Assigned roles:",e)}
}
