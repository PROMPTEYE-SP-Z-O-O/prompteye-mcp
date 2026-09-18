import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "../public");

/** The uri a tool points at, and the resource is served under. */
export const widgetUri = (name: string): string => `ui://prompteye/${name}.html`;

/**
 * One branded page per widget: the shell carries the PromptEye mark, the
 * palette and both handshakes, and each widget only contributes its `render`.
 * Building it here keeps the brand in one file instead of copied into each.
 */
function widgetHtml(name: string, title: string): string {
  const shell = fs.readFileSync(path.join(PUBLIC_DIR, "widget-shell.html"), "utf-8");
  const render = fs.readFileSync(path.join(PUBLIC_DIR, "widgets", `${name}.js`), "utf-8");

  return shell
    .replace("{{TITLE}}", title)
    .replace("{{APP}}", `prompteye-${name}`)
    // A function replacement, so `$&` and friends in the widget are left alone.
    .replace("{{RENDER}}", () => render);
}

/**
 * Registers the page a tool renders alongside its text.
 *
 * The `ui` metadata is what Claude reads; the `openai/*` keys are the same
 * facts under the names the Apps SDK looks for, so one resource serves both.
 */
export function registerWidget(server: McpServer, name: string, title: string, description: string): string {
  const uri = widgetUri(name);
  let html: string | undefined;

  registerAppResource(
    server,
    title,
    uri,
    {
      description,
      _meta: {
        ui: { preferBorder: true },
        "openai/widgetDescription": description,
        "openai/widgetPrefersBorder": true,
      },
    },
    async () => {
      // Read once per server, and never let a missing file take the tool down.
      if (html === undefined) {
        try {
          html = widgetHtml(name, title);
        } catch {
          html = `<html><body>${title} is unavailable.</body></html>`;
        }
      }

      return { contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: html }] };
    }
  );

  return uri;
}

/** The `_meta` a tool carries so both hosts know which page to render. */
export const widgetMeta = (
  uri: string,
  invoking: string,
  invoked: string
): Record<string, unknown> => ({
  ui: { resourceUri: uri },
  "openai/outputTemplate": uri,
  "openai/toolInvocation/invoking": invoking,
  "openai/toolInvocation/invoked": invoked,
});
