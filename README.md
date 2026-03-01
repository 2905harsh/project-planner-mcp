# Project Planner MCP

Imagine You're deep in a coding session. You need to check what's left to build. Instead of opening Notion, switching tabs, scrolling through your notes — you just ask Cursor:

*"What todos are still pending in my project?"*

And it tells you. Right there. No context switching. No copy pasting. Because your AI assistant isn't just chatting with you anymore — it has direct access to your actual project system.

That's what this is.

A remote MCP server built on Cloudflare Workers that makes your AI **project-aware**. It can create projects, manage todos, update priorities, track progress — all through natural conversation, from inside whatever AI tool you're already using.

> Built this after going through way too many hours of debugging — so hopefully this saves you some pain.

---

## Why this is different

Every AI can *talk* about your project if you paste the details in. That's just chat.

This is different. Your AI can directly **read and act on** your project data without you doing anything. You're coding and you say *"mark the auth todos as done and add a new one for deployment"* — it just does it. The project updates. You keep coding.

It's not a separate tool you go check. It becomes part of how you naturally talk to your AI already.

---

## What it does

You can say things like:

- *"Create a new project called Website Redesign"*
- *"Add a high priority todo to finish the landing page"*
- *"What todos are still pending?"*
- *"Mark that todo as completed"*
- *"Delete all completed todos from the API project"*

And it just works — from inside Cursor, Claude Desktop, or any MCP-compatible AI client.

---

## Tools available

| Tool | Description |
|------|-------------|
| `create_project` | Create a new project |
| `list_projects` | List all your projects |
| `get_project` | Get a project with all its todos |
| `delete_project` | Delete a project and all its todos |
| `create_todo` | Add a todo to a project |
| `get_todo` | Get a specific todo by ID |
| `list_todos` | List todos in a project (filter by status) |
| `update_todo` | Update title, description, priority or status |
| `delete_todo` | Delete a todo |

---

## Tech stack

- **Cloudflare Workers** — serverless runtime
- **Durable Objects** — stateful MCP session handling
- **Cloudflare KV** — persistent data storage
- **agents SDK** — `McpAgent` base class for MCP protocol
- **@modelcontextprotocol/sdk** — `McpServer` for tool registration
- **Zod v3** — schema validation (important: must be v3, not v4)
- **TypeScript**

---

## Deploy it yourself

### Prerequisites

- A [Cloudflare account](https://cloudflare.com) (free tier works)
- Node.js installed
- Wrangler CLI

### 1. Clone the repo

```bash
git clone https://github.com/2905harsh/project-planner-mcp.git
cd project-planner-mcp
```

### 2. Install dependencies

```bash
npm install
```

> ⚠️ Make sure Zod stays on v3. The `agents` SDK is not compatible with Zod v4.
> If you see version issues run: `npm install zod@^3.23.8`

### 3. Create a KV namespace

```bash
npx wrangler kv namespace create PROJECT_PLANNER_STORE
```

Copy the `id` from the output and paste it into `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  {
    "binding": "PROJECT_PLANNER_STORE",
    "id": "your-kv-id-here"
  }
]
```

### 4. Deploy

```bash
npx wrangler deploy
```

Your server will be live at:
```
https://your-worker-name.your-subdomain.workers.dev/sse
```

---

## Connect to Cursor

Go to Cursor Settings → MCP → Add Server and use:

```
https://your-worker-name.your-subdomain.workers.dev/sse
```

> The `/sse` endpoint handles both SSE and Streamable HTTP transports automatically.

---

## Connect to Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "project-planner": {
      "command": "mcp-remote",
      "args": ["https://your-worker-name.your-subdomain.workers.dev/sse"]
    }
  }
}
```

---

## Debugging tips

Things I ran into while building this (so you don't have to):

- **Error 1101 / Worker threw exception** — almost always a startup crash. Run `npx wrangler tail --format pretty` to see the real error
- **`registerTool is not a function`** — the `agents` SDK uses `this.server.tool()`, not `registerTool()`
- **Zod errors at runtime** — downgrade to Zod v3. The agents SDK doesn't support v4
- **`Missing namespace or room headers`** — don't manually route to the Durable Object. Use `McpAgent.serve()` in your default export
- **`Not Acceptable: Client must accept text/event-stream`** — this just means you opened the URL directly in a browser. It's normal, not a bug

---

## Project structure

```
src/
  index.ts       # Main worker — MCP class + tool definitions
wrangler.jsonc   # Cloudflare config (DO bindings, KV, migrations)
```

---

## ⚠️ Note on authentication

This server has no auth right now — anyone with the URL can access it. If you're planning to use this seriously, look into adding an API key check or putting it behind Cloudflare Access.

---

## License

MIT
