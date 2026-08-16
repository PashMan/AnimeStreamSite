import fs from 'fs';
import fetch from 'node-fetch';

async function test() {
  const host = "https://larkin-as.stravers.live";
  const appJsUrl = host + "/build/app.1216f2e9.js";
  const appJs = await (await fetch(appJsUrl)).text();

  console.log("Searching for 'a0J' references in app.js...");
  let idx = 0;
  let matches = 0;
  while ((idx = appJs.indexOf('a0J', idx)) !== -1) {
    matches++;
    console.log(`\n=== Match ${matches} at index ${idx} ===`);
    console.log(appJs.slice(Math.max(0, idx - 100), Math.min(appJs.length, idx + 150)));
    idx += 3;
    if (matches >= 40) {
      console.log("... Truncated after 40 matches ...");
      break;
    }
  }
}

test();
