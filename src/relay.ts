import { CellManager } from './cellManager';

export class HITRelayClient {
  private socket: WebSocket | null = null;

  constructor(private cellManager: CellManager) {
    this.connect();
  }

  private connect() {
    this.socket = new WebSocket('ws://localhost:8080');
    
    this.socket.onopen = () => {
      console.log("[HIT] Connected to Relay");
      this.socket?.send(JSON.stringify({ type: 'HIT_HELLO', payload: { version: '2.0-STABLE' } }));
      this.syncCells();
    };

    this.socket.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'CALL_ACTION') {
          const { uid, action, params = {} } = msg.payload;
          console.log("[HIT] Action:", action, params);
          
          let res: any = { ok: false, error: 'Unknown action' };

          if (action === 'set_hud_intent') {
            console.log("[HIT Intent]:", params.text);
            res = { ok: true };
          } else if (action === 'insert_markdown') {
            res = await this.cellManager.insertCell('markdown', params.source);
          } else if (action === 'insert_code') {
            res = await this.cellManager.insertCell('code', params.source);
          } else if (action === 'execute_last_cell') {
            res = await this.cellManager.executeLastCell();
          } else if (action === 'execute_cell') {
            res = await this.cellManager.executeCell(params.uid);          } else if (action === 'update_cell') {
            res = await this.cellManager.updateCell(params.uid, params.source);
          } else if (action === 'change_cell_type') {
            res = await this.cellManager.changeCellType(params.uid, params.type);
          }

          this.socket?.send(JSON.stringify({
            type: res.ok ? 'ACTION_RESULT' : 'ACTION_ERROR',
            payload: { uid, status: res.ok ? 'success' : 'error', output: res.output, error: res.error }
          }));
          
          this.syncCells();
        }
      } catch (e: any) {
        console.error("[HIT] Error handling message:", e);
      }
    };

    this.socket.onclose = () => {
      console.log("[HIT] Disconnected, retrying...");
      setTimeout(() => this.connect(), 3000);
    };
  }

  public sendStatePatch(data: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'PATCH_STATE', payload: data }));
    }
  }

  public syncCells() {
    const cells = this.cellManager.getCellsState();
    cells.forEach(cell => this.sendStatePatch(cell));
  }
}