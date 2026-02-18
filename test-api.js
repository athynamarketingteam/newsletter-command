// Quick test: call Beehiiv API directly to diagnose the 503 error
require('dotenv').config();
const https = require('https');

const pubId = process.env.BEEHIIV_PUB_ROKO;
const apiKey = process.env.BEEHIIV_API_KEY;

console.log('API Key (first 8 chars):', apiKey?.substring(0, 8) + '...');
console.log('Publication ID:', pubId);

// Test 1: Simple posts fetch (no extra params)
const path = `/v2/publications/${pubId}/posts?limit=3`;
console.log('\nFetching:', path);

const options = {
    hostname: 'api.beehiiv.com',
    path: path,
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Headers:', JSON.stringify(res.headers, null, 2));
        try {
            const json = JSON.parse(body);
            console.log('Response keys:', Object.keys(json));
            if (json.data) {
                console.log('Posts count:', json.data.length);
                if (json.data[0]) {
                    console.log('First post keys:', Object.keys(json.data[0]));
                    console.log('First post title:', json.data[0].title || json.data[0].subject_line);
                    console.log('Has stats?', !!json.data[0].stats);
                }
            }
            if (json.errors) console.log('Errors:', json.errors);
            if (json.message) console.log('Message:', json.message);
        } catch (e) {
            console.log('Raw body (first 500):', body.substring(0, 500));
        }
    });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.end();
