import fetch from 'node-fetch';

async function test() {
  const host = "https://larkin-as.stravers.live";
  const appJsUrl = host + "/build/app.1216f2e9.js";
  const mainJsUrl = host + "/build/401.3853f8e4.js";

  console.log("Fetching app.js...");
  const appJs = await (await fetch(appJsUrl)).text();
  console.log("Fetching main.js...");
  const mainJs = await (await fetch(mainJsUrl)).text();

  // Find the exact boundaries of a0z
  const a0zStartIdx = appJs.indexOf('function a0z(){');
  const a0zEndString = 'return a0z();}';
  const a0zEndIdx = appJs.indexOf(a0zEndString) + a0zEndString.length;

  const a0zFuncStr = appJs.slice(a0zStartIdx, a0zEndIdx);
  console.log("Extracted a0z length:", a0zFuncStr.length);

  // Parse out the TJ array body
  const arrayBodyStart = a0zFuncStr.indexOf('[');
  const arrayBodyEnd = a0zFuncStr.lastIndexOf(']') + 1;
  const arrayStr = a0zFuncStr.slice(arrayBodyStart, arrayBodyEnd);

  // Evaluate TJ and define a0z
  const TJ = eval(arrayStr);
  let a0z = function() { return TJ; };

  // Define a0J first so the rotation function can use it
  function a0J(z, J) {
    z = z - (0x9e + 0xb23 * 0x3 + 0x3 * -0xb0d);
    var B = a0z();
    var g = B[z];
    return g;
  }

  // Find rotation loop start and end indices dynamically (without leading paren)
  const rotationStart = appJs.indexOf('function(z,J){var B=z();function Nt(');
  const rotationEndTermStr = '}(a0z,0x8*-0x5e43+0x1962*-0x5+0x1*0x9068e)';
  const rotationEnd = appJs.indexOf(rotationEndTermStr, rotationStart) + rotationEndTermStr.length;

  console.log("rotationStart idx:", rotationStart);
  console.log("rotationEnd idx:", rotationEnd);

  const rotationStr = appJs.slice(rotationStart, rotationEnd);
  console.log("Extracted rotation loop length:", rotationStr.length);

  // Execute rotation loop using eval in the current scope
  // Wrap in parentheses to make it an expression statement that evaluates/executes
  eval('(' + rotationStr + ')');

  console.log("Successfully shifted TJ array!");
  console.log("Shifted array length:", TJ.length);

  // Search for '/lists.php' and '/vorf' positions
  const listsPhpIdx = TJ.indexOf('/lists.php');
  const vorfIdx = TJ.indexOf('/vorf');
  console.log("'/lists.php' is at shifted index:", listsPhpIdx, "-> so z =", listsPhpIdx + 224);
  console.log("'/vorf' is at shifted index:", vorfIdx, "-> so z =", vorfIdx + 224);

  // Let's create a reverse mapping of the deobfuscated strings to find their hex values!
  // This will let us search mainJs for references to those strings!
  const getZForString = (str) => {
    const idx = TJ.indexOf(str);
    if (idx === -1) return null;
    return idx + 224;
  };

  const getHexForString = (str) => {
    const z = getZForString(str);
    if (z === null) return null;
    return '0x' + z.toString(16);
  };

  const stringsToMap = ['/lists.php', '/vorf', 'token', 'token_movie', 'fileList', 'active', 'id_file', 'id', 'file', 'id_translation', 'translation'];
  stringsToMap.forEach(str => {
    const z = getZForString(str);
    const hex = getHexForString(str);
    console.log(`String '${str}': Dec = ${z}, Hex = ${hex}`);
  });
}

test();
