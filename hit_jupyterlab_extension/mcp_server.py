import asyncio
import json
import uuid
import sys
import websockets as ws_lib
from mcp.server.fastmcp import FastMCP

RELAY_URL = "ws://localhost:8080"
mcp = FastMCP("HIT-Jupyter-Bridge")

relay_ws        = None
notebook_nodes  = {}
pending_results = {}

async def connect_to_relay():
    global relay_ws
    while True:
        try:
            async with ws_lib.connect(RELAY_URL) as websocket:
                relay_ws = websocket
                await relay_ws.send(json.dumps({
                    "type": "HIT_AGENT_HELLO",
                    "payload": {"subscribe": ["*"]}
                }))
                
                async for message in websocket:
                    msg = json.loads(message)
                    mtype = msg.get("type")

                    if mtype == "PATCH_STATE":
                        uid = msg["payload"].get("uid")
                        if uid: notebook_nodes[uid] = msg["payload"]

                    elif mtype in ("ACTION_RESULT", "ACTION_ERROR"):
                        uid = msg.get("payload", {}).get("uid")
                        if uid and uid in pending_results:
                            future = pending_results.pop(uid)
                            if not future.done():
                                future.set_result(msg)

                    elif mtype in ("UI_OFFLINE", "UI_ONLINE"):
                        # RESET STATE on connection/disconnection to prevent stale cells
                        notebook_nodes.clear()
                        print(f"Notebook UI state reset ({mtype})", file=sys.stderr)

        except Exception as e:
            relay_ws = None
            await asyncio.sleep(2)

async def send_action(action: str, params: dict, timeout: float = 30.0) -> dict:
    if not relay_ws: return {"ok": False, "error": "Not connected to HIT-Relay"}
    
    action_id = f"mcp-{action}-{uuid.uuid4().hex[:8]}"
    loop      = asyncio.get_event_loop()
    future    = loop.create_future()
    pending_results[action_id] = future

    await relay_ws.send(json.dumps({
        "type": "CALL_ACTION",
        "payload": {"uid": action_id, "action": action, "params": params}
    }))

    try:
        result_msg = await asyncio.wait_for(future, timeout=timeout)
        return result_msg.get("payload", {})
    except asyncio.TimeoutError:
        pending_results.pop(action_id, None)
        return {"ok": False, "error": f"Action '{action}' timed out after {timeout}s"}

@mcp.tool()
async def get_notebook_tree():
    """Return the current state of all cells in the active notebook."""
    if not notebook_nodes:
        return "No nodes yet. Open a notebook in JupyterLab and wait a moment."
    return list(notebook_nodes.values())

@mcp.tool()
async def set_agent_intent(text: str):
    """Update the HUD overlay shown to the user with the agent's current intent."""
    await send_action("set_hud_intent", {"text": text}, timeout=5.0)
    return "HUD updated."

@mcp.tool()
async def add_and_execute_cell(code: str, commentary: str = ""):
    """
    Insert a code cell (optionally preceded by a markdown commentary cell)
    into the active notebook and execute it. Returns the cell output.
    """
    if not relay_ws: return "Error: Not connected to HIT-Relay."
    await send_action("set_hud_intent", {"text": commentary[:80] if commentary else "Executing..."}, timeout=5.0)
    
    if commentary:
        await send_action("insert_markdown", {"source": commentary}, timeout=15.0)
    
    insert_res = await send_action("insert_code", {"source": code}, timeout=15.0)
    if insert_res.get("status") != "success": return f"Failed: {insert_res}"
        
    result = await send_action("execute_last_cell", {}, timeout=60.0)
    await send_action("set_hud_intent", {"text": "Step complete ✓"}, timeout=5.0)
    
    return {"status": "success", "output": result.get("output", "(no text output)")}

@mcp.tool()
async def change_cell_type(uid: str, type: str):
    """
    Change the type of an existing cell (e.g. from code to markdown or vice versa).
    The 'type' parameter must be either 'markdown' or 'code'.
    """
    if not relay_ws: return "Error: Not connected to HIT-Relay."
    if type not in ("markdown", "code"):
        return "Error: Invalid type. Must be 'markdown' or 'code'."
        
    await send_action("set_hud_intent", {"text": f"Converting cell to {type}..."}, timeout=5.0)
    res = await send_action("change_cell_type", {"uid": uid, "type": type}, timeout=10.0)
    await send_action("set_hud_intent", {"text": "Cell type updated ✓"}, timeout=5.0)
    
    if res.get("status") != "success":
        return f"Failed: {res}"
    return "Cell type successfully changed."

async def _run():
    asyncio.create_task(connect_to_relay())
    await mcp.run_stdio_async()

def main():
    """Console-script entrypoint: run the HIT MCP server (stdio)."""
    asyncio.run(_run())

if __name__ == "__main__":
    main()
