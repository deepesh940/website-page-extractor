const https = require('https');

const data = JSON.stringify({ url: 'https://example.com' });

const options = {
  hostname: 'website-page-extractor.vercel.app',
  port: 443,
  path: '/api/extract',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let responseBody = '';
  res.on('data', (chunk) => {
    responseBody += chunk;
  });
  res.on('end', () => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log('Response Body:');
    try {
      console.log(JSON.stringify(JSON.parse(responseBody), null, 2));
    } catch {
      console.log(responseBody);
    }
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
