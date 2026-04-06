// api/sync.js — Cross-device user data sync
// For production: replace with Vercel KV (@vercel/kv)
// npm install @vercel/kv  then:  const { kv } = require('@vercel/kv');

// In-memory store (resets on cold start — use Vercel KV for persistence)
const store = {};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const userKey = (req.query.user || '').toLowerCase().trim();

  if (req.method === 'GET') {
    if (!userKey) { res.json(null); return; }
    res.json(store[userKey] || null);
    return;
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { user, data } = body || {};
      if (!user || !data) { res.json({ error: 'Missing user or data' }); return; }
      const key = user.toLowerCase();
      store[key] = { ...data, _updated: Date.now() };
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
