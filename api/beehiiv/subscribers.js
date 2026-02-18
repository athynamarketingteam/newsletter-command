const { beehiivFetch, resolvePublicationId, setCorsHeaders } = require('../_helpers');

module.exports = async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const { newsletter } = req.query;
    const pubId = resolvePublicationId(newsletter);

    if (!pubId) {
        return res.status(400).json({ error: `Unknown newsletter: ${newsletter}` });
    }

    try {
        const result = await beehiivFetch(
            `/v2/publications/${pubId}?expand[]=stats`
        );

        res.status(result.statusCode);
        return res.end(result.body);

    } catch (err) {
        return res.status(500).json({ error: 'Proxy request failed', details: err.message });
    }
};
