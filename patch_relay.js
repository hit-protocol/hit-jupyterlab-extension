const fs = require('fs');
let content = fs.readFileSync('src/relay.ts', 'utf8');

const oldConditions = `} else if (action === 'execute_last_cell') {
          res = await this.cellManager.executeLastCell();
        }`;

const newConditions = `} else if (action === 'execute_last_cell') {
          res = await this.cellManager.executeLastCell();
        } else if (action === 'update_code') {
          await this.cellManager.updateLastCodeCell(params.source);
          res = await this.cellManager.executeLastCell();
        }`;

content = content.replace(oldConditions, newConditions);
fs.writeFileSync('src/relay.ts', content);
console.log('Added update_code to relay.ts');