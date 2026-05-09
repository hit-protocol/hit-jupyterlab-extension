const fs = require('fs');
let content = fs.readFileSync('src/cellManager.ts', 'utf8');

const updateFunc = `
  public async updateLastCodeCell(source: string): Promise<{ok: boolean, error?: string}> {
    const nbPanel = this.getActiveNotebook();
    if (!nbPanel) {
      return { ok: false, error: 'No active notebook' };
    }

    const nb = nbPanel.content;
    if (!nb.widgets || nb.widgets.length === 0) {
      return { ok: false, error: 'No cells to update' };
    }

    // Find the last code cell
    let targetCell = null;
    let targetIndex = -1;
    for (let i = nb.widgets.length - 1; i >= 0; i--) {
      if (nb.widgets[i].model.type === 'code') {
        targetCell = nb.widgets[i];
        targetIndex = i;
        break;
      }
    }

    if (!targetCell) {
      return { ok: false, error: 'No code cell found to update' };
    }

    // Update the cell
    nb.activeCellIndex = targetIndex;
    await this.sleep(50);
    
    if (targetCell.model && targetCell.model.sharedModel) {
      targetCell.model.sharedModel.setSource(source);
      this.highlightCell(targetCell);
      return { ok: true };
    } else {
      return { ok: false, error: 'Could not access cell model' };
    }
  }
`;

// Insert the update function into the class before executeLastCell
content = content.replace('public async executeLastCell', updateFunc + '\n  public async executeLastCell');

fs.writeFileSync('src/cellManager.ts', content);
console.log('Added updateLastCodeCell');