async function test() {
  const url = `https://kodikapi.com/search?token=b3b563060d02ee000ca18740b7842ca0&shikimori_id=20`;
  try {
    const res = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET'
      }
    });
    console.log("Status:", res.status);
    console.log("CORS:", res.headers.get('Access-Control-Allow-Origin'));
  } catch(e) {
    console.error(e.message);
  }
}
test();
