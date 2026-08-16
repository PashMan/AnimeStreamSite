import fs from 'fs';

const code = fs.readFileSync('./pages/Details.tsx', 'utf8');
const lines = code.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('const [players') || l.includes('setPlayers') || l.includes('selectedPlayer') || l.includes('const [selectedPlayer')) {
    console.log(`Line ${idx+1}: ${l}`);
  }
});
