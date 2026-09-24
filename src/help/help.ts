/**
 * PromptEye's help center: Markdown guides that say how the product works, as
 * opposed to the API, which says what a workspace holds.
 *
 * Every guide is published twice — a page for people and the original Markdown
 * for models — and `/help/index.md` lists them all. This reads that index and
 * fetches the Markdown, so the model answers "how does X work" from the guide
 * and not from memory.
 */

/** Fixed on purpose: the help center is read from research, whatever API the key points at. */
export const HELP_BASE_URL = "https://research.prompteye.com";

const INDEX_PATH = "/help/index.md";
const INDEX_TTL_MS = 10 * 60 * 1000;

/** Raised for a help center failure the model can act on: a refused path or an unreachable page. */
export class HelpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HelpError";
  }
}

export type HelpArticle = {
  section: string;
  title: string;
  /** What read_help_article takes: the location of the original Markdown. */
  path: string;
  /** The page to send a person to. */
  url: string;
};

export type Fetcher = (url: string) => Promise<Response>;

// - [Title](/help/raw/....md) — [read online](/help/....)
const ENTRY = /^\s*-\s+\[([^\]]+)\]\((\/help\/raw\/[^)\s]+\.md)\)(?:[^[\n]*\[[^\]]*\]\((\/help\/[^)\s]*)\))?/;

/** Reads the index into its entries, ignoring anything that is not a guide on this site. */
export function parseHelpIndex(markdown: string, baseUrl: string): HelpArticle[] {
  const articles: HelpArticle[] = [];
  let section = "";

  for (const line of markdown.split("\n")) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      section = heading[1];
      continue;
    }

    const entry = ENTRY.exec(line);
    if (!entry) continue;

    const [, title, path, page] = entry;
    articles.push({ section, title, path, url: `${baseUrl}${page ?? path}` });
  }

  return articles;
}

export type HelpCenterOptions = {
  baseUrl?: string;
  fetcher?: Fetcher;
  now?: () => number;
};

export class HelpCenter {
  readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly now: () => number;
  private cache: { at: number; articles: HelpArticle[] } | null = null;

  constructor({ baseUrl = HELP_BASE_URL, fetcher = (url) => fetch(url), now = Date.now }: HelpCenterOptions = {}) {
    this.baseUrl = baseUrl;
    this.fetcher = fetcher;
    this.now = now;
  }

  /** The address people are sent to for the whole help center. */
  get homeUrl(): string {
    return `${this.baseUrl}/help`;
  }

  async articles(): Promise<HelpArticle[]> {
    if (this.cache && this.now() - this.cache.at < INDEX_TTL_MS) return this.cache.articles;

    const articles = parseHelpIndex(await this.read(INDEX_PATH), this.baseUrl);
    this.cache = { at: this.now(), articles };
    return articles;
  }

  async article(path: string): Promise<string> {
    // Only Markdown under /help/raw/ on this host: the model must not be able to point this at anything else.
    if (!/^\/help\/raw\/[A-Za-z0-9_\-./]+\.md$/.test(path) || path.split("/").includes("..")) {
      throw new HelpError(
        `"${path}" is not a help article path. Take one from list_help_articles — they look like /help/raw/<section>/<name>.md.`
      );
    }

    return this.read(path);
  }

  private async read(path: string): Promise<string> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`);
    } catch {
      throw new HelpError(`The PromptEye help center could not be reached. Send the user to ${this.homeUrl}.`);
    }

    if (!response.ok) {
      throw new HelpError(
        `The PromptEye help center answered ${response.status} for ${path}. Send the user to ${this.homeUrl}.`
      );
    }

    return response.text();
  }
}
