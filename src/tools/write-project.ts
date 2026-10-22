import { z } from "zod";

export const writeProjectIdShape = {
  projectId: z
    .string()
    .min(1)
    .describe(
      "The project this change is written to — its id from list_projects. " +
        "Required on every change so that parallel conversations never write into each other's project."
    ),
};
