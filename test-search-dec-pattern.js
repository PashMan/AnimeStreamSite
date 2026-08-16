import fetch from 'node-fetch';

async function test() {
  const host = "https://larkin-as.stravers.live";
  const mainJsUrl = host + "/build/401.3853f8e4.js";

  console.log("Fetching main.js...");
  const mainJs = await (await fetch(mainJsUrl)).text();

  const searchPatterns = [
    '2628', '1986', '2659'
  ];

  searchPatterns.forEach(pattern => {
    console.log(`\n--- Searching for decimal pattern '${pattern}' in main.js ---`);
    let mIdx = 0;
    while ((mIdx = mainJs.indexOf(pattern, mIdx)) !== -1) {
      console.log(`Found at index ${mIdx}:`);
      console.log(mainJs.slice(Math.max(0, mIdx - 150), Math.min(mainJs.length, mIdx + 150)));
      mIdx += pattern.length;
    }
  });
}

test();
