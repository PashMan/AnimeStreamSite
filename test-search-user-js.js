import fs from 'fs';

const fileContent = fs.readFileSync('./ShikiPlayer/ShikiPlayer.user.js', 'utf8');
const lines = fileContent.split('\n');

lines.forEach((line, index) => {
  if (line.toLowerCase().includes('alloha')) {
    console.log(`Line ${index + 1}: ${line}`);
    for (let i = -5; i <= 5; i++) {
      if (lines[index + i]) {
        console.log(`  ${index + 1 + i}: ${lines[index + i]}`);
      }
    }
  }
});
