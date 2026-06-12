import https from 'https';

const options = {
  hostname: 'api.remanga.org',
  port: 443,
  path: '/api/search/catalog/?count=5&offset=0',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': '*/* '
  }
};

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (d) => process.stdout.write(d.toString().substring(0,100)));
});

req.on('error', (e) => {
  console.error(e);
});
req.end();
