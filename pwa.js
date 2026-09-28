(() => {
  const isStandalone = () =>
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;

  let deferredPrompt = null;
  let installButton = null;
  let installToast = null;

  function ensureInstallUI(){
    if(installButton) return;

    const style = document.createElement("style");
    style.textContent = `
      #travelPwaInstall{
        position:fixed;
        right:16px;
        bottom:calc(92px + env(safe-area-inset-bottom));
        z-index:9998;
        display:none;
        align-items:center;
        gap:8px;
        min-height:42px;
        padding:0 14px;
        border:1px solid rgba(255,107,104,.42);
        border-radius:999px;
        background:rgba(12,18,23,.96);
        color:#f7f4ef;
        box-shadow:0 12px 34px rgba(0,0,0,.38);
        backdrop-filter:blur(12px);
        -webkit-backdrop-filter:blur(12px);
        font:800 10px/1 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        letter-spacing:.08em;
        cursor:pointer;
        -webkit-tap-highlight-color:transparent;
      }

      #travelPwaInstall.show{
        display:flex;
      }

      #travelPwaInstall .pwa-install-mark{
        width:22px;
        height:22px;
        display:grid;
        place-items:center;
        border-radius:50%;
        background:rgba(255,107,104,.13);
        color:#ff7774;
        font-size:16px;
        line-height:1;
      }

      #travelPwaToast{
        position:fixed;
        left:50%;
        bottom:calc(94px + env(safe-area-inset-bottom));
        z-index:10000;
        max-width:calc(100vw - 32px);
        transform:translate(-50%,14px);
        padding:11px 14px;
        border:1px solid rgba(255,255,255,.10);
        border-radius:12px;
        background:rgba(14,21,27,.97);
        color:#f7f4ef;
        opacity:0;
        pointer-events:none;
        box-shadow:0 14px 36px rgba(0,0,0,.42);
        transition:opacity .18s ease,transform .18s ease;
        font:700 11px/1.35 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        text-align:center;
      }

      #travelPwaToast.show{
        opacity:1;
        transform:translate(-50%,0);
      }

      @media (display-mode: standalone){
        #travelPwaInstall{
          display:none !important;
        }
      }
    `;
    document.head.appendChild(style);

    installButton = document.createElement("button");
    installButton.id = "travelPwaInstall";
    installButton.type = "button";
    installButton.setAttribute("aria-label","Install Travel app");
    installButton.innerHTML =
      '<span class="pwa-install-mark" aria-hidden="true">↓</span><span>INSTALL APP</span>';

    installToast = document.createElement("div");
    installToast.id = "travelPwaToast";
    installToast.setAttribute("role","status");
    installToast.setAttribute("aria-live","polite");

    document.body.appendChild(installButton);
    document.body.appendChild(installToast);

    installButton.addEventListener("click", async () => {
      const installed = await window.travelPWA.install();

      if(installed){
        showToast("Travel installed. You can open it from your apps.");
      }
    });
  }

  function showInstallButton(){
    ensureInstallUI();

    if(!isStandalone() && deferredPrompt){
      installButton?.classList.add("show");
    }
  }

  function hideInstallButton(){
    installButton?.classList.remove("show");
  }

  function showToast(message){
    ensureInstallUI();

    if(!installToast) return;

    installToast.textContent = message;
    installToast.classList.add("show");

    window.setTimeout(() => {
      installToast?.classList.remove("show");
    }, 3500);
  }

  window.travelPWA = {
    isStandalone: isStandalone(),
    canInstall: false,

    async install(){
      if(isStandalone()){
        hideInstallButton();
        return true;
      }

      if(!deferredPrompt){
        showToast("Use Chrome menu → Install and create shortcut → Install.");
        return false;
      }

      const prompt = deferredPrompt;
      deferredPrompt = null;
      this.canInstall = false;
      hideInstallButton();

      await prompt.prompt();

      const choice = await prompt.userChoice;
      const accepted = choice?.outcome === "accepted";

      if(!accepted){
        return false;
      }

      return true;
    }
  };

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();

    deferredPrompt = event;
    window.travelPWA.canInstall = true;

    showInstallButton();

    window.dispatchEvent(
      new CustomEvent("travel:pwa-install-ready")
    );
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.travelPWA.canInstall = false;
    window.travelPWA.isStandalone = true;

    hideInstallButton();
    showToast("Travel installed successfully.");

    window.dispatchEvent(
      new CustomEvent("travel:pwa-installed")
    );
  });

  const registerServiceWorker = async () => {
    if(!("serviceWorker" in navigator)) return;

    try{
      const registration =
        await navigator.serviceWorker.register(
          "/onthego/service-worker.js",
          { scope:"/onthego/" }
        );

      await registration.update();
    }
    catch(error){
      console.warn("Travel PWA service worker:", error);
    }
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", () => {
      ensureInstallUI();

      if(deferredPrompt){
        showInstallButton();
      }
    }, { once:true });
  }
  else{
    ensureInstallUI();

    if(deferredPrompt){
      showInstallButton();
    }
  }

  if(document.readyState === "complete"){
    registerServiceWorker();
  }
  else{
    window.addEventListener("load", registerServiceWorker, { once:true });
  }
})();
