/**
 * Smart TV & 10-Foot UI Detection and Spatial Navigation Handler
 * Supports Samsung Tizen, LG webOS, Android TV, Google TV, Apple TV, FireTV, Hisense VIDAA, etc.
 */

export const isTvDevice = (): boolean => {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;

  const ua = navigator.userAgent || "";
  
  // Specific Smart TV identifiers in User-Agent
  const tvKeywords = [
    "TV", "SmartTV", "Smart-TV", "Tizen", "Web0S", "WebOS", "VIDAA", "Vidaa",
    "Android TV", "AFTT", "AFTM", "AFTA", "AFTB", "FireTV", "HbbTV", "CrKey",
    "Roku", "AppleTV", "BRAVIA", "NetCast", "GoogleTV", "Opera TV", "Viera",
    "SmartHub", "Large Screen", "Kylo", "DuneHD", "MAG250", "MiTV", "Hisense",
    "TCL", "Philips", "SonyDTV", "LOEWE", "Vestel"
  ];

  const hasTvKeyword = tvKeywords.some((kw) =>
    new RegExp(kw, "i").test(ua)
  );

  if (hasTvKeyword) return true;

  // TV browsers with generic Linux/Android UA and 1080p/4K resolution with no touch
  if (
    typeof window !== "undefined" &&
    navigator.maxTouchPoints === 0 &&
    !('ontouchstart' in window) &&
    window.innerWidth >= 1920 &&
    window.innerHeight >= 1080 &&
    /Linux|Android|X11/i.test(ua)
  ) {
    return true;
  }

  return false;
};

export const isTvModeEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem("kami_tv_mode");
  if (stored !== null) {
    return stored === "true";
  }
  return isTvDevice();
};

export const setTvMode = (enabled: boolean) => {
  if (typeof document === "undefined") return;
  localStorage.setItem("kami_tv_mode", String(enabled));
  applyTvModeClass(enabled);
};

export const toggleTvMode = (): boolean => {
  const current = isTvModeEnabled();
  const next = !current;
  setTvMode(next);
  return next;
};

export const applyTvModeClass = (enabled: boolean) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const body = document.body;

  if (enabled) {
    root.classList.add("tv-mode");
    body.classList.add("tv-mode");
  } else {
    root.classList.remove("tv-mode");
    body.classList.remove("tv-mode");
  }
};

/**
 * Initialize TV Mode and D-Pad remote control spatial navigation
 */
export const initTvSystem = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const enabled = isTvModeEnabled();
  applyTvModeClass(enabled);

  // TV Remote Keycode Handler
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    const isTv = document.documentElement.classList.contains("tv-mode");
    
    // Tizen / WebOS Return / Back keys
    const backKeyCodes = [10009, 461, 27, 8];
    if (backKeyCodes.includes(e.keyCode) && isTv) {
      // If modal is open, or player in fullscreen, handle gracefully
      const activeModal = document.querySelector('[role="dialog"]');
      if (activeModal) {
        e.preventDefault();
        const closeBtn = activeModal.querySelector('button') as HTMLButtonElement | null;
        if (closeBtn) closeBtn.click();
      }
    }
  });
};
