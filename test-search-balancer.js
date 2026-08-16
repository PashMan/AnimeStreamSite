import fs from 'fs';

const code = fs.readFileSync('./server.ts', 'utf8');
const lines = code.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('/api/balancer')) {
    console.log(`Line ${idx + 1}: ${line}`);
    for (let i = -5; i <= 30; i++) {
      if (lines[idx + i]) {
        console.log(`  ${idx + 1 + i}: ${lines[idx + i]}`);
      }
    }
  }
});
