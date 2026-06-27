(() => {
  "use strict";

  if (window.hljs) {
    window.hljs.highlightAll();
  }

  const sidebarStorageKey = "rod.docs.sidebar.open";
  const wrapStorageKey = "rod.docs.code.wrap";
  const toggle = document.querySelector("[data-sidebar-toggle]");
  const sidebar = document.querySelector("[data-doc-sidebar]");
  const scrim = document.querySelector("[data-sidebar-close]");

  function setSidebarOpen(open) {
    document.documentElement.classList.toggle("sidebar-open", open);

    if (toggle) {
      toggle.setAttribute("aria-expanded", String(open));
    }

    try {
      window.localStorage.setItem(sidebarStorageKey, open ? "1" : "0");
    } catch {}
  }

  if (toggle && sidebar) {
    toggle.addEventListener("click", () => {
      setSidebarOpen(!document.documentElement.classList.contains("sidebar-open"));
    });

    if (scrim) {
      scrim.addEventListener("click", () => setSidebarOpen(false));
    }

    for (const link of sidebar.querySelectorAll("a")) {
      link.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 980px)").matches) {
          setSidebarOpen(false);
        }
      });
    }

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    });
  }

  function setCodeFrameWrap(frame, enabled) {
    frame.dataset.wrap = enabled ? "true" : "false";

    const button = frame.querySelector("[data-code-wrap]");
    if (button) {
      button.setAttribute("aria-pressed", String(enabled));
    }
  }

  let initialWrap = false;

  try {
    initialWrap = window.localStorage.getItem(wrapStorageKey) === "1";
  } catch {}

  for (const frame of document.querySelectorAll("[data-code-frame]")) {
    setCodeFrameWrap(frame, initialWrap);

    const wrapButton = frame.querySelector("[data-code-wrap]");
    const copyButton = frame.querySelector("[data-code-copy]");
    const copyLabel = frame.querySelector("[data-copy-label]");
    const code = frame.querySelector("code");

    if (wrapButton) {
      wrapButton.addEventListener("click", () => {
        const enabled = frame.dataset.wrap !== "true";

        setCodeFrameWrap(frame, enabled);

        try {
          window.localStorage.setItem(wrapStorageKey, enabled ? "1" : "0");
        } catch {}
      });
    }

    if (copyButton && code) {
      copyButton.addEventListener("click", async () => {
        const text = code.textContent || "";

        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const textarea = document.createElement("textarea");

          textarea.value = text;
          textarea.setAttribute("readonly", "");
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          textarea.style.pointerEvents = "none";

          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          textarea.remove();
        }

        copyButton.classList.add("copied");

        if (copyLabel) {
          copyLabel.textContent = "Copied";
        }

        window.setTimeout(() => {
          copyButton.classList.remove("copied");

          if (copyLabel) {
            copyLabel.textContent = "Copy";
          }
        }, 1400);
      });
    }
  }

  for (const input of document.querySelectorAll("[data-doc-search]")) {
    input.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();

      for (const node of document.querySelectorAll(".searchable-content, .example-block, .side-list a, .portal-links a")) {
        const visible = !query || node.textContent.toLowerCase().includes(query);
        node.hidden = !visible;
      }
    });
  }
})();
