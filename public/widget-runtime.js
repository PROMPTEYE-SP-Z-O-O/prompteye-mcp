(() => {
  const root = document.getElementById("root");
  const contextEl = document.getElementById("context");

  const esc = (value) =>
    String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /** Renders a number, keeping null legible as "no data". */
  const fmt = (value, suffix = "") => (value === null || value === undefined ? "—" : `${value}${suffix}`);

  const setContext = (text) => {
    contextEl.textContent = text ?? "";
  };

  function delta(value, suffix) {
    if (value === null || value === undefined) return '<div class="delta flat">no prior period</div>';
    const cls = value === 0 ? "flat" : value > 0 ? "up" : "down";
    return `<div class="delta ${cls}">${value > 0 ? "+" : ""}${value}${suffix} vs previous period</div>`;
  }

  function tile(label, value, suffix, change) {
    return `<div class="tile">
      <div class="label">${esc(label)}</div>
      <div class="value">${esc(fmt(value, suffix))}</div>
      ${delta(change, suffix === "%" ? " pp" : "")}
    </div>`;
  }

  /** One ranked bar per entry: { name, own, value, suffix, note }. */
  function rows(entries) {
    const max = Math.max(1, ...entries.map((entry) => entry.value ?? 0));

    return `<div class="rows">${entries
      .map((entry) => {
        const value = entry.value ?? 0;
        return `<div class="row">
          <div class="row-name" title="${esc(entry.name)}">${esc(entry.name)}${
            entry.own ? ' <span class="tag">· yours</span>' : ""
          }</div>
          <div class="track">
            <div class="fill ${entry.own ? "own" : "other"}" style="width:${Math.max(2, (value / max) * 100)}%"></div>
          </div>
          <div class="row-value"><strong>${esc(fmt(entry.value, entry.suffix ?? ""))}</strong>${
            entry.note ? ` ${esc(entry.note)}` : ""
          }</div>
        </div>`;
      })
      .join("")}</div>`;
  }

  const empty = (message) => {
    root.innerHTML = `<p class="empty">${esc(message)}</p>`;
  };

  {{RENDER}}

  function show(data) {
    try {
      render(data);
    } catch (error) {
      empty("This result could not be rendered.");
    }
    reportSize();
  }

  function applyTheme(theme) {
    if (theme !== "dark" && theme !== "light") return;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  }

  /*
   * ChatGPT's Apps SDK hands the widget its data on `window.openai` and
   * refreshes it by dispatching `openai:set_globals`. Claude speaks the MCP
   * Apps handshake below instead; both paths end in the same `show`.
   */
  if (window.openai) {
    applyTheme(window.openai.theme);
    if (window.openai.toolOutput) show(window.openai.toolOutput);

    window.addEventListener("openai:set_globals", (event) => {
      const globals = event.detail?.globals ?? window.openai ?? {};
      if (globals.theme) applyTheme(globals.theme);
      if (globals.toolOutput) show(globals.toolOutput);
    });
  }

  /*
   * The MCP Apps handshake, spoken directly over postMessage.
   *
   * The ext-apps `App` class does this for us, but it is an npm module and
   * this widget ships as one self-contained file with no build step — so the
   * four messages it needs are written out here:
   *   → ui/initialize (request)          ← host result
   *   → ui/notifications/initialized     ← ui/notifications/tool-result
   */
  const PROTOCOL_VERSION = "2026-01-26";
  let nextId = 1;
  const send = (message) => window.parent.postMessage({ jsonrpc: "2.0", ...message }, "*");

  let lastHeight = 0;
  function reportSize() {
    const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (height === lastHeight) return;
    lastHeight = height;
    send({ method: "ui/notifications/size-changed", params: { width: Math.ceil(window.innerWidth), height } });
  }

  const initializeId = nextId++;

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message?.jsonrpc !== "2.0") return;

    if (message.id === initializeId && message.result) {
      applyTheme(message.result.hostContext?.theme);
      send({ method: "ui/notifications/initialized" });
      reportSize();
      return;
    }

    if (message.method === "ui/notifications/tool-result") {
      show(message.params?.structuredContent);
      return;
    }

    if (message.method === "ui/notifications/host-context-changed") {
      applyTheme(message.params?.theme);
      return;
    }

    // The host pings to check the app is alive; an unanswered ping tears it down.
    if (message.method === "ping" && message.id !== undefined) {
      send({ id: message.id, result: {} });
    }
  });

  send({
    id: initializeId,
    method: "ui/initialize",
    params: {
      appInfo: { name: "{{APP}}", version: "1.0.0" },
      appCapabilities: {},
      protocolVersion: PROTOCOL_VERSION,
    },
  });
})();
