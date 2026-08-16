import fetch from 'node-fetch';

async function test() {
  const host = "https://larkin-as.stravers.live";
  const appJsUrl = host + "/build/app.1216f2e9.js";
  const mainJsUrl = host + "/build/401.3853f8e4.js";

  console.log("Fetching app.js...");
  const appJs = await (await fetch(appJsUrl)).text();
  console.log("Fetching main.js...");
  const mainJs = await (await fetch(mainJsUrl)).text();

  // We are searching for the exact unshifted hex representations:
  // - 0xa44 (for /lists.php)
  // - 0x7c2 (for /vorf)
  // - 0xa63 (for token)
  
  const searchPatterns = [
    '0xa44', '0x7c2', '0xa63'
  ];

  searchPatterns.forEach(pattern => {
    console.log(`\n--- Searching for '${pattern}' in app.js ---`);
    let idx = 0;
    while ((idx = appJs.indexOf(pattern, idx)) !== -1) {
      console.log(`Found in app.js at index ${idx}:`);
      console.log(appJs.slice(Math.max(0, idx - 150), Math.min(appJs.length, idx + 150)));
      idx += pattern.length;
    }

    console.log(`\n--- Searching for '${pattern}' in main.js ---`);
    let mIdx = 0;
    while ((mIdx = mainJs.indexOf(pattern, mIdx)) !== -1) {
      console.log(`Found in main.js at index ${mIdx}:`);
      console.log(mainJs.slice(Math.max(0, mIdx - 150), Math.min(mainJs.length, mIdx + 150)));
      mIdx += pattern.length;
    }
  });
}

test();
