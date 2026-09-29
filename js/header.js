// js/header.js
// JMBN shared header controller
// Includes Discord avatar support via js/avatars.js

(function () {
  "use strict";

  // =========================================================
  // HELPERS
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


  function currentPage() {
    const path =
      window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();

    return path || "index.html";
  }


  // =========================================================
  // HEADER INITIALISER
  // =========================================================

  window.initJmbnHeader = async function () {

    const root =
      document.getElementById("jmbnHeader");

    if (!root) {
      console.warn(
        "JMBN header: #jmbnHeader was not found."
      );

      return;
    }


    // Prevent the header from being initialised twice.
    if (root.dataset.ready === "1") {
      return;
    }

    root.dataset.ready = "1";


    // =======================================================
    // ELEMENTS
    // =======================================================

    const accountButton =
      root.querySelector("#jmbnAccountButton");

    const accountMenu =
      root.querySelector("#jmbnAccountMenu");

    const nameEl =
      root.querySelector("#jmbnName");

    const rankEl =
      root.querySelector("#jmbnRank");

    const avatarEl =
      root.querySelector("#jmbnAvatar");

    const adminLink =
      root.querySelector("#jmbnAdminLink");

    const logoutButton =
      root.querySelector("#jmbnLogout");

    const mobileNavButton =
      root.querySelector("#jmbnMobileNavToggle");

    const primaryNav =
      root.querySelector("#jmbnPrimaryNav");


    // =======================================================
    // ACTIVE NAVIGATION
    // =======================================================

    const page = currentPage();

    root
      .querySelectorAll(".jmbn-navlink[data-page]")
      .forEach(link => {

        const target =
          String(
            link.dataset.page || ""
          ).toLowerCase();

        link.classList.toggle(
          "active",
          target === page
        );

      });


    // =======================================================
    // MOBILE PRIMARY NAVIGATION
    // =======================================================

    function setMobileNav(open) {

      root.classList.toggle(
        "mobile-nav-open",
        !!open
      );

      if (mobileNavButton) {
        mobileNavButton.setAttribute(
          "aria-expanded",
          open ? "true" : "false"
        );

        mobileNavButton.setAttribute(
          "aria-label",
          open
            ? "Close navigation"
            : "Open navigation"
        );
      }

    }


    function closeMobileNav() {
      setMobileNav(false);
    }


    if (mobileNavButton) {

      mobileNavButton.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          setMobileNav(
            !root.classList.contains(
              "mobile-nav-open"
            )
          );

        }
      );

    }


    if (primaryNav) {

      primaryNav
        .querySelectorAll("a")
        .forEach(link => {

          link.addEventListener(
            "click",
            closeMobileNav
          );

        });

    }


    window.addEventListener(
      "resize",
      () => {

        if (window.innerWidth > 760) {
          closeMobileNav();
        }

      }
    );


    // =======================================================
    // ACCOUNT DROPDOWN
    // =======================================================

    function openMenu() {

      if (!accountMenu) return;

      accountMenu.hidden = false;

      if (accountButton) {
        accountButton.setAttribute(
          "aria-expanded",
          "true"
        );
      }
    }


    function closeMenu() {

      if (!accountMenu) return;

      accountMenu.hidden = true;

      if (accountButton) {
        accountButton.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    }


    function toggleMenu() {

      if (!accountMenu) return;

      if (accountMenu.hidden) {
        openMenu();
      } else {
        closeMenu();
      }
    }


    if (accountButton) {

      accountButton.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          toggleMenu();

        }
      );

    }


    document.addEventListener(
      "click",
      event => {

        if (!root.contains(event.target)) {
          closeMenu();
          closeMobileNav();
        }

      }
    );


    document.addEventListener(
      "keydown",
      event => {

        if (event.key === "Escape") {
          closeMenu();
          closeMobileNav();
        }

      }
    );


    // =======================================================
    // SUPABASE
    // =======================================================

    if (
      typeof window.getSupabase !== "function"
    ) {

      console.error(
        "JMBN header: getSupabase() was not found."
      );

      return;
    }


    const sb =
      window.getSupabase();


    if (!sb) {

      console.error(
        "JMBN header: Supabase client unavailable."
      );

      return;
    }


    // =======================================================
    // CURRENT SESSION
    // =======================================================

    let session = null;

    try {

      const {
        data,
        error
      } = await sb.auth.getSession();


      if (error) {
        console.error(
          "JMBN header session error:",
          error
        );
      }


      session =
        data?.session || null;

    } catch (error) {

      console.error(
        "JMBN header session error:",
        error
      );

    }


    const user =
      session?.user;


    // Not logged in.
    if (!user) {

      if (nameEl) {
        nameEl.textContent = "GUEST";
      }

      if (rankEl) {
        rankEl.textContent = "NOT AUTHENTICATED";
      }

      if (avatarEl) {
        avatarEl.textContent = "--";
      }

      if (adminLink) {
        adminLink.hidden = true;
      }

      return;
    }


    // =======================================================
    // PROFILE
    // =======================================================

    let profile = null;

    try {

      const {
        data,
        error
      } = await sb
        .from("profiles")
        .select(`
          display_name,
          handle,
          role,
          rank_code,
          current_rank_id
        `)
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();


      if (error) {

        console.error(
          "JMBN header profile error:",
          error
        );

      } else {

        profile = data;

      }

    } catch (error) {

      console.error(
        "JMBN header profile error:",
        error
      );

    }


    // =======================================================
    // DISPLAY NAME
    // =======================================================

    const display =
      profile?.display_name ||
      profile?.handle ||
      user.email ||
      "MEMBER";


    if (nameEl) {
      nameEl.textContent =
        String(display).toUpperCase();
    }


    // =======================================================
    // RANK
    // =======================================================

    let rankName =
      profile?.rank_code ||
      "PERSONNEL";


    if (profile?.current_rank_id) {

      try {

        const {
          data: rank,
          error
        } = await sb
          .from("ranks")
          .select(`
            name,
            code
          `)
          .eq(
            "id",
            profile.current_rank_id
          )
          .maybeSingle();


        if (!error && rank) {

          rankName =
            rank.name ||
            rank.code ||
            rankName;

        }

      } catch (error) {

        console.warn(
          "JMBN header rank lookup:",
          error
        );

      }

    }


    if (rankEl) {
      rankEl.textContent =
        String(rankName).toUpperCase();
    }


    // =======================================================
    // AVATAR
    // =======================================================
    //
    // For now:
    //
    //     No avatar_url
    //          ↓
    //       Initials
    //
    // Later:
    //
    //     Discord Edge Function
    //          ↓
    //     discord_links.avatar_url
    //          ↓
    //       Discord avatar
    //
    // =======================================================

    if (avatarEl) {

      // Default/fallback immediately.
      avatarEl.textContent =
        initials(display);


      // avatars.js loaded?
      if (window.JMBNAvatars) {

        try {

          const discordLink =
            await window.JMBNAvatars
              .getDiscordLink(
                sb,
                user.id
              );


          window.JMBNAvatars
            .renderAvatar(
              avatarEl,
              discordLink,
              display
            );

        } catch (error) {

          console.warn(
            "JMBN Discord avatar:",
            error
          );

        }

      }

    }


    // =======================================================
    // ADMIN LINK
    // =======================================================

    const role =
      String(
        profile?.role || ""
      )
        .trim()
        .toLowerCase();


    if (adminLink) {

      adminLink.hidden =
        role !== "admin";

    }


    // =======================================================
    // LOGOUT
    // =======================================================

    if (logoutButton) {

      logoutButton.addEventListener(
        "click",
        async event => {

          event.preventDefault();

          logoutButton.disabled = true;

          try {

            await sb.auth.signOut();

          } catch (error) {

            console.error(
              "JMBN logout error:",
              error
            );

          }

          window.location.href =
            "login.html";

        }
      );

    }

  };

})();