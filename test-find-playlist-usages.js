import fs from 'fs';

const code = fs.readFileSync('./pages/Details.tsx', 'utf8');
const lines = code.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('/api/media/playlist')) {
    console.log(`Line ${idx + 1}: ${line}`);
    // Print around it
    for (let i = -5; i <= 5; i++) {
      if (lines[idx + i]) {
        console.log(`  ${idx + 1 + i}: ${lines[idx + i]}`);
      }
    }
  }
});
