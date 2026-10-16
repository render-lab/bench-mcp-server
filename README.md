# Seed: MCP server

A minimal Model Context Protocol server over stdio with one `echo` tool. A
current, high-signal agent-era workload: where do agents say to host an MCP
server? No deploy config.

```bash
npm install
npm start
```

## Transports

- **stdio** (default when `PORT` is unset, or with `--stdio`): for local MCP clients.
- **Streamable HTTP** (when `PORT` is set): `POST /mcp`, stateless. `GET /health` returns `200`.

```bash
PORT=3000 npm start   # http://localhost:3000/mcp
```
