// supabase/functions/discord-mission-bot/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ==== ENV VARS set in Supabase Function Settings ====
const DISCORD_PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY") || "";
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Service role client (server-side)
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------- Discord verify helpers ----------
async function verifyDiscordRequest(req: Request, bodyText: string) {
  const signature = req.headers.get("x-signature-ed25519") ?? "";
  const timestamp = req.headers.get("x-signature-timestamp") ?? "";
  if (!signature || !timestamp) return false;

  const publicKey = hexToUint8Array(DISCORD_PUBLIC_KEY);
  const sig = hexToUint8Array(signature);
  const msg = new TextEncoder().encode(timestamp + bodyText);

  const key = await crypto.subtle.importKey(
    "raw",
    publicKey,
    {
      name: "Ed25519",
      namedCurve: "Ed25519",
    },
    false,
    ["verify"],
  );

  return await crypto.subtle.verify("Ed25519", key, sig, msg);
}

function hexToUint8Array(hex: string) {
  const clean = hex.replace(/^0x/, "");
  const arr = new Uint8Array(clean.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return arr;
}

// ---------- UI helpers ----------
const GOLD = 0xF2D675;
function hudTitle(text: string) {
  return `🟨 ${text} 🟨`;
}
function fmtDT(iso?: string | null) {
  if (!iso) return "TBA";
  const d = new Date(iso);
  return d.toLocaleString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(/\s?([ap])m/i, "$1m");
}
function statusBadge(st?: string | null) {
  const s = (st || "").toLowerCase();
  if (s === "active") return "🟩 Active";
  if (s === "planned") return "🟨 Planned";
  if (s === "success") return "🟦 Success";
  if (s === "fail") return "🟥 Fail";
  if (s === "abort") return "⬛ Abort";
  return `⬜ ${s || "Unknown"}`;
}
function cleanNull(x: any) {
  return x == null ? "" : String(x);
}
function toTitleCase(str = "") {
  return str.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------- Rank image helper ----------
function rankImageUrl(code?: string | null) {
  if (!code) return null;
  const { data } = sb.storage.from("Ranks").getPublicUrl(`${code}.png`);
  return data?.publicUrl ?? null;
}

// ---------- Discord response helpers ----------
function jsonResponse(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function editInteractionOriginal(interaction: any, data: any) {
  const response = await fetch(
    `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to edit deferred Discord response (${response.status}): ${body}`,
    );
  }
}

async function createInteractionFollowup(interaction: any, data: any) {
  const response = await fetch(
    `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to post Discord follow-up (${response.status}): ${body}`,
    );
  }
}

function webhookMessageData(data: any) {
  const next = { ...(data || {}) };
  delete next.flags;
  return next;
}

function pong() {
  return jsonResponse({
    type: 4,
    data: {
      content: "pong ✅",
      flags: 64, // ephemeral
    },
  });
}

// ---------- DB helpers ----------
async function getDiscordLinkedUser(discordId: string) {
  const { data, error } = await sb
    .from("discord_links")
    .select("user_id, handle, avatar_url")
    .eq("discord_id", discordId)
    .maybeSingle();
  if (error) return null;
  return data || null;
}

async function fetchMissionById(id: string) {
  const { data, error } = await sb
    .from("missions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchAttendeesDetailed(missionId: string) {
  const { data, error } = await sb
    .from("v_mission_attendees_detailed")
    .select("attendee_name, attendance, role_in_mission, user_id")
    .eq("mission_id", missionId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function upsertRsvp(
  missionId: string,
  userId: string,
  status: string,
) {
  if (status === "withdraw") {
    const { error } = await sb
      .from("mission_attendees")
      .delete()
      .match({ mission_id: missionId, user_id: userId });
    if (error) throw error;
    return;
  }

  const { error } = await sb
    .from("mission_attendees")
    .upsert(
      { mission_id: missionId, user_id: userId, attendance: status },
      { onConflict: "mission_id,user_id" },
    );
  if (error) throw error;
}

// ---------- Duty status helpers ----------
async function getAvailabilityForUser(userId: string) {
  const { data, error } = await sb
    .from("profiles")
    .select("availability_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return String(data?.availability_status || "active").toLowerCase();
}

async function setAvailabilityForUser(userId: string, statusRaw: string) {
  const status = String(statusRaw || "").trim().toLowerCase();

  if (status !== "active" && status !== "awol") {
    throw new Error("Invalid duty status");
  }

  const { data: profile, error: profileError } = await sb
    .from("profiles")
    .update({ availability_status: status })
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) throw new Error("JMBN profile not found");

  let markedNotGoing = 0;

  if (status === "awol") {
    const { data: operations, error: operationError } = await sb
      .from("missions")
      .select("id")
      .in("status", ["planned", "active"])
      .gte("start_time", new Date().toISOString());

    if (operationError) throw operationError;

    const rows = (operations || []).map((m: any) => ({
      mission_id: m.id,
      user_id: userId,
      attendance: "not_going",
      updated_at: new Date().toISOString(),
    }));

    if (rows.length) {
      const { error: attendanceError } = await sb
        .from("mission_attendees")
        .upsert(rows, { onConflict: "mission_id,user_id" });

      if (attendanceError) throw attendanceError;
      markedNotGoing = rows.length;
    }
  }

  return { status, markedNotGoing };
}

// ---------- Admin / Officer check via DB role ----------
async function isAdminByDiscordId(discordId: string) {
  const link = await getDiscordLinkedUser(discordId);
  if (!link?.user_id) return false;

  const { data, error } = await sb
    .from("profiles")
    .select("role")
    .eq("user_id", link.user_id)
    .maybeSingle();

  if (error) throw error;

  const role = (data?.role || "").toLowerCase();
  // allow Admin only; add officer if you want:
  return role === "admin"; // || role === "officer";
}

// ---------- Mission debrief (stored in missions.notes) ----------
const debriefCommand = {
  name: "debrief",
  description: "Record an operation outcome, summary and lesson learned",
  type: 1,
  options: [
    { type: 3, name: "id", description: "Operation ID from /operations View", required: true },
    { type: 3, name: "outcome", description: "How the operation went", required: true,
      choices: [
        { name: "Pass", value: "Pass" },
        { name: "Partial success", value: "Partial success" },
        { name: "Fail", value: "Fail" }
      ]
    }
  ]
};
let debriefRegistrationAttempted = false;
async function registerDebriefCommand(applicationId: string) {
  if (!applicationId || !DISCORD_BOT_TOKEN || debriefRegistrationAttempted) return;
  debriefRegistrationAttempted = true;
  try {
    const response = await fetch(
      `https://discord.com/api/v10/applications/${applicationId}/commands`,
      { method: "POST",
        headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(debriefCommand) }
    );
    if (!response.ok) {
      console.error("Debrief command registration failed", response.status, await response.text());
      debriefRegistrationAttempted = false;
    }
  } catch (error) {
    console.error("Debrief command registration failed", error);
    debriefRegistrationAttempted = false;
  }
}
function parseDebriefNotes(notes: string) {
  const raw = String(notes || "");
  const match = raw.match(/^(?:Outcome: ([^\n]*)\n\n)?(?:Summary: ([\s\S]*?)(?=\n\nLesson learned: |$))?(?:\n\nLesson learned: ([\s\S]*))?$/);
  if (!match || !(match[1] || match[2] || match[3])) {
    return { summary: raw, lesson: "" };
  }
  return { summary: (match[2] || "").trim(), lesson: (match[3] || "").trim() };
}
async function handleDebriefCommand(interaction: any) {
  const discordId = interaction.member?.user?.id || interaction.user?.id;
  if (!discordId || !await isAdminByDiscordId(discordId)) {
    return jsonResponse({ type: 4, data: { content: "Only JMBN Admins can submit a debrief.", flags: 64 } });
  }
  const options = interaction.data?.options || [];
  const missionId = String(options.find((o: any) => o.name === "id")?.value || "");
  const outcome = String(options.find((o: any) => o.name === "outcome")?.value || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(missionId) ||
      !["Pass", "Partial success", "Fail"].includes(outcome)) {
    return jsonResponse({ type: 4, data: { content: "Choose an outcome and enter a valid Operation ID.", flags: 64 } });
  }
  const mission = await fetchMissionById(missionId);
  if (!mission) return jsonResponse({ type: 4, data: { content: "Operation not found.", flags: 64 } });
  const previous = parseDebriefNotes(mission.notes || "");
  return jsonResponse({
    type: 9,
    data: {
      custom_id: `debrief:${missionId}:${outcome === "Pass" ? "pass" : outcome === "Fail" ? "fail" : "partial"}`,
      title: "Operation debrief",
      components: [
        { type: 1, components: [{ type: 4, custom_id: "summary", label: "What happened and why?", style: 2,
          min_length: 1, max_length: 1800, required: true, value: previous.summary.slice(0, 1800) }] },
        { type: 1, components: [{ type: 4, custom_id: "lesson", label: "Lesson learned", style: 2,
          max_length: 1000, required: false, value: previous.lesson.slice(0, 1000),
          placeholder: "What should we prepare or do differently?" }] }
      ]
    }
  });
}
async function handleDebriefSubmit(interaction: any) {
  const discordId = interaction.member?.user?.id || interaction.user?.id;
  if (!discordId || !await isAdminByDiscordId(discordId)) {
    return jsonResponse({ type: 4, data: { content: "Only JMBN Admins can submit a debrief.", flags: 64 } });
  }
  const parts = String(interaction.data?.custom_id || "").split(":");
  const missionId = parts[1];
  const outcome = ({ pass: "Pass", partial: "Partial success", fail: "Fail" } as Record<string, string>)[parts[2]];
  if (parts.length !== 3 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(missionId) || !outcome) {
    return jsonResponse({ type: 4, data: { content: "Invalid debrief request.", flags: 64 } });
  }
  const fields = (interaction.data?.components || []).flatMap((row: any) => row.components || []);
  const summary = String(fields.find((field: any) => field.custom_id === "summary")?.value || "").trim();
  const lesson = String(fields.find((field: any) => field.custom_id === "lesson")?.value || "").trim();
  if (!summary || summary.length > 1800 || lesson.length > 1000) {
    return jsonResponse({ type: 4, data: { content: "Add a summary before submitting the debrief.", flags: 64 } });
  }
  const notes = [
    `Outcome: ${outcome}`,
    `Summary: ${summary}`,
    lesson && `Lesson learned: ${lesson}`
  ].filter(Boolean).join("\n\n");
  const { data, error } = await sb.from("missions")
    .update({ notes }).eq("id", missionId).select("id,title").maybeSingle();
  if (error) throw error;
  if (!data) return jsonResponse({ type: 4, data: { content: "Operation not found or could not be updated.", flags: 64 } });
  return jsonResponse({ type: 4, data: {
    content: `Debrief saved for **${String(data.title || "Operation").replace(/[*_`~|]/g, "")}**. The outcome, summary and lesson are now in the Mission Log's Notes field.`,
    flags: 64
  } });
}

// ---------- Link-code consume ----------
async function consumeLinkCode(codeRaw: any) {
  const code = String(codeRaw || "").trim().toUpperCase();
  const now = new Date();

  const { data, error } = await sb
    .from("discord_link_codes")
    .select("code,user_id,expires_at,used")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;

  if (!data) return { ok: false, reason: "not_found" };
  if (data.used) return { ok: false, reason: "used" };
  if (data.expires_at && new Date(data.expires_at) <= now) {
    return { ok: false, reason: "expired" };
  }

  const { error: e2 } = await sb
    .from("discord_link_codes")
    .update({ used: true })
    .eq("code", code);
  if (e2) throw e2;

  return { ok: true, user_id: data.user_id, code };
}

async function upsertDiscordLink(
  discordId: string,
  userId: string,
  handle?: string | null,
  avatarUrl?: string | null,
) {
  const { error } = await sb
    .from("discord_links")
    .upsert(
      {
        discord_id: discordId,
        user_id: userId,
        handle: handle || null,
        avatar_url: avatarUrl || null,
      },
      { onConflict: "discord_id" },
    );
  if (error) throw error;
}

// ---------- Profile via discord_id ----------
async function getProfileByDiscordId(discordId: string) {
  const link = await getDiscordLinkedUser(discordId);
  if (!link?.user_id) return null;

  const { data, error } = await sb
    .from("v_profiles_detailed")
    .select(`
      user_id,
      handle,
      display_name,
      current_rank_name,
      current_rank_image_url
    `)
    .eq("user_id", link.user_id)
    .maybeSingle();
  if (error) throw error;

  return data;
}

// ---------- Certifications helpers ----------
async function fetchCertCatalog() {
  const { data, error } = await sb
    .from("certifications")
    .select("certification_code,name,sort_order,is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchUserCertCodes(userId: string) {
  const { data, error } = await sb
    .from("user_certifications")
    .select("certification_code")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data || []).map((x: any) => x.certification_code));
}

// ---------- /status with duty-status dropdown ----------
async function handleStatusCommand(interaction: any, statusRaw: string) {
  const discordUserId =
    interaction.member?.user?.id || interaction.user?.id;

  const link = await getDiscordLinkedUser(discordUserId);

  if (!link?.user_id) {
    return jsonResponse({
      type: 4,
      data: {
        content:
          "❌ You’re not linked yet. Generate a link code on the JMBN Dashboard, then use /link first.",
        flags: 64,
      },
    });
  }

  const status = String(statusRaw || "").trim().toLowerCase();

  if (status !== "active" && status !== "awol") {
    return jsonResponse({
      type: 4,
      data: {
        content: "❌ Invalid status selection.",
        flags: 64,
      },
    });
  }

  const result = await setAvailabilityForUser(link.user_id, status);

  if (result.status === "awol") {
    return jsonResponse({
      type: 4,
      data: {
        embeds: [
          {
            color: 0xE46B6B,
            title: "🔴 JMBN Duty Status // AWOL",
            description: [
              "**Your duty status is now AWOL.**",
              "",
              result.markedNotGoing > 0
                ? `${result.markedNotGoing} upcoming operation${result.markedNotGoing === 1 ? "" : "s"} marked **Not Going**.`
                : "No upcoming operations required an RSVP update.",
              "",
              "Returning to Active will not automatically change existing Not Going responses.",
            ].join("\n"),
            footer: { text: "JMBN Manifest System" },
          },
        ],
        flags: 64,
      },
    });
  }

  return jsonResponse({
    type: 4,
    data: {
      embeds: [
        {
          color: 0x48D891,
          title: "🟢 JMBN Duty Status // ACTIVE",
          description: [
            "**Your duty status is now Active.**",
            "",
            "You can RSVP Going to upcoming operations again.",
            "Existing Not Going responses are left unchanged.",
          ].join("\n"),
          footer: { text: "JMBN Manifest System" },
        },
      ],
      flags: 64,
    },
  });
}

async function processStatusDeferred(
  interaction: any,
  statusValue: string,
) {
  try {
    const response = await handleStatusCommand(interaction, statusValue);
    const body = await response.json();

    await editInteractionOriginal(
      interaction,
      webhookMessageData(body.data),
    );
  } catch (error) {
    console.error("Deferred status update failed:", error);

    try {
      await editInteractionOriginal(interaction, {
        content: "⚠️ Could not update your duty status. Please try again.",
        embeds: [],
        components: [],
      });
    } catch (editError) {
      console.error("Failed to update deferred status response:", editError);
    }
  }
}

async function processOperationsListDeferred(interaction: any) {
  try {
    const response = await handleOperationsList();
    const body = await response.json();

    await editInteractionOriginal(
      interaction,
      webhookMessageData(body.data),
    );
  } catch (error) {
    console.error("Deferred operations list failed:", error);

    try {
      await editInteractionOriginal(interaction, {
        content: "⚠️ Could not load operations. Please try again.",
        embeds: [],
        components: [],
      });
    } catch (editError) {
      console.error("Failed to update operations list response:", editError);
    }
  }
}

async function processOperationsViewDeferred(
  interaction: any,
  missionId: string,
) {
  try {
    const response =
      await handleOperationsView(interaction, missionId, true);

    const body = await response.json();

    await editInteractionOriginal(
      interaction,
      webhookMessageData(body.data),
    );
  } catch (error) {
    console.error("Deferred operation view failed:", error);

    try {
      await editInteractionOriginal(interaction, {
        content: "⚠️ Could not load that operation. Please try again.",
        embeds: [],
        components: [],
      });
    } catch (editError) {
      console.error("Failed to update operation view response:", editError);
    }
  }
}

// ---------- /operations list (old /mission list, always ephemeral) ----------
async function handleOperationsList() {
  const { data, error } = await sb
    .from("missions")
    .select("id,title,start_time,status")
    .order("start_time", { ascending: false }); // newest first

  if (error) {
    console.error(error);
    return jsonResponse({
      type: 4,
      data: {
        content: "❌ Failed to load operations.",
        flags: 64,
      },
    });
  }

  const filtered = (data || []).filter((m: any) => {
    const s = (m.status || "").toLowerCase();
    return s === "planned" || s === "unknown" || s === "" || s == null;
  });

  if (!filtered.length) {
    return jsonResponse({
      type: 4,
      data: {
        embeds: [
          {
            title: hudTitle("Operations List"),
            description: "```No planned/unknown operations found.```",
            color: GOLD,
          },
        ],
        flags: 64,
      },
    });
  }

  const lines = filtered.map((m: any, i: number) => {
    const dt = fmtDT(m.start_time);
    const st = statusBadge(m.status);
    const title = cleanNull(m.title || "(Untitled)");
    return [
      `${String(i + 1).padStart(2, "0")} • **${title}**`,
      `🕒 ${dt} • ${st}`,
      `ID: \`${m.id}\``,
      "",
    ].join("\n");
  });

  return jsonResponse({
    type: 4,
    data: {
      embeds: [
        {
          title: hudTitle("Operations List"),
          description: lines.join("\n"),
          color: GOLD,
          footer: { text: "Tip: /operations action:View id:<uuid>" },
        },
      ],
      flags: 64, // ephemeral
    },
  });
}

// ---------- /operations action:Latest ----------
// Discord requires a fast acknowledgement. The actual database work and public
// operation post happen after the initial deferred ephemeral response.
async function publishLatestOperationDeferred(interaction: any) {
  try {
    const discordUserId =
      interaction.member?.user?.id || interaction.user?.id;

    const isAdmin = await isAdminByDiscordId(discordUserId);

    if (!isAdmin) {
      await editInteractionOriginal(interaction, {
        content: "❌ Only JMBN Admins can publish the next operation.",
        embeds: [],
        components: [],
      });
      return;
    }

    const { data: operation, error } = await sb
      .from("missions")
      .select("id")
      .in("status", ["planned", "active"])
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!operation) {
      await editInteractionOriginal(interaction, {
        content: "ℹ️ No upcoming operations are currently available.",
        embeds: [],
        components: [],
      });
      return;
    }

    const operationResponse =
      await handleOperationsView(interaction, operation.id, false);

    const operationBody = await operationResponse.json();

    await editInteractionOriginal(
      interaction,
      webhookMessageData(operationBody.data),
    );
  } catch (error) {
    console.error("Deferred latest operation failed:", error);

    try {
      await editInteractionOriginal(interaction, {
        content: "⚠️ Could not publish the operation. Please try again.",
        embeds: [],
        components: [],
      });
    } catch (editError) {
      console.error("Failed to update deferred response:", editError);
    }
  }
}

// Retained helper for direct/internal use.
async function handleOperationsLatest(interaction: any) {
  const discordUserId =
    interaction.member?.user?.id || interaction.user?.id;

  const isAdmin = await isAdminByDiscordId(discordUserId);

  if (!isAdmin) {
    return jsonResponse({
      type: 4,
      data: {
        content: "❌ Only JMBN Admins can post the next operation.",
        flags: 64,
      },
    });
  }

  const { data: operation, error } = await sb
    .from("missions")
    .select("id,title,start_time,status")
    .in("status", ["planned", "active"])
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!operation) {
    return jsonResponse({
      type: 4,
      data: {
        content: "ℹ️ No upcoming operations are currently available.",
        flags: 64,
      },
    });
  }

  return await handleOperationsView(interaction, operation.id, false);
}

// ---------- /operations action:View ----------
function rsvpButtons(missionId: string) {
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3,
          label: "Going",
          emoji: { name: "✅" },
          custom_id: `rsvp:going:${missionId}`,
        },
        {
          type: 2,
          style: 4,
          label: "Not going",
          emoji: { name: "❌" },
          custom_id: `rsvp:not_going:${missionId}`,
        },
        {
          type: 2,
          style: 2,
          label: "Withdraw",
          emoji: { name: "🌀" },
          custom_id: `rsvp:withdraw:${missionId}`,
        },
      ],
    },
  ];
}

function publishButtons(missionId: string) {
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 1, // blurple
          label: "Publish to Channel",
          emoji: { name: "📣" },
          custom_id: `publish:${missionId}`,
        },
      ],
    },
  ];
}

// Preview for everyone is ephemeral; publish button only shown to Admins
async function handleOperationsView(
  interaction: any,
  missionId: string,
  ephemeral = false,
) {
  const m = await fetchMissionById(missionId);
  if (!m) {
    return jsonResponse({
      type: 4,
      data: {
        content: "❌ Operation not found.",
        flags: ephemeral ? 64 : 0,
      },
    });
  }

  const attendees = await fetchAttendeesDetailed(missionId);
  const going = attendees.filter((a: any) =>
    (a.attendance || "").toLowerCase() === "going"
  );
  const notGoing = attendees.filter((a: any) =>
    (a.attendance || "").toLowerCase() === "not_going"
  );

  const goingLines = going.length
    ? going
      .map((a: any) =>
        `✅ ${toTitleCase(a.attendee_name)}${
          a.role_in_mission ? ` — ${toTitleCase(a.role_in_mission)}` : ""
        }`
      )
      .join("\n")
    : "_(none)_";

  const notGoingLines = notGoing.length
    ? notGoing
      .map((a: any) =>
        `❌ ${toTitleCase(a.attendee_name)}${
          a.role_in_mission ? ` — ${toTitleCase(a.role_in_mission)}` : ""
        }`
      )
      .join("\n")
    : "_(none)_";

  const dt = fmtDT(m.start_time);
  const st = statusBadge(m.status);
  const route = m.origin || m.destination
    ? `${cleanNull(m.origin || "n/a")} → ${cleanNull(m.destination || "n/a")}`
    : "n/a";
  const payout = m.payout_auec
    ? `${Number(m.payout_auec).toLocaleString()} aUEC`
    : "0 aUEC";
  const type = cleanNull(m.type || "n/a");

  // Decide buttons
  let components: any[] = rsvpButtons(m.id);

  if (ephemeral) {
    const discordUserId =
      interaction.member?.user?.id || interaction.user?.id;
    const isAdmin = await isAdminByDiscordId(discordUserId);
    if (isAdmin) components = [...components, ...publishButtons(m.id)];
  }

  return jsonResponse({
    type: 4,
    data: {
      embeds: [
        {
          color: GOLD,
          title: cleanNull(m.title || "Untitled Operation"),
          description: `**${st} • ${dt}**\nID: \`${m.id}\``,
          fields: [
            {
              name: "Operation Details",
              value: [
                `**Type:** ${type}`,
                `**Route:** ${route}`,
                `**Payout:** ${payout}`,
              ].join("\n"),
              inline: false,
            },
            {
              name: `✅ Going (${going.length})`,
              value: goingLines,
              inline: true,
            },
            {
              name: `❌ Not going (${notGoing.length})`,
              value: notGoingLines,
              inline: true,
            },
          ],
          image: {
            url: "https://fcegavhipeaeihxegsnw.supabase.co/storage/v1/object/public/frontpage/grow.png",
          },
          footer: { text: "Tap a button below to RSVP." },
        },
      ],
      components,
      flags: ephemeral ? 64 : 0,
    },
  });
}

// ---------- Publish cooldown (optional but recommended) ----------
const publishCooldown = new Map<string, number>();
const PUBLISH_COOLDOWN_MS = 10 * 60 * 1000; // 10 min

async function handlePublishButton(interaction: any) {
  const discordUserId =
    interaction.member?.user?.id || interaction.user?.id;

  const cid = interaction.data?.custom_id || "";
  const [, missionId] = cid.split(":");

  const isAdmin = await isAdminByDiscordId(discordUserId);
  if (!isAdmin) {
    return jsonResponse({
      type: 4,
      data: {
        content: "❌ Only JMBN Admins can publish operations.",
        flags: 64,
      },
    });
  }

  const last = publishCooldown.get(missionId) || 0;
  const now = Date.now();
  if (now - last < PUBLISH_COOLDOWN_MS) {
    const mins = Math.ceil(
      (PUBLISH_COOLDOWN_MS - (now - last)) / 60000,
    );
    return jsonResponse({
      type: 4,
      data: {
        content:
          `⏳ This operation was published recently. Try again in ~${mins} min.`,
        flags: 64,
      },
    });
  }
  publishCooldown.set(missionId, now);

  // PUBLIC post
  return await handleOperationsView(interaction, missionId, false);
}

// ---------- /link ----------
async function handleLinkCommand(interaction: any, codeRaw: any) {
  const discordUser =
    interaction.member?.user ||
    interaction.user;

  const discordUserId =
    discordUser?.id || null;

  if (!discordUserId) {
    return jsonResponse({
      type: 4,
      data: {
        content: "❌ Unable to identify your Discord account.",
        flags: 64,
      },
    });
  }

  const discordHandle =
    discordUser?.username || null;

  const discordDisplayName =
    discordUser?.global_name ||
    discordUser?.username ||
    discordUserId;

  const avatarHash =
    discordUser?.avatar || null;

  let discordAvatarUrl: string | null = null;

  if (avatarHash) {
    const extension =
      String(avatarHash).startsWith("a_")
        ? "gif"
        : "png";

    discordAvatarUrl =
      `https://cdn.discordapp.com/avatars/${discordUserId}/${avatarHash}.${extension}?size=256`;
  }

  const code =
    String(codeRaw || "")
      .trim()
      .toUpperCase();

  if (!code || !code.startsWith("JMBN-")) {
    return jsonResponse({
      type: 4,
      data: {
        content:
          "❌ Invalid code. Generate a new one on the JMBN Dashboard.",
        flags: 64,
      },
    });
  }

  const consumed =
    await consumeLinkCode(code);

  if (!consumed.ok) {
    const msg =
      consumed.reason === "not_found"
        ? "❌ Code not found. Generate a new one on the JMBN Dashboard."
        : consumed.reason === "used"
        ? "❌ Code already used. Generate a new one on the JMBN Dashboard."
        : "❌ Code expired. Generate a new one on the JMBN Dashboard.";

    return jsonResponse({
      type: 4,
      data: {
        content: msg,
        flags: 64,
      },
    });
  }

  await upsertDiscordLink(
    discordUserId,
    consumed.user_id,
    discordHandle,
    discordAvatarUrl,
  );

  const embed: any = {
    title: hudTitle("Discord linked"),
    description: [
      "```",
      `discord: ${discordDisplayName}`,
      `jmbn user: ${consumed.user_id}`,
      "",
      "✅ Link successful.",
      "Your Discord profile is now connected to JMBN.",
      "```",
    ].join("\n"),
    color: GOLD,
  };

  if (discordAvatarUrl) {
    embed.thumbnail = {
      url: discordAvatarUrl,
    };
  }

  return jsonResponse({
    type: 4,
    data: {
      embeds: [embed],
      flags: 64,
    },
  });
}

// ---------- Mission attendance helper ----------
async function fetchMissionsAttended(userId: string) {
  const { data, error } = await sb
    .from("v_mission_attendees_detailed")
    .select("mission_id, attendance")
    .eq("user_id", userId);

  if (error) throw error;

  // Count each mission only once.
  // A deleted/withdrawn RSVP will not count.
  const missionIds = new Set(
    (data || [])
      .filter((row: any) =>
        row.mission_id &&
        row.attendance &&
        String(row.attendance).toLowerCase() !== "withdrawn"
      )
      .map((row: any) => row.mission_id),
  );

  return missionIds.size;
}

// ---------- /profile (supports user:@someone) ----------
async function handleProfile(interaction: any) {
  const optUser = interaction.data?.options?.find((o: any) =>
    o.name === "user"
  )?.value;

  const targetDiscordId = optUser
    ? String(optUser)
    : interaction.member?.user?.id || interaction.user?.id;

  const p = await getProfileByDiscordId(targetDiscordId);
  if (!p) {
    const msg = optUser
      ? "❌ That Discord user is not linked to JMBN yet."
      : "❌ You’re not linked yet. Generate a code on the dashboard, then use `/link code:JMBN-XXXXXX`.";
    return jsonResponse({
      type: 4,
      data: { content: msg, flags: 64 },
    });
  }

  // Basic profile info
  const handle = toTitleCase(cleanNull(p.handle || p.display_name || "Unknown"));
  const rank = cleanNull(p.current_rank_name || "Unranked");
  const rankImg = cleanNull(p.current_rank_image_url || "");

  // Count missions directly from the detailed attendance view.
  let missionsAttended: number | null = null;
  try {
    missionsAttended = await fetchMissionsAttended(p.user_id);
  } catch (error) {
    console.error("Failed to fetch missions attended for profile:", error);
  }

  const fields: any[] = [];
  if (missionsAttended !== null) {
    fields.push({
      name: "Missions Attended",
      value: `\`${missionsAttended}\``,
      inline: false,
    });
  }

  return jsonResponse({
    type: 4,
    data: {
      embeds: [
        {
          color: GOLD,
          title: `Handle : ${handle}`,
         description: [
         `**${rank}**`,
         "Welcome to the JMBN Manifest System",
        "", // <-- spacer
].join("\n"),
          thumbnail: rankImg ? { url: rankImg } : undefined,
          fields,
          footer: { text: "JMBN Rank Card" },
        },
      ],
      flags: 64,
    },
  });
}


// ---------- /certifications ----------
async function handleCertifications(interaction: any) {
  const optUser = interaction.data?.options?.find((o: any) =>
    o.name === "user"
  )?.value;

  let targetDiscordId: string;
  let targetUserId: string | null = null;
  let targetLabel = "Your";

  if (optUser) {
    targetDiscordId = String(optUser);
    const link = await getDiscordLinkedUser(targetDiscordId);
    if (!link?.user_id) {
      return jsonResponse({
        type: 4,
        data: {
          content: "❌ That Discord user is not linked to JMBN yet.",
          flags: 64,
        },
      });
    }
    targetUserId = link.user_id;
    targetLabel = `${toTitleCase(link.handle || "Member")}'s`;
  } else {
    targetDiscordId = interaction.member?.user?.id || interaction.user?.id;
    const link = await getDiscordLinkedUser(targetDiscordId);
    if (!link?.user_id) {
      return jsonResponse({
        type: 4,
        data: {
          content:
            "❌ You’re not linked yet. Use `/link code:JMBN-XXXXXX` first.",
          flags: 64,
        },
      });
    }
    targetUserId = link.user_id;
  }

  const catalog = await fetchCertCatalog();
  const owned = await fetchUserCertCodes(targetUserId!);

  if (!catalog.length) {
    return jsonResponse({
      type: 4,
      data: { content: "No certifications configured yet.", flags: 64 },
    });
  }

  const lines = catalog.map((c: any) => {
    const code = c.certification_code;
    const name = cleanNull(c.name || code);
    const has = owned.has(code);
    return `[\`${code}\`] ${name}  —  ${has ? "✅ Earned" : "⬛ Locked"}`;
  });

  return jsonResponse({
    type: 4,
    data: {
      embeds: [
        {
          color: GOLD,
          title: `🟨 ${targetLabel} Certifications 🟨`,
          description: lines.join("\n"),
          footer: { text: "JMBN Progression System" },
        },
      ],
      flags: 64,
    },
  });
}

// ---------- /progression (supports user:@someone) ----------
// ---------- /progression (supports user:@someone) ----------
async function handleProgression(interaction: any) {
  const optUser = interaction.data?.options?.find((o: any) =>
    o.name === "user"
  )?.value;

  let targetDiscordId: string;
  let targetUserId: string | null = null;
  let targetLabel = "Your";

  if (optUser) {
    targetDiscordId = String(optUser);
    const link = await getDiscordLinkedUser(targetDiscordId);
    if (!link?.user_id) {
      return jsonResponse({
        type: 4,
        data: {
          content: "❌ That Discord user is not linked to JMBN yet.",
          flags: 64,
        },
      });
    }
    targetUserId = link.user_id;
    targetLabel = `${toTitleCase(link.handle || "Member")}'s`;
  } else {
    targetDiscordId = interaction.member?.user?.id || interaction.user?.id;
    const link = await getDiscordLinkedUser(targetDiscordId);
    if (!link?.user_id) {
      return jsonResponse({
        type: 4,
        data: {
          content:
            "❌ You’re not linked yet. Use `/link code:JMBN-XXXXXX` first.",
          flags: 64,
        },
      });
    }
    targetUserId = link.user_id;
  }

  const [{ data: rankRow, error: rankErr }, { data: progRow, error: progErr }] =
    await Promise.all([
      sb
        .from("v_user_rank_progress")
        .select("*")
        .eq("user_id", targetUserId!)
        .maybeSingle(),
      sb
        .from("v_user_progress")
        .select("*")
        .eq("user_id", targetUserId!)
        .maybeSingle(),
    ]);

  if (rankErr || progErr || !rankRow || !progRow) {
    return jsonResponse({
      type: 4,
      data: {
        content:
          "❌ Progression data not found or not configured yet for this user.",
        flags: 64,
      },
    });
  }

  const missions = await fetchMissionsAttended(targetUserId!);
  const hours = Number(progRow.hours_total ?? 0);
  const certs = Number(progRow.certifications_total ?? 0);

  const missionsTarget = Number(rankRow.missions_target ?? 0);
  const hoursTarget = Number(rankRow.hours_target ?? 0);
  const certsTarget = Number(rankRow.certification_target ?? 0);

  const pct = (done: number, target: number) =>
    target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 100;

  const mPct = pct(missions, missionsTarget);
  const hPct = pct(hours, hoursTarget);
  const cPct = pct(certs, certsTarget);

  const allMet =
    (missionsTarget ? missions >= missionsTarget : true) &&
    (hoursTarget ? hours >= hoursTarget : true) &&
    (certsTarget ? certs >= certsTarget : true) &&
    !!rankRow.next_code;

  const statusLine = !rankRow.next_code
    ? "You are at the highest configured rank."
    : allMet
    ? "✅ All requirements met. You can request promotion."
    : "Progress toward next rank shown below.";

  // shorter bar so it doesn’t spam the embed
  const makeBar = (percent: number) => {
    const total = 10;
    const filled = Math.round((percent / 100) * total);
    return "█".repeat(filled) + "░".repeat(Math.max(0, total - filled));
  };

  const currentImg = rankImageUrl(rankRow.current_code);
  const nextImg = rankImageUrl(rankRow.next_code);

  const currentRankLine = `**${rankRow.current_name ?? "(Unranked)"}**  ·  PG \`${rankRow.current_paygrade ?? "—"}\``;
  const nextRankLine = rankRow.next_name
    ? `**${rankRow.next_name}**  ·  PG \`${rankRow.next_paygrade ?? "—"}\``
    : "—";

  // Assets field with compact links instead of full URLs in main text
  const assetsLines: string[] = [];
  if (currentImg) assetsLines.push(`[Current badge](${currentImg})`);
  if (nextImg) assetsLines.push(`[Next badge](${nextImg})`);

  const embed: any = {
    color: GOLD,
    title: hudTitle(`${targetLabel} Progression`),
    description: [
      "**Rank Path**",
      currentRankLine,
      rankRow.next_name ? `⬇️ Next: ${nextRankLine}` : "",
      "",
      `**Status**`,
      statusLine,
    ]
      .filter(Boolean)
      .join("\n"),
    thumbnail: currentImg ? { url: currentImg } : undefined,
    fields: [
      {
        name: "Missions",
        value: `\`${missions} / ${missionsTarget || 0}\` · ${mPct}%\n\`${makeBar(mPct)}\``,
        inline: true,
      },
      {
        name: "Hours",
        value: `\`${hours} / ${hoursTarget || 0}\` · ${hPct}%\n\`${makeBar(hPct)}\``,
        inline: true,
      },
      {
        name: "Certifications",
        value: `\`${certs} / ${certsTarget || 0}\` · ${cPct}%\n\`${makeBar(cPct)}\``,
        inline: true,
      },
    ],
    footer: {
      text: "JMBN Manifest System — Rank Progression",
    },
  };

  if (assetsLines.length) {
    embed.fields.push({
      name: "Assets",
      value: assetsLines.join(" · "),
      inline: false,
    });
  }

  return jsonResponse({
    type: 4,
    data: {
      embeds: [embed],
      flags: 64, // still ephemeral (Option A)
    },
  });
}

// ---------- RSVP from button click ----------
async function processRsvpButtonDeferred(interaction: any) {
  try {
    const discordUserId =
      interaction.member?.user?.id || interaction.user?.id;

    const link = await getDiscordLinkedUser(discordUserId);

    if (!link?.user_id) {
      await createInteractionFollowup(interaction, {
        content: "❌ You aren’t linked yet. Use /link first.",
        flags: 64,
      });
      return;
    }

    const customId = interaction.data?.custom_id || "";
    const parts = customId.split(":");

    if (parts.length !== 3) {
      await createInteractionFollowup(interaction, {
        content: "❌ Bad RSVP button.",
        flags: 64,
      });
      return;
    }

    const status = parts[1];
    const missionId = parts[2];

    if (status === "going") {
      const availability = await getAvailabilityForUser(link.user_id);

      if (availability === "awol") {
        await createInteractionFollowup(interaction, {
          content:
            "🔴 You are currently AWOL. Set /status to Active before marking yourself Going.",
          flags: 64,
        });
        return;
      }
    }

    const m = await fetchMissionById(missionId);

    if (!m) {
      await createInteractionFollowup(interaction, {
        content: "❌ Operation not found.",
        flags: 64,
      });
      return;
    }

    await upsertRsvp(missionId, link.user_id, status);

    const msgFlags = interaction.message?.flags ?? 0;
    const wasEphemeral = (msgFlags & 64) === 64;

    const response =
      await handleOperationsView(interaction, missionId, wasEphemeral);

    const body = await response.json();

    await editInteractionOriginal(
      interaction,
      webhookMessageData(body.data),
    );
  } catch (error) {
    console.error("Deferred RSVP failed:", error);

    try {
      await createInteractionFollowup(interaction, {
        content: "⚠️ RSVP update failed. Please try again.",
        flags: 64,
      });
    } catch (followupError) {
      console.error("Failed to send RSVP error follow-up:", followupError);
    }
  }
}

async function processPublishButtonDeferred(interaction: any) {
  try {
    const response = await handlePublishButton(interaction);
    const body = await response.json();

    if (body?.data) {
      await createInteractionFollowup(
        interaction,
        body.data,
      );
    }
  } catch (error) {
    console.error("Deferred publish failed:", error);

    try {
      await createInteractionFollowup(interaction, {
        content: "⚠️ Could not publish the operation. Please try again.",
        flags: 64,
      });
    } catch (followupError) {
      console.error("Failed to send publish error follow-up:", followupError);
    }
  }
}

// ---------- Main interaction router ----------
async function handleInteraction(interaction: any) {
  if (interaction.data?.name === "ping") return pong();

  if (interaction.type === 2 && interaction.data?.name === "debrief") {
    return await handleDebriefCommand(interaction);
  }
  if (interaction.type === 5 && String(interaction.data?.custom_id || "").startsWith("debrief:")) {
    return await handleDebriefSubmit(interaction);
  }

  // TOP LEVEL: /profile
  if (interaction.type === 2 && interaction.data?.name === "profile") {
    return await handleProfile(interaction);
  }

  // TOP LEVEL: /link
  if (interaction.type === 2 && interaction.data?.name === "link") {
    const code = interaction.data.options?.find((o: any) =>
      o.name === "code"
    )?.value;
    if (!code) {
      return jsonResponse({
        type: 4,
        data: { content: "❌ Missing link code.", flags: 64 },
      });
    }
    return await handleLinkCommand(interaction, code);
  }

  // TOP LEVEL: /certifications
  if (interaction.type === 2 && interaction.data?.name === "certifications") {
    return await handleCertifications(interaction);
  }

  // TOP LEVEL: /progression
  if (interaction.type === 2 && interaction.data?.name === "progression") {
    return await handleProgression(interaction);
  }

  // TOP LEVEL: /status duty:<Active|AWOL>
  if (interaction.type === 2 && interaction.data?.name === "status") {
    const statusValue = interaction.data.options?.find((o: any) =>
      o.name === "duty"
    )?.value;

    if (statusValue === "active" || statusValue === "awol") {
      EdgeRuntime.waitUntil(
        processStatusDeferred(interaction, statusValue),
      );

      return jsonResponse({
        type: 5,
        data: {
          flags: 64,
        },
      });
    }

    return jsonResponse({
      type: 4,
      data: {
        content: "❌ Pick Active or AWOL from the Duty Status dropdown.",
        flags: 64,
      },
    });
  }

  // /operations action:<Latest|List|View> [id]
  if (
    interaction.type === 2 &&
    interaction.data?.name === "operations"
  ) {
    const action = interaction.data.options?.find((o: any) =>
      o.name === "action"
    )?.value;

    const missionId = interaction.data.options?.find((o: any) =>
      o.name === "id"
    )?.value;

    if (action === "list") {
      EdgeRuntime.waitUntil(
        processOperationsListDeferred(interaction),
      );

      return jsonResponse({
        type: 5,
        data: {
          flags: 64,
        },
      });
    }

    if (action === "latest") {
      EdgeRuntime.waitUntil(
        publishLatestOperationDeferred(interaction),
      );

      // Public deferred response. The final operation card replaces this
      // original response, so Discord will not show "Only you can see this".
      return jsonResponse({
        type: 5,
      });
    }

    if (action === "view") {
      if (!missionId) {
        return jsonResponse({
          type: 4,
          data: {
            content: "❌ Pick View and enter the Operation ID.",
            flags: 64,
          },
        });
      }

      EdgeRuntime.waitUntil(
        processOperationsViewDeferred(interaction, missionId),
      );

      return jsonResponse({
        type: 5,
        data: {
          flags: 64,
        },
      });
    }

    return jsonResponse({
      type: 4,
      data: {
        content: "❌ Choose Latest, List or View from the Action dropdown.",
        flags: 64,
      },
    });
  }

  // Buttons
  if (interaction.type === 3) {
    const cid = interaction.data?.custom_id || "";

    if (cid.startsWith("rsvp:")) {
      EdgeRuntime.waitUntil(
        processRsvpButtonDeferred(interaction),
      );

      return jsonResponse({ type: 6 });
    }

    if (cid.startsWith("publish:")) {
      EdgeRuntime.waitUntil(
        processPublishButtonDeferred(interaction),
      );

      return jsonResponse({ type: 6 });
    }

    return jsonResponse({ type: 6 });
  }

  return jsonResponse({
    type: 4,
    data: { content: "Unknown command.", flags: 64 },
  });
}

// ---------- Deno serve ----------
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });

  const bodyText = await req.text();
  const ok = await verifyDiscordRequest(req, bodyText);
  if (!ok) return new Response("Bad signature", { status: 401 });
  // Register the new command after a signed Discord interaction reaches the bot.


  const interaction = JSON.parse(bodyText);

  if (interaction.application_id && interaction.type !== 1) {
    EdgeRuntime.waitUntil(registerDebriefCommand(interaction.application_id));
  }

  // Discord verification ping
  if (interaction.type === 1) {
    return jsonResponse({ type: 1 });
  }

  try {
    return await handleInteraction(interaction);
  } catch (e) {
    console.error(e);
    return jsonResponse({
      type: 4,
      data: {
        content: "⚠️ Bot error. Check function logs.",
        flags: 64,
      },
    });
  }
});
