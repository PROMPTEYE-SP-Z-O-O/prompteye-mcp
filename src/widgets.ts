import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "../public");

/** The uri a tool points at, and the resource is served under. */
export const widgetUri = (name: string): string => `ui://prompteye/${name}.html`;

const WIDGET_NAME = /^[a-z]+$/;

/** Where the widget scripts are served: ChatGPT runs no inline script, so each page loads its script from here. */
export const WIDGET_ASSETS_ORIGIN = new URL(process.env.MCP_PUBLIC_URL ?? "https://mcp.prompteye.com/mcp").origin;

const pages = new Map<string, string>();
const scripts = new Map<string, string>();

const widgetResourceMeta = (description: string): Record<string, unknown> => ({
  ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [WIDGET_ASSETS_ORIGIN] } },
  "openai/widgetDescription": description,
  "openai/widgetPrefersBorder": true,
  "openai/widgetCSP": { connect_domains: [], resource_domains: [WIDGET_ASSETS_ORIGIN] },
});

/** The script one widget runs — the shared runtime with the widget's `render` — or undefined for an unknown widget. */
export function widgetScript(name: string): string | undefined {
  if (!WIDGET_NAME.test(name)) return undefined;
  const cached = scripts.get(name);
  if (cached !== undefined) return cached;

  const renderPath = path.join(PUBLIC_DIR, "widgets", `${name}.js`);
  if (!fs.existsSync(renderPath)) return undefined;

  const runtime = fs.readFileSync(path.join(PUBLIC_DIR, "widget-runtime.js"), "utf-8");
  const script = runtime
    .replace("{{APP}}", `prompteye-${name}`)
    // A function replacement, so `$&` and friends in the widget are left alone.
    .replace("{{RENDER}}", () => fs.readFileSync(renderPath, "utf-8"));
  scripts.set(name, script);
  return script;
}

/**
 * One branded page per widget: the shell carries the PromptEye mark and the
 * palette, and loads the widget's script — the shared runtime with both
 * handshakes plus the widget's own `render` — from the assets origin.
 */
function widgetHtml(name: string, title: string): string {
  if (widgetScript(name) === undefined) throw new Error(`No script for widget ${name}`);
  const shell = fs.readFileSync(path.join(PUBLIC_DIR, "widget-shell.html"), "utf-8");

  return shell
    .replace("{{TITLE}}", title)
    .replace("{{SCRIPTS}}", `<script src="${WIDGET_ASSETS_ORIGIN}/widgets/${name}.js"></script>`);
}

/**
 * Registers the page a tool renders alongside its text.
 *
 * The `ui` metadata is what Claude reads; the `openai/*` keys are the same
 * facts under the names the Apps SDK looks for, so one resource serves both.
 * ChatGPT reads them from the page it fetches, so they go on the read result as
 * well as on the listing, and it runs only scripts from the domains the CSP names.
 */
export function registerWidget(server: McpServer, name: string, title: string, description: string): string {
  const uri = widgetUri(name);

  registerAppResource(
    server,
    title,
    uri,
    { description, _meta: widgetResourceMeta(description) },
    async () => {
      // Read once per process, since every request builds its own server, and never let a missing file take the tool down.
      let html = pages.get(name);
      if (html === undefined) {
        try {
          html = widgetHtml(name, title);
          pages.set(name, html);
        } catch {
          html = `<html><body>${title} is unavailable.</body></html>`;
        }
      }

      return { contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: html, _meta: widgetResourceMeta(description) }] };
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
