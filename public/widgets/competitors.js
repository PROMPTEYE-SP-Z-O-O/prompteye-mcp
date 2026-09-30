/** Brands answering alongside the project's own, ranked by visibility, then position. */
function render(data) {
  const brands = data?.data ?? [];

  if (brands.length === 0) {
    empty("No brands were named on these prompts in this period.");
    return;
  }

  const own = brands.find((brand) => brand.ownBrand);
  const rank = own ? brands.indexOf(own) + 1 : null;
  const leader = brands[0];

  const headline = own
    ? `${own.brand} holds ${fmt(own.shareOfVoice, "%")} of the naming, ${
        rank === 1 ? "first by visibility" : `behind ${esc(leader.brand)}, first by visibility at ${fmt(leader.metrics?.visibility, "%")}`
      }.`
    : `${esc(leader.brand)} comes first by visibility, at ${fmt(leader.metrics?.visibility, "%")}.`;

  root.innerHTML = `
    <h1>${esc(data.brand ?? "Share of voice")}${data.model ? ` · ${esc(data.model)}` : ""}</h1>
    <div class="sub">${headline}</div>
    ${
      own
        ? `<div class="tiles">
             ${tile("Share of voice", own.shareOfVoice, "%", null)}
             ${tile("Visibility", own.metrics?.visibility, "%", own.change?.visibility)}
             ${tile("Avg position", own.metrics?.averagePosition, "", own.change?.averagePosition)}
           </div>`
        : ""
    }
    <section>
      <h2>Share of voice, ranked by visibility, then position</h2>
      ${rows(
        brands.map((brand) => ({
          name: brand.brand,
          own: brand.ownBrand,
          value: brand.shareOfVoice,
          suffix: "%",
          note: brand.citedAnswers === null || brand.citedAnswers === undefined ? "" : `· cited in ${brand.citedAnswers} answer(s)`,
        }))
      )}
    </section>`;
}
