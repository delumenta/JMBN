
// =====================================================
// JAPAN TRIP — GOOGLE MAPS / PLACES
// =====================================================
//
// Shared Google Maps loader for:
// - food.html
// - schedule.html
// - other future pages
//
// IMPORTANT:
// Replace the placeholder below with your NEW
// restricted Google Maps browser API key.
//
// =====================================================

const GOOGLE_MAPS_API_KEY = "AIzaSyD1tFdxoch8ihGkoLA7OYoEuG2k93CGi80";


// =====================================================
// INTERNAL STATE
// =====================================================

let googleMapsPromise = null;
let googlePlacesPromise = null;


// =====================================================
// LOAD GOOGLE MAPS JAVASCRIPT API
// =====================================================

function loadGoogleMaps() {

  // Already loaded
  if (
    window.google &&
    window.google.maps &&
    typeof window.google.maps.importLibrary === "function"
  ) {
    return Promise.resolve(window.google.maps);
  }


  // Already loading
  if (googleMapsPromise) {
    return googleMapsPromise;
  }


  googleMapsPromise = new Promise((resolve, reject) => {

    // Unique callback used by Google
    const callbackName = "__japanTripGoogleMapsReady";


    // ---------------------------------------------
    // GOOGLE CALLBACK
    // ---------------------------------------------

    window[callbackName] = function () {

      try {

        if (
          window.google &&
          window.google.maps &&
          typeof window.google.maps.importLibrary === "function"
        ) {

          resolve(window.google.maps);

        } else {

          googleMapsPromise = null;

          reject(
            new Error(
              "Google Maps loaded, but importLibrary() is unavailable."
            )
          );

        }

      } catch (error) {

        googleMapsPromise = null;
        reject(error);

      }

    };


    // ---------------------------------------------
    // CREATE GOOGLE SCRIPT
    // ---------------------------------------------

    const script = document.createElement("script");

    script.src =
      "https://maps.googleapis.com/maps/api/js" +
      "?key=" + encodeURIComponent(GOOGLE_MAPS_API_KEY) +
      "&v=weekly" +
      "&loading=async" +
      "&callback=" + callbackName;

    script.async = true;


    // ---------------------------------------------
    // SCRIPT FAILED
    // ---------------------------------------------

    script.onerror = function () {

      googleMapsPromise = null;

      reject(
        new Error(
          "Google Maps JavaScript API could not be loaded. " +
          "Check the API key, website restrictions, enabled APIs and billing."
        )
      );

    };


    // ---------------------------------------------
    // ADD SCRIPT TO PAGE
    // ---------------------------------------------

    document.head.appendChild(script);

  });


  return googleMapsPromise;
}


// =====================================================
// LOAD GOOGLE PLACES
// =====================================================
//
// Usage:
//
// const places = await getGooglePlaces();
//
// =====================================================

function getGooglePlaces() {

  // Don't import Places more than once
  if (googlePlacesPromise) {
    return googlePlacesPromise;
  }


  googlePlacesPromise = (async function () {

    // First make sure Maps is ready
    await loadGoogleMaps();


    // Then load Places
    const places =
      await google.maps.importLibrary("places");


    if (!places) {

      googlePlacesPromise = null;

      throw new Error(
        "Google Places library could not be loaded."
      );

    }


    return places;

  })();


  return googlePlacesPromise;
}


// =====================================================
// CREATE GOOGLE PLACE AUTOCOMPLETE
// =====================================================
//
// Optional helper.
//
// Example:
//
// const autocomplete =
//   await createGooglePlaceAutocomplete(
//     document.getElementById("googlePlaceSearch")
//   );
//
// =====================================================

async function createGooglePlaceAutocomplete(
  container,
  options = {}
) {

  if (!container) {

    throw new Error(
      "Autocomplete container was not found."
    );

  }


  const places =
    await getGooglePlaces();


  if (
    typeof places.PlaceAutocompleteElement !== "function"
  ) {

    throw new Error(
      "PlaceAutocompleteElement is unavailable."
    );

  }


  // Clear anything previously inside
  container.innerHTML = "";


  // Create Google's autocomplete element
  const autocomplete =
    new places.PlaceAutocompleteElement();


  autocomplete.placeholder =
    options.placeholder ||
    "Search places in Japan...";


  // ---------------------------------------------
  // JAPAN RESTRICTION
  // ---------------------------------------------
  //
  // Restrict autocomplete results to Japan.
  //
  // "jp" = Japan
  //

  try {

    autocomplete.includedRegionCodes = ["jp"];

  } catch (error) {

    console.warn(
      "Could not apply Japan region restriction:",
      error
    );

  }


  container.appendChild(autocomplete);


  return autocomplete;
}


// =====================================================
// GET PLACE DETAILS
// =====================================================
//
// Pass the gmp-select event:
//
// const place = await getGooglePlaceDetails(event);
//
// =====================================================

async function getGooglePlaceDetails(event) {

  if (!event) {

    throw new Error(
      "Google Places selection event is missing."
    );

  }


  const prediction =
    event.placePrediction;


  if (!prediction) {

    throw new Error(
      "Google Places did not return a place prediction."
    );

  }


  const place =
    prediction.toPlace();


  await place.fetchFields({

    fields: [

      "id",
      "displayName",
      "formattedAddress",
      "addressComponents",
      "googleMapsURI",
      "websiteURI",
      "location",
      "types"

    ]

  });


  return place;
}


// =====================================================
// ADDRESS HELPER
// =====================================================
//
// Makes it easier for food.html / schedule.html
// to retrieve city / prefecture / ward etc.
//
// =====================================================

function getGoogleAddressComponent(
  place,
  type
) {

  if (
    !place ||
    !Array.isArray(place.addressComponents)
  ) {

    return "";

  }


  const component =
    place.addressComponents.find(item =>
      Array.isArray(item.types) &&
      item.types.includes(type)
    );


  if (!component) {
    return "";
  }


  return (
    component.longText ||
    component.shortText ||
    ""
  );
}


// =====================================================
// GOOGLE PLACE → SIMPLE OBJECT
// =====================================================
//
// Converts Google's Place object into something
// easier for our website to use.
//
// =====================================================

function normalizeGooglePlace(place) {

  if (!place) {
    return null;
  }


  const city =
    getGoogleAddressComponent(
      place,
      "locality"
    ) ||

    getGoogleAddressComponent(
      place,
      "administrative_area_level_2"
    );


  const area =
    getGoogleAddressComponent(
      place,
      "sublocality_level_1"
    ) ||

    getGoogleAddressComponent(
      place,
      "sublocality"
    ) ||

    getGoogleAddressComponent(
      place,
      "administrative_area_level_3"
    );


  const prefecture =
    getGoogleAddressComponent(
      place,
      "administrative_area_level_1"
    );


  let latitude = null;
  let longitude = null;


  if (place.location) {

    try {

      latitude =
        typeof place.location.lat === "function"
          ? place.location.lat()
          : place.location.lat;


      longitude =
        typeof place.location.lng === "function"
          ? place.location.lng()
          : place.location.lng;

    } catch (error) {

      console.warn(
        "Could not read Google coordinates:",
        error
      );

    }

  }


  return {

    google_place_id:
      place.id || "",

    name:
      place.displayName || "",

    address:
      place.formattedAddress || "",

    city:
      city || "",

    area:
      area || "",

    prefecture:
      prefecture || "",

    maps_url:
      place.googleMapsURI || "",

    website_url:
      place.websiteURI || "",

    latitude:
      latitude,

    longitude:
      longitude,

    types:
      Array.isArray(place.types)
        ? place.types
        : []

  };
}


// =====================================================
// EXPOSE FUNCTIONS TO HTML PAGES
// =====================================================
//
// This is important.
//
// food.html / schedule.html can now access these
// functions through window.
//
// =====================================================

window.loadGoogleMaps =
  loadGoogleMaps;

window.getGooglePlaces =
  getGooglePlaces;

window.createGooglePlaceAutocomplete =
  createGooglePlaceAutocomplete;

window.getGooglePlaceDetails =
  getGooglePlaceDetails;

window.getGoogleAddressComponent =
  getGoogleAddressComponent;

window.normalizeGooglePlace =
  normalizeGooglePlace;


// =====================================================
// READY
// =====================================================

console.log(
  "Japan Trip Google Maps helper loaded."
);
