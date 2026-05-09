const fs = require('fs');
let content = fs.readFileSync('src/cellManager.ts', 'utf8');

const oldRun = `    if (nb.widgets && nb.widgets.length > 0) {
      nb.activeCellIndex = nb.widgets.length - 1;
    }

    const { commands } = this.app;
    await commands.execute('notebook:run-cell');`;

const newRun = `    if (nb.widgets && nb.widgets.length > 0) {
      nb.activeCellIndex = nb.widgets.length - 1;
      await this.sleep(50); // Ensure activeCell is updated before running
    }

    const { commands } = this.app;
    await commands.execute('notebook:run-cell');`;

content = content.replace(oldRun, newRun);
fs.writeFileSync('src/cellManager.ts', content);
console.log('Patched executeLastCell');