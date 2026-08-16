import fs from 'fs';

const code = fs.readFileSync('./components/CustomPlayer.tsx', 'utf8');
const lines = code.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('hls.loadSource') || line.includes('video.src =') || line.includes('hls.on')) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
