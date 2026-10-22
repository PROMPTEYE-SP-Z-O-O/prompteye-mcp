import { z } from "zod";

export const readProjectIdShape = {
  projectId: z
    .string()
    .min(1)
    .describe(
      "The project to read — its id from list_projects. Required on every read."
    ),
};
