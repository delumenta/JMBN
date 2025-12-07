// js/auth.js
// ----------------------------------------------------
// Supabase auth bootstrap for JMBN (GitHub Pages safe)
// Exposes helpers on window: getSupabase, requireAuth,
// signIn, signOut, loginWithDiscord, getSession,
// currentUsername, goto, getBasePath
// ----------------------------------------------------

/** ***** CONFIG ***** **/
const SUPABASE_URL = "https://fcegavhipeaeihxegsnw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZWdhdmhpcGVhZWloeGVnc253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMjk3NTcsImV4cCI6MjA3NzcwNTc1N30.i-ZjOlKc89-uA7fqOIvmAMv60-C2_NmKikRI_78Jei8
"; // <-- put your anon key back here

/** ***** BASE PATH (works for GitHub Pages repo sites) ***** **/
function getBasePath() {
  // e.g. https://username.github.io/repo-name/page.html -> "/repo-name/"
  // local dev (file:// or localhost) -> "/"
  try {
    const parts = location.pathname.split("/").filter(Boolean);
    const onGithub = /\.github\.io$/.test(location.hostname);
    if (onGithub && parts.length) return "/" + parts[0] + "/";
  } catch {}
  return "/";
}
const BASE = getBasePath();

/** ***** SUPABASE CLIENT ***** **/
if (!window.supabase) {
  console.error(
    '[auth] Supabase JS not loaded. Add <script src="https://unpkg.com/@supabase/supabase-js@2"></script> BEFORE js/auth.js'
  );
}

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true, // handles PKCE redirect fragments
    flowType: "pkce",
    autoRefreshToken: true,
  },
});

// Expose a getter so all pages share the same instance
window.getSupabase = () => _sb;

/** ***** NAV HELPERS ***** **/
window.goto = function goto(path = "") {
  // path like "auth.html" or "/absolute"
  const isAbs = /^\//.test(path);
  location.href = isAbs ? path : BASE + path;
};

window.getBasePath = getBasePath;

/** ***** SESSION HELPERS ***** **/
window.getSession = async function getSession() {
  const { data } = await _sb.auth.getSession();
  return data?.session ?? null;
};

// Prefer Discord username if available, else email prefix
window.currentUsername = function currentUsername(session) {
  if (!session?.user) return "";
  const u = session.user;

  // If identity from Discord exists, use that username
  const discordIdentity = (u.identities || []).find(
    (i) => i.provider === "discord"
  );
  const idData = discordIdentity?.identity_data || {};
  if (idData.username) return idData.username;
  if (idData.global_name) return idData.global_name;

  const email = u.email || "";
  return email.split("@")[0] || "";
};

/** ***** FIRST-LOGIN PROFILE / DISCORD LINK ***** **/
async function ensureProfileAndDiscordLink(session) {
  const user = session.user;
  const sb = _sb;

  // 1) Ensure profile exists
  const { data: prof, error: profErr } = await sb
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Basic handle from either email or Discord identity
  let handle = currentUsername({ user });
  if (!handle) handle = "recruit-" + user.id.slice(0, 6);

  if (!prof && !profErr) {
    // Create minimal profile; you can tweak defaults here
    await sb.from("profiles").insert({
      user_id: user.id,
      handle,
      display_name: handle,
      role: "Recruit",
      rank_category: "Enlisted",
      rank_code: "E-1",
    });
  }

  // 2) If this user logged in via Discord, ensure discord_links row exists
  const discordIdentity = (user.identities || []).find(
    (i) => i.provider === "discord"
  );
  if (!discordIdentity) return; // email/password user – nothing else to do

  const idData = discordIdentity.identity_data || {};
  const discordId = idData.sub;
  const discordHandle =
    idData.username || idData.global_name || handle || "recruit";

  if (!discordId) return;

  // Check if link already exists for this discord_id
  const { data: link, error: linkErr } = await sb
    .from("discord_links")
    .select("discord_id,user_id")
    .eq("discord_id", discordId)
    .maybeSingle();

  if (linkErr) {
    console.warn("[auth] discord_links lookup error:", linkErr.message);
    return;
  }

  if (!link) {
    // Brand new Discord user → create link
    await sb.from("discord_links").insert({
      discord_id: discordId,
      user_id: user.id,
      handle: discordHandle,
    });
  } else if (!link.user_id) {
    // Link exists from old manual method but no user_id yet → attach this account
    await sb
      .from("discord_links")
      .update({ user_id: user.id, handle: discordHandle })
      .eq("discord_id", discordId);
  }
}

/** ***** GUARDS ***** **/
window.requireAuth = async function requireAuth() {
  try {
    const {
      data: { session },
    } = await _sb.auth.getSession();

    if (!session) {
      goto("auth.html");
      return null;
    }

    // Make sure profile + discord_links are set up on first login
    try {
      await ensureProfileAndDiscordLink(session);
    } catch (e) {
      console.warn("[auth] ensureProfileAndDiscordLink failed:", e);
    }

    return session;
  } catch (e) {
    console.error("[auth] requireAuth failed:", e);
    goto("auth.html");
    return null;
  }
};

/** ***** ACTIONS: PASSWORD SIGN-IN ***** **/
window.signIn = async function signIn(usernameOrEmail, password) {
  // Accept plain username or full email; append @jmbn.local for usernames
  const email = usernameOrEmail.includes("@")
    ? usernameOrEmail
    : `${usernameOrEmail}@jmbn.local`;

  const { data, error } = await _sb.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

window.signOut = async function signOut() {
  try {
    await _sb.auth.signOut();
  } finally {
    goto("auth.html");
  }
};

/** ***** ACTIONS: DISCORD OAUTH ***** **/
window.loginWithDiscord = async function loginWithDiscord() {
  // After Discord auth, send user back to your main dashboard (adjust if needed)
  const redirectTo = `${window.location.origin}${BASE}index.html`;

  const { data, error } = await _sb.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo,
    },
  });

  if (error) {
    console.error("[auth] Discord login error:", error.message);
    alert("Discord login failed: " + error.message);
  }

  return data;
};

/** ***** OPTIONAL: auth state listener (for debugging) ***** **/
_sb.auth.onAuthStateChange((event, session) => {
  // console.log("[auth] state:", event, session);
});
