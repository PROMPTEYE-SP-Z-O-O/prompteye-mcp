import { createJsonLogger } from "./http/logging.js";
import { startHttpServer } from "./http/server.js";
import { readHttpSettings } from "./http/settings.js";

try {
  startHttpServer(readHttpSettings(), createJsonLogger());
} catch (err) {
  console.error("Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
}
