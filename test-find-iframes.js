import fs from 'fs';

const code = fs.readFileSync('./pages/Details.tsx', 'utf8');
const matches = code.match(/<iframe[\s\S]*?\/>/g) || [];
console.log(`Found ${matches.length} matches of <iframe />:`);
matches.forEach(m => console.log(m));
