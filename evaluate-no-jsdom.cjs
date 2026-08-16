const fs = require('fs');
const code = fs.readFileSync('app.js.unzipped', 'utf8');
const vm = require('vm');

const arrayStrMatch = code.match(/var\s+TJ\s*=\s*\[\s*((?:['"].*?['"]\s*,?\s*)+)\s*\];/);
const arrayStr = arrayStrMatch[0];

const iifeStrMatch = code.match(/!function\([^)]+\)\{[\s\S]*?\}\(TJ,[^)]+\);/);
const iifeStr = iifeStrMatch[0];

const decoderMatch = code.match(/function\s+a0J\(z,J\)\{[\s\S]*?return\s+a0J\(z,J\);\}/);
const decoderStr = decoderMatch[0];

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(arrayStr + "\n" + iifeStr + "\n" + decoderStr, sandbox);

let foundXg = false;
for (let i = -2000; i < 2000; i++) {
  for (let j = -2000; j < 2000; j++) {
    try {
      const res = sandbox.a0J(i, j);
      if (res === '/sarn') {
        console.log(`/sarn found at a0J(${i}, ${j})`);
        foundXg = true;
      }
      if (res === 'POST') {
        console.log(`POST found at a0J(${i}, ${j})`);
      }
      if (res === 'concat') {
        console.log(`concat found at a0J(${i}, ${j})`);
      }
      if (res === 'n/a') {
        console.log(`n/a found at a0J(${i}, ${j})`);
      }
    } catch(e) {}
  }
}
if(!foundXg) console.log("Not found.");
