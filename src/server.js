import { createServer } from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

function buildServer() {
  const server = new Server(
    { name: 'seed-mcp-server', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'echo',
        description: 'Echo back the provided text.',
        inputSchema: {
          type: 'object',
          properties: { text: { type: 'string' } },
          required: ['text'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name === 'echo') {
      return {
        content: [{ type: 'text', text: String(req.params.arguments?.text ?? '') }],
      };
    }
    throw new Error(`Unknown tool: ${req.params.name}`);
  });

  return server;
}

// Use stdio for local MCP clients; serve Streamable HTTP when PORT is set (e.g. on Render).
if (process.argv.includes('--stdio') || !process.env.PORT) {
  await buildServer().connect(new StdioServerTransport());
} else {
  const port = Number(process.env.PORT);

  const httpServer = createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');

    if (pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"status":"ok"}');
      return;
    }
    if (pathname !== '/mcp') {
      res.writeHead(404).end();
      return;
    }
    if (req.method !== 'POST') {
      // Stateless mode: no server-initiated SSE streams or sessions to delete.
      res.writeHead(405, { allow: 'POST' }).end();
      return;
    }

    // Stateless: a fresh server + transport per request, so any instance can serve any request.
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' }).end(
          JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null }),
        );
      }
    }
  });

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`MCP server listening on http://0.0.0.0:${port}/mcp`);
  });

  process.on('SIGTERM', () => httpServer.close(() => process.exit(0)));
}
