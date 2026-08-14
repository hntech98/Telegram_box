(function () {
  const SUN = '<circle cx="12" cy="12" r="5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1.5" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22.5"/><line x1="1.5" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22.5" y2="12"/><line x1="4.5" y1="4.5" x2="6.2" y2="6.2"/><line x1="17.8" y1="17.8" x2="19.5" y2="19.5"/><line x1="4.5" y1="19.5" x2="6.2" y2="17.8"/><line x1="17.8" y1="6.2" x2="19.5" y2="4.5"/></g>';
  const MOON = '<path fill="currentColor" d="M20.6 15.5A8.5 8.5 0 0 1 9.5 4.4a.8.8 0 0 0-1-1A10 10 0 1 0 22 16.5a.8.8 0 0 0-1.4-1z"/>';

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const iconEl = document.getElementById("theme-icon");
    if (iconEl) iconEl.innerHTML = theme === "dark" ? SUN : MOON;
    localStorage.setItem("theme", theme);
  }

  function initTheme() {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    const btn = document.getElementById("theme-toggle");
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      applyTheme(current === "dark" ? "light" : "dark");
    });
  });
})();
