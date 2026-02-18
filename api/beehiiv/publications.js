const { beehiivFetch, setCorsHeaders } = require('../_helpers');

module.exports = async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    try {
        const result = await beehiivFetch('/v2/publications');
        res.status(result.statusCode);
        return res.end(result.body);

    } catch (err) {
        return res.status(500).json({ error: 'Proxy request failed', details: err.message });
    }
};
