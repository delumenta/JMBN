// js/auth.js
// ----------------------------------------------------
// Supabase auth bootstrap for JMBN (GitHub Pages safe)
//
// - Handles PKCE Discord OAuth
// - Redirects auth.html → index.html after login
// - NO discord_links logic
// ----------------------------------------------------

/***** CONFIG *****/
const SUPABASE_URL = "https://fcegavhipeaeihxegsnw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZWdhdmhpcGVhZWloeGVnc253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMjk3NTcsImV4cCI6MjA3NzcwNTc1N30.i-ZjOlKc89-uA7fqOIvmAMv60-C2_NmKikRI_78Jei8";

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
    detectSessionInUrl: false, // we handle PKCE manually
    flowType: "pkce",
    autoRefreshToken: true,
  },
});

window.getSupabase = () => _sb;

/***** PKCE HANDLER: exchange ?code=... → session *****/
(async () => {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const errorDesc = url.searchParams.get("error_description");

    if (errorDesc) {
      console.error("[auth] OAuth error from provider:", errorDesc);
    }

    if (code) {
      // IMPORTANT: pass only the code string, not the full URL
      const { data, error } = await _sb.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[auth] exchangeCodeForSession failed:", error);
      } else {
        // Clean the URL (remove ?code=...) but stay on auth.html
        window.history.replaceState({}, document.title, BASE + "auth.html");
      }
    }
  } catch (err) {
    console.error("[auth] PKCE handler error:", err);
  }

  // After attempting exchange, if we already have a session and are on auth.html,
  // go straight to the dashboard.
  const { data } = await _sb.auth.getSession();
  if (
    data?.session &&
    (location.pathname.endsWith("/auth.html") ||
      location.pathname.endsWith("auth.html"))
  ) {
    goto("index.html");
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

/***** AUTH GUARD (for protected pages) *****/
window.requireAuth = async function requireAuth() {
  try {
    const { data } = await _sb.auth.getSession();
    if (!data?.session) {
      goto("auth.html");
      return null;
    }
    return data.session;
  } catch (e) {
    console.error("[auth] requireAuth failed:", e);
    goto("auth.html");
    return null;
  }
};

/***** USERNAME / PASSWORD LOGIN *****/
window.signIn = async function signIn(usernameOrEmail, password) {
  const email = usernameOrEmail.includes("@")
    ? usernameOrEmail
    : `${usernameOrEmail}@jmbn.local`;

  return await _sb.auth.signInWithPassword({ email, password });
};

window.signOut = async function signOut() {
  await _sb.auth.signOut();
  goto("auth.html");
};

/***** DISCORD LOGIN *****/
window.loginWithDiscord = async function loginWithDiscord() {
  const redirectTo = `${location.origin}${BASE}auth.html`;

  const { error } = await _sb.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo, scopes: "identify email" },
  });

  if (error) {
    console.error("[auth] Discord OAuth error:", error);
    throw error;
  }
};

/***** OPTIONAL: auth state listener *****/
_sb.auth.onAuthStateChange((event, session) => {
  console.log("[auth] event:", event);

  if (
    event === "SIGNED_IN" &&
    (location.pathname.endsWith("/auth.html") ||
      location.pathname.endsWith("auth.html"))
  ) {
    goto("index.html");
  }
});
