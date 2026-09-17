/** Brands answering alongside the project's own, ranked by share of voice. */
function render(data) {
  const brands = data?.data ?? [];
  setContext(data?.startDate ? `${data.startDate} → ${data.endDate}` : "");

  if (brands.length === 0) {
    empty("No brands were named on these prompts in this period.");
    return;
  }

  const own = brands.find((brand) => brand.ownBrand);
  const rank = own ? brands.indexOf(own) + 1 : null;
  const leader = brands[0];

  const headline = own
    ? `${own.brand} holds ${fmt(own.shareOfVoice, "%")} of the naming, ${
        rank === 1 ? "ahead of everyone" : `behind ${esc(leader.brand)} at ${fmt(leader.shareOfVoice, "%")}`
      }.`
    : `${esc(leader.brand)} leads with ${fmt(leader.shareOfVoice, "%")} of the naming.`;

  root.innerHTML = `
    <h1>${esc(data.brand ?? "Share of voice")}${data.model ? ` · ${esc(data.model)}` : ""}</h1>
    <div class="sub">${headline}</div>
    ${
      own
        ? `<div class="tiles">
             ${tile("Share of voice", own.shareOfVoice, "%", null, true)}
             ${tile("Visibility", own.metrics?.visibility, "%", own.change?.visibility, true)}
             ${tile("Avg position", own.metrics?.averagePosition, "", own.change?.averagePosition, false)}
           </div>`
        : ""
    }
    <section>
      <h2>Ranked by share of voice</h2>
      ${rows(
        brands.map((brand) => ({
          name: brand.brand,
          own: brand.ownBrand,
          value: brand.shareOfVoice,
          suffix: "%",
          note: brand.citations === null || brand.citations === undefined ? "" : `· ${brand.citations} cited`,
        }))
      )}
    </section>`;
}
