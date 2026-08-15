import fs from 'fs';

const serverCode = fs.readFileSync('./server.ts', 'utf8');
const lines = serverCode.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('extractBalancersM3u8')) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
