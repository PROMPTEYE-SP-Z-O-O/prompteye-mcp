/** The prompts a project is tracked on, with what each one earned in the period. */
function render(data) {
  const prompts = data?.data ?? [];
  setContext(data?.startDate ? `${data.startDate} → ${data.endDate}` : "");

  if (prompts.length === 0) {
    empty("No prompts match this filter.");
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

  const list = prompts
    .map((prompt) => {
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
    })
    .join("");

  root.innerHTML = `
    <h1>${esc(data.projectName ?? data.brand ?? "Prompts")}</h1>
    <div class="sub">${prompts.length} prompt(s)${
      data.nextCursor ? ", first page" : ""
    } · ranked as the API returns them, newest first</div>
    <div class="tiles">
      ${tile("Prompts", prompts.length, "", null, true)}
      ${tile("Average visibility", average, "%", null, true)}
      ${tile("Never named", silent, "", null, false)}
    </div>
    <section>
      <h2>Visibility per prompt</h2>
      <div class="rows">${list}</div>
      ${data.nextCursor ? '<p class="sub" style="margin-top:8px">More prompts follow on the next page.</p>' : ""}
    </section>`;
}
