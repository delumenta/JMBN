// ======================================================
// JAPAN TRIP — SUPABASE CONNECTION
// ======================================================

// Replace these two values with your own Supabase project details.
const SUPABASE_URL = "https://zngncasvdrrxyrkjqutj.supabase.co";
const SUPABASE_KEY = "sb_publishable_wUrH6t12z4tRKruS28LqWQ_2GG06U9m";

// Create the Supabase client.
// `supabase` comes from the Supabase CDN script loaded in your HTML.
const db = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// Optional connection test.
// You can remove this later.
async function testSupabaseConnection() {
  try {
    const { data, error } = await db
      .from("restaurants")
      .select("id")
      .limit(1);

    if (error) {
      console.error("❌ Supabase connection error:", error.message);
      return false;
    }

    console.log("✅ Supabase connected successfully");
    return true;

  } catch (err) {
    console.error("❌ Supabase connection failed:", err);
    return false;
  }
}
