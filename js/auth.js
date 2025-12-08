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
    detectSessionInUrl: true, // handles PKCE redirect for OAuth (Discord)
    flowType: "pkce",
    autoRefreshToken: true,
  },
});

// shared instance
window.getSupabase = () => _sb;

/***** HELPER: sync discord_links from session *****/
/**
 * Called after a successful sign-in.
 * If the user logged in with Discord, user_metadata will contain the Discord id.
 * We use that to upsert into public.discord_links so the bot sees them as linked.
 */
async function syncDiscordLinkFromSession(session) {
  if (!session || !session.user) return;

  const user = session.user;
  const meta = user.user_metadata || {};

  // For Discord provider, Supabase usually puts the Discord id in provider_id.
  // (You can confirm in auth.users -> user_metadata.)
  const discordId =
    meta.provider_id ||
    meta.sub ||
    meta.id ||
    (meta.user && meta.user.id) ||
    null;

  if (!discordId) {
    // Probably email/password login, or provider without discord id.
    // Nothing to sync.
    return;
  }

  const handle =
    meta.global_name ||
    meta.username ||
    meta.user_name ||
    meta.full_name ||
    meta.name ||
    (user.email ? user.email.split("@")[0] : null);

  const payload = {
    discord_id: String(discordId),
    user_id: user.id,
    handle,
  };

  console.log("[auth] Upserting into public.discord_links:", payload);

  const { error } = await _sb
    .from("discord_links")
    .upsert(payload, { onConflict: "discord_id" });

  if (error) {
    console.error("[auth] Failed to upsert discord_links:", error);
  }
}

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
    const {
      data: { session },
    } = await _sb.auth.getSession();
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

/***** ACTIONS: USERNAME / PASSWORD *****/
window.signIn = async function signIn(usernameOrEmail, password) {
  // Accept plain username or full email; append @jmbn.local for usernames
  const email = usernameOrEmail.includes("@")
    ? usernameOrEmail
    : `${usernameOrEmail}@jmbn.local`;

  const { data, error } = await _sb.auth.signInWithPassword({
    email,
    password,
  });

  // password login has no discord id, so no discord_links work here
  return { data, error };
};

window.signOut = async function signOut() {
  try {
    await _sb.auth.signOut();
  } finally {
    goto("auth.html");
  }
};

/***** ACTION: DISCORD OAUTH *****/
// Called from auth.html "Sign in with Discord" button
window.loginWithDiscord = async function loginWithDiscord() {
  // After Discord login, Supabase will send the user back here
  const redirectTo = `${location.origin}${BASE}auth.html`;

  const { data, error } = await _sb.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo, // where to return after Supabase callback
      scopes: "identify email", // optional; email if you want it
    },
  });

  if (error) {
    console.error("[auth] Discord OAuth error:", error);
    throw error;
  }

  return data;
};

/***** OPTIONAL: auth state listener *****/
/**
 * This fires after Supabase finishes processing the OAuth redirect.
 * For Discord sign-in, we:
 *  - upsert into public.discord_links
 *  - (optionally) redirect off auth.html to index.html
 */
_sb.auth.onAuthStateChange(async (event, session) => {
  // console.log("[auth] state:", event, session);

  if (event === "SIGNED_IN") {
    try {
      await syncDiscordLinkFromSession(session);
    } catch (e) {
      console.error("[auth] syncDiscordLinkFromSession error:", e);
    }

    // If we're on auth.html after Discord login, send them to the dashboard
    const path = location.pathname || "";
    if (path.endsWith("/auth.html") || path.endsWith("auth.html")) {
      goto("index.html");
    }
  }
});
