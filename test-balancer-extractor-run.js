import { extractBalancersM3u8 } from './utils/balancerExtractor.js';

async function run() {
  const iframeUrl = "https://larkin-as.stravers.live/?token_movie=9c40cb0e1e9af056f56de910be1ec1&token=d317441359e505c343c2063edc97e7&episode=1";
  console.log("Running extractor...");
  const result = await extractBalancersM3u8(iframeUrl);
  console.log("\n=== Extractor Result ===");
  console.log("m3u8Url:", result.m3u8Url);
  console.log("headers:", result.headers);
  console.log("htmlLength:", result.htmlLength);
  console.log("\n=== Logs ===");
  console.log(result.logs.join('\n'));
}

run().catch(console.error);
