const fs = require('fs');
const code = fs.readFileSync('app.js.unzipped', 'utf8');
const vm = require('vm');

const decoderMatch = code.match(/function\s+a0J\(z,J\)\{[\s\S]*?return\s+a0J\(z,J\);\}/) || code.match(/function\s+a0J\(z,J\)\{[\s\S]*?return[^}]+\}/);
const arrayFuncMatch = code.match(/function\s+a0z\(\)\{[\s\S]*?return\s+a0z\(\);\}/) || code.match(/function\s+a0z\(\)\{[\s\S]*?return\s+[a-zA-Z0-9_$]+;\}/);
const iifeMatch = code.match(/!function\([^)]+\)\{[\s\S]*?\}\(a0z,[^)]+\);/) || code.match(/\(function\([^)]+\)\{[\s\S]*?\}\)\(a0z,[^)]+\);/);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(arrayFuncMatch[0] + "\n" + decoderMatch[0] + "\n" + (iifeMatch ? iifeMatch[0] : "") + "\n" + `globalThis.decode = a0J;`, sandbox);

const decode = sandbox.decode;

// Find all occurrences of function calls that look like decoder calls
// e.g. a0J(0x427, 0x24d) or any 2-letter function name like nC(0xb47,0x962)
const callRegex = /[a-zA-Z0-9_$]+\s*\(\s*(-?0x[0-9a-fA-F]+|-?[0-9]+)\s*,\s*(-?0x[0-9a-fA-F]+|-?[0-9]+)\s*\)/g;
let match;
const results = new Map();

while ((match = callRegex.exec(code)) !== null) {
  const arg1 = parseInt(match[1], match[1].startsWith('0x') || match[1].startsWith('-0x') ? 16 : 10);
  const arg2 = parseInt(match[2], match[2].startsWith('0x') || match[2].startsWith('-0x') ? 16 : 10);
  
  // We don't know which function is a wrapper for a0J.
  // The wrappers usually do something like `return a0J(z - 0x123, J)`
  // Since there are many wrappers with different offsets, we can't just call decode(arg1, arg2).
  // But wait! We can just look at the wrappers themselves!
}

// Better approach: parse the wrapper functions!
const wrapperRegex = /function\s+([a-zA-Z0-9_$]+)\s*\(z,\s*J\)\s*\{\s*return\s+(?:a0J|([a-zA-Z0-9_$]+))\(([^,]+),\s*([^)]+)\);\s*\}/g;
const wrappers = {};
while ((match = wrapperRegex.exec(code)) !== null) {
  wrappers[match[1]] = { arg1: match[3], arg2: match[4] };
}
console.log("Wrappers found:", Object.keys(wrappers).length);
fs.writeFileSync('wrappers.json', JSON.stringify(wrappers, null, 2));

