/**
 * What the host is told about this server the moment it connects, before any
 * tool is called.
 *
 * Tool descriptions explain one call each; nothing there answers "what can I do
 * with this?", which is the first thing a user asks after installing. This does,
 * and it says plainly what PromptEye cannot do through the API yet, so nobody is
 * promised a button that is not there.
 */
export const SERVER_INSTRUCTIONS = `PromptEye measures how often AI assistants name a brand when they answer buying questions, and which sources they lean on while doing it.

WHEN THE USER ASKS WHAT THEY CAN DO, WHERE TO START, WHERE THEY STAND, OR WHAT TO DO NEXT — call get_started first. It reads the workspace and answers from its actual state instead of a generic list. Never answer those questions from this text alone.

How the product works, in order:

1. The project. One brand tracked in one market; the same brand in another market is a second project. Everything else hangs off it. list_projects, select_project, create_project.

2. The brand description (get_knowledge_base, update_knowledge_base). What the company sells and to whom — industry, product category, audience, ICP, operating area. Everything PromptEye writes for the project reads this first, so a thin or wrong description quietly poisons the prompts it proposes. Fixing it is the highest-leverage edit in the product, and it can be done from here.

3. The prompts. These are the questions put to the assistants every run — the unit everything is measured on. PromptEye generates them from real demand and from the way people actually put questions to assistants, then proposes them with the funnel stage they fill, the demand behind them and how well they fit the brand: list_prompt_suggestions. Accepting a suggestion happens in the app. add_prompts exists for prompts the user already has and must track verbatim — it skips the demand, duplicate and fit checks, so it is not the way to "add a few ideas".

4. The measurement. list_prompts carries what each prompt earned over a period and how it moved; list_competitors ranks the brands answering alongside; list_sources ranks the domains the assistants cited. list_prompt_groups and list_categories are how prompts are organised, and a group is the unit analysis happens in.

5. What came of it. get_google_status, get_search_performance and get_ai_traffic report Google's own record of the project's site: Search Console clicks, impressions and positions, and the Google Analytics sessions whose referrer was an AI assistant. This answers a different question from visibility — visibility counts the answers that named the brand, this counts the people who then arrived — and it undercounts by design, because an assistant that names a brand without linking it sends nobody and somebody who reads an answer and then types the domain arrives as direct traffic. Both integrations are bound to the project in the app; a project with nothing bound answers with zeros, so read get_google_status before treating a zero as a finding.

6. Whether the assistants can read the site at all. list_bot_visits and count_bot_visits report the requests AI assistants and search engines made to it; list_crawls says what each bot has ever fetched, and get_sitemap what the site offers for reading. An assistant can only quote a page its bot managed to fetch, so a 4xx served to chatgpt-user is a citation that did not happen, and a page no bot has ever fetched cannot be quoted however well it is written. count_bot_visits with groupBy=status is the health check; an address in get_sitemap with no row in list_crawls is a page published into silence — comparing the two is your job, no tool does it for you. Every request is marked verified or not, because a User-Agent is free text anybody can send and the API cannot filter on it, so treat any count as an upper bound and say so rather than quoting it flat. These endpoints read 31 days at a time, not a year.

There is a second surface next to tracking: public reports, PromptEye's lead magnet, sold to agencies white-label. create_report generates a one-off visibility report for any brand and emails it, and the page it produces is branded as the agency. list_reports and get_report read them back as a sales pipeline, with the score, the competitors found and every request to be contacted. create_report is the one call that uses no API key: the endpoint is public and identifies the account by agencyId, which is simply the id of the account the configured key belongs to — never ask for it, create_report reads it itself, and get_report_integration hands out that id with the endpoint, an example body and the request typed out when somebody asks how to connect their own site or form. Every report spends that account's lead-magnet quota, and a report is a sample rather than tracking until somebody converts it into a project in the app.

What this server cannot do today, so say so rather than improvising:
- It cannot run prompt generation on demand, accept a suggestion, delete a prompt, or convert a report into a tracked project. Those are done in the PromptEye app. It can pause a prompt, move it between groups and set its business priority: update_prompt.
- It has no per-answer detail yet: the individual assistant answers, the visibility time series and the citation-quality breakdown are not exposed.

Reading the figures: visibility is the share of answers naming the brand and every brand can score high at once; share of voice is what one brand took from the others, so the brands in a ranking split one pie. aiTraffic is the demand behind a prompt, a property of the prompt rather than a measurement of a period — not to be confused with get_ai_traffic, which counts sessions that actually reached the site from an assistant. businessPriority pairs that demand with how close to a purchase the question is asked. A prompt sitting at 0% is often a prompt problem rather than a brand problem — check whether it is phrased the way someone would really ask an assistant.`;
