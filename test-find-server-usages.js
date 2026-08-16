import fs from 'fs';

const fileContent = fs.readFileSync('./server.ts', 'utf8');
const lines = fileContent.split('\n');

lines.forEach((line, index) => {
  if (line.includes('lists.php') || line.includes('vorf') || line.includes('alloha')) {
    console.log(`Line ${index + 1}: ${line}`);
    for (let i = -3; i <= 3; i++) {
      if (lines[index + i]) {
        console.log(`  ${index + 1 + i}: ${lines[index + i]}`);
      }
    }
  }
});
