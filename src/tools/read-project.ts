import { z } from "zod";

export const readProjectIdShape = {
  projectId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "The project to read — its id from list_projects or get_active_project. Pass it on every read: " +
        "the active project is forgotten when the connection is renewed, and a read that names its project " +
        "keeps working. Left out, the active project is read."
    ),
};
