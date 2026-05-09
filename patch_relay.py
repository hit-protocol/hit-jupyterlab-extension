import os
import re

with open("src/relay.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the condition block
old_block = """        } else if (action === 'execute_last_cell') {
          res = await this.cellManager.executeLastCell();
        }

        this.socket.send(JSON.stringify({"""

new_block = """        } else if (action === 'execute_last_cell') {
          res = await this.cellManager.executeLastCell();
        } else if (action === 'update_cell') {
          res = await this.cellManager.updateCell(uid, params.source);
        } else if (action === 'execute_cell') {
          res = await this.cellManager.executeCell(uid);
        }

        this.socket.send(JSON.stringify({"""

content = content.replace(old_block, new_block)

# Add this.syncCells() after sending action result
old_send = """        this.socket.send(JSON.stringify({
          type: res.ok ? 'ACTION_RESULT' : 'ACTION_ERROR',
          payload: { uid, status: res.ok ? 'success' : 'error', output: res.output, error: res.error }
        }));
      }"""

new_send = """        this.socket.send(JSON.stringify({
          type: res.ok ? 'ACTION_RESULT' : 'ACTION_ERROR',
          payload: { uid, status: res.ok ? 'success' : 'error', output: res.output, error: res.error }
        }));
        
        // Push cells after any action
        this.syncCells();
      }"""

content = content.replace(old_send, new_send)

# Add syncCells method
sync_cells_method = """  public syncCells() {
    if (this.socket.readyState !== WebSocket.OPEN) return;
    const cells = this.cellManager.getCellsState();
    for (const cell of cells) {
      this.sendStatePatch(cell);
    }
  }

  public sendStatePatch"""

content = content.replace("  public sendStatePatch", sync_cells_method)

with open("src/relay.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("Done relay.ts")
