// js/auth.js
// ----------------------------------------------------
// Supabase auth bootstrap for JMBN (GitHub Pages safe)
// Exposes helpers on window: getSupabase, requireAuth,
// signIn, signOut, loginWithDiscord, getSession,
// currentUsername, goto, getBasePath
// ----------------------------------------------------

/***** CONFIG *****/
const SUPABASE_URL = "https://fcegavhipeaeihxegsnw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZWdhdmhpcGVhZWloeGVnc253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMjk3NTcsImV4cCI6MjA3NzcwNTc1N30.i-ZjOlKc89-uA7fqOIvmAMv60-C2_NmKikRI_78Jei8
"; // <-- your anon key

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

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: false,     // <-- IMPORTANT: we handle PKCE manually
    flowType: "pkce",
    autoRefreshToken: true,
  },
});

// expose shared instance
window.getSupabase = () => _sb;

/***** NEW — HANDLE ?code=... FROM DISCORD (PKCE) *****/
(async () => {
  try {
    const url = new URL(window.location.href);
    const hasCode = url.searchParams.get("code") || url.searchParams.get("error_description");

    if (hasCode) {
      const { data, error } = await _sb.auth.exchangeCodeForSession(
        window.location.search.substring(1) // strip leading '?'
      );

      if (error) {
        console.error("[auth] exchangeCodeForSession failed:", error);
      } else {
        // Clean URL so "?code=..." disappears but stays on auth.html
        window.history.replaceState({}, document.title, BASE + "auth.html");
      }
    }
  } catch (err) {
    console.error("[auth] PKCE handler error:", err);
  }
})();

/***** HELPERS *****/
window.goto = function goto(path = "") {
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

/***** USERNAME/PASSWORD LOGIN *****/
window.signIn = async function signIn(usernameOrEmail, password) {
  const email = usernameOrEmail.includes("@")
    ? usernameOrEmail
    : `${usernameOrEmail}@jmbn.local`;

  const { data, error } = await _sb.auth.signInWithPassword({ email, password });
  return { data, error };
};

window.signOut = async function signOut() {
  try {
    await _sb.auth.signOut();
  } finally {
    goto("auth.html");
  }
};

/***** DISCORD OAUTH LOGIN *****/
window.loginWithDiscord = async function loginWithDiscord() {
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

/***** OPTIONAL LISTENER *****/
_sb.auth.onAuthStateChange((event, session) => {
  // console.log("[auth] state:", event, session);
});
