const https = require('https');

const BEEHIIV_BASE = 'https://api.beehiiv.com/v2';

// Map newsletter slug PREFIXES → .env Publication ID keys
const PUB_PREFIX_MAP = [
    { prefix: 'roko-basilisk', pubId: process.env.BEEHIIV_PUB_ROKO, isDefault: true },
    { prefix: 'memorandum', pubId: process.env.BEEHIIV_PUB_MEMORANDUM, isDefault: true },
    { prefix: 'open-source-ceo-by-bill-kerr', pubId: process.env.BEEHIIV_PUB_OPENSOURCE, isDefault: true },
];

function beehiivFetch(apiPath) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.beehiiv.com',
            path: apiPath,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.BEEHIIV_API_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        const apiReq = https.request(options, (apiRes) => {
            let body = '';
            apiRes.on('data', chunk => body += chunk);
            apiRes.on('end', () => {
                resolve({ statusCode: apiRes.statusCode, body });
            });
        });

        apiReq.on('error', (err) => {
            reject(err);
        });
        apiReq.end();
    });
}

function resolvePublicationId(newsletter) {
    const match = PUB_PREFIX_MAP.find(entry =>
        newsletter === entry.prefix || newsletter.startsWith(entry.prefix)
    );
    if (match && match.pubId) return match.pubId;
    return null;
}

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = { beehiivFetch, resolvePublicationId, setCorsHeaders, PUB_PREFIX_MAP };
