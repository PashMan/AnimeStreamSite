const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const crypto = require('crypto');

const code = fs.readFileSync('app.js.unzipped', 'utf8');
const firstPart = code.substring(0, 80000); // contains the array and decoder

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
  console.log("Could not find Xg!");
  process.exit(1);
}

const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const host = "miyagi-as.stravers.live";
const targetUrl = "https://miyagi-as.stravers.live/?token_movie=f174d1e9bc42d32d073a2914fd1334&token=04941a9a3ca3ac16e2b4327347bbc1";

async function runSarn() {
  // We need to implement DR.
  // Wait, let's look at the source for `aC` construction again.
  // aC = ''[Xg(0x427,0x24d)](av,'|')[Xg(0x427,0x309)](aO,'|')[Xg(0x427,0x291)](aV,'|')[Xg(0x427,0x3f0)](al||Xg(0x4bc,0x2b2),'|')[Xg(0x427,0x4a7)](al||Xg(0x4bc,0x332))
  console.log("Concat method:", Xg(0x427, 0x24d)); // should be 'concat'
  console.log("Fallback 1:", Xg(0x4bc, 0x2b2)); // 'n/a' ?
  console.log("Fallback 2:", Xg(0x4bc, 0x332)); // 'n/a' ?
  
  // DR logic:
  // al = DR(window[Xg(0x2ad,0x27b)][Xg(0x312,0x2c3)])
  console.log("DR arg obj:", Xg(0x2ad, 0x27b)); // probably 'location'
  console.log("DR arg prop:", Xg(0x312, 0x2c3)); // probably 'ancestorOrigins'
  
  // For window.location.ancestorOrigins, it's a DOMStringList. If in iframe, it's the parent origin.
  // If not in iframe, it might be undefined or empty.
  // The applet is running standalone, so parentOrigin might be empty string or 'n/a' or the referrer.
  // Let's see what aO is.
  console.log("aO is adblock status. Passed as '0' in my test.");
  
  // Let's do a request to /sarn to get a fresh challenge.
  const res = await fetch(`https://${host}/sarn`, { headers: { 'User-Agent': ua, 'Referer': targetUrl } });
  const data = await res.json();
  
  const av = data.nonce;
  const aV = data.uap;
  const aA = data.challenge;
  const aO = '0';
  const fallback = Xg(0x4bc, 0x2b2); // usually 'n/a'
  
  // Try al = fallback first
  const aC = "".concat(av, '|').concat(aO, '|').concat(aV, '|').concat(fallback, '|').concat(fallback);
  const aR = crypto.createHash('sha256').update(aC).digest('hex');
  
  console.log("aC:", aC);
  
  const res2 = await fetch(`https://${host}/sarn`, {
    method: 'POST',
    headers: {
      'User-Agent': ua,
      'Referer': targetUrl,
      'Content-Type': 'application/json',
      'accepts-block': aO
    },
    body: JSON.stringify({
      challenge: aA,
      proof: aR,
      parentOrigin: fallback === 'n/a' ? '' : fallback,
      referrer: targetUrl // this was document.referrer
    })
  });
  
  console.log("Status:", res2.status);
  console.log(await res2.text());
}

runSarn().catch(console.error);
