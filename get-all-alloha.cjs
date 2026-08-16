const fs = require('fs');
const js = fs.readFileSync('app.js.unzipped', 'utf8') + fs.readFileSync('401.js.unzipped', 'utf8');

const regex = /https?:\/\/[a-zA-Z0-9.\-]+\/(?:bnsi|movies|serials|sarn|vorf)[^\s"']*/g;
const matches = [...new Set(js.match(regex))];
console.log(matches.slice(0, 50));
