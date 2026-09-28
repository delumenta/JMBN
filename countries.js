(() => {
  const countries = [
    "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria","Azerbaijan",
    "Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi",
    "Cambodia","Cameroon","Canada","Cape Verde","Central African Republic","Chad","Chile","China","Colombia","Comoros","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic",
    "Democratic Republic of the Congo","Denmark","Djibouti","Dominica","Dominican Republic",
    "Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia",
    "Fiji","Finland","France",
    "Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana",
    "Haiti","Honduras","Hong Kong","Hungary",
    "Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy",
    "Jamaica","Japan","Jordan",
    "Kazakhstan","Kenya","Kiribati","Kosovo","Kuwait","Kyrgyzstan",
    "Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg",
    "Macau","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar",
    "Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway",
    "Oman",
    "Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal",
    "Qatar",
    "Republic of the Congo","Romania","Russia","Rwanda",
    "Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria",
    "Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu",
    "Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan",
    "Vanuatu","Vatican City","Venezuela","Vietnam",
    "Yemen","Zambia","Zimbabwe"
  ];

  const aliases = {
    "america":"United States",
    "britain":"United Kingdom",
    "brunei darussalam":"Brunei",
    "burma":"Myanmar",
    "czechia":"Czech Republic",
    "england":"United Kingdom",
    "hong kong sar china":"Hong Kong",
    "korea":"South Korea",
    "lao pdr":"Laos",
    "macao":"Macau",
    "macao sar china":"Macau",
    "republic of korea":"South Korea",
    "russian federation":"Russia",
    "south korea":"South Korea",
    "taipei":"Taiwan",
    "the netherlands":"Netherlands",
    "uae":"United Arab Emirates",
    "u.a.e.":"United Arab Emirates",
    "uk":"United Kingdom",
    "u.k.":"United Kingdom",
    "united states of america":"United States",
    "usa":"United States",
    "u.s.a.":"United States",
    "us":"United States",
    "u.s.":"United States",
    "viet nam":"Vietnam"
  };

  function clean(value){
    return String(value ?? "").trim().replace(/\s+/g," ");
  }

  function key(value){
    return clean(value).toLowerCase();
  }

  const countryMap = new Map(countries.map(name => [key(name), name]));

  function canonicalCountryName(value){
    const cleaned = clean(value);
    if(!cleaned) return null;
    const normalized = key(cleaned);
    return countryMap.get(normalized) || aliases[normalized] || null;
  }

  function mountCountryDatalist(inputId, listId="travelCountryOptions"){
    const input = document.getElementById(inputId);
    if(!input) return;

    let list = document.getElementById(listId);
    if(!list){
      list = document.createElement("datalist");
      list.id = listId;
      list.innerHTML = countries.map(name => `<option value="${name}"></option>`).join("");
      document.body.appendChild(list);
    }

    input.setAttribute("list", listId);
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");

    input.addEventListener("change", () => {
      const canonical = canonicalCountryName(input.value);
      if(canonical) input.value = canonical;
    });
  }

  window.TRAVEL_COUNTRIES = Object.freeze(countries.slice());
  window.canonicalCountryName = canonicalCountryName;
  window.mountCountryDatalist = mountCountryDatalist;
})();