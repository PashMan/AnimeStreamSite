import fs from 'fs';

const js = fs.readFileSync('./ShikiPlayer/ShikiPlayer.backup.js', 'utf8');
console.log("Size:", js.length);

// Let's search for "alloha" or "stravers" or "lists.php" or "vorf" in the entire codebase
function searchCode(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
    const full = `${dir}/${file}`;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      searchCode(full);
    } else if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx')) {
      const code = fs.readFileSync(full, 'utf8');
      if (code.includes('lists.php') || code.includes('vorf') || code.includes('alloha')) {
        console.log(`Found in: ${full}`);
      }
    }
  }
}

searchCode('.');
