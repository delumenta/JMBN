// js/auth.js (simple + discord_links auto-link)
// ----------------------------------------------------
// Exposes on window:
//   getSupabase, requireAuth, signIn, signOut,
//   loginWithDiscord, getSession, currentUsername,
//   goto, getBasePath
// ----------------------------------------------------

/***** CONFIG *****/
const SUPABASE_URL = "https://fcegavhipeaeihxegsnw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZWdhdmhpcGVhZWloeGVnc253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMjk3NTcsImV4cCI6MjA3NzcwNTc1N30.i-ZjOlKc89-uA7fqOIvmAMv60-C2_NmKikRI_78Jei8", // <- keep as-is in your real file

/***** BASE PATH (GitHub Pages friendly) *****/
function getBasePath() {
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

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,   // let supabase handle the PKCE code in URL
    flowType: "pkce",
    autoRefreshToken: true,
  },
});

// shared instance
window.getSupabase = () => sb;

/***** HELPERS *****/
window.goto = function goto(path = "") {
  const isAbs = /^\//.test(path);
  location.href = isAbs ? path : BASE + path;
};

window.getSession = async function getSession() {
  const { data } = await sb.auth.getSession();
  return data?.session ?? null;
};

window.currentUsername = function currentUsername(session) {
  const email = session?.user?.email || "";
  return email.split("@")[0] || "";
};

/***** AUTH GUARD (for protected pages) *****/
window.requireAuth = async function requireAuth() {
  try {
    const { data: { session } } = await sb.auth.getSession();
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

/***** USERNAME/PASSWORD LOGIN *****/
window.signIn = async function signIn(usernameOrEmail, password) {
  // Accept plain username or full email; append @jmbn.local for usernames
  const email = usernameOrEmail.includes("@")
    ? usernameOrEmail
    : `${usernameOrEmail}@jmbn.local`;

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  return { data, error };
};

window.signOut = async function signOut() {
  try {
    await sb.auth.signOut();
  } finally {
    goto("auth.html");
  }
};

/***** DISCORD_LINKS SYNC *****/
/**
 * Upserts a row in public.discord_links for a Discord-auth user.
 * - discord_id  = user.user_metadata.provider_id
 * - user_id     = user.id
 * - handle      = user.user_metadata.user_name (if present)
 *
 * Safe to call many times; it just keeps the mapping updated.
 */
async function syncDiscordLink(session) {
  if (!session?.user) return;

  const user = session.user;
  const provider = user.app_metadata?.provider;
  if (provider !== "discord") return;   // only care about Discord logins

  const meta = user.user_metadata || {};
  const discordId = meta.provider_id || meta.sub || null;
  if (!discordId) {
    console.warn("[auth] No discordId found in user_metadata:", meta);
    return;
  }

  const userId = user.id;
  const handle = meta.user_name || meta.full_name || null;

  const payload = {
    discord_id: String(discordId),
    user_id: userId,
    handle,
  };

  const { error } = await sb
    .from("discord_links")
    .upsert(payload, { onConflict: "discord_id" });

  if (error) {
    console.error("[auth] Failed to sync discord_links:", error);
  } else {
    console.log("[auth] discord_links synced for", discordId);
  }
}

/***** DISCORD OAUTH LOGIN *****/
window.loginWithDiscord = async function loginWithDiscord() {
  const redirectTo = `${location.origin}${BASE}auth.html`;

  const { data, error } = await sb.auth.signInWithOAuth({
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

/***** AUTH STATE LISTENER *****/
// When user signs in (including via Discord), auto-sync discord_links
sb.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_IN" && session) {
    try {
      await syncDiscordLink(session);
    } catch (e) {
      console.error("[auth] syncDiscordLink failed:", e);
    }
  }
});