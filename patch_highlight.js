const fs = require('fs');
let content = fs.readFileSync('src/cellManager.ts', 'utf8');

const highlightFunc = `
  private highlightCell(cell: any) {
    if (cell && cell.node) {
      cell.node.style.transition = 'box-shadow 0.3s ease, background-color 0.3s ease';
      cell.node.style.boxShadow = 'inset 4px 0 0 0 #a32cf1, 0 0 12px rgba(163, 44, 241, 0.2)';
      cell.node.style.backgroundColor = 'rgba(163, 44, 241, 0.02)';
      
      setTimeout(() => {
        if (cell && cell.node) {
          cell.node.style.boxShadow = 'inset 4px 0 0 0 rgba(163, 44, 241, 0.4)';
          cell.node.style.backgroundColor = '';
        }
      }, 1500);
    }
  }
`;

// Insert the highlight function into the class
content = content.replace('private sleep(ms: number): Promise<void> {', highlightFunc + '\n  private sleep(ms: number): Promise<void> {');

// Add highlightCell(targetCell) at the end of insertCell
content = content.replace('return { ok: true };\n  }', 'this.highlightCell(targetCell);\n    return { ok: true };\n  }');

// Also highlight activeCell in executeLastCell
content = content.replace('const activeCell = nb.activeCell;', 'const activeCell = nb.activeCell;\n    this.highlightCell(activeCell);');

fs.writeFileSync('src/cellManager.ts', content);
console.log('Added highlighting logic');