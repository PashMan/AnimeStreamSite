const fs = require('fs');
const html = fs.readFileSync('output2.html', 'utf8');

const regex = /fileList\s*=\s*JSON\.parse\(['"](.*?)['"]\)/;
const match = html.match(regex);
if (match) {
  const jsonStr = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  try {
    const obj = JSON.parse(jsonStr);
    fs.writeFileSync('fileList.json', JSON.stringify(obj, null, 2));
    console.log("fileList.json written.");
  } catch(e) {
    console.log("Parse error:", e);
  }
} else {
  console.log("No fileList found");
}
