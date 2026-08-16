const token = "kviy_oK7xnynn9bZDcnUaOA2qTKzRKkH8RfawRm74ctehjHIvdbLdcayjb2pRHWAP1_aTQIWHXzlnI0rjVducLBMhkxY2pxmt70KrB_wkEcekMrCOMpJnKPJW8WUy-ZEplI3VGfkA6IFTozF5eKRweHemoSM4rqC7tUUEJcpze78Kug8kSvaJUKN5Q32SbyqOIwPGlhHQ8S--alwqjBXUnklNyoEN6x0ZDkJACq8BBGcjA";

// Try standard url-safe base64
function decodeBase64(str) {
  try {
    let normalized = str.replace(/-/g, '+').replace(/_/g, '/');
    while (normalized.length % 4) normalized += '=';
    const buf = Buffer.from(normalized, 'base64');
    console.log("Base64 decoded bytes length:", buf.length);
    console.log("Base64 decoded UTF-8 string:", buf.toString('utf-8'));
    console.log("Base64 decoded Hex:", buf.toString('hex'));
  } catch (e) {
    console.log("Base64 decode failed:", e.message);
  }
}

decodeBase64(token);
