import { z } from "zod";

export const projectIdShape = {
  projectId: z
    .string()
    .min(1)
    .describe(
      "The project to work on — its id from list_projects. Required on every call, so that parallel " +
        "conversations never read or write each other's project."
    ),
};
