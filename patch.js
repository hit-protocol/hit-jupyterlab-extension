const fs = require('fs');
let content = fs.readFileSync('src/cellManager.ts', 'utf8');

const newCode = `  public async insertCell(type: 'markdown' | 'code', source: string): Promise<{ok: boolean, error?: string}> {
    const nbPanel = this.getActiveNotebook();
    if (!nbPanel) {
      return { ok: false, error: 'No active notebook' };
    }

    const nb = nbPanel.content;
    const { commands } = this.app;

    let targetCell = null;
    if (nb.widgets && nb.widgets.length > 0) {
      const lastCell = nb.widgets[nb.widgets.length - 1];
      const lastCellSource = lastCell.model.sharedModel ? lastCell.model.sharedModel.getSource() : (lastCell.model.value ? lastCell.model.value.text : '');
      
      if (lastCell.model.type === 'code' && lastCellSource.trim() === '') {
        nb.activeCellIndex = nb.widgets.length - 1;
        targetCell = lastCell;
        await this.sleep(50);
      } else {
        nb.activeCellIndex = nb.widgets.length - 1;
        await this.sleep(50);
        await commands.execute('notebook:insert-cell-below');
        await this.sleep(150);
        targetCell = nb.activeCell;
      }
    } else {
      await commands.execute('notebook:insert-cell-below');
      await this.sleep(150);
      targetCell = nb.activeCell;
    }

    if (type === 'markdown' && targetCell && targetCell.model.type !== 'markdown') {
      await commands.execute('notebook:change-cell-to-markdown');
      await this.sleep(100);
      targetCell = nb.activeCell;
    } else if (type === 'code' && targetCell && targetCell.model.type !== 'code') {
      await commands.execute('notebook:change-cell-to-code');
      await this.sleep(100);
      targetCell = nb.activeCell;
    }

    if (targetCell && targetCell.model && targetCell.model.sharedModel) {
      targetCell.model.sharedModel.setSource(source);
    } else {
      return { ok: false, error: 'Could not access cell model' };
    }

    if (type === 'markdown') {
      await commands.execute('notebook:run-cell');
      await this.sleep(100);
    }

    return { ok: true };
  }`;

content = content.replace(/public async insertCell[\s\S]*?return \{ ok: true \};\r?\n  \}/, newCode);
fs.writeFileSync('src/cellManager.ts', content);
console.log('Patched');