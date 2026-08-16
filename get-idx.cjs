const fs = require('fs');
const lines = fs.readFileSync('all-strings.txt', 'utf8').split('\n');
const get = (z) => {
  const target = z + 717;
  const match = lines.find(l => l.startsWith(`[${target}] = `));
  return match ? match.split(' = ')[1] : 'NOT FOUND';
};
console.log("We(0x486,0x6f9) =", get(0x486)); // token?
console.log("We(-0xd8,0x27e) =", get(-0xd8)); // serial?
console.log("We(0x3e8,0x1f8) =", get(0x3e8)); // type?
console.log("We(0x4d,0x325) =", get(0x4d)); // /serials/?
console.log("We(0x2ac,0x2cf) =", get(0x2ac)); // /bnsi?
console.log("We(-0x47,-0x3e5) =", get(-0x47)); // concat
console.log("We(0x1e5,0x18b) =", get(0x1e5)); // POST
console.log("We(-0x47,-0x7c) =", get(-0x47)); // concat
console.log("We(-0x47,0x2f8) =", get(-0x47)); // concat
