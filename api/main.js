// api/main.js — Serve API keys from environment variables
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  res.json({
    gemini  : process.env.GEMINI_KEY   || '',
    claude  : process.env.CLAUDE_KEY   || '',
    openai  : process.env.OPENAI_KEY   || '',
    grok    : process.env.GROK_KEY     || '',
    deepseek: process.env.DEEPSEEK_KEY || '',
    mistral : process.env.MISTRAL_KEY  || '',
    version : '3.5',
  });
};
