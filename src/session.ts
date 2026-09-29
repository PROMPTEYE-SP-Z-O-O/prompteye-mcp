import type { PromptEyeClient } from "./client/prompteye-client.js";
import { NoActiveProjectError } from "./client/errors.js";
import type { Project } from "./schemas/prompteye.js";

/**
 * The project every project-scoped tool reports on.
 *
 * One instance per MCP session: the stdio entry point runs one session per
 * process, and the HTTP entry point builds a fresh `McpServer` — and so a fresh
 * session — for every `mcp-session-id`, so no two clients share a selection.
 */
export class ProjectSession {
  private active: Project | undefined;
  private readonly briefed = new Set<string>();

  constructor(private readonly client: PromptEyeClient) {}

  /** Makes `project` the one every project-scoped tool reports on. */
  async select(projectId: string): Promise<Project> {
    this.active = await this.client.getProject(projectId);
    return this.active;
  }

  /**
   * Records that an article brief was ordered for `projectId` in this session.
   * The API has no listing of briefs, so this is how get_started knows the
   * content step was taken and the next one is waiting for the run.
   */
  noteBrief(projectId: string): void {
    this.briefed.add(projectId);
  }

  /** Whether an article brief was ordered for `projectId` in this session. */
  hasBrief(projectId: string): boolean {
    return this.briefed.has(projectId);
  }

  /** The active project, or undefined when nothing has been selected yet. */
  current(): Project | undefined {
    return this.active;
  }

  /**
   * The active project, selecting it first when the key reaches exactly one —
   * with a single project there is nothing to choose, and making the model call
   * `select_project` to learn that wastes a turn.
   */
  async require(): Promise<Project> {
    if (this.active) return this.active;

    const { data } = await this.client.listProjects();
    if (data.length === 1) {
      this.active = data[0];
      return data[0];
    }

    throw new NoActiveProjectError();
  }
}
