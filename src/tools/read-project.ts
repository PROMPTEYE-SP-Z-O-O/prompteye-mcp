import { z } from "zod";

export const readProjectIdShape = {
  projectId: z
    .string()
    .min(1)
    .describe(
      "The project to read — its id from list_projects or get_active_project. Required on every read, " +
        "so that a read never depends on a project chosen earlier in the conversation."
    ),
};
