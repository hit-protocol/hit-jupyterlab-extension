const fs = require('fs');
let content = fs.readFileSync('src/cellManager.ts', 'utf8');

content = content.replace(/lastCell\.model\.value/g, "(lastCell.model as any).value");
fs.writeFileSync('src/cellManager.ts', content);
console.log('Patched types');