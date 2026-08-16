const fs = require('fs');
const code = fs.readFileSync('app.js.unzipped', 'utf8');
const indexMatch = code.indexOf("aE=We(-0xd8,0x27e)==fileList[We(0x3e8,0x1f8)]");
console.log(code.substring(indexMatch - 500, indexMatch + 1000));
