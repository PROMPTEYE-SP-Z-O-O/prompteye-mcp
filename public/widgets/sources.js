/** The domains the assistants leaned on, ranked by how often they were cited. */
function render(data) {
  const domains = data?.data ?? [];
  setContext(data?.startDate ? `${data.startDate} → ${data.endDate}` : "");

  if (domains.length === 0) {
    empty("No domains were cited on these prompts in this period.");
    return;
  }

  const ownShare = domains
    .filter((domain) => domain.ownDomain)
    .reduce((sum, domain) => sum + (domain.share ?? 0), 0);
  const total = domains.reduce((sum, domain) => sum + (domain.citations ?? 0), 0);

  root.innerHTML = `
    <h1>Cited sources${data.brand ? ` · ${esc(data.brand)}` : ""}${data.model ? ` · ${esc(data.model)}` : ""}</h1>
    <div class="sub">
      ${
        ownShare > 0
          ? `Own pages carry ${fmt(Math.round(ownShare * 10) / 10, "%")} of the citations — the rest of the story is told elsewhere.`
          : "No citation went to the project's own pages in this period."
      }
    </div>
    <section>
      <h2>${domains.length} domain(s), ${total} citation(s)</h2>
      ${rows(
        domains.map((domain) => ({
          name: domain.domain,
          own: domain.ownDomain,
          value: domain.share,
          suffix: "%",
          note: `· ${domain.citations} cited`,
        }))
      )}
    </section>`;
}
