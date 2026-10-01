// Member-specific layer. Reuses the live Supabase schema; never invents mission or signup data.
const API="https://fcegavhipeaeihxegsnw.supabase.co";
const KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZWdhdmhpcGVhZWloeGVnc253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMjk3NTcsImV4cCI6MjA3NzcwNTc1N30.i-ZjOlKc89-uA7fqOIvmAMv60-C2_NmKikRI_78Jei8";
const client=window.supabase.createClient(API,KEY,{auth:{persistSession:true,flowType:"pkce",autoRefreshToken:true}});
const el=id=>document.getElementById(id);
let selectedMission=null, currentUser=null, currentSignup=null, refreshing=false;
function niceDate(s){if(!s)return"DATE TO BE CONFIRMED";const d=new Date(s);return isNaN(d)?"DATE TO BE CONFIRMED":d.toLocaleString("en-SG",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true,timeZone:"Asia/Singapore"})+" SGT"}
function text(id,v){if(el(id))el(id).textContent=v}
function responseLabel(s){return ({going:"GOING",maybe:"MAYBE",not_going:"NOT GOING",withdraw:"NOT RESPONDED"})[s]||"NOT RESPONDED"}
function setBusy(b){document.querySelectorAll("[data-member-rsvp]").forEach(x=>x.disabled=b)}
function showMessage(msg){text("memberRsvpMessage",msg)}
async function refreshMember(){
 if(refreshing)return;refreshing=true;
 try{
  const {data:{session},error:authError}=await client.auth.getSession();if(authError)throw authError;
  if(!session){text("memberSync","Sign in to view your manifest");return}
  currentUser=session.user.id;
  const [missions,signups]=await Promise.all([
   client.from("missions").select("*").order("start_time",{ascending:true}),
   client.from("mission_signups").select("mission_id,status,operational_role").eq("user_id",currentUser)
  ]);
  if(missions.error)throw missions.error;
  if(signups.error)throw signups.error;
  const all=missions.data||[], mine=signups.data||[], now=Date.now();
  const upcoming=all.filter(m=>!m.start_time||new Date(m.start_time).getTime()>=now);
  const joined=upcoming.filter(m=>mine.some(s=>s.mission_id===m.id&&s.status==="going"));
  const responded=upcoming.filter(m=>mine.some(s=>s.mission_id===m.id&&["going","maybe"].includes(s.status)));
  const next=responded[0]||upcoming[0]||null;
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
   el("memberMissionOpen").disabled=true;el("memberRsvpActions").hidden=true;return;
  }
  el("memberRsvpActions").hidden=false;
  text("memberNextTitle",next.title||"Untitled operation");
  text("memberNextDate",niceDate(next.start_time));
  text("memberNextRoute",[next.origin,next.destination].filter(Boolean).join(" → ")||next.description||next.type||"Mission briefing available");
  text("memberRsvp",responseLabel(currentSignup?.status));
  text("memberRole",currentSignup?.operational_role||"Not assigned");
  el("memberMissionOpen").disabled=false;
  document.querySelectorAll("[data-member-rsvp]").forEach(x=>x.classList.toggle("selected",x.dataset.memberRsvp===currentSignup?.status));
  const pending=upcoming.filter(m=>!mine.some(s=>s.mission_id===m.id&&["going","maybe","not_going"].includes(s.status)));
  if(pending.length){text("memberActionTitle",pending.length+" mission"+(pending.length===1?"":"s")+" awaiting RSVP");text("memberActionDescription","Open Operations to respond to the missions you haven't answered yet.")}
  else if(!currentSignup?.operational_role&&currentSignup?.status==="going"){text("memberActionTitle","Choose your mission role");text("memberActionDescription","Open your mission briefing to select an operational role.")}
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
