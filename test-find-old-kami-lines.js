import fs from 'fs';

['./services/balancer.ts', './utils/clientDecoder.ts'].forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  const lines = code.split('\n');
  lines.forEach((l, idx) => {
    if (l.includes('KamiPlayer (1080p)')) {
      console.log(`${file} Line ${idx+1}: ${l}`);
    }
  });
});
