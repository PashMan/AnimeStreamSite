const fs = require('fs');
const code = fs.readFileSync('app.js.unzipped', 'utf8');
const vm = require('vm');

const decoderMatch = code.match(/function\s+a0J\(z,J\)\{[\s\S]*?return[^}]+\}/);
const arrayFuncMatch = code.match(/function\s+a0z\(\)\{[\s\S]*?return\s+[a-zA-Z0-9_$]+;\}/);
const iifeMatch = code.match(/!function\([^)]+\)\{[\s\S]*?\}\(a0z,[^)]+\);/);

let sandboxCode = arrayFuncMatch[0] + "\n" + decoderMatch[0] + "\n" + (iifeMatch ? iifeMatch[0] : "") + "\n";
const wrapperRegex = /function\s+([a-zA-Z0-9_$]+)\s*\(z,\s*J\)\s*\{\s*return\s+([a-zA-Z0-9_$]+)\(([^,]+),\s*([^)]+)\);\s*\}/g;
let match;
while ((match = wrapperRegex.exec(code)) !== null) {
  sandboxCode += match[0] + "\n";
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(sandboxCode, sandbox);

function evalStr(func, z, J) {
  try {
    return sandbox[func](z, J);
  } catch(e) { return null; }
}

console.log("We(0x486,0x6f9) =", evalStr('We', 0x486, 0x6f9));
console.log("We(-0xd8,0x27e) =", evalStr('We', -0xd8, 0x27e));
console.log("We(0x3e8,0x1f8) =", evalStr('We', 0x3e8, 0x1f8));
console.log("We(0x4d,0x325) =", evalStr('We', 0x4d, 0x325));
console.log("We(0x2ac,0x2cf) =", evalStr('We', 0x2ac, 0x2cf));
console.log("We(-0x47,-0x3e5) =", evalStr('We', -0x47, -0x3e5));
console.log("We(0x1e5,0x18b) =", evalStr('We', 0x1e5, 0x18b));
console.log("We(-0x47,-0x7c) =", evalStr('We', -0x47, -0x7c));
console.log("We(-0x47,0x2f8) =", evalStr('We', -0x47, 0x2f8));

