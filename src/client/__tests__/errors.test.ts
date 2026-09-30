import { PromptEyeApiError } from "../../api/index.js";
import { toolMessageFor } from "../errors.js";

const refusal = (body: unknown) => toolMessageFor(new PromptEyeApiError(400, body));

describe("toolMessageFor", () => {
  it("names the field and what it takes, the way the API reports it", () => {
    const message = refusal({
      error: {
        code: "invalid_request",
        message: "No prompt group with this identifier is in this project.",
        details: [
          {
            field: "groupId",
            message:
              "Not a prompt group of this project. GET /v1/projects/{projectId}/prompt-groups lists the ones it has.",
          },
        ],
      },
    });

    expect(message).toBe(
      "PromptEye API error 400 (invalid_request): The request failed validation. " +
        "No prompt group with this identifier is in this project.\n" +
        "  - groupId: Not a prompt group of this project. " +
        "GET /v1/projects/{projectId}/prompt-groups lists the ones it has."
    );
  });

  it("keeps the reason the API gives when it names no field", () => {
    const message = refusal({
      error: { code: "invalid_request", message: "No category with this identifier is in this project." },
    });

    expect(message).toBe(
      "PromptEye API error 400 (invalid_request): The request failed validation. " +
        "No category with this identifier is in this project."
    );
  });

  it("says the reason once when the API repeats the generic one", () => {
    const message = refusal({
      error: {
        code: "invalid_request",
        message: "The request failed validation.",
        details: [{ field: "botId", message: 'Invalid option: expected one of "gptbot"|"claudebot"' }],
      },
    });

    expect(message).toBe(
      "PromptEye API error 400 (invalid_request): The request failed validation.\n" +
        '  - botId: Invalid option: expected one of "gptbot"|"claudebot"'
    );
  });
});
