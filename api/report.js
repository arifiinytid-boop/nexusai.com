// api/report.js — NEXUS AI Report Handler v2
// Stores reports in /tmp and optionally emails via Resend
import { readFileSync, writeFileSync, existsSync } from 'fs';

const REPORT_FILE = '/tmp/nexus_reports.json';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET reports (admin only)
  if (req.method === 'GET') {
    const token = req.query.token;
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const reports = existsSync(REPORT_FILE)
        ? JSON.parse(readFileSync(REPORT_FILE, 'utf8'))
        : [];
      return res.status(200).json({ reports, total: reports.length });
    } catch (_) {
      return res.status(200).json({ reports: [], total: 0 });
    }
  }

  // POST new report
  if (req.method === 'POST') {
    const body = req.body || {};
    const { from, message, time, plan, credits, userId } = body;

    if (!message || !from) {
      return res.status(400).json({ error: 'from and message required' });
    }

    const report = {
      id:      Date.now().toString(36),
      from:    String(from).substring(0, 50),
      userId:  userId || '0',
      message: String(message).substring(0, 2000),
      plan:    plan || 'free',
      credits: credits || 0,
      time:    time || new Date().toISOString(),
      savedAt: Date.now()
    };

    try {
      let reports = [];
      if (existsSync(REPORT_FILE)) {
        reports = JSON.parse(readFileSync(REPORT_FILE, 'utf8'));
      }
      reports.unshift(report);
      if (reports.length > 500) reports = reports.slice(0, 500);
      writeFileSync(REPORT_FILE, JSON.stringify(reports));
    } catch (e) {
      console.error('Failed to save report:', e.message);
    }

    // Optional: send email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const emailResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendKey}`
          },
          body: JSON.stringify({
            from: 'onboarding@resend.dev',
            to: ['arifiinytid@gmail.com'],
            subject: `[NEXUS AI Report] dari ${from}`,
            html: `
              <div style="font-family:monospace;background:#030312;color:#b8cfff;padding:24px;border-radius:12px;">
                <h2 style="color:#00e5ff;margin-bottom:16px;">📩 Report Baru — NEXUS AI</h2>
                <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                  <tr><td style="padding:6px;color:#3a4a7a;width:120px;">User</td><td style="padding:6px;color:white;font-weight:bold;">${from}</td></tr>
                  <tr><td style="padding:6px;color:#3a4a7a;">User ID</td><td style="padding:6px;color:white;">${userId}</td></tr>
                  <tr><td style="padding:6px;color:#3a4a7a;">Plan</td><td style="padding:6px;color:#00ffaa;">${plan}</td></tr>
                  <tr><td style="padding:6px;color:#3a4a7a;">Credits</td><td style="padding:6px;color:#ffd600;">${credits}</td></tr>
                  <tr><td style="padding:6px;color:#3a4a7a;">Waktu</td><td style="padding:6px;color:white;">${time}</td></tr>
                </table>
                <div style="background:#06071a;border:1px solid #3a4a7a;border-radius:8px;padding:14px;">
                  <div style="color:#00e5ff;font-size:12px;margin-bottom:8px;">PESAN:</div>
                  <div style="color:#b8cfff;line-height:1.7;">${String(message).replace(/\n/g, '<br>')}</div>
                </div>
                <div style="margin-top:16px;font-size:11px;color:#3a4a7a;">Dikirim oleh NEXUS AI Report System</div>
              </div>
            `
          })
        });
        if (!emailResp.ok) {
          const errData = await emailResp.json().catch(() => ({}));
          console.error('Resend error:', errData);
        }
      } catch (emailErr) {
        console.error('Email failed:', emailErr.message);
      }
    } else {
      console.warn('RESEND_API_KEY tidak diset di environment variables Vercel!');
    }

    return res.status(200).json({ status: 'ok', id: report.id });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
