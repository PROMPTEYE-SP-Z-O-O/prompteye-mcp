/** Headline visibility for a period, with the breakdown the tool was asked for. */
function trend(entries) {
  const points = entries.map((entry) => entry.metrics.visibility ?? 0);
  if (points.length < 2) return '<p class="empty">A trend needs at least two days in the period.</p>';

  const w = 640;
  const h = 150;
  const pad = 6;
  const max = Math.max(100, ...points);
  const x = (i) => (i / (points.length - 1)) * (w - pad * 2) + pad;
  const y = (v) => h - pad - (v / max) * (h - pad * 2);

  const line = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;

  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Visibility over time">
      <path d="${area}" fill="var(--brand)" opacity="0.14" />
      <path d="${line}" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
    <div class="sub" style="display:flex;justify-content:space-between;margin-top:4px">
      <span>${esc(entries[0].label)}</span><span>${esc(entries[entries.length - 1].label)}</span>
    </div>`;
}

function render(data) {
  if (!data || !data.totals) {
    empty("No visibility data in this result.");
    return;
  }

  const { totals, change, breakdown = [], by } = data;
  setContext(`${data.startDate} → ${data.endDate}`);

  const breakdownSection =
    breakdown.length === 0
      ? ""
      : `<section>
           <h2>${by === "day" ? "Trend" : by === "model" ? "By assistant" : "By prompt"}</h2>
           ${
             by === "day"
               ? trend(breakdown)
               : rows(
                   breakdown.map((entry) => ({
                     name: entry.label,
                     value: entry.metrics.visibility,
                     suffix: "%",
                   }))
                 )
           }
           ${data.breakdownTruncated ? '<p class="sub">Truncated — ask for a higher limit to see more.</p>' : ""}
         </section>`;

  root.innerHTML = `
    <h1>${esc(data.brand ?? "Visibility")}${data.projectName ? ` · ${esc(data.projectName)}` : ""}</h1>
    <div class="sub">${esc((data.models ?? []).join(", ") || "no assistants")}</div>
    <div class="tiles">
      ${tile("Visibility", totals.visibility, "%", change?.visibility, true)}
      ${tile("Reach index", totals.reachIndex, "", change?.reachIndex, true)}
      ${tile("Avg position", totals.averagePosition, "", change?.averagePosition, false)}
    </div>
    ${breakdownSection}`;
}
