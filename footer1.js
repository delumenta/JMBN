/* =========================================================
   SHARED FOOTER
   Requires:
   - supabase-js
   - supabase.js
   - <div id="footer"></div>
========================================================= */

(function(){

  const FOOTER_FILE = "footer.html";

  let footerTripId =
    Number(
      new URLSearchParams(window.location.search).get("trip")
    ) || null;

  let footerUser = null;


  /* =======================================================
     HELPERS
  ======================================================= */

  function footerText(value){
    return String(value ?? "");
  }


  function footerEsc(value){

    return footerText(value)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");

  }


  function footerNorm(value){

    return footerText(value)
      .trim()
      .toLowerCase();

  }


  function footerFormatDate(value){

    if(!value){
      return "";
    }

    const date =
      new Date(value + "T12:00:00");

    return date.toLocaleDateString(
      "en-SG",
      {
        day:"numeric",
        month:"short",
        year:"numeric"
      }
    );

  }


  function footerTripIcon(country){

    const value =
      footerNorm(country);

    if(value.includes("japan")) return "🇯🇵";
    if(value.includes("taiwan")) return "🇹🇼";
    if(value.includes("singapore")) return "🇸🇬";
    if(value.includes("korea")) return "🇰🇷";
    if(value.includes("china")) return "🇨🇳";
    if(value.includes("thailand")) return "🇹🇭";
    if(value.includes("malaysia")) return "🇲🇾";
    if(value.includes("indonesia")) return "🇮🇩";

    return "✈️";

  }


  function footerCurrentPage(){

    const page =
      window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();

    return page || "index.html";

  }


  function footerWithTrip(page){

    if(!footerTripId){
      return page;
    }

    return (
      page +
      "?trip=" +
      encodeURIComponent(footerTripId)
    );

  }


  /* =======================================================
     LOAD FOOTER.HTML
  ======================================================= */

  async function loadFooterHTML(){

    const host =
      document.getElementById("footer");

    if(!host){

      console.warn(
        'Shared footer: <div id="footer"></div> was not found.'
      );

      return false;

    }


    const response =
      await fetch(
        FOOTER_FILE,
        {
          cache:"no-cache"
        }
      );


    if(!response.ok){

      throw new Error(
        `Could not load ${FOOTER_FILE} (${response.status}).`
      );

    }


    host.innerHTML =
      await response.text();

    return true;

  }


  /* =======================================================
     LINKS + ACTIVE PAGE
  ======================================================= */

  function setupFooterLinks(){

    const links = {

      sharedNavHome:
        "index.html",

      sharedNavPlan:
        "schedule.html",

      sharedNavFood:
        "food.html",

      sharedNavHub:
        "bookings.html",

      /* EXPENSES — MAIN FOOTER ICON */

      sharedNavExpenses:
        "expenses.html",

      sharedProfileLink:
        "profile.html",

      sharedTripsLink:
        "trips.html",

      sharedPlacesLink:
        "places.html"

    };


    Object.entries(links)
      .forEach(([id,page]) => {

        const element =
          document.getElementById(id);

        if(element){

          element.href =
            footerWithTrip(page);

        }

      });


    const page =
      footerCurrentPage();


    const activeMap = {

      "index.html":
        "sharedNavHome",

      "schedule.html":
        "sharedNavPlan",

      "food.html":
        "sharedNavFood",

      "bookings.html":
        "sharedNavHub",

      "expenses.html":
        "sharedNavExpenses"

    };


    const activeId =
      activeMap[page];


    if(activeId){

      const active =
        document.getElementById(activeId);

      if(active){

        active.classList.add("active");

        active.setAttribute(
          "aria-current",
          "page"
        );

      }

    }

  }


  /* =======================================================
     MORE + SWITCH TRIP SHEETS
  ======================================================= */

  function setupFooterSheets(){

    const more =
      document.getElementById(
        "sharedMoreBackdrop"
      );

    const trips =
      document.getElementById(
        "sharedTripBackdrop"
      );

    const moreButton =
      document.getElementById(
        "sharedNavMore"
      );

    const closeMore =
      document.getElementById(
        "sharedCloseMore"
      );

    const switchTrip =
      document.getElementById(
        "sharedSwitchTrip"
      );

    const closeTrips =
      document.getElementById(
        "sharedCloseTrips"
      );

    const logoutButton =
      document.getElementById(
        "sharedLogout"
      );


    /* LOG OUT */

    if(logoutButton){

      logoutButton.onclick = async () => {

        logoutButton.disabled = true;

        const title =
          logoutButton.querySelector(
            ".footer-more-title"
          );

        if(title){
          title.textContent = "Logging Out…";
        }

        try{

          if(typeof db === "undefined"){

            throw new Error(
              "Supabase is not ready."
            );

          }


          const { error } =
            await db.auth.signOut();


          if(error){
            throw error;
          }


          localStorage.removeItem(
            "current_trip_id"
          );


          location.replace(
            "login.html"
          );

        }

        catch(error){

          console.error(
            "Shared footer logout:",
            error
          );


          logoutButton.disabled = false;


          if(title){

            title.textContent =
              "Log Out";

          }


          alert(
            error.message ||
            "Could not log out. Please try again."
          );

        }

      };

    }


    /* OPEN MORE */

    if(moreButton){

      moreButton.onclick = () => {

        more?.classList.add("open");

      };

    }


    /* CLOSE MORE */

    if(closeMore){

      closeMore.onclick = () => {

        more?.classList.remove("open");

      };

    }


    /* OPEN SWITCH TRIP */

    if(switchTrip){

      switchTrip.onclick = async () => {

        more?.classList.remove("open");

        trips?.classList.add("open");

        await loadFooterTrips();

      };

    }


    /* CLOSE SWITCH TRIP */

    if(closeTrips){

      closeTrips.onclick = () => {

        trips?.classList.remove("open");

      };

    }


    /* CLICK OUTSIDE MORE */

    if(more){

      more.onclick = event => {

        if(event.target === more){

          more.classList.remove("open");

        }

      };

    }


    /* CLICK OUTSIDE TRIPS */

    if(trips){

      trips.onclick = event => {

        if(event.target === trips){

          trips.classList.remove("open");

        }

      };

    }


    /* ESC KEY */

    document.addEventListener(
      "keydown",
      event => {

        if(event.key !== "Escape"){
          return;
        }

        more?.classList.remove("open");

        trips?.classList.remove("open");

      }
    );

  }


  /* =======================================================
     GET LOGGED-IN USER
  ======================================================= */

  async function footerGetUser(){

    if(typeof db === "undefined"){

      throw new Error(
        "Supabase is not ready. Make sure supabase.js loads before footer.js."
      );

    }


    const {
      data,
      error
    } =
      await db.auth.getUser();


    if(error){
      throw error;
    }


    footerUser =
      data?.user || null;


    return footerUser;

  }


  /* =======================================================
     GET ACCESSIBLE TRIPS
  ======================================================= */

  async function footerAccessibleTrips(){

    const user =
      footerUser ||
      await footerGetUser();


    if(!user){

      throw new Error(
        "You are not signed in."
      );

    }


    /* -----------------------------------------------
       TRIPS OWNED BY USER
    ----------------------------------------------- */

    const ownedResult =
      await db
        .from("trips")
        .select("*")
        .eq(
          "owner_id",
          user.id
        );


    if(ownedResult.error){
      throw ownedResult.error;
    }


    /* -----------------------------------------------
       TRIPS SHARED WITH USER
    ----------------------------------------------- */

    const memberResult =
      await db
        .from("trip_members")
        .select("trip_id")
        .eq(
          "user_id",
          user.id
        );


    if(memberResult.error){
      throw memberResult.error;
    }


    const sharedIds =
      [
        ...new Set(
          (memberResult.data || [])
            .map(
              row =>
                Number(row.trip_id)
            )
            .filter(
              Number.isFinite
            )
        )
      ];


    let sharedTrips = [];


    if(sharedIds.length){

      const sharedResult =
        await db
          .from("trips")
          .select("*")
          .in(
            "id",
            sharedIds
          );


      if(sharedResult.error){
        throw sharedResult.error;
      }


      sharedTrips =
        sharedResult.data || [];

    }


    /* -----------------------------------------------
       COMBINE WITHOUT DUPLICATES
    ----------------------------------------------- */

    const tripMap =
      new Map();


    (ownedResult.data || [])
      .forEach(trip => {

        tripMap.set(
          Number(trip.id),
          {
            ...trip,
            __role:"owner"
          }
        );

      });


    sharedTrips
      .forEach(trip => {

        const id =
          Number(trip.id);


        if(!tripMap.has(id)){

          tripMap.set(
            id,
            {
              ...trip,
              __role:"member"
            }
          );

        }

      });


    return [...tripMap.values()]
      .sort((a,b) => {

        return footerText(
          a.start_date
        ).localeCompare(
          footerText(
            b.start_date
          )
        );

      });

  }


  /* =======================================================
     LOAD SWITCH TRIP LIST
  ======================================================= */

  async function loadFooterTrips(){

    const container =
      document.getElementById(
        "sharedTripList"
      );


    if(!container){
      return;
    }


    container.innerHTML = `

      <div class="footer-trip-message">
        Loading your trips…
      </div>

    `;


    try{

      const trips =
        await footerAccessibleTrips();


      if(!trips.length){

        container.innerHTML = `

          <div class="footer-trip-message">
            No trips available yet.
          </div>

        `;

        return;

      }


      const currentPage =
        footerCurrentPage();


      /* =================================================
         KEEP SAME PAGE WHEN SWITCHING TRIP
         INCLUDING EXPENSES.HTML
      ================================================= */

      const switchPage =
        [
          "index.html",
          "schedule.html",
          "food.html",
          "bookings.html",
          "expenses.html",
          "profile.html",
          "places.html"
        ]
        .includes(currentPage)

          ? currentPage
          : "index.html";


      container.innerHTML =
        trips.map(trip => {

          const id =
            Number(trip.id);


          const current =
            id === Number(footerTripId);


          const role =
            trip.__role === "owner"
              ? "YOUR TRIP"
              : "SHARED WITH YOU";


          const dates =
            trip.start_date &&
            trip.end_date

              ?

            `${footerFormatDate(
              trip.start_date
            )} – ${footerFormatDate(
              trip.end_date
            )}`

              :

            "";


          const meta =
            [
              trip.country,
              dates
            ]
            .filter(Boolean)
            .join(" · ");


          return `

            <a
              class="
                footer-trip-card
                ${current ? "current" : ""}
              "
              href="${switchPage}?trip=${id}"
            >

              <div class="footer-trip-icon">

                ${footerTripIcon(
                  trip.country
                )}

              </div>


              <div class="footer-trip-main">

                <div class="footer-trip-name">

                  ${footerEsc(
                    trip.name ||
                    "Unnamed Trip"
                  )}

                </div>


                <div class="footer-trip-meta">

                  ${footerEsc(meta)}

                </div>


                <span class="footer-trip-role">

                  ${
                    current
                      ? "CURRENT · "
                      : ""
                  }

                  ${role}

                </span>

              </div>


              <div class="footer-trip-arrow">
                →
              </div>

            </a>

          `;

        }).join("");

    }

    catch(error){

      console.error(
        "Shared footer trip switcher:",
        error
      );


      container.innerHTML = `

        <div class="footer-trip-message error">

          Could not load your trips.

          <br><br>

          ${footerEsc(
            error.message ||
            "Supabase error"
          )}

        </div>

      `;

    }

  }


  /* =======================================================
     RESOLVE TRIP IF URL HAS NO ?trip=
  ======================================================= */

  async function resolveFooterTrip(){

    if(footerTripId){
      return;
    }


    try{

      const trips =
        await footerAccessibleTrips();


      if(!trips.length){
        return;
      }


      footerTripId =
        Number(
          trips[0].id
        );

    }

    catch(error){

      console.warn(
        "Shared footer could not resolve a trip:",
        error
      );

    }

  }


  /* =======================================================
     START
  ======================================================= */

  async function startSharedFooter(){

    try{

      const loaded =
        await loadFooterHTML();


      if(!loaded){
        return;
      }


      await resolveFooterTrip();


      setupFooterLinks();

      setupFooterSheets();

    }

    catch(error){

      console.error(
        "Shared footer error:",
        error
      );


      const host =
        document.getElementById(
          "footer"
        );


      if(host){

        host.innerHTML = `

          <div
            style="
              position:fixed;
              left:10px;
              right:10px;
              bottom:10px;
              z-index:999;
              padding:10px;
              border:1px solid #5a3434;
              border-radius:10px;
              background:#1a1010;
              color:#ffc5c1;
              font:12px system-ui,sans-serif;
              text-align:center;
            "
          >
            Footer could not load.
          </div>

        `;

      }

    }

  }


  /* =======================================================
     WAIT UNTIL PAGE IS READY
  ======================================================= */

  if(
    document.readyState === "loading"
  ){

    document.addEventListener(
      "DOMContentLoaded",
      startSharedFooter
    );

  }

  else{

    startSharedFooter();

  }

})();
