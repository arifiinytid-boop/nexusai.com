// api/redeem.js — NEXUS AI Redeem Code Handler v2
// Codes dengan expiry dates yang berbeda-beda
// Format env REDEEM_CODES: CODE:credits:plan:maxUses:expires,CODE2:...

import { readFileSync, writeFileSync, existsSync } from 'fs';

const USED_FILE = '/tmp/nexus_redeemed.json';

// Hardcoded codes dengan expiry
// expires: 'YYYY-MM-DD' atau 'never'
const BUILTIN_CODES = {
  // === GENERAL CODES (no expiry) ===
  'NEXUS2026':      { credits: 50,  plan: null,  maxUses: 9999, expires: '2026-12-31', desc: 'Welcome NEXUS AI 2026' },
  'DISCORD100':     { credits: 100, plan: null,  maxUses: 9999, expires: '2026-12-31', desc: 'Discord community bonus' },
  'FREECREDITS':    { credits: 30,  plan: null,  maxUses: 9999, expires: 'never',      desc: 'Free credits starter' },
  'ROBLOXDEV':      { credits: 75,  plan: null,  maxUses: 9999, expires: '2026-08-31', desc: 'Roblox developer bonus' },

  // === LIMITED TIME CODES ===
  'LAUNCH50':       { credits: 50,  plan: null,  maxUses: 500,  expires: '2026-05-31', desc: 'Launch promo (500 uses)' },
  'SUMMER2026':     { credits: 60,  plan: null,  maxUses: 9999, expires: '2026-09-30', desc: 'Summer special 2026' },
  'APRIL2026':      { credits: 40,  plan: null,  maxUses: 9999, expires: '2026-04-30', desc: 'April bonus' },
  'MAY2026':        { credits: 45,  plan: null,  maxUses: 9999, expires: '2026-05-31', desc: 'May bonus' },
  'JUNI2026':       { credits: 50,  plan: null,  maxUses: 9999, expires: '2026-06-30', desc: 'Juni bonus' },
  'STUDIOBUILD':    { credits: 40,  plan: null,  maxUses: 500,  expires: '2026-07-31', desc: 'Studio builder pack' },

  // === CREATOR PACKS ===
  'CREATOR200':     { credits: 200, plan: null,  maxUses: 200,  expires: '2026-12-31', desc: 'Creator pack (200 uses)' },
  'DEVPACK100':     { credits: 100, plan: null,  maxUses: 300,  expires: '2026-10-31', desc: 'Dev pack' },
  'BUILDER150':     { credits: 150, plan: null,  maxUses: 150,  expires: '2026-08-31', desc: 'Builder pack' },
  'SCRIPTER80':     { credits: 80,  plan: null,  maxUses: 400,  expires: '2026-09-30', desc: 'Scripter pack' },

  // === VIP / PRO UPGRADES ===
  'NEXUSPRO':       { credits: 200, plan: 'pro', maxUses: 10,   expires: '2026-06-30', desc: 'Pro plan upgrade (10 uses)' },
  'NEXUSVIP500':    { credits: 500, plan: 'pro', maxUses: 5,    expires: '2026-05-31', desc: 'VIP special (5 uses)' },
  'MEGAPACK':       { credits: 300, plan: 'pro', maxUses: 10,   expires: '2026-06-30', desc: 'Mega upgrade (10 uses)' },
  'PROMONTH':       { credits: 250, plan: 'pro', maxUses: 25,   expires: '2026-07-31', desc: 'Pro monthly (25 uses)' },
  'NEXUSVIP':       { credits: 500, plan: 'pro', maxUses: 3,    expires: '2026-05-15', desc: 'VIP exclusive (3 uses)' },

  // === ONE-TIME SPECIAL ===
  'BETA2025':       { credits: 100, plan: null,  maxUses: 50,   expires: '2026-04-30', desc: 'Beta tester reward' },
  'EARLYBIRD':      { credits: 120, plan: null,  maxUses: 30,   expires: '2026-04-25', desc: 'Early adopter bonus' },
  'QWIEWIEUWI':     { credits: 150, plan: null,  maxUses: 9999, expires: 'never',      desc: 'Special community code' },
  'NEXUSLOVE':      { credits: 70,  plan: null,  maxUses: 9999, expires: '2026-12-31', desc: 'From NEXUS with love' },

  // === YOUTUBE / SOCIAL ===
  'YOUTUBE50':      { credits: 50,  plan: null,  maxUses: 9999, expires: '2026-12-31', desc: 'YouTube subscriber bonus' },
  'SUBSCRIBE100':   { credits: 100, plan: null,  maxUses: 1000, expires: '2026-12-31', desc: 'Subscribe & get credits' },
  'NEXUSSOCIAL':    { credits: 60,  plan: null,  maxUses: 9999, expires: '2026-10-31', desc: 'Social media bonus' },

  // === SEASONAL (very limited) ===
  'RAMADAN2026':    { credits: 100, plan: null,  maxUses: 9999, expires: '2026-04-20', desc: 'Ramadan Mubarak!' },
  'LEBARAN2026':    { credits: 80,  plan: null,  maxUses: 9999, expires: '2026-04-30', desc: 'Selamat Lebaran!' },
  'MERDEKA2026':    { credits: 170, plan: null,  maxUses: 1000, expires: '2026-08-20', desc: 'HUT RI ke-81 (170 CR!)' },

  // === HIDDEN / EASTER EGG ===
  'NEXUSEGG':       { credits: 250, plan: null,  maxUses: 10,   expires: '2026-12-31', desc: '🥚 You found an easter egg!' },
  'FIINYTID25':     { credits: 999, plan: 'pro', maxUses: 1,    expires: 'never',      desc: 'Developer special code' },
};

function getAllCodes() {
  const codes = { ...BUILTIN_CODES };
  // Load additional codes from env var
  // Format: CODE:credits:plan:maxUses:expires
  const envStr = process.env.REDEEM_CODES || '';
  if (envStr) {
    envStr.split(',').forEach(entry => {
      const parts = entry.trim().split(':');
      if (parts.length >= 2) {
        const code    = parts[0].trim().toUpperCase();
        const creds   = parseFloat(parts[1]) || 0;
        const plan    = parts[2] && parts[2] !== 'null' && parts[2] !== '-' ? parts[2].trim() : null;
        const maxU    = parseInt(parts[3]) || 9999;
        const expires = parts[4] ? parts[4].trim() : 'never';
        if (code) codes[code] = { credits: creds, plan, maxUses: maxU, expires, desc: 'Custom code' };
      }
    });
  }
  return codes;
}

function getUsed() {
  try {
    if (existsSync(USED_FILE)) return JSON.parse(readFileSync(USED_FILE, 'utf8'));
  } catch(_) {}
  return {};
}
function saveUsed(used) {
  try { writeFileSync(USED_FILE, JSON.stringify(used)); } catch(_) {}
}

// Check if a code is expired
function isExpired(code) {
  if (!code.expires || code.expires === 'never') return false;
  const now = new Date();
  const exp = new Date(code.expires + 'T23:59:59');
  return now > exp;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: list codes (admin only)
  if (req.method === 'GET') {
    const token = req.query.token;
    if (token !== process.env.ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
    const codes = getAllCodes();
    const used  = getUsed();
    const list  = Object.entries(codes).map(([code, data]) => ({
      code,
      ...data,
      usedBy:  used[code] ? Object.keys(used[code]).length : 0,
      expired: isExpired(data),
    }));
    return res.status(200).json({ codes: list, total: list.length });
  }

  // POST: redeem a code
  if (req.method === 'POST') {
    const body = req.body || {};
    const code = (body.code || '').trim().toUpperCase();
    const user = (body.user || '').trim().toLowerCase();

    if (!code) return res.status(400).json({ error: 'Kode tidak boleh kosong' });
    if (!user) return res.status(400).json({ error: 'User tidak boleh kosong' });

    const codes    = getAllCodes();
    const codeData = codes[code];

    if (!codeData) {
      return res.status(404).json({ error: 'Kode tidak valid atau tidak ditemukan 🔍' });
    }

    // Check expiry
    if (isExpired(codeData)) {
      return res.status(400).json({
        error: `Kode "${code}" sudah kadaluarsa (expired: ${codeData.expires}) ⏰`
      });
    }

    const used      = getUsed();
    const codeUsed  = used[code] || {};
    const totalUses = Object.keys(codeUsed).length;

    // Check max uses
    if (totalUses >= codeData.maxUses) {
      return res.status(400).json({ error: 'Kode sudah habis digunakan 😔' });
    }

    // Check if user already used this code
    if (codeUsed[user]) {
      return res.status(400).json({ error: 'Kamu sudah pernah menggunakan kode ini ⚠️' });
    }

    // Mark as used
    if (!used[code]) used[code] = {};
    used[code][user] = { ts: Date.now(), remaining: codeData.maxUses - totalUses - 1 };
    saveUsed(used);

    const remaining = codeData.maxUses - totalUses - 1;
    const expText   = codeData.expires === 'never' ? '' : ` (berlaku s/d ${codeData.expires})`;
    const planText  = codeData.plan ? ` + upgrade ke ${codeData.plan.toUpperCase()}` : '';
    const remText   = codeData.maxUses < 9999 ? ` · Sisa: ${remaining} uses` : '';

    return res.status(200).json({
      success:  true,
      credits:  codeData.credits,
      plan:     codeData.plan,
      desc:     codeData.desc,
      expires:  codeData.expires,
      message:  `✅ Berhasil! +${codeData.credits} CR${planText} ditambahkan!${expText}${remText}`,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
