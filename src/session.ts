import type { PromptEyeClient } from "./client/prompteye-client.js";
import type { Project } from "./schemas/prompteye.js";

/**
 * The project chosen with select_project, kept for get_active_project.
 *
 * One instance per MCP session: the stdio entry point runs one session per
 * process, and the HTTP entry point builds a fresh `McpServer` — and so a fresh
 * session — for every `mcp-session-id`, so no two clients share a selection.
 */
export class ProjectSession {
  private active: Project | undefined;

  constructor(private readonly client: PromptEyeClient) {}

  /** Remembers `project` as the one the conversation is about. */
  async select(projectId: string): Promise<Project> {
    this.active = await this.client.getProject(projectId);
    return this.active;
  }

  async refreshIfActive(projectId: string): Promise<void> {
    if (this.active?.id === projectId) await this.select(projectId);
  }

  /** The active project, or undefined when nothing has been selected yet. */
  current(): Project | undefined {
    return this.active;
  }
}
