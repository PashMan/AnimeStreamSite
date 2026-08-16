const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const crypto = require('crypto');

const code = fs.readFileSync('app.js.unzipped', 'utf8');
const firstPart = code.substring(0, 80000); 

const dom = new JSDOM(`<body><script>${firstPart}</script></body>`, { runScripts: "dangerously", url: "https://miyagi-as.stravers.live/" });
const window = dom.window;

let Xg = null;
for (let key of Object.keys(window)) {
  if (typeof window[key] === 'function' && window[key].length === 2) {
    try {
      if (window[key](0x733, 0x434) === '/sarn') {
        Xg = window[key];
        break;
      }
    } catch(e) {}
  }
}

if (!Xg) {
  // try different arguments
  for (let key of Object.keys(window)) {
    if (typeof window[key] === 'function' && window[key].length === 2) {
      try {
        const str = window[key](0x653, 0x665);
        if (str === 'POST' || str === 'GET') {
           Xg = window[key];
           break;
        }
      } catch(e) {}
    }
  }
}

if (!Xg) {
  console.log("Could not find Xg fallback!");
  process.exit(1);
}

console.log("Xg('/sarn'):", Xg(0x733, 0x434));
console.log("Xg('concat'):", Xg(0x427, 0x24d));
console.log("Xg('n/a' 1):", Xg(0x4bc, 0x2b2));
console.log("Xg('n/a' 2):", Xg(0x4bc, 0x332));

