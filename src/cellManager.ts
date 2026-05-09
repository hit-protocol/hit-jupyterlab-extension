import { JupyterFrontEnd } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { CodeCell } from '@jupyterlab/cells';

export class CellManager {
  constructor(
    private app: JupyterFrontEnd,
    private tracker: INotebookTracker
  ) {}

  private getActiveNotebook(): NotebookPanel | null {
    return this.tracker.currentWidget;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async insertCell(type: 'markdown' | 'code', source: string): Promise<{ok: boolean, error?: string}> {
    const nbPanel = this.getActiveNotebook();
    if (!nbPanel) return { ok: false, error: 'No active notebook' };
    
    const model = nbPanel.model;
    if (!model) return { ok: false, error: 'No notebook model' };

    try {
      const cells = model.cells;
      const lastCell = cells.get(cells.length - 1);
      
      // OPTIMIZATION: Reuse last cell if it's empty and same type
      if (lastCell && lastCell.type === type && lastCell.sharedModel.getSource().trim() === '') {
        lastCell.sharedModel.setSource(source);
        return { ok: true };
      } else {
        // DIRECT MODEL INSERTION (Using sharedModel for JL4 stability)
        model.sharedModel.insertCell(model.sharedModel.cells.length, {
          cell_type: type,
          source: source,
          metadata: {}
        });
        
        // Update UI focus to the new cell
        const nb = nbPanel.content;
        nb.activeCellIndex = model.sharedModel.cells.length - 1;
        nb.node.scrollTop = nb.node.scrollHeight;
        return { ok: true };
      }
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  public async updateCell(uid: string, source: string): Promise<{ok: boolean, error?: string}> {
    const nbPanel = this.getActiveNotebook();
    if (!nbPanel) return { ok: false, error: 'No active notebook' };
    
    const nb = nbPanel.content;
    for (let i = 0; i < nb.widgets.length; i++) {
      const cell = nb.widgets[i];
      if (cell.model.id === uid || uid.endsWith(cell.model.id)) {
        cell.model.sharedModel.setSource(source);
        return { ok: true };
      }
    }
    return { ok: false, error: 'Cell not found' };
  }

  public async executeCell(uid: string): Promise<{ok: boolean, output?: string, error?: string}> {
     const nbPanel = this.getActiveNotebook();
     if (!nbPanel) return { ok: false, error: 'No active notebook' };
     
     const nb = nbPanel.content;
     let targetIndex = -1;
     
     for (let i = 0; i < nb.widgets.length; i++) {
       if (nb.widgets[i].model.id === uid || uid.endsWith(nb.widgets[i].model.id)) {
         targetIndex = i;
         break;
       }
     }

     if (targetIndex === -1) return { ok: false, error: 'Cell not found' };

     nb.activeCellIndex = targetIndex;
     await this.app.commands.execute('notebook:run-cell');
     await this.sleep(1000);
     
     const cell = nb.widgets[targetIndex] as CodeCell;
     const output = cell.model.outputs.toJSON().map((o: any) => o.text || o.data?.['text/plain'] || '').join('\n');
     return { ok: true, output };
  }

  public async executeLastCell(): Promise<{ok: boolean, output?: string, error?: string}> {
    const nbPanel = this.getActiveNotebook();
    if (!nbPanel) return { ok: false, error: 'No active notebook' };
    
    const nb = nbPanel.content;
    nb.activeCellIndex = nb.widgets.length - 1;
    
    await this.app.commands.execute('notebook:run-cell');
    await this.sleep(2000);
    
    const lastIdx = nb.widgets.length - 1;
    const cell = nb.widgets[lastIdx] as CodeCell;
    const output = cell.model.outputs.toJSON().map((o: any) => o.text || o.data?.['text/plain'] || '').join('\n');
    return { ok: true, output };
  }

  public getCellsState(): any[] {
    const nbPanel = this.getActiveNotebook();
    if (!nbPanel) return [];
    
    const nb = nbPanel.content;
    return nb.widgets.map((cell, index) => {
      const output = (cell.model.type === 'code') 
        ? (cell as CodeCell).model.outputs.toJSON().map((o: any) => o.text || o.data?.['text/plain'] || '').join('\n')
        : '';
        
      return {
        uid: `jupyter.cell.${cell.model.id}`,
        role: cell.model.type === 'code' ? 'code_cell' : 'markdown_cell',
        state: {
          content: cell.model.sharedModel.getSource(),
          output: output,
          index: index
        },
        intent: { domain: 'notebook', action: 'update_cell', object: 'cell' }
      };
    });
  }
}