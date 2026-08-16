const fs = require('fs');
const code = fs.readFileSync('app.js.unzipped', 'utf8');

const jsdom = require('jsdom');
const dom = new jsdom.JSDOM(`<body><script>${code.substring(0, 150000)}</script></body>`, { runScripts: "dangerously" });
const window = dom.window;

const funcs = Object.keys(window).filter(k => typeof window[k] === 'function' && window[k].length === 2);
console.log("Functions found:", funcs);

let decoderFunc = null;
for (const f of funcs) {
  try {
    const val = window[f](0x653, 0x665);
    if (typeof val === 'string' && val.length > 0) {
      console.log(`Found string return from ${f}`);
      decoderFunc = window[f];
      break;
    }
  } catch(e) {}
}

if (!decoderFunc) {
  for (const f of funcs) {
    try {
      const val = window[f](0, 0);
      if (typeof val === 'string') {
        console.log(`Found string return from ${f} (0, 0)`);
        decoderFunc = window[f];
        break;
      }
    } catch(e) {}
  }
}

if (decoderFunc) {
  console.log("Decoder works.");
}
