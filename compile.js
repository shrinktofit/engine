
console.time(`c`);
const cp = require('child_process');
const ps = require('path');
cp.execSync(`${ps.join('.', 'node_modules', '.bin', 'tsc')} --incremental`);
console.timeEnd(`c`);