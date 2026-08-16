const fs = require('fs');
const code = fs.readFileSync('app.js.unzipped', 'utf8');

const callRegex = /([a-zA-Z0-9_$]+)\s*\(\s*(-?0x[0-9a-fA-F]+|-?[0-9]+)\s*,\s*(-?0x[0-9a-fA-F]+|-?[0-9]+)\s*\)/g;
let match;
while ((match = callRegex.exec(code)) !== null) {
  const funcName = match[1];
  const arg1Str = match[2];
  const arg2Str = match[3];
  const arg1 = parseInt(arg1Str, arg1Str.includes('0x') ? 16 : 10);
  const arg2 = parseInt(arg2Str, arg2Str.includes('0x') ? 16 : 10);
  
  if (funcName === 'XV' && arg1 === 1060) {
    console.log("Found:", match[0]);
    console.log("Context:", code.substring(match.index - 100, match.index + 100));
  }
  if (funcName === 'We' && arg1 === 684) {
    console.log("Found sarn:", match[0]);
    console.log("Context sarn:", code.substring(match.index - 100, match.index + 100));
  }
}
