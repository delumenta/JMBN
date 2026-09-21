/* =========================================================
   JMBN SHARED HEADER
   js/header.js

   Used with:
   header.html

   Handles:
   - Active navigation
   - Logged-in member identity
   - Rank display
   - Account dropdown
   - Admin Console visibility
   - Logout
========================================================= */

(function () {

  "use strict";


  /* =========================================================
     INITIALIZE HEADER
  ========================================================= */

  window.initJmbnHeader = async function initJmbnHeader() {


    /* ---------------------------------------------------------
       FIND HEADER
    --------------------------------------------------------- */

    const root =
      document.getElementById("jmbnHeader");


    if (!root) {

      console.warn(
        "JMBN header root #jmbnHeader was not found."
      );

      return;

    }


    /*
      Prevent the same injected header from being
      initialized more than once.
    */

    if (root.dataset.ready === "1") {

      return;

    }


    root.dataset.ready = "1";



    /* =========================================================
       ELEMENT REFERENCES
    ========================================================= */

    const accountButton =
      root.querySelector(
        "#jmbnAccountButton"
      );


    const accountMenu =
      root.querySelector(
        "#jmbnAccountMenu"
      );


    const nameEl =
      root.querySelector(
        "#jmbnName"
      );


    const rankEl =
      root.querySelector(
        "#jmbnRank"
      );


    const avatarEl =
      root.querySelector(
        "#jmbnAvatar"
      );


    const adminLink =
      root.querySelector(
        "#jmbnAdminLink"
      );


    const logoutButton =
      root.querySelector(
        "#jmbnLogout"
      );



    /* =========================================================
       ACTIVE NAVIGATION
    ========================================================= */

    const currentPage =
      (
        window.location.pathname
          .split("/")
          .pop()

        ||

        "index.html"
      )
        .toLowerCase();



    root
      .querySelectorAll(
        ".jmbn-navlink"
      )
      .forEach(
        function (link) {


          const page =
            String(
              link.dataset.page ||
              ""
            )
              .toLowerCase();


          const isActive =
            page === currentPage;


          link.classList.toggle(
            "active",
            isActive
          );


          if (isActive) {

            link.setAttribute(
              "aria-current",
              "page"
            );

          }
          else {

            link.removeAttribute(
              "aria-current"
            );

          }


        }
      );



    /* =========================================================
       ACCOUNT DROPDOWN
    ========================================================= */


    /*
      IMPORTANT:

      header.html uses:

          hidden

      to control whether the menu is visible.

      Therefore we change accountMenu.hidden directly.
    */


    function closeAccountMenu() {


      if (!accountMenu) {

        return;

      }


      accountMenu.hidden =
        true;


      if (accountButton) {

        accountButton.setAttribute(
          "aria-expanded",
          "false"
        );

      }

    }



    function openAccountMenu() {


      if (!accountMenu) {

        return;

      }


      accountMenu.hidden =
        false;


      if (accountButton) {

        accountButton.setAttribute(
          "aria-expanded",
          "true"
        );

      }

    }



    function toggleAccountMenu() {


      if (!accountMenu) {

        return;

      }


      if (accountMenu.hidden) {

        openAccountMenu();

      }
      else {

        closeAccountMenu();

      }

    }



    /* ---------------------------------------------------------
       ACCOUNT BUTTON
    --------------------------------------------------------- */

    if (
      accountButton &&
      accountMenu
    ) {


      accountButton.addEventListener(
        "click",
        function (event) {


          event.preventDefault();

          event.stopPropagation();


          toggleAccountMenu();


        }
      );



      /* -------------------------------------------------------
         CLICK INSIDE MENU

         Prevent document click from immediately closing it.
      ------------------------------------------------------- */

      accountMenu.addEventListener(
        "click",
        function (event) {

          event.stopPropagation();

        }
      );



      /* -------------------------------------------------------
         CLICK OUTSIDE
      ------------------------------------------------------- */

      document.addEventListener(
        "click",
        function (event) {


          if (
            !root.contains(
              event.target
            )
          ) {

            closeAccountMenu();

            return;

          }


          if (
            !accountButton.contains(
              event.target
            )

            &&

            !accountMenu.contains(
              event.target
            )
          ) {

            closeAccountMenu();

          }


        }
      );



      /* -------------------------------------------------------
         ESCAPE KEY
      ------------------------------------------------------- */

      document.addEventListener(
        "keydown",
        function (event) {


          if (
            event.key !==
            "Escape"
          ) {

            return;

          }


          if (
            !accountMenu.hidden
          ) {


            closeAccountMenu();


            accountButton.focus();


          }


        }
      );


    }



    /* =========================================================
       INITIALS
    ========================================================= */

    function getInitials(value) {


      const text =
        String(
          value ||
          ""
        )
          .trim();


      if (!text) {

        return "--";

      }


      const parts =
        text
          .split(/\s+/)
          .filter(Boolean);


      if (!parts.length) {

        return "--";

      }


      /*
        Single word:

        DELUMENTA
        becomes
        DE
      */

      if (
        parts.length === 1
      ) {

        return parts[0]
          .slice(
            0,
            2
          )
          .toUpperCase();

      }


      /*
        Multiple words:

        DEREK LUMENTA
        becomes
        DL
      */

      return (
        parts[0][0]
        +
        parts[
          parts.length - 1
        ][0]
      )
        .toUpperCase();

    }



    /* =========================================================
       ADMIN LINK DEFAULT
    ========================================================= */

    if (adminLink) {

      adminLink.hidden =
        true;

    }



    /* =========================================================
       CHECK AUTH.JS
    ========================================================= */

    if (
      typeof window.getSupabase !==
      "function"
    ) {


      console.error(
        "JMBN Header: getSupabase() was not found. " +
        "Make sure js/auth.js loads before js/header.js."
      );


      if (nameEl) {

        nameEl.textContent =
          "PERSONNEL";

      }


      if (rankEl) {

        rankEl.textContent =
          "OFFLINE";

      }


      if (avatarEl) {

        avatarEl.textContent =
          "--";

      }


      return;

    }



    /* =========================================================
       GET SUPABASE CLIENT
    ========================================================= */

    let sb;


    try {


      sb =
        window.getSupabase();


      if (!sb) {

        throw new Error(
          "getSupabase() returned no client."
        );

      }


    }
    catch (error) {


      console.error(
        "JMBN Header: Unable to initialize Supabase.",
        error
      );


      if (nameEl) {

        nameEl.textContent =
          "PERSONNEL";

      }


      if (rankEl) {

        rankEl.textContent =
          "OFFLINE";

      }


      return;

    }



    /* =========================================================
       LOGOUT
    ========================================================= */

    /*
      We can attach logout now that we have
      the Supabase client.
    */

    if (logoutButton) {


      logoutButton.addEventListener(
        "click",
        async function (event) {


          event.preventDefault();

          event.stopPropagation();


          try {


            logoutButton.disabled =
              true;


            logoutButton.textContent =
              "Signing Out...";


            const {
              error
            } =
              await sb.auth.signOut();


            if (error) {

              throw error;

            }


            window.location.href =
              "login.html";


          }
          catch (error) {


            console.error(
              "JMBN Header logout failed:",
              error
            );


            logoutButton.disabled =
              false;


            logoutButton.textContent =
              "Log Out";


          }


        }
      );


    }



    /* =========================================================
       GET SESSION
    ========================================================= */

    try {


      const {
        data:sessionData,
        error:sessionError
      } =
        await sb.auth.getSession();



      if (sessionError) {

        throw sessionError;

      }



      const session =
        sessionData?.session;


      const user =
        session?.user;



      /* ---------------------------------------------------------
         NOT SIGNED IN
      --------------------------------------------------------- */

      if (!user) {


        if (nameEl) {

          nameEl.textContent =
            "SIGN IN";

        }


        if (rankEl) {

          rankEl.textContent =
            "PERSONNEL";

        }


        if (avatarEl) {

          avatarEl.textContent =
            "--";

        }


        if (adminLink) {

          adminLink.hidden =
            true;

        }


        return;

      }



      /* =========================================================
         LOAD PROFILE
      ========================================================= */

      const {
        data:profile,
        error:profileError
      } =
        await sb
          .from(
            "profiles"
          )
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



      if (profileError) {


        console.warn(
          "JMBN Header profile query:",
          profileError.message
        );


      }



      /* =========================================================
         DISPLAY NAME
      ========================================================= */

      const emailName =
        user.email

          ? user.email
              .split("@")[0]

          : "";



      const displayName =
        profile?.display_name

        ||

        profile?.handle

        ||

        emailName

        ||

        "Member";



      if (nameEl) {

        nameEl.textContent =
          displayName;

      }



      if (avatarEl) {

        avatarEl.textContent =
          getInitials(
            displayName
          );

      }



      /* =========================================================
         RANK FALLBACK
      ========================================================= */

      let rankName =
        profile?.rank_code

        ||

        profile?.role

        ||

        "Member";



      /* =========================================================
         LOAD FULL RANK NAME
      ========================================================= */

      if (
        profile?.current_rank_id
      ) {


        const {
          data:rank,
          error:rankError
        } =
          await sb
            .from(
              "ranks"
            )
            .select(
              "name, code"
            )
            .eq(
              "id",
              profile.current_rank_id
            )
            .maybeSingle();



        if (rankError) {


          console.warn(
            "JMBN Header rank query:",
            rankError.message
          );


        }
        else if (rank) {


          /*
            Prefer the full rank name.

            Example:
            Lieutenant, Junior Grade (O-2)
          */

          rankName =
            rank.name

            ||

            rank.code

            ||

            rankName;


        }


      }



      if (rankEl) {

        rankEl.textContent =
          rankName;

      }



      /* =========================================================
         ADMIN CONSOLE VISIBILITY
      ========================================================= */

      const userRole =
        String(
          profile?.role ||
          ""
        )
          .trim()
          .toLowerCase();



      if (adminLink) {


        if (
          userRole === "admin"
        ) {


          adminLink.hidden =
            false;


        }
        else {


          adminLink.hidden =
            true;


        }


      }



    }
    catch (error) {


      console.error(
        "JMBN Header initialization failed:",
        error
      );


      if (nameEl) {

        nameEl.textContent =
          "PERSONNEL";

      }


      if (rankEl) {

        rankEl.textContent =
          "OFFLINE";

      }


      if (avatarEl) {

        avatarEl.textContent =
          "--";

      }


      if (adminLink) {

        adminLink.hidden =
          true;

      }


    }


  };


})();
