(() => {
  "use strict";

  const enhanceHeader = () => {
    const header = document.querySelector("header.site");
    const inner = header ? header.querySelector(".inner") : null;
    const title = inner ? inner.querySelector(".title") : null;
    const nav = inner ? inner.querySelector("nav") : null;

    if (!header || !inner || !title || !nav || header.hasAttribute("data-site-nav-ready")) {
      return;
    }

    if (!nav.id) nav.id = "site-navigation";
    nav.setAttribute("aria-label", nav.getAttribute("aria-label") || "Primary navigation");
    nav.querySelectorAll("a.here").forEach((link) => {
      link.setAttribute("aria-current", "page");
    });

    const button = document.createElement("button");
    button.className = "site-nav-toggle";
    button.type = "button";
    button.setAttribute("aria-controls", nav.id);

    const label = document.createElement("span");
    label.className = "site-nav-toggle-label";
    button.append(label);

    const setOpen = (open, returnFocus = false) => {
      nav.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      label.textContent = open ? "Close" : "Menu";
      header.toggleAttribute("data-site-nav-open", open);
      if (returnFocus) button.focus();
    };

    setOpen(false);
    title.insertAdjacentElement("afterend", button);
    header.setAttribute("data-site-nav-ready", "");

    button.addEventListener("click", () => {
      setOpen(button.getAttribute("aria-expanded") !== "true");
    });

    nav.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && button.getAttribute("aria-expanded") === "true") {
        event.preventDefault();
        setOpen(false, true);
      }
    });

    window.addEventListener("pageshow", () => setOpen(false));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhanceHeader, { once: true });
  } else {
    enhanceHeader();
  }
})();
