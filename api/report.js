// api/report.js — Send report email to arifiinytid@gmail.com
// Setup env vars in Vercel: GMAIL_USER, GMAIL_PASS (App Password)
// Get app password: myaccount.google.com/security → 2FA → App passwords

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { from, userId, message, time, plan, credits, type } = body || {};

    if (!message || !from) { res.status(400).json({ error: 'Missing required fields' }); return; }

    const subject = `[NEXUS AI] Report dari ${from} — ${type || 'General'}`;
    const emailBody = `
NEXUS AI — Laporan Pengguna
============================
Dari       : ${from}
User ID    : ${userId || 'N/A'}
Plan       : ${plan || 'free'}
Credits    : ${credits || 0} CR
Waktu      : ${time || new Date().toISOString()}
Tipe       : ${type || 'General'}

Pesan:
${message}

============================
Dikirim otomatis dari nexusai-com.vercel.app
`.trim();

    // Try nodemailer first
    let sent = false;
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER || 'arifiinytid@gmail.com',
          pass: process.env.GMAIL_PASS || '',
        },
      });

      await transporter.sendMail({
        from: `"NEXUS AI Report" <${process.env.GMAIL_USER || 'arifiinytid@gmail.com'}>`,
        to: 'arifiinytid@gmail.com',
        subject,
        text: emailBody,
        html: `<pre style="font-family:monospace;font-size:13px;">${emailBody}</pre>`,
      });
      sent = true;
    } catch (mailErr) {
      console.error('Nodemailer error:', mailErr.message);
    }

    // Fallback: log to Vercel console (visible in dashboard)
    console.log('=== NEXUS AI REPORT ===');
    console.log(emailBody);
    console.log('=======================');

    res.json({ success: true, sent, message: sent ? 'Email sent!' : 'Saved to logs' });
  } catch (e) {
    console.error('Report error:', e);
    res.status(500).json({ error: e.message });
  }
};
