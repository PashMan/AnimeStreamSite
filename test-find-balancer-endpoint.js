import fs from 'fs';

const code = fs.readFileSync('./server.ts', 'utf8');
const lines = code.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('app.get(\'/api/balancer\'') || line.includes('app.get("/api/balancer"')) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
