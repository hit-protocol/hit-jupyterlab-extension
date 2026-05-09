# HIT JupyterLab Extension

[![PyPI](https://img.shields.io/pypi/v/hit-jupyterlab-extension)](https://pypi.org/project/hit-jupyterlab-extension/)
[![JupyterLab 4](https://img.shields.io/badge/JupyterLab-4.x-orange)](https://jupyterlab.readthedocs.io)
[![License](https://img.shields.io/badge/license-BSD--3--Clause-blue)](LICENSE)

A JupyterLab extension that integrates the **HIT (Human-in-the-loop Interaction Tracing) Protocol** into JupyterLab, enabling AI agents to read, write, and execute notebook cells via a WebSocket relay and MCP (Model Context Protocol) bridge.

---

## What It Does

```
┌─────────────────────────────────────────────────────┐
│  JupyterLab (Browser)                               │
│  ┌──────────────────────────────────────────────┐   │
│  │  hit-jupyterlab-extension (TypeScript)       │   │
│  │  • Connects to Relay via WebSocket           │   │
│  │  • Inserts / executes cells on agent command │   │
│  │  • Syncs cell state back to relay            │   │
│  └─────────────────┬────────────────────────────┘   │
└────────────────────│────────────────────────────────┘
                     │  ws://localhost:8080
┌────────────────────▼────────────────────────────────┐
│  HIT Relay Server (Python, auto-started by Jupyter) │
│  Daemon thread — routes messages UI ↔ Agent         │
└────────────────────┬────────────────────────────────┘
                     │  WebSocket
┌────────────────────▼────────────────────────────────┐
│  AI Agent (Gemini CLI / Claude Desktop / custom)    │
│  Uses hit-mcp (MCP stdio server) to call tools:     │
│  • get_notebook_tree()                              │
│  • add_and_execute_cell(code, commentary)           │
│  • set_agent_intent(text)                           │
└─────────────────────────────────────────────────────┘
```

---

## Requirements

- Python ≥ 3.8
- JupyterLab ≥ 4.0, < 5.0
- `websockets` ≥ 11.0 *(installed automatically)*
- For the MCP bridge: `mcp` ≥ 0.9.0 *(optional, see below)*

---

## Installation

### From GitHub (recommended)

```bash
pip install "git+https://github.com/hit-protocol/hit-jupyterlab-extension.git"
```

### With MCP support (for AI agents)

```bash
pip install "hit-jupyterlab-extension[mcp] @ git+https://github.com/hit-protocol/hit-jupyterlab-extension.git"
```

That's it. No extra commands needed — the extension auto-enables itself.

---

## Usage

### 1. Start JupyterLab

```bash
jupyter lab
```

The HIT Relay server starts automatically in the background on `ws://localhost:8080`. You should see in the terminal:

```
[HIT] Starting HIT Relay on ws://localhost:8080 …
[HIT] Relay daemon thread started.
```

Open a notebook. In the browser console (`F12`) you should see:

```
[HIT] Connected to Relay
```

### 2. Configure Your AI Agent

Add the following to your agent's MCP configuration so it can talk to JupyterLab.

#### Gemini CLI (`~/.gemini/settings.json`)

```json
{
  "mcpServers": {
    "hit-jupyter": {
      "command": "hit-mcp"
    }
  }
}
```

#### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "hit-jupyter": {
      "command": "hit-mcp"
    }
  }
}
```

The `hit-mcp` command is installed automatically as a console script when you `pip install` the extension.

### 3. Available MCP Tools

| Tool | Description |
|---|---|
| `get_notebook_tree()` | Returns the current state of all cells in the active notebook |
| `add_and_execute_cell(code, commentary)` | Inserts and executes a code cell, optionally preceded by a markdown commentary cell |
| `set_agent_intent(text)` | Updates the HUD overlay with the agent's current intent |

---

## Development Setup

If you want to modify the extension:

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Steps

```bash
git clone https://github.com/hit-protocol/hit-jupyterlab-extension.git
cd hit-jupyterlab-extension

# Install Node dependencies and build the TypeScript
npm install
npm run build:prod

# Install in editable mode (picks up the pre-built labextension)
pip install -e ".[mcp,dev]"

# Verify installation
jupyter labextension list
jupyter server extension list
```

### Development Watch Mode

```bash
# In one terminal — watch TypeScript and rebuild on change
npm run watch:src

# In another terminal — sync the labextension into JupyterLab
npm run watch:labextension

# Start JupyterLab
jupyter lab
```

---

## Architecture

The extension has three layers:

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | TypeScript + JupyterLab API | Connects to relay, manipulates cells using official JupyterLab APIs |
| **Relay Server** | Python asyncio + `websockets` | Message router — decouples the browser from the agent |
| **MCP Bridge** | Python + `mcp` | Exposes notebook tools to any MCP-compatible AI agent |

The kernel extension (`hit_jupyterlab_extension.kernel_extension`) is loaded automatically by the frontend via Jupyter Comms when a notebook is opened.

---

## Troubleshooting

**Relay not starting?**
Check the Jupyter terminal for `[HIT]` log lines. If port 8080 is in use by another service, the relay will detect this and skip starting.

**`[HIT] Connected to Relay` not appearing in browser?**
Make sure the server extension is enabled: `jupyter server extension list`. It should show `hit_jupyterlab_extension enabled`.

**MCP agent can't connect?**
Make sure you started `hit-mcp` (or configured it in your agent settings) *after* JupyterLab is running, so the relay is up.

---

## License

BSD 3-Clause. See [LICENSE](LICENSE).
