const fs = require('fs');
const code = fs.readFileSync('app.js.unzipped', 'utf8');

const prefix = "var TJ=['subtitle',";
if (!code.startsWith(prefix)) {
  console.log("Unexpected start of code.");
  process.exit(1);
}

// Find the string array
const arrayMatch = code.match(/var\s+TJ\s*=\s*\[\s*((?:['"].*?['"]\s*,?\s*)+)\s*\];/);
if (!arrayMatch) {
  console.log("Could not find array.");
  process.exit(1);
}
const arrayStr = arrayMatch[0];

// Find the IIFE that rotates the array
const iifeMatch = code.match(/!function\([^)]+\)\{[\s\S]*?\}\(TJ,[^)]+\);/);
if (!iifeMatch) {
  console.log("Could not find IIFE.");
  process.exit(1);
}
const iifeStr = iifeMatch[0];

// Find the decoder function
const decoderMatch = code.match(/function a0J\(z,J\)\{[\s\S]*?return a0J\(z,J\);\}/);
let decoderStr = "";
if (decoderMatch) {
  decoderStr = decoderMatch[0];
} else {
  // alternative
  const altDecoderMatch = code.match(/function\s+[a-zA-Z0-9_$]+\(z,J\)\{[\s\S]*?return\s+[a-zA-Z0-9_$]+\(z,J\);\}/);
  if (altDecoderMatch) {
    decoderStr = altDecoderMatch[0];
  }
}

if (!decoderStr) {
  console.log("Could not find decoder.");
  process.exit(1);
}

// Evaluate it
try {
  eval(arrayStr + "\n" + iifeStr + "\n" + decoderStr + "\n" + "global.decode = a0J;");
  console.log("Decoded /sarn:");
  let foundSarn = false;
  // Let's brute force the arguments around 0-2000
  for (let i = -1000; i < 2000; i++) {
    for (let j = -1000; j < 2000; j++) {
      try {
        const str = global.decode(i, j);
        if (str === '/sarn' || str === 'POST') {
          console.log(`decode(${i}, ${j}) = ${str}`);
          foundSarn = true;
          // break out if we found both, but let's just print
        }
      } catch(e) {}
    }
  }
} catch(e) {
  console.log("Eval error:", e);
}
