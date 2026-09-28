document.addEventListener("DOMContentLoaded", function () {

    const headerTarget = document.getElementById("site-header");

    fetch("header.html")
        .then(response => {

            if (!response.ok) {
                throw new Error("Could not load header.html");
            }

            return response.text();

        })
        .then(html => {

            headerTarget.innerHTML = html;

            highlightCurrentPage();

        })
        .catch(error => {

            console.error("Header loading error:", error);

        });

});


function highlightCurrentPage() {

    let currentPage =
        window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();

    if (currentPage === "") {
        currentPage = "index.html";
    }


    const pageMap = {
        "index.html": "home",
        "kyoto.html": "kyoto",
        "roadtrip.html": "roadtrip",
        "osaka.html": "osaka",
        "narai.html": "narai",
        "notes.html": "notes"
    };


    const activePage = pageMap[currentPage];


    document.querySelectorAll(".trip-nav a").forEach(link => {

        if (link.dataset.page === activePage) {
            link.classList.add("active");
        }

    });

}
function showKyotoDay(day) {

    // Hide all day content
    document.querySelectorAll(".kyoto-day-content").forEach(section => {
        section.classList.remove("active");
    });


    // Remove active state from all day cards
    document.querySelectorAll(".journey-day-card").forEach(card => {
        card.classList.remove("active");
    });


    // Show selected day
    const selectedDay =
        document.getElementById("kyoto-day-" + day);

    if (selectedDay) {
        selectedDay.classList.add("active");
    }


    // Highlight selected card
    const selectedCard =
        document.querySelector(
            '.journey-day-card[data-day="' + day + '"]'
        );

    if (selectedCard) {
        selectedCard.classList.add("active");
    }

}
document.addEventListener("DOMContentLoaded", function () {

    const headerTarget =
        document.getElementById("site-header");


    fetch("header.html")
        .then(response => {

            if (!response.ok) {
                throw new Error("Could not load header.html");
            }

            return response.text();

        })

        .then(html => {

            headerTarget.innerHTML = html;

            highlightCurrentPage();

            updatePageHero();

        })

        .catch(error => {

            console.error(
                "Header loading error:",
                error
            );

        });

});



function highlightCurrentPage() {

    let currentPage =
        window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();


    if (currentPage === "") {
        currentPage = "index.html";
    }


    const pageMap = {

        "index.html": "home",
        "kyoto.html": "kyoto",
        "roadtrip.html": "roadtrip",
        "osaka.html": "osaka",
        "narai.html": "narai",
        "notes.html": "notes"

    };


    const activePage =
        pageMap[currentPage];


    document
        .querySelectorAll(".trip-nav a")
        .forEach(link => {

            if (
                link.dataset.page === activePage
            ) {
                link.classList.add("active");
            }

        });

}



function updatePageHero() {

    let currentPage =
        window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();


    if (currentPage === "") {
        currentPage = "index.html";
    }


    const hero =
        document.getElementById("page-hero");

    const eyebrow =
        document.getElementById("hero-eyebrow");

    const title =
        document.getElementById("hero-title");

    const description =
        document.getElementById("hero-description");

    const pills =
        document.getElementById("hero-pills");


    /* ==========================
       KYOTO
       ========================== */

    if (currentPage === "kyoto.html") {

        hero.classList.add("hero-kyoto");


        eyebrow.innerHTML =
            "KYOTO · 18–22 OCTOBER 2026 🇯🇵";


        title.innerHTML =
            "Kyoto";


        description.innerHTML =
            "Autumn temples, old Kyoto streets, scenic walks and day trips through Kyoto and Nara.";


        pills.innerHTML = `

            <div class="hero-pill">
                🗓️ 18–22 Oct
            </div>

            <div class="hero-pill">
                ⛩️ Temples + Old Kyoto
            </div>

            <div class="hero-pill">
                🎋 Arashiyama
            </div>

            <div class="hero-pill">
                🍁 Autumn scenery
            </div>

        `;

    }

}
