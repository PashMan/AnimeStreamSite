import fs from 'fs';
import path from 'path';

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const fullPath = path.join(dir, f);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.js')) {
      const code = fs.readFileSync(fullPath, 'utf8');
      if (code.includes('KamiPlayer (1080p)')) {
        console.log(`Found in file: ${fullPath}`);
      }
    }
  }
}

searchDir('./pages');
searchDir('./components');
searchDir('./services');
searchDir('./utils');
