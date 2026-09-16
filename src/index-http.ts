import { randomUUID } from "crypto";
import express from "express";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describeDataSource, requireSettings, serverName, serverVersion } from "./config.js";
import { createMcpServer } from "./server.js";

// Refuse to start without a key and a deployment, rather than failing per request.
const { baseUrl } = requireSettings();

const app = express();
app.use(cors({ origin: "*", methods: ["GET", "POST", "DELETE", "OPTIONS"] }));
app.use(express.json());

const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

// Sessions whose transport has already closed leave an entry behind; sweep them.
setInterval(() => {
  for (const [id, session] of sessions) {
    if (!session.transport.sessionId) sessions.delete(id);
  }
}, 10 * 60 * 1000);

const handler = async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      await sessions.get(sessionId)!.transport.handleRequest(req, res, req.body);
      return;
    }

    // A fresh session gets its own server, and so its own project selection.
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid): void => {
        sessions.set(sid, { server, transport });
      },
    });

    transport.onclose = (): void => {
      const sid = transport.sessionId;
      if (sid) sessions.delete(sid);
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
};

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    server: { name: serverName, version: serverVersion },
    endpoint: "/mcp",
    sessions: sessions.size,
    source: baseUrl,
  });
});

app.all("/mcp", handler);

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
  console.log(`${serverName} → http://localhost:${PORT}/mcp`);
  console.log(describeDataSource(baseUrl));
});
