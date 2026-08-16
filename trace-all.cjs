const fs = require('fs');
const code = fs.readFileSync('app.js.unzipped', 'utf8');
const vm = require('vm');

const decoderMatch = code.match(/function\s+a0J\(z,J\)\{[\s\S]*?return\s+a0J\(z,J\);\}/) || code.match(/function\s+a0J\(z,J\)\{[\s\S]*?return[^}]+\}/);
const arrayFuncMatch = code.match(/function\s+a0z\(\)\{[\s\S]*?return\s+a0z\(\);\}/) || code.match(/function\s+a0z\(\)\{[\s\S]*?return\s+[a-zA-Z0-9_$]+;\}/);
const iifeMatch = code.match(/!function\([^)]+\)\{[\s\S]*?\}\(a0z,[^)]+\);/) || code.match(/\(function\([^)]+\)\{[\s\S]*?\}\)\(a0z,[^)]+\);/);

let sandboxCode = arrayFuncMatch[0] + "\n" + decoderMatch[0] + "\n" + (iifeMatch ? iifeMatch[0] : "") + "\n";

// Add all wrappers
const wrapperRegex = /function\s+([a-zA-Z0-9_$]+)\s*\(z,\s*J\)\s*\{\s*return\s+([a-zA-Z0-9_$]+)\(([^,]+),\s*([^)]+)\);\s*\}/g;
let match;
while ((match = wrapperRegex.exec(code)) !== null) {
  sandboxCode += match[0] + "\n";
}

sandboxCode += `globalThis.callMap = {};
function logCall(funcName, z, J) {
  try {
    const res = globalThis[funcName](z, J);
    if (typeof res === 'string') {
      globalThis.callMap[funcName + '(' + z + ',' + J + ')'] = res;
      return res;
    }
  } catch(e) {}
}
`;

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(sandboxCode, sandbox);

const callRegex = /([a-zA-Z0-9_$]+)\s*\(\s*(-?0x[0-9a-fA-F]+|-?[0-9]+)\s*,\s*(-?0x[0-9a-fA-F]+|-?[0-9]+)\s*\)/g;
let foundCalls = [];
while ((match = callRegex.exec(code)) !== null) {
  const funcName = match[1];
  const arg1 = match[2];
  const arg2 = match[3];
  if (sandbox[funcName]) {
    foundCalls.push(`logCall("${funcName}", ${arg1}, ${arg2});`);
  }
}

// deduplicate
foundCalls = [...new Set(foundCalls)];
vm.runInContext(foundCalls.join('\n'), sandbox);

const results = sandbox.callMap;
const output = [];
for (const [call, str] of Object.entries(results)) {
  if (str.includes('/sarn') || str.includes('/bnsi') || str.includes('/vorf') || str.includes('wss://') || str.includes('http') || str.includes('concat') || str.includes('uap') || str.includes('token')) {
    output.push(`${call} = ${str}`);
  }
  // also dump /movies, /serials
  if (str.includes('/movie') || str.includes('/serial')) {
    output.push(`${call} = ${str}`);
  }
}

fs.writeFileSync('traced-calls.txt', output.join('\n'));
console.log("Found matching calls:", output.length);

