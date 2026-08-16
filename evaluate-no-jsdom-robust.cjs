const fs = require('fs');
const code = fs.readFileSync('app.js.unzipped', 'utf8');
const vm = require('vm');

const decoderMatch = code.match(/function\s+a0J\(z,J\)\{[\s\S]*?return\s+a0J\(z,J\);\}/) || code.match(/function\s+a0J\(z,J\)\{[\s\S]*?return[^}]+\}/);
const decoderStr = decoderMatch[0];

const arrayFuncMatch = code.match(/function\s+a0z\(\)\{[\s\S]*?return\s+a0z\(\);\}/) || code.match(/function\s+a0z\(\)\{[\s\S]*?return\s+[a-zA-Z0-9_$]+;\}/);
const arrayFuncStr = arrayFuncMatch[0];

// The IIFE typically looks like !function(a, b){...}(a0z, ...);
const iifeMatch = code.match(/!function\([^)]+\)\{[\s\S]*?\}\(a0z,[^)]+\);/) || code.match(/\(function\([^)]+\)\{[\s\S]*?\}\)\(a0z,[^)]+\);/);
const iifeStr = iifeMatch ? iifeMatch[0] : "";

console.log("Decoder:", decoderStr);
console.log("ArrayFunc:", arrayFuncStr.substring(0, 100) + "...");
console.log("IIFE:", iifeStr.substring(0, 100) + "...");

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(arrayFuncStr + "\n" + decoderStr + "\n" + iifeStr + "\n" + `globalThis.decode = a0J;`, sandbox);

const decode = sandbox.decode;

for (let i = -1000; i < 2000; i++) {
  for (let j = -1000; j < 2000; j++) {
    try {
      const res = decode(i, j);
      if (res === '/sarn') console.log(`/sarn found at ${i}, ${j}`);
      if (res === 'POST') console.log(`POST found at ${i}, ${j}`);
      if (res === 'concat') console.log(`concat found at ${i}, ${j}`);
      if (res === 'n/a') console.log(`n/a found at ${i}, ${j}`);
      if (res === 'uap') console.log(`uap found at ${i}, ${j}`);
    } catch(e) {}
  }
}
