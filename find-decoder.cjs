const fs = require('fs');
const js = fs.readFileSync('app.js.unzipped', 'utf8');

// The array usually starts at the very beginning or close to it.
const arrayMatch = js.match(/var\s+[a-zA-Z0-9_$]+\s*=\s*\[\s*(['"].*?['"]\s*,?\s*)+\];/);
if (arrayMatch) {
  console.log("Array match:", arrayMatch[0].substring(0, 100));
}

// Another pattern: const arr = [...]; (function(a, b){...})(arr, ...); function decoder(z, J) {...}
// Let's just output the first 5000 characters to see the structure.
console.log(js.substring(0, 5000));
