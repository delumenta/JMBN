(function () {

  window.initJmbnHeader = async function initJmbnHeader() {

    const root = document.getElementById("jmbnHeader");

    if (!root) {
      console.warn("JMBN header root not found.");
      return;
    }

    // Prevent duplicate initialization
    if (root.dataset.ready === "1") {
      return;
    }

    root.dataset.ready = "1";


    /* =====================================================
       ACTIVE NAVIGATION
    ====================================================== */

    const current =
      (
        window.location.pathname.split("/").pop()
        || "index.html"
      ).toLowerCase();


    root
      .querySelectorAll(".jmbn-navlink")
      .forEach(function (link) {

        const page =
          String(
            link.dataset.page || ""
          ).toLowerCase();

        const active =
          page === current;

        link.classList.toggle(
          "active",
          active
        );

        if (active) {
          link.setAttribute(
            "aria-current",
            "page"
          );
        } else {
          link.removeAttribute(
            "aria-current"
          );
        }

      });



    /* =====================================================
       ACCOUNT DROPDOWN
    ====================================================== */

    const accountButton =
      root.querySelector(
        "#jmbnAccountButton"
      );

    const accountMenu =
      root.querySelector(
        "#jmbnAccountMenu"
      );


    function closeAccountMenu() {

      if (!accountMenu) return;

      accountMenu.classList.remove(
        "open"
      );

      if (accountButton) {
        accountButton.setAttribute(
          "aria-expanded",
          "false"
        );
      }

    }


    function openAccountMenu() {

      if (!accountMenu) return;

      accountMenu.classList.add(
        "open"
      );

      if (accountButton) {
        accountButton.setAttribute(
          "aria-expanded",
          "true"
        );
      }

    }


    if (
      accountButton &&
      accountMenu
    ) {

      accountButton.addEventListener(
        "click",
        function (event) {

          event.stopPropagation();

          const isOpen =
            accountMenu.classList.contains(
              "open"
            );

          if (isOpen) {
            closeAccountMenu();
          } else {
            openAccountMenu();
          }

        }
      );


      document.addEventListener(
        "click",
        function (event) {

          if (
            !root.contains(
              event.target
            )
          ) {
            closeAccountMenu();
          }

        }
      );


      document.addEventListener(
        "keydown",
        function (event) {

          if (
            event.key === "Escape"
          ) {

            closeAccountMenu();

            accountButton.focus();

          }

        }
      );

    }



    /* =====================================================
       HEADER ELEMENTS
    ====================================================== */

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



    /* =====================================================
       INITIALS
    ====================================================== */

    function getInitials(value) {

      const text =
        String(
          value || ""
        ).trim();

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

      if (parts.length === 1) {
        return parts[0]
          .slice(0, 2)
          .toUpperCase();
      }

      return (
        parts[0][0] +
        parts[
          parts.length - 1
        ][0]
      ).toUpperCase();

    }



    /* =====================================================
       SUPABASE
    ====================================================== */

    if (
      typeof window.getSupabase !==
      "function"
    ) {

      console.error(
        "getSupabase() was not found. Make sure js/auth.js loads before js/header.js."
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


    let sb;

    try {

      sb =
        window.getSupabase();

    } catch (error) {

      console.error(
        "Unable to initialize Supabase for header:",
        error
      );

      return;

    }



    /* =====================================================
       SESSION
    ====================================================== */

    try {

      const {
        data,
        error
      } =
        await sb.auth.getSession();


      if (error) {
        throw error;
      }


      const session =
        data?.session;


      if (!session?.user) {

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

        return;

      }


      const user =
        session.user;

      const uid =
        user.id;



      /* ===================================================
         PROFILE
      ==================================================== */

      const {
        data:profile,
        error:profileError
      } =
        await sb
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
            uid
          )
          .maybeSingle();


      if (profileError) {

        console.warn(
          "Header profile query:",
          profileError.message
        );

      }



      /* ===================================================
         DISPLAY NAME
      ==================================================== */

      const emailName =
        user.email
          ? user.email.split("@")[0]
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



      /* ===================================================
         RANK
      ==================================================== */

      let rankName =
        profile?.rank_code
        ||
        profile?.role
        ||
        "Member";


      if (
        profile?.current_rank_id
      ) {

        const {
          data:rank,
          error:rankError
        } =
          await sb
            .from("ranks")
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
            "Header rank query:",
            rankError.message
          );

        } else if (rank) {

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



      /* ===================================================
         ADMIN CONSOLE
      ==================================================== */

      const role =
        String(
          profile?.role || ""
        ).toLowerCase();


      if (adminLink) {

        if (
          role === "admin"
        ) {

          adminLink.hidden =
            false;

          adminLink.style.display =
            "";

        } else {

          adminLink.hidden =
            true;

          adminLink.style.display =
            "none";

        }

      }



      /* ===================================================
         LOGOUT
      ==================================================== */

      if (logoutButton) {

        logoutButton.addEventListener(
          "click",
          async function () {

            try {

              logoutButton.disabled =
                true;

              await sb.auth.signOut();

              window.location.href =
                "login.html";

            } catch (error) {

              console.error(
                "Logout failed:",
                error
              );

              logoutButton.disabled =
                false;

            }

          }
        );

      }


    } catch (error) {

      console.error(
        "JMBN header initialization failed:",
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

    }

  };

})();
