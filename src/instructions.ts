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

2. The brand description (get_knowledge_base). What the company sells and to whom. Everything PromptEye writes for the project reads this first, so a thin or wrong description quietly poisons the prompts it proposes. It is written and corrected in the PromptEye app, not here.

3. The prompts. These are the questions put to the assistants every run — the unit everything is measured on. PromptEye generates them from real demand and from the way people actually put questions to assistants, then proposes them with the funnel stage they fill, the demand behind them and how well they fit the brand: list_prompt_suggestions. Accepting a suggestion happens in the app. add_prompts exists for prompts the user already has and must track verbatim — it skips the demand, duplicate and fit checks, so it is not the way to "add a few ideas".

4. The measurement. list_prompts carries what each prompt earned over a period and how it moved; list_competitors ranks the brands answering alongside; list_sources ranks the domains the assistants cited. list_prompt_groups and list_categories are how prompts are organised, and a group is the unit analysis happens in.

What this server cannot do today, so say so rather than improvising:
- It cannot run prompt generation on demand, or accept, edit, pause or delete a prompt. Those are done in the PromptEye app.
- It cannot write the brand description.
- It has no per-answer detail yet: the individual assistant answers, the visibility time series and the citation-quality breakdown are not exposed.

Reading the figures: visibility is the share of answers naming the brand and every brand can score high at once; share of voice is what one brand took from the others, so the brands in a ranking split one pie. aiTraffic is the demand behind a prompt, a property of the prompt rather than a measurement of a period. businessPriority pairs that demand with how close to a purchase the question is asked. A prompt sitting at 0% is often a prompt problem rather than a brand problem — check whether it is phrased the way someone would really ask an assistant.`;
