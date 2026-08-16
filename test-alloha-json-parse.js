import fetch from 'node-fetch';

async function test() {
  const host = "https://larkin-as.stravers.live";
  const f = "/build/app.1216f2e9.js";
  const res = await fetch(host + f);
  const js = await res.text();
  console.log("Index of 0x9068e:", js.indexOf("0x9068e"));
  console.log("Context around 0x9068e:");
  const idx = js.indexOf("0x9068e");
  if (idx !== -1) {
    console.log(js.slice(idx - 100, idx + 100));
  }
}

test();
