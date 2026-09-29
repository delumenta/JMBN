// js/avatars.js
// JMBN shared Discord avatar helper
//
// This file is safe to use BEFORE avatar_url is added to Supabase.
// If no Discord avatar is available, the member's initials are shown.

(function () {
  "use strict";

  const FALLBACK = "";

  // =========================================================
  // INITIALS
  // =========================================================

  function initials(value) {
    const text = String(value || "").trim();

    if (!text) return "--";

    const parts = text
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 1) {
      return parts[0]
        .slice(0, 2)
        .toUpperCase();
    }

    return (
      parts[0][0] +
      parts[parts.length - 1][0]
    ).toUpperCase();
  }


  // =========================================================
  // GET AVATAR URL
  // =========================================================

  function avatarUrl(row) {
    return String(
      row?.avatar_url || ""
    ).trim();
  }


  // =========================================================
  // RENDER AVATAR
  // =========================================================

  function renderAvatar(element, row, label) {
    if (!element) return;

    const url = avatarUrl(row);

    element.classList.toggle(
      "has-avatar-image",
      !!url
    );

    // ---------------------------------------------------------
    // Discord avatar available
    // ---------------------------------------------------------

    if (url) {
      element.textContent = "";

      element.style.backgroundImage =
        `url("${url.replace(/"/g, '\\"')}")`;

      element.style.backgroundSize = "cover";
      element.style.backgroundPosition = "center";
      element.style.backgroundRepeat = "no-repeat";

      element.setAttribute(
        "aria-label",
        `${label || "Member"} Discord avatar`
      );

      return;
    }


    // ---------------------------------------------------------
    // Fallback — initials
    // ---------------------------------------------------------

    element.style.backgroundImage = "";

    element.textContent =
      initials(label);

    element.setAttribute(
      "aria-label",
      `${label || "Member"} avatar`
    );
  }


  // =========================================================
  // GET ONE USER'S DISCORD LINK
  // =========================================================

  async function getDiscordLink(sb, userId) {
    if (!sb || !userId) {
      return null;
    }

    try {

      /*
       * Primary lookup:
       * exact Supabase user_id -> discord_links row.
       */

      const {
        data,
        error
      } = await sb
        .from("discord_links")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();


      if (error) {
        console.warn(
          "JMBN avatar lookup:",
          error.message
        );
      }


      /*
       * If the exact account already has an avatar, always use it.
       */
      if (data && avatarUrl(data)) {
        return data;
      }


      /*
       * Legacy duplicate-profile fallback.
       *
       * Older JMBN records can contain two Supabase profiles for the
       * same handle. The Discord link may still belong to the older
       * profile while the member is signed in through the newer one.
       *
       * Member Registry already sees the linked record because it loads
       * the full Discord-link roster. For Profile + shared Header we
       * resolve a single Discord-linked alias with the same handle so
       * the same avatar is shown consistently.
       */

      const {
        data: profile,
        error: profileError
      } = await sb
        .from("profiles")
        .select("handle")
        .eq("user_id", userId)
        .maybeSingle();


      if (profileError || !profile?.handle) {
        return data || null;
      }


      const {
        data: aliases,
        error: aliasesError
      } = await sb
        .from("profiles")
        .select("user_id,handle")
        .ilike("handle", profile.handle);


      if (aliasesError) {
        return data || null;
      }


      const aliasIds =
        (aliases || [])
          .filter(
            row =>
              String(row.handle || "")
                .trim()
                .toLowerCase() ===
              String(profile.handle || "")
                .trim()
                .toLowerCase()
          )
          .map(row => row.user_id)
          .filter(Boolean);


      if (!aliasIds.length) {
        return data || null;
      }


      const {
        data: linkedAliases,
        error: linkedAliasesError
      } = await sb
        .from("discord_links")
        .select("*")
        .in("user_id", aliasIds);


      if (linkedAliasesError) {
        return data || null;
      }


      const withAvatar =
        (linkedAliases || [])
          .filter(row => !!avatarUrl(row));


      /*
       * Only use the fallback when there is one unambiguous
       * Discord-linked profile for that handle.
       */
      if (withAvatar.length === 1) {
        return withAvatar[0];
      }


      return data || null;

    } catch (error) {

      console.warn(
        "JMBN avatar lookup:",
        error
      );

      return null;
    }
  }


  // =========================================================
  // GET ALL DISCORD LINKS
  // Used by member.html
  // =========================================================

  async function getDiscordLinks(sb) {
    if (!sb) {
      return [];
    }

    try {

      const {
        data,
        error
      } = await sb
        .from("discord_links")
        .select("*");


      if (error) {
        console.warn(
          "JMBN avatar roster lookup:",
          error.message
        );

        return [];
      }


      return data || [];

    } catch (error) {

      console.warn(
        "JMBN avatar roster lookup:",
        error
      );

      return [];
    }
  }


  // =========================================================
  // PUBLIC API
  // =========================================================

  window.JMBNAvatars = {

    FALLBACK,

    initials,

    avatarUrl,

    renderAvatar,

    getDiscordLink,

    getDiscordLinks

  };

})();