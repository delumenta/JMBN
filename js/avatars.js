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
       * We deliberately use SELECT *
       *
       * This means this JS can already be placed on GitHub
       * even before avatar_url is added to discord_links.
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

        return null;
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