(async () => {
  const $ = (sel) => document.querySelector(sel);
  const out = (sel, val) => { const el = $(sel); if (el) el.textContent = val ?? ''; };
  const esc = (s) => { const d=document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
  const timeAgo = (iso) => {
    if(!iso) return '';
    const s = Math.floor((Date.now() - new Date(iso)) / 1000);
    const t = [[31536000,'y'],[2592000,'mo'],[604800,'w'],[86400,'d'],[3600,'h'],[60,'m'],[1,'s']];
    for (const [sec, lbl] of t) {
      if (s >= sec) return Math.floor(s/sec) + lbl + ' ago';
    }
    return 'just now';
  };

  const fmtMissionDate = (iso) => {
    if(!iso) return 'TBA';
    const d = new Date(iso);
    return d.toLocaleString('en-SG',{
      day:'2-digit',
      month:'short',
      hour:'numeric',
      minute:'2-digit',
      hour12:true
    });
  };

  const prettyAttendance = (status) => {
    if(status==='going') return 'GOING';
    if(status==='not_going') return 'NOT GOING';
    return 'NO RESPONSE';
  };

  const session = await requireAuth();
  if (!session) return;
  const sb = getSupabase();

  /* ---- Member card ---- */
  let row = {};
  try {
    const { data, error } = await sb
      .from('v_profiles_detailed')
      .select(`
        user_id, handle, display_name,
        current_rank_name, current_rank_code, current_rank_image_url,
        current_rank_category, ingame_role
      `)
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (error) throw error;
    row = data || {};
  } catch (e) {
    console.warn('v_profiles_detailed:', e.message);
  }

  const emailFallback  = session.user?.email || '';
  const theHandle  = row.handle || row.display_name || emailFallback.split('@')[0] || 'Unknown';
  const rankName = row.current_rank_name || 'Unranked';
  const rankCode = row.current_rank_code || '';
  const category = row.current_rank_category || '—';

  const storageUrl = rankCode ? sb.storage.from('Ranks').getPublicUrl(`${rankCode}.png`).data.publicUrl : '';
  const rankImg    = row.current_rank_image_url || storageUrl;

  out('#mName', theHandle.replace(/\b\w/g, c => c.toUpperCase()));
  out('#mRank', rankName);
  out('#mCategory', category);
  out('#mRankCode', rankCode || 'CURRENT RANK');

  const imgEl = $('#mRankImg');
  if (imgEl) {
    if (rankImg) {
      imgEl.src = rankImg;
      imgEl.alt = rankName;
      imgEl.style.visibility = 'visible';
      imgEl.onerror = () => { imgEl.style.visibility = 'hidden'; };
    } else {
      imgEl.style.visibility = 'hidden';
    }
  }

  /* ---- Duty status: ACTIVE / AWOL ---- */
  let availabilityStatus = 'active';
  const availabilityToggle = $('#availabilityToggle');
  const availabilityNote = $('#availabilityNote');

  function renderAvailability(){
    const awol = availabilityStatus === 'awol';
    if(availabilityToggle){
      availabilityToggle.textContent = awol ? 'AWOL' : 'ACTIVE';
      availabilityToggle.classList.toggle('awol', awol);
      availabilityToggle.setAttribute('aria-pressed', awol ? 'true' : 'false');
      availabilityToggle.title = awol
        ? 'Click to return to Active duty'
        : 'Click to mark yourself AWOL';
    }
    if(availabilityNote){
      availabilityNote.textContent = awol
        ? 'AWOL // Upcoming missions are automatically marked Not Going.'
        : 'ACTIVE // You can RSVP to upcoming missions below.';
    }
  }

  try{
    const {data:availabilityRow,error:availabilityError} = await sb
      .from('profiles')
      .select('availability_status')
      .eq('user_id',session.user.id)
      .maybeSingle();

    if(availabilityError) throw availabilityError;
    availabilityStatus = String(availabilityRow?.availability_status || 'active').toLowerCase();
  }catch(e){
    console.warn('availability status:',e.message);
  }
  renderAvailability();

  async function setAvailability(nextStatus){
    if(!availabilityToggle) return;

    availabilityToggle.disabled = true;
    try{
      const {data,error} = await sb.rpc('set_member_availability',{
        p_status:nextStatus
      });
      if(error) throw error;

      availabilityStatus = String(data?.status || nextStatus).toLowerCase();
      renderAvailability();
      await loadHomeMissions();
    }catch(e){
      alert('Status update failed: '+e.message);
    }finally{
      availabilityToggle.disabled = false;
    }
  }

  if(availabilityToggle){
    availabilityToggle.addEventListener('click',()=>{
      setAvailability(availabilityStatus==='awol' ? 'active' : 'awol');
    });
  }

  /* ---- Mission history summary uses backend rank-progress rules ---- */
  async function loadMissionSummary(){
    try{
      const {data,error} = await sb
        .from('v_user_progress')
        .select('missions_attended,hours_total')
        .eq('user_id',session.user.id)
        .maybeSingle();

      if(error) throw error;

      const count = Number(data?.missions_attended || 0);
      const hours = Number(data?.hours_total || 0);
      out(
        '#missionsBlurb',
        `Attended ${count} mission${count===1?'':'s'} • ${hours.toLocaleString()} operational hour${hours===1?'':'s'}.`
      );
    }catch(e){
      console.warn('mission summary:',e.message);
      out('#missionsBlurb','Your next available operations are listed below.');
    }
  }

  let homeMissions = [];
  let homeAttendance = new Map();

  async function setHomeAttendance(missionId,status){
    if(status==='going' && availabilityStatus==='awol'){
      alert('Set your Duty Status to ACTIVE before marking yourself Going.');
      return;
    }

    try{
      if(status==='withdraw'){
        const {error} = await sb
          .from('mission_attendees')
          .delete()
          .eq('mission_id',missionId)
          .eq('user_id',session.user.id);
        if(error) throw error;
      }else{
        const {error} = await sb
          .from('mission_attendees')
          .upsert({
            mission_id:missionId,
            user_id:session.user.id,
            attendance:status
          },{onConflict:'mission_id,user_id'});
        if(error) throw error;
      }

      await Promise.all([
        loadHomeMissions(),
        loadMissionSummary()
      ]);
    }catch(e){
      alert('Attendance update failed: '+e.message);
    }
  }

  function renderHomeMissions(){
    const list = $('#homeMissionList');
    if(!list) return;

    if(!homeMissions.length){
      list.innerHTML = '<div class="home-mission-empty">NO UPCOMING MISSIONS AVAILABLE</div>';
      return;
    }

    list.innerHTML = homeMissions.map(m=>{
      const attendance = homeAttendance.get(m.id) || '';
      const stateClass = attendance ? attendance : '';
      return `
        <div class="home-mission" data-home-mission="${esc(m.id)}">
          <div class="home-mission-head">
            <div class="home-mission-title">${esc(m.title || 'UNTITLED MISSION')}</div>
            <span class="home-mission-state ${esc(stateClass)}">
              ${esc(prettyAttendance(attendance))}
            </span>
          </div>
          <div class="home-mission-meta">
            ${esc(fmtMissionDate(m.start_time))} • FORM-UP: ${esc(m.origin || 'TBA')}
            ${m.hours!=null ? ` • ${esc(m.hours)} HRS` : ''}
          </div>

          <div class="home-mission-rsvp">
            <button class="home-rsvp-btn going ${attendance==='going'?'current':''}" type="button" data-rsvp="going" ${availabilityStatus==='awol'?'disabled':''}>
              GOING
            </button>
            <button class="home-rsvp-btn not-going ${attendance==='not_going'?'current':''}" type="button" data-rsvp="not_going">
              NOT GOING
            </button>
            <button class="home-rsvp-btn" type="button" data-rsvp="withdraw">
              WITHDRAW
            </button>
          </div>

          <div class="home-mission-hint">
            CLICK MISSION TO UPDATE ATTENDANCE
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.home-mission').forEach(card=>{
      card.addEventListener('click',(ev)=>{
        if(ev.target.closest('.home-rsvp-btn')) return;
        list.querySelectorAll('.home-mission').forEach(other=>{
          if(other!==card) other.classList.remove('open');
        });
        card.classList.toggle('open');
      });

      card.querySelectorAll('.home-rsvp-btn').forEach(button=>{
        button.addEventListener('click',async(ev)=>{
          ev.stopPropagation();
          if(button.disabled) return;

          const status = button.dataset.rsvp;
          const missionId = card.dataset.homeMission;

          button.disabled = true;
          await setHomeAttendance(missionId,status);
        });
      });
    });
  }

  async function loadHomeMissions(){
    const list = $('#homeMissionList');
    if(list){
      list.innerHTML = '<div class="home-mission-empty">LOADING UPCOMING MISSIONS…</div>';
    }

    try{
      const {data:missions,error:missionError} = await sb
        .from('missions')
        .select('id,title,type,status,origin,start_time,hours')
        .in('status',['planned','active'])
        .gte('start_time',new Date().toISOString())
        .order('start_time',{ascending:true})
        .limit(1);

      if(missionError) throw missionError;

      homeMissions = missions || [];
      homeAttendance = new Map();

      if(homeMissions.length){
        const ids = homeMissions.map(m=>m.id);
        const {data:attendanceRows,error:attendanceError} = await sb
          .from('mission_attendees')
          .select('mission_id,attendance')
          .eq('user_id',session.user.id)
          .in('mission_id',ids);

        if(attendanceError) throw attendanceError;

        (attendanceRows || []).forEach(a=>{
          homeAttendance.set(a.mission_id,a.attendance);
        });
      }

      renderHomeMissions();
    }catch(e){
      console.warn('home missions:',e.message);
      if(list){
        list.innerHTML = '<div class="home-mission-empty">UPCOMING MISSIONS UNAVAILABLE</div>';
      }
    }
  }

  await Promise.all([
    loadMissionSummary(),
    loadHomeMissions()
  ]);

  /* ---- Elevation: reuse same RPC as Admin Console ---- */
  let elevated = false;
  try {
    const { data } = await sb.rpc('is_elevated', { u: session.user.id });
    elevated = data === true;
  } catch (e) {
    console.warn('is_elevated:', e.message);
  }

  // Show / hide admin teaser panel
  const adminPanel = document.getElementById('adminPanelTeaser');
  if (adminPanel && elevated) {
    adminPanel.style.display = 'grid';
  }

  /* ---- Announcement Ticket (latest only) ---- */
  const tTitle = $('#anncTitle'), tMeta = $('#anncMeta'), tBody = $('#anncBody'),
        tActions = $('#anncActions'), btnEdit = $('#anncEdit'), btnDel = $('#anncDelete'),
        postLink = $('#postAnnc');
  let latest = null;

  async function loadAnncTicket(){
    try{
      const { data, error } = await sb
        .from('announcements')
        .select('id,title,body,created_at,posted_by')
        .order('created_at',{ ascending:false })
        .limit(1);
      if(error) throw error;

      if(!data || data.length===0){
        tTitle.textContent = 'No announcements yet.';
        tMeta.textContent = '';
        tBody.textContent = '';
        tActions.style.display = elevated ? '' : 'none';
        if(postLink){ postLink.style.display = elevated ? '' : 'none'; }
        return;
      }

      latest = data[0];

      // resolve poster
      let who = 'Officer';
      try{
        const { data: prof } = await sb
          .from('v_profiles_detailed')
          .select('user_id,handle,display_name')
          .eq('user_id', latest.posted_by)
          .maybeSingle();
        if(prof) who = prof.handle || prof.display_name || who;
      }catch(_){}

      tTitle.textContent = latest.title || 'Announcement';
      tMeta.textContent = `Posted by ${who} • ${timeAgo(latest.created_at)}`;
      tBody.textContent = latest.body || '';
      const canEdit = elevated || latest.posted_by === session.user.id;
      tActions.style.display = (elevated || canEdit) ? '' : 'none';
      if(postLink){ postLink.style.display = elevated ? '' : 'none'; }

      if(btnEdit){
        btnEdit.onclick = async ()=>{
          if(!latest) return;
          const title = prompt('Edit title:', latest.title || '');
          if(title===null) return;
          const body  = prompt('Edit body (optional):', latest.body || '') ?? null;
          const { error } = await sb.from('announcements').update({ title, body }).eq('id', latest.id);
          if(error){ alert('Edit failed: ' + error.message); return; }
          await loadAnncTicket();
        };
      }
      if(btnDel){
        btnDel.onclick = async ()=>{
          if(!latest) return;
          if(!confirm('Delete this announcement?')) return;
          const { error } = await sb.from('announcements').delete().eq('id', latest.id);
          if(error){ alert('Delete failed: ' + error.message); return; }
          latest = null;
          await loadAnncTicket();
        };
      }

    }catch(e){
      console.warn('announcement ticket:', e.message);
      tTitle.textContent = 'Announcement unavailable';
      tMeta.textContent  = '';
      tBody.textContent  = '';
      tActions.style.display = elevated ? '' : 'none';
      if(postLink){ postLink.style.display = elevated ? '' : 'none'; }
    }
  }
  await loadAnncTicket();

  if (postLink) {
    postLink.onclick = async (ev) => {
      ev.preventDefault();
      const title = prompt('Announcement title?'); if (!title) return;
      const body  = prompt('Body (optional):') || null;
      try {
        const { error } = await sb
          .from('announcements')
          .insert({ title, body, posted_by: session.user.id });
        if (error) throw error;
        await loadAnncTicket();
      } catch (e) {
        alert('Post failed: ' + e.message);
      }
    };
  }

  /* ---- Discord Link Code (Step 1C) ---- */
  const genBtn = document.getElementById('genDiscordLinkCode');
  const box = document.getElementById('discordLinkBox');
  const codeEl = document.getElementById('discordLinkCode');
  const expEl = document.getElementById('discordLinkExpiry');

  async function generateDiscordLinkCode(){
    if (!session?.user?.id) {
      alert("You must be logged in.");
      return;
    }

    genBtn.textContent = "⏳ Generating…";
    genBtn.style.pointerEvents = "none";

    try {
      const res = await fetch(
        "https://fcegavhipeaeihxegsnw.functions.supabase.co/functions/v1/create-discord-link-code",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: session.user.id })
        }
      );

      const json = await res.json();
      if (!json.code) throw new Error(json.error || "No code returned");

      codeEl.textContent = json.code;
      box.style.display = "block";

      if (json.expires_at) {
        const exp = new Date(json.expires_at);
        expEl.textContent = `Expires at ${exp.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" })}`;
      } else {
        expEl.textContent = "Expires in 10 minutes.";
      }

    } catch (e) {
      alert("Failed to generate code: " + e.message);
    } finally {
      genBtn.textContent = "🔗 Link Discord";
      genBtn.style.pointerEvents = "";
    }
  }

  if (genBtn){
    genBtn.addEventListener("click", generateDiscordLinkCode);
  }

  if (codeEl){
    codeEl.addEventListener("click", async () => {
      const txt = codeEl.textContent.trim();
      if (!txt) return;
      try {
        await navigator.clipboard.writeText(txt);
        expEl.textContent = "Copied ✅ Paste in Discord now.";
        setTimeout(()=> expEl.textContent = "Expires in 10 minutes.", 1500);
      } catch(_) {
        prompt("Copy this code:", txt);
      }
    });
  }
})();
