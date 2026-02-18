const { setCorsHeaders, PUB_PREFIX_MAP } = require('../_helpers');

module.exports = async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    try {
        if (req.method === 'GET') {
            // Return all configured newsletters (from .env defaults)
            const allNewsletters = PUB_PREFIX_MAP.map(entry => ({
                slug: entry.prefix,
                pubId: entry.pubId ? ('***' + entry.pubId.slice(-6)) : '',
                hasPubId: !!entry.pubId,
                isDefault: true
            }));

            return res.status(200).json({ newsletters: allNewsletters });
        }

        // POST and DELETE are not supported in serverless (no filesystem for newsletters.json)
        // In the deployed version, newsletter config comes from env vars only
        if (req.method === 'POST' || req.method === 'DELETE') {
            return res.status(400).json({
                error: 'Newsletter management is not available in the deployed version. Configure newsletters via Vercel environment variables.'
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (err) {
        return res.status(500).json({ error: 'Server error', details: err.message });
    }
};
