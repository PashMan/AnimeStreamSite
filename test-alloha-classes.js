import fs from 'fs';

const code = fs.readFileSync('./ShikiPlayer/ShikiPlayer.backup.js', 'utf8');
const lines = code.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('class Alloha') || line.includes('AllohaPlayer') || line.includes('AllohaApi')) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
