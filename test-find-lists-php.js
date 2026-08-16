import fs from 'fs';
import path from 'path';

function search(dir) {
  const list = fs.readdirSync(dir);
  for (const f of list) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist' && f !== 'build') {
        search(full);
      }
    } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.json')) {
      const txt = fs.readFileSync(full, 'utf8');
      if (txt.includes('lists.php') || txt.includes('vorf')) {
        console.log(`Found in: ${full}`);
      }
    }
  }
}

search('.');
