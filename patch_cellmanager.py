import os
import re

with open("src/cellManager.ts", "r", encoding="utf-8") as f:
    content = f.read()

new_methods = """  public getCellsState(): any[] {
    const nbPanel = this.getActiveNotebook();
    if (!nbPanel) return [];
    const nb = nbPanel.content;
    if (!nb.widgets) return [];

    return nb.widgets.map((cell, index) => {
      let outputText = '';
      if (cell.model.type === 'code') {
        const codeModel = cell.model as any;
        const outputs = codeModel.sharedModel ? codeModel.sharedModel.getOutputs() : (codeModel.outputs ? codeModel.outputs.toJSON() : []);
        for (const o of outputs) {
          if (o.output_type === 'stream') outputText += o.text || '';
          if (o.output_type === 'execute_result' || o.output_type === 'display_data') {
             outputText += JSON.stringify(o.data || '');
          }
          if (o.output_type === 'error') {
             outputText += `ERROR: ${o.ename}: ${o.evalue}`;
          }
        }
      }

      return {
        uid: `jupyter.cell.${cell.model.id}`,
        role: cell.model.type + "_cell",
        state: {
          content: cell.model.sharedModel ? cell.model.sharedModel.getSource() : ((cell.model as any).value ? (cell.model as any).value.text : ''),
          output: outputText.substring(0, 1000),
          index: index
        },
        intent: { domain: "notebook", action: "update_cell", object: "cell" }
      };
    });
  }

  public async updateCell(uid: string, source: string): Promise<{ok: boolean, error?: string}> {
    const nbPanel = this.getActiveNotebook();
    if (!nbPanel) return { ok: false, error: 'No active notebook' };
    const nb = nbPanel.content;
    if (!nb.widgets) return { ok: false, error: 'No cells' };

    let targetCell = null;
    let targetIndex = -1;
    for (let i = 0; i < nb.widgets.length; i++) {
      if (`jupyter.cell.${nb.widgets[i].model.id}` === uid) {
        targetCell = nb.widgets[i];
        targetIndex = i;
        break;
      }
    }

    if (!targetCell) return { ok: false, error: 'Cell not found' };

    nb.activeCellIndex = targetIndex;
    await this.sleep(50);
    
    if (targetCell.model && targetCell.model.sharedModel) {
      targetCell.model.sharedModel.setSource(source);
      this.highlightCell(targetCell);
      return { ok: true };
    }
    return { ok: false, error: 'Could not access cell model' };
  }

  public async executeCell(uid: string): Promise<{ok: boolean, output?: string, error?: string}> {
    const nbPanel = this.getActiveNotebook();
    if (!nbPanel) return { ok: false, error: 'No active notebook' };
    const nb = nbPanel.content;
    if (!nb.widgets) return { ok: false, error: 'No cells' };

    let targetCell = null;
    let targetIndex = -1;
    for (let i = 0; i < nb.widgets.length; i++) {
      if (`jupyter.cell.${nb.widgets[i].model.id}` === uid) {
        targetCell = nb.widgets[i];
        targetIndex = i;
        break;
      }
    }

    if (!targetCell) return { ok: false, error: 'Cell not found' };

    nb.activeCellIndex = targetIndex;
    const { commands } = this.app;
    await commands.execute('notebook:run-cell');
    await this.sleep(1500);

    let outText = '';
    if (targetCell.model.type === 'code') {
      const codeModel = targetCell.model as any;
      const outputs = codeModel.sharedModel ? codeModel.sharedModel.getOutputs() : (codeModel.outputs ? codeModel.outputs.toJSON() : []);
      for (const o of outputs) {
        if (o.output_type === 'stream') outText += o.text || '';
        if (o.output_type === 'execute_result' || o.output_type === 'display_data') {
           outText += JSON.stringify(o.data || '');
        }
        if (o.output_type === 'error') {
           outText += `ERROR: ${o.ename}: ${o.evalue}`;
        }
      }
    }

    this.highlightCell(targetCell);
    return { ok: true, output: outText.substring(0, 2000) };
  }
}
"""

content = re.sub(r'  \}\r?\n\}\r?\n?$', new_methods, content)
with open("src/cellManager.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
