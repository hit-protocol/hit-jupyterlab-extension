const fs = require('fs');
let content = fs.readFileSync('src/relay.ts', 'utf8');

const oldOpen = `    this.socket.onopen = () => {
      this.socket.send(JSON.stringify({ type: 'HIT_HELLO', payload: { version: '11.0 (Extension)' } }));
    };`;

const newOpen = `    this.socket.onopen = () => {
      this.socket.send(JSON.stringify({ type: 'HIT_HELLO', payload: { version: '11.0 (Extension)' } }));
      // Initial sync of cells
      setTimeout(() => this.syncCells(), 500);
    };`;

content = content.replace(oldOpen, newOpen);
fs.writeFileSync('src/relay.ts', content);
console.log('Added initial syncCells to relay.ts');