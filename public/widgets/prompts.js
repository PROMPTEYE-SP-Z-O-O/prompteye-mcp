/** The prompts a project is tracked on, with what each one earned in the period. */
function render(data) {
  const prompts = data?.data ?? [];

  if (prompts.length === 0) {
    empty("No prompts match these filters. Add prompts or change the filters.");
    return;
  }

  const measured = prompts.filter(
    (prompt) => prompt.metrics?.visibility !== null && prompt.metrics?.visibility !== undefined
  );
  const average = measured.length
    ? Math.round((measured.reduce((sum, prompt) => sum + prompt.metrics.visibility, 0) / measured.length) * 10) / 10
    : null;
  const silent = prompts.filter((prompt) => (prompt.metrics?.visibility ?? 0) === 0).length;
  const max = Math.max(1, ...prompts.map((prompt) => prompt.metrics?.visibility ?? 0));

  const VISIBLE_ROWS = 10;
  const row = (prompt) => {
    const visibility = prompt.metrics?.visibility ?? 0;
    const change = prompt.change?.visibility;
    const chips = [
      prompt.status !== "active" ? `<span class="chip">${esc(prompt.status)}</span>` : "",
      prompt.businessPriority ? `<span class="chip brand">${esc(prompt.businessPriority)}</span>` : "",
      ...(prompt.categories ?? []).slice(0, 2).map((category) => `<span class="chip">${esc(category)}</span>`),
    ].join("");

    return `<div class="row stacked">
      <div>
        <div class="row-name" title="${esc(prompt.prompt)}">${esc(prompt.prompt)}</div>
        ${chips ? `<div class="row-sub">${chips}</div>` : ""}
      </div>
      <div class="track"><div class="fill other" style="width:${Math.max(2, (visibility / max) * 100)}%"></div></div>
      <div class="row-value">
        <strong>${esc(fmt(prompt.metrics?.visibility, "%"))}</strong>
        ${
          change === null || change === undefined
            ? ""
            : `<div class="delta ${change === 0 ? "flat" : change > 0 ? "up" : "down"}">${
                change > 0 ? "+" : ""
              }${change} pp</div>`
        }
      </div>
    </div>`;
  };
  const visible = prompts.slice(0, VISIBLE_ROWS).map(row).join("");
  const hidden = prompts.slice(VISIBLE_ROWS).map(row).join("");

  root.innerHTML = `
    <h1>${esc(data.projectName ?? data.brand ?? "Prompts")}</h1>
    <div class="sub">${prompts.length} prompt(s)${
      data.nextCursor ? ", first page" : ""
    } · ranked as the API returns them, newest first</div>
    <div class="tiles">
      ${tile("Prompts", prompts.length, "", null)}
      ${tile("Average visibility", average, "%", null)}
      ${tile("Never named", silent, "", null)}
    </div>
    <section>
      <h2>Visibility per prompt</h2>
      <div class="rows">${visible}</div>
      ${
        hidden
          ? `<details style="margin-top:7px"><summary class="sub">Show all (${prompts.length})</summary><div class="rows" style="margin-top:7px">${hidden}</div></details>`
          : ""
      }
      ${data.nextCursor ? '<p class="sub" style="margin-top:8px">More prompts follow on the next page.</p>' : ""}
    </section>`;
  root.querySelector("details")?.addEventListener("toggle", reportSize);
}
