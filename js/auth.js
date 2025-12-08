// js/auth.js
// ----------------------------------------------------
// Supabase auth bootstrap for JMBN (GitHub Pages safe)
// Exposes helpers on window: getSupabase, requireAuth,
// signIn, signOut, loginWithDiscord, getSession,
// currentUsername, goto, getBasePath
// ----------------------------------------------------

/***** CONFIG *****/
const SUPABASE_URL = "https://fcegavhipeaeihxegsnw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZWdhdmhpcGVhZWloeGVnc253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMjk3NTcsImV4cCI6MjA3NzcwNTc1N30.i-ZjOlKc89-uA7fqOIvmAMv60-C2_NmKikRI_78Jei8"; // <-- your anon key

/***** BASE PATH (GitHub Pages friendly) *****/
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
window.getBasePath = getBasePath;

/***** SUPABASE CLIENT *****/
if (!window.supabase) {
  console.error(
    '[auth] Supabase JS not loaded. Add <script src="https://unpkg.com/@supabase/supabase-js@2"></script> BEFORE js/auth.js'
  );
}

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,   // Supabase will process ?code= for PKCE
    flowType: "pkce",
    autoRefreshToken: true,
  },
});

// shared instance
window.getSupabase = () => _sb;

/***** HELPERS *****/
window.goto = function goto(path = "") {
  // path like "auth.html" or "/absolute"
  const isAbs = /^\//.test(path);
  location.href = isAbs ? path : BASE + path;
};

window.getSession = async function getSession() {
  const { data } = await _sb.auth.getSession();
  return data?.session ?? null;
};

window.currentUsername = function currentUsername(session) {
  const email = session?.user?.email || "";
  return email.split("@")[0] || "";
};

/***** GUARD *****/
window.requireAuth = async function requireAuth() {
  try {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) {
      goto("auth.html");
      return null;
    }
    return session;
  } catch (e) {
    console.error("[auth] requireAuth failed:", e);
    goto("auth.html");
    return null;
  }
};

/***** USERNAME / PASSWORD LOGIN *****/
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

/***** DISCORD OAUTH LOGIN (button on auth.html) *****/
window.loginWithDiscord = async function loginWithDiscord() {
  // After Discord login, Supabase will send the user back to auth.html
  const redirectTo = `${location.origin}${BASE}auth.html`;

  const { data, error } = await _sb.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo,
      scopes: "identify email",
    },
  });

  if (error) {
    console.error("[auth] Discord OAuth error:", error);
    throw error;
  }

  return data;
};

/***** AUTO-LINK DISCORD → public.discord_links *****/
/**
 * Called whenever we have a valid session.
 * If the user logged in with Discord, upsert a row into public.discord_links.
 */
async function linkDiscordFromSession(session) {
  if (!session?.user) return;

  const user = session.user;

  // identities[] contains the provider info; look for Discord
  const identities = user.identities || [];
  const discordIdentity = identities.find((id) => id.provider === "discord");
  if (!discordIdentity) return; // normal email/password login = nothing to do

  const idData = discordIdentity.identity_data || {};

  // Discord's unique user ID (what your bot uses)
  const discordId = String(idData.id || discordIdentity.id || "").trim();
  if (!discordId) {
    console.warn("[auth] No discord id found in identity_data:", idData);
    return;
  }

  // A nice handle to store (fallbacks just in case)
  const handle =
    idData.username ||
    idData.user_name ||
    user.user_metadata?.preferred_username ||
    user.user_metadata?.user_name ||
    null;

  const payload = {
    discord_id: discordId,
    user_id: user.id,
    handle,
  };

  console.log("[auth] upserting discord_links:", payload);

  const { error } = await _sb
    .from("discord_links")
    .upsert(payload, { onConflict: "discord_id" });

  if (error) {
    console.error("[auth] Failed to upsert discord_links:", error);
  }
}

/***** AUTH STATE LISTENER *****/
// Whenever the auth state changes (including after OAuth redirect),
// make sure Discord is linked, then you can choose where to send the user.
_sb.auth.onAuthStateChange(async (event, session) => {
  console.log("[auth] state:", event, session);

  if (session) {
    // Try to link Discord if this is a Discord login
    await linkDiscordFromSession(session);

    // If we’re currently on auth.html, push them to index.html after sign-in
    if (location.pathname.endsWith("/auth.html") || location.pathname.endsWith("auth.html")) {
      goto("index.html");
    }
  }
});
