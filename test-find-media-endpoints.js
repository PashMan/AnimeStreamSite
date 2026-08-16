import fs from 'fs';

const code = fs.readFileSync('./server.ts', 'utf8');
const lines = code.split('\n');
lines.forEach((line, idx) => {
  if (line.includes("app.get('/api/media") || line.includes("app.post('/api/media") || line.includes("app.all('/api/media")) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
