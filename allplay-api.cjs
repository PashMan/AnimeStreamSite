const crypto = require('crypto');

// The decoding functions extracted from app.js
function a5(aS){var aO=arguments['length']>1&&void 0!==arguments[1]&&arguments[1],ah=aS['length'];if(ah<=1)return aS;function aU(al){if(al<2)return false;if(al%2==0)return 2===al;for(var aC=3;aC*aC<=al;aC+=2)if(al%aC===0)return false;return true;}for(var ax=function(al){for(var aC=Math.max(2,al);!aU(aC);)aC++;return aC;}(ah+1),aj=new Array(ah).fill(false),ac=[],aE=0;ac.length<ah;)(aE=(aE+1)%ax)<ah&&!aj[aE]&&(ac.push(aE),aj[aE]=true);for(var aA=new Array(ah),av=0;av<ah;av++)aA[ac[av]]=aS[av];var aV=aA.join('');return aO&&aV.length>2&&(aV=aV.slice(1)+aV[0]),aV;}
function a6(aS){var aO=arguments['length']>1&&void 0!==arguments[1]&&arguments[1],ah=aS['length'];if(ah<=1)return aS;for(var aU=1;1<<aU<ah;)aU++;function ax(aZ){if(0===aZ)return aU;for(var aG=0;!(1&aZ);)aG++,aZ>>=1;return aG;}for(var aj=new Array(aU+1).fill(0),ac=0;ac<ah;ac++)aj[ax(ac)]++;for(var aE=new Array(aU+1),aA=0,av=0;av<=aU;av++)aE[av]=aS.slice(aA,aA+aj[av]),aA+=aj[av];for(var aV=new Array(aU+1).fill(0),al=new Array(ah),aC=0;aC<ah;aC++){var aR=ax(aC);al[aC]=aE[aR].charAt(aV[aR]++);}var aM=al.join('');return aO&&aM.length>2&&(aM=aM.slice(-1)+aM.slice(0,-1)),aM;}
function a7(aS){var aO=arguments['length']>1&&void 0!==arguments[1]&&arguments[1],ah=aS['length'];if(ah<=1)return aS;for(var aU=0;1<<aU<ah;)aU++;function ax(aG){if(0===aG)return 0;for(var ad=0;aG>0;)ad++,aG>>=1;return ad-1;}for(var aj=new Array(aU+1).fill(0),ac=0;ac<ah;ac++)aj[ax(ac)]++;for(var aE=new Array(aU+1),aA=0,av=0;av<=aU;av++)aE[av]=aS.slice(aA,aA+aj[av]),aA+=aj[av];for(var aV=new Array(aU+1).fill(0),al=new Array(ah),aC=0;aC<ah;aC++){var aR=ax(aC);al[aC]=aE[aR].charAt(aV[aR]++);}var aM=al.join('');return aO&&aM.length>2&&(aM=aM.slice(1)+aM[0]),aM;}

function generateBorthPart(wl, wV = false) {
  return a5(a6(a7(wl, wV), wV), wV);
}

function generateFingerprintHash() {
  // Generates a mock SHA-256 fingerprint hash (similar to what the browser canvas/webgl fingerprint creates)
  const fakeFingerprintStr = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 
    "Asia/Tashkent", 
    "1920x1080",
    "true", // plugins
    "canvas_hash_mock_12345",
    "Google Inc. (NVIDIA)|ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)"
  ].join('||');
  return crypto.createHash('sha256').update(fakeFingerprintStr).digest('hex');
}

/**
 * Returns the headers and payload required to fetch the video stream.
 * @param {string} viewportiContent - The content of <meta name="viewporti" content="...">
 * @param {string} controlshiddenToken - The token from window.userParam['controlshidden']
 */
function getApiRequestParams(viewportiContent, controlshiddenToken) {
  const wv = generateFingerprintHash();
  const borthPart = generateBorthPart(viewportiContent, false);
  const borthHeader = `${wv}|${borthPart}`;
  
  return {
    headers: {
      'Borth': borthHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'https://allplay.uz',
      'Referer': 'https://allplay.uz/'
    },
    body: `token=${encodeURIComponent(controlshiddenToken)}&av1=0&autoplay=0`
  };
}

module.exports = {
  getApiRequestParams,
  generateBorthPart
};
