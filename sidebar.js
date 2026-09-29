(()=>{
"use strict";

const scriptElement=document.currentScript;
const rootUrl=new URL(".",scriptElement?.src||location.href);

const fallbackProgrammes=[
  {certification_code:"BMT",name:"Basic Military Training"},
  {certification_code:"SOC",name:"Standard Obstacle Course"},
  {certification_code:"MED",name:"Empire Health Medical Responder Certification"},
  {certification_code:"LOG",name:"Covalex Logistics Support Certification"},
  {certification_code:"MIN",name:"ArcCorp Mining Consortium Certification"},
  {certification_code:"GUNNERY",name:"Combat System Operator Certification"},
  {certification_code:"ENGINEERING",name:"Electronic Technician Certification"},
  {certification_code:"PILOT",name:"Pilot Training"}
];

const corePathwayOrder=[
  "BMT",
  "SOC"
];

const supportPathwayOrder=[
  "MED",
  "LOG",
  "MIN"
];

const specialisationPathwayOrder=[
  "GUNNERY",
  "ENGINEERING"
];

const routeByCode={
  BMT:"AP/bmt.html",
  SOC:"AP/soc.html",
  MED:"AP/med.html",
  LOG:"AP/log.html",
  MIN:"AP/min.html",
  GUNNERY:"AP/gun.html",
  ENGINEERING:"AP/eng.html",
  PILOT:"AP/pilot.html"
};

const shortCode={
  BMT:"BMT",
  SOC:"SOC",
  MED:"MED",
  LOG:"LOG",
  MIN:"MIN",
  GUNNERY:"GUN",
  ENGINEERING:"ENG",
  PILOT:"PILOT"
};

const iconByCode={
  BMT:"fa-shield-halved",
  SOC:"fa-mountain",
  MED:"fa-kit-medical",
  LOG:"fa-boxes-stacked",
  MIN:"fa-gem",
  GUNNERY:"fa-crosshairs",
  ENGINEERING:"fa-screwdriver-wrench",
  PILOT:"fa-plane"
};

function esc(value){
  return String(value??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function currentFile(){
  const parts=location.pathname.split("/").filter(Boolean);
  return (parts.at(-1)||"index.html").toLowerCase();
}

function currentProgrammeCode(){
  const file=currentFile();
  const map={
    "bmt.html":"BMT",
    "soc.html":"SOC",
    "med.html":"MED",
    "log.html":"LOG",
    "min.html":"MIN",
    "gun.html":"GUNNERY",
    "eng.html":"ENGINEERING",
    "pilot.html":"PILOT"
  };
  return map[file]||null;
}


function revealStaffSectionForStaffPages(){
  const file=currentFile();

  if(
    file!=="instructor.html" &&
    file!=="academy-log.html"
  ){
    return;
  }

  const staffNav=
    document.getElementById(
      "academyStaffNav"
    );

  if(staffNav){
    staffNav.hidden=false;
  }
}

function setRoutes(){
  document
    .querySelectorAll(".shared-academy-sidebar [data-route]")
    .forEach(node=>{
      node.href=new URL(node.dataset.route,rootUrl).href;
    });
}

function applyActiveNav(){
  const file=currentFile();
  const inProgrammePage=/\/AP\//i.test(location.pathname);

  const navMap={
    "academy.html":"academy",
    "programmes.html":"programmes",
    "training-schedule.html":"schedule",
    "instructor.html":"instructor",
    "academy-log.html":"academy-log"
  };

  const active=inProgrammePage?"programmes":navMap[file];

  document
    .querySelectorAll(".shared-academy-sidebar [data-nav]")
    .forEach(node=>{
      node.classList.toggle("active",node.dataset.nav===active);
    });
}

function injectCss(){
  if(document.getElementById("academySharedSidebarCss")){
    return;
  }

  const link=document.createElement("link");
  link.id="academySharedSidebarCss";
  link.rel="stylesheet";
  link.href=new URL("sidebar.css",rootUrl).href;
  document.head.appendChild(link);
}

function mergeProgrammes(rows){
  const byCode=new Map(
    (rows||[]).map(row=>[
      String(row.certification_code||"").toUpperCase(),
      row
    ])
  );

  return fallbackProgrammes.map(fallback=>({
    ...fallback,
    ...(byCode.get(fallback.certification_code)||{})
  }));
}

function programmeState({
  code,
  certified,
  progress,
  bmtCertified,
  socCertified,
  assignment
}){
  if(certified){
    return {state:"CERTIFIED",locked:false,css:"is-certified"};
  }

  if(code==="BMT"){
    return progress>0
      ? {state:"IN TRAINING",locked:false,css:"is-training"}
      : {state:"AVAILABLE",locked:false,css:""};
  }

  if(code==="SOC"){
    if(!bmtCertified){
      return {state:"LOCKED",locked:true,css:"is-locked"};
    }

    return progress>0
      ? {state:"IN TRAINING",locked:false,css:"is-training"}
      : {state:"AVAILABLE",locked:false,css:""};
  }

  if(["MED","LOG","MIN"].includes(code)){
    if(!bmtCertified||!socCertified){
      return {state:"LOCKED",locked:true,css:"is-locked"};
    }

    return progress>0
      ? {state:"IN TRAINING",locked:false,css:"is-training"}
      : {state:"AVAILABLE",locked:false,css:""};
  }

  if(["GUNNERY","ENGINEERING"].includes(code)){
    if(!bmtCertified||!socCertified||assignment!==code){
      return {state:"LOCKED",locked:true,css:"is-locked"};
    }

    return progress>0
      ? {state:"IN TRAINING",locked:false,css:"is-training"}
      : {state:"ASSIGNED",locked:false,css:"is-assigned"};
  }

  return progress>0
    ? {state:"IN TRAINING",locked:false,css:"is-training"}
    : {state:"AVAILABLE",locked:false,css:""};
}

function renderProgrammeGroup(hostId,codes,programmes,context={}){
  const host=document.getElementById(hostId);

  if(!host){
    return;
  }

  const byCode=new Map(
    programmes.map(programme=>[
      String(programme.certification_code||"").toUpperCase(),
      programme
    ])
  );

  const certifiedCodes=context.certifiedCodes||new Set();
  const approvedEvents=context.approvedEvents||new Set();
  const requirementMap=context.requirementMap||new Map();
  const assignment=String(context.assignment||"").toUpperCase();
  const isStaff=!!context.isStaff;
  const activeCode=currentProgrammeCode();

  const bmtCertified=certifiedCodes.has("BMT");
  const socCertified=certifiedCodes.has("SOC");

  host.innerHTML=codes
    .map(code=>byCode.get(code))
    .filter(Boolean)
    .map(programme=>{
      const code=String(programme.certification_code||"").toUpperCase();
      const requirements=requirementMap.get(code)||[];
      const progress=requirements.filter(eventCode=>approvedEvents.has(eventCode)).length;
      const certified=certifiedCodes.has(code);

      const status=programmeState({
        code,
        certified,
        progress,
        bmtCertified,
        socCertified,
        assignment
      });

      const isActive=activeCode===code;

      const classes=[
        "nav-item",
        "nav",
        "shared-path-link",
        status.css,
        isActive?"active":""
      ].filter(Boolean).join(" ");

      const inner=`
        <i class="fa-solid ${status.locked&&!isStaff?"fa-lock":(iconByCode[code]||"fa-certificate")}"></i>
        <span class="shared-path-copy">
          <span class="shared-path-code">${esc(shortCode[code]||code)}</span>
          <span class="shared-path-name">${esc(programme.name||code)}</span>
        </span>
        <small class="shared-path-state">${esc(status.state)}</small>
      `;

      if(status.locked&&!isStaff){
        return `
          <div
            class="${classes}"
            aria-disabled="true"
            title="Certification access is locked by Academy progression."
          >
            ${inner}
          </div>
        `;
      }

      return `
        <a
          class="${classes}"
          href="${new URL(routeByCode[code],rootUrl).href}"
        >
          ${inner}
        </a>
      `;
    })
    .join("");
}

function renderProgrammes(programmes,context={}){
  renderProgrammeGroup(
    "sharedCoreProgrammeNav",
    corePathwayOrder,
    programmes,
    context
  );

  renderProgrammeGroup(
    "sharedOptionalProgrammeNav",
    supportPathwayOrder,
    programmes,
    context
  );

  renderProgrammeGroup(
    "sharedSpecialisationProgrammeNav",
    specialisationPathwayOrder,
    programmes,
    context
  );
}

async function hydrateSidebar(){
  renderProgrammes(fallbackProgrammes);

  if(typeof window.getSupabase!=="function"){
    return;
  }

  let sb;
  try{
    sb=window.getSupabase();
  }catch(error){
    console.warn("Shared Academy sidebar: Supabase unavailable.",error);
    return;
  }

  try{
    const {
      data:{user}
    }=await sb.auth.getUser();

    if(!user){
      return;
    }

    const [
      profileResult,
      instructorResult,
      certResult,
      myCertResult,
      requirementResult,
      eventResult,
      assignmentResult
    ]=await Promise.all([
      sb
        .from("profiles")
        .select("role")
        .eq("user_id",user.id)
        .maybeSingle(),

      sb
        .from("academy_instructors")
        .select("id")
        .eq("user_id",user.id)
        .eq("is_active",true)
        .or("can_instruct.eq.true,can_sign_off.eq.true")
        .limit(1),

      sb
        .from("certifications")
        .select("certification_code,name,sort_order,is_active")
        .eq("is_active",true)
        .order("sort_order",{ascending:true}),

      sb
        .from("user_certifications")
        .select("certification_code")
        .eq("user_id",user.id),

      sb
        .from("certification_requirements")
        .select("certification_code,event_code,required")
        .eq("required",true),

      sb
        .from("user_training_events")
        .select("event_code,approved_at,approved_by")
        .eq("user_id",user.id),

      sb
        .from("academy_specialisation_assignments")
        .select("specialisation_code")
        .eq("user_id",user.id)
        .maybeSingle()
    ]);

    const isAdmin=
      String(profileResult.data?.role||"").toLowerCase()==="admin";

    const isInstructor=
      (instructorResult.data||[]).length>0;

    const isStaff=
      isAdmin||isInstructor;

    const staffNav=document.getElementById("academyStaffNav");
    if(staffNav){
      staffNav.hidden=!isStaff;
    }

    const programmes=mergeProgrammes(certResult.data||[]);

    const certifiedCodes=new Set(
      (myCertResult.data||[])
        .map(row=>String(row.certification_code||"").toUpperCase())
    );

    const approvedEvents=new Set(
      (eventResult.data||[])
        .filter(row=>row.approved_at&&row.approved_by)
        .map(row=>row.event_code)
    );

    const requirementMap=new Map();

    (requirementResult.data||[]).forEach(row=>{
      const code=String(row.certification_code||"").toUpperCase();
      if(!requirementMap.has(code)){
        requirementMap.set(code,[]);
      }
      requirementMap.get(code).push(row.event_code);
    });

    renderProgrammes(programmes,{
      certifiedCodes,
      approvedEvents,
      requirementMap,
      assignment:assignmentResult.data?.specialisation_code||"",
      isStaff
    });

    applyActiveNav();

  }catch(error){
    console.warn("Shared Academy sidebar failed to hydrate.",error);
  }
}


function ensureMobileSidebarToggle(){
  const bar=document.querySelector(".mobile-bar");

  if(!bar){
    return;
  }

  let button=
    bar.querySelector("#mobileMenu, #menu, .mobile-menu");

  let created=false;

  if(!button){
    button=document.createElement("button");
    button.type="button";
    button.className="mobile-menu academy-auto-menu";
    button.id="academyAutoMenu";
    button.setAttribute("aria-label","Open Academy navigation");
    button.setAttribute("aria-expanded","false");
    button.innerHTML='<i class="fa-solid fa-bars"></i>';
    bar.prepend(button);
    created=true;
  }

  if(created){
    button.addEventListener("click",event=>{
      event.stopPropagation();

      const open=
        document.body.classList.toggle("sidebar-open");

      button.setAttribute(
        "aria-expanded",
        open ? "true" : "false"
      );
    });

    document.addEventListener("click",event=>{
      if(window.innerWidth>760){
        return;
      }

      if(!document.body.classList.contains("sidebar-open")){
        return;
      }

      const sidebar=document.getElementById("academySidebar");

      if(
        sidebar?.contains(event.target) ||
        button.contains(event.target)
      ){
        return;
      }

      document.body.classList.remove("sidebar-open");
      button.setAttribute("aria-expanded","false");
    });

    document.addEventListener("keydown",event=>{
      if(event.key!=="Escape"){
        return;
      }

      document.body.classList.remove("sidebar-open");
      button.setAttribute("aria-expanded","false");
    });
  }

  document.addEventListener("click",event=>{
    const link=event.target.closest(".shared-academy-sidebar a");

    if(!link || window.innerWidth>760){
      return;
    }

    document.body.classList.remove("sidebar-open");

    if(button){
      button.setAttribute("aria-expanded","false");
    }
  });
}

async function init(){
  const mount=document.querySelector("[data-academy-sidebar]");
  if(!mount){
    return;
  }

  injectCss();
  ensureMobileSidebarToggle();

  try{
    const response=await fetch(
      new URL("sidebar.html",rootUrl).href,
      {cache:"no-cache"}
    );

    if(!response.ok){
      throw new Error("Sidebar request failed: "+response.status);
    }

    mount.innerHTML=await response.text();

    setRoutes();
    revealStaffSectionForStaffPages();
    applyActiveNav();
    await hydrateSidebar();

  }catch(error){
    console.error("Academy sidebar failed to load.",error);
    mount.innerHTML='<div style="padding:20px;color:#8f8976;font-size:10px">ACADEMY SIDEBAR UNAVAILABLE</div>';
  }
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",init,{once:true});
}else{
  init();
}

})();