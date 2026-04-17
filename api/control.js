// api/control.js — NEXUS AI RELAY v7 FIXED
// ═══════════════════════════════════════════════════════════
// FIX V7:
// - Endpoint GET ?userinfo=1&userId=xxx → proxy ke Roblox API
//   (plugin tidak bisa akses roblox.com langsung, jadi lewat sini)
// - Simpan captured output dari run_code
// - Support semua command baru: sound, npc, billboard, dll
// ═══════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, existsSync } from 'fs';

const TMP       = '/tmp';
const LOG_FILE  = TMP + '/nexus_log.json';
const HIST_FILE = TMP + '/nexus_hist.json';

// ── Sanitize username ─────────────────────────────────────
function sanitizeUser(user) {
  return (user || 'default')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .toLowerCase()
    .substring(0, 40);
}

// ── Per-user file paths ───────────────────────────────────
function getCmdFile(user)    { return TMP + '/ncmd_'    + sanitizeUser(user) + '.json'; }
function getPollFile(user)   { return TMP + '/npoll_'   + sanitizeUser(user) + '.txt';  }
function getOutputFile(user) { return TMP + '/nout_'    + sanitizeUser(user) + '.json'; }
function getWsFile(user)     { return TMP + '/nexus_ws_' + sanitizeUser(user) + '.json'; }

// ── Per-user command queue ────────────────────────────────
function getCmd(user) {
  try {
    const f = getCmdFile(user);
    if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
  } catch(_) {}
  return { action: 'none' };
}
function setCmd(user, c) {
  try { writeFileSync(getCmdFile(user), JSON.stringify(c)); } catch(_) {}
}
function clearCmd(user) {
  try { writeFileSync(getCmdFile(user), JSON.stringify({ action: 'none' })); } catch(_) {}
}
function bumpPoll(user) {
  try { writeFileSync(getPollFile(user), String(Date.now())); } catch(_) {}
}
function lastPoll(user) {
  try { return parseInt(readFileSync(getPollFile(user), 'utf8') || '0'); } catch(_) { return 0; }
}
function isConnected(user) {
  return (Date.now() - lastPoll(user)) < 6000; // plugin poll tiap 2s, 3x miss = disconnect
}

// ── Output storage ────────────────────────────────────────
function saveOutput(user, outputs) {
  try {
    writeFileSync(getOutputFile(user), JSON.stringify({ outputs, ts: Date.now() }));
  } catch(_) {}
}
function getOutput(user) {
  try {
    const f = getOutputFile(user);
    if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
  } catch(_) {}
  return { outputs: [] };
}

// ── Shared logs ───────────────────────────────────────────
function pushLog(entry) {
  try {
    let logs = existsSync(LOG_FILE) ? JSON.parse(readFileSync(LOG_FILE, 'utf8')) : [];
    logs.unshift({ ...entry, ts: Date.now() });
    if (logs.length > 200) logs = logs.slice(0, 200);
    writeFileSync(LOG_FILE, JSON.stringify(logs));
  } catch(_) {}
}
function pushHistory(entry) {
  try {
    let hist = existsSync(HIST_FILE) ? JSON.parse(readFileSync(HIST_FILE, 'utf8')) : [];
    hist.unshift({ ...entry, ts: Date.now() });
    if (hist.length > 100) hist = hist.slice(0, 100);
    writeFileSync(HIST_FILE, JSON.stringify(hist));
  } catch(_) {}
}

// ── Valid actions ─────────────────────────────────────────
const VALID_ACTIONS = new Set([
  'none',
  // Script
  'inject_script', 'batch_inject',
  // Parts & Models
  'create_part', 'batch_create', 'insert_model', 'clone_object',
  // NPC
  'create_npc',
  // Sound
  'create_sound',
  // GUI
  'create_gui', 'create_billboard', 'create_surface_gui',
  // Interaction
  'create_proximity_prompt', 'create_click_detector',
  // Physics / Structure
  'weld_parts', 'create_tool', 'create_seat',
  // Effects
  'create_particle', 'create_light',
  // Workspace management
  'clear_workspace', 'delete_object', 'delete_multiple', 'modify_part', 'select_object',
  // Instance creation
  'create_instance', 'create_folder', 'create_team',
  // Lighting & environment
  'set_lighting', 'change_baseplate', 'fill_terrain', 'clear_terrain', 'add_effect',
  // Spawn
  'create_spawn',
  // Code & Console
  'run_code', 'print_output', 'get_output',
  // Values
  'set_value', 'create_animation',
  // Workspace reading
  'read_workspace', 'workspace_data',
  // Misc
  'set_game_info',
]);

// ══════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ══════════════════════════════════════════════════════
  // GET HANDLER
  // ══════════════════════════════════════════════════════
  if (req.method === 'GET') {

    // ─────────────────────────────────────────────────────
    // ENDPOINT KRITIS V7:
    // GET ?userinfo=1&userId=12345678
    // Plugin tidak bisa akses users.roblox.com secara langsung
    // karena Roblox memblokir HTTP ke *.roblox.com dari plugin.
    // Solusi: plugin memanggil relay API kita,
    // lalu relay API ini yang fetch ke Roblox server-side.
    // ─────────────────────────────────────────────────────
    if (req.query.userinfo === '1') {
      const userId = parseInt(req.query.userId || '0');
      if (!userId || userId <= 0) {
        return res.status(400).json({ error: 'userId tidak valid', ok: false });
      }
      try {
        // Fetch dari Roblox API (ini jalan di server Vercel, bukan dari Studio)
        const robloxRes = await fetch(
          `https://users.roblox.com/v1/users/${userId}`,
          {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000),
          }
        );
        if (!robloxRes.ok) {
          return res.status(502).json({
            error: `Roblox API error: ${robloxRes.status}`,
            ok: false,
          });
        }
        const data = await robloxRes.json();
        return res.status(200).json({
          username:    data.name        || '',
          displayName: data.displayName || data.name || '',
          userId:      userId,
          description: data.description || '',
          ok: true,
        });
      } catch(e) {
        return res.status(500).json({
          error: `Fetch gagal: ${e.message}`,
          ok: false,
        });
      }
    }

    // ── Check koneksi plugin (dari web) ───────────────────
    if (req.query.check) {
      const targetUser = sanitizeUser(req.query.user || '');
      return res.status(200).json({
        _pluginConnected: isConnected(targetUser),
        _lastPoll:        lastPoll(targetUser),
        user:             targetUser,
        action:           'none',
      });
    }

    // ── Get output konsol ─────────────────────────────────
    if (req.query.get_output) {
      const u = sanitizeUser(req.query.user || '');
      const out = getOutput(u);
      return res.status(200).json(out);
    }

    // ── Get workspace data ────────────────────────────────
    if (req.query.get_workspace) {
      const u = sanitizeUser(req.query.user || '');
      try {
        const f = getWsFile(u);
        if (existsSync(f)) {
          const ws = JSON.parse(readFileSync(f, 'utf8'));
          return res.status(200).json(ws);
        }
      } catch(_) {}
      return res.status(200).json({ error: 'Belum ada workspace data', ok: false });
    }

    // ── Plugin poll — ambil command ───────────────────────
    const pluginUser = sanitizeUser(req.query.user || req.query.u || '');
    if (!pluginUser) {
      return res.status(400).json({ error: 'parameter user diperlukan', action: 'none' });
    }
    // Bump poll timestamp (plugin masih hidup)
    bumpPoll(pluginUser);

    const cmd = getCmd(pluginUser);
    return res.status(200).json(cmd);
  }

  // ══════════════════════════════════════════════════════
  // POST HANDLER
  // ══════════════════════════════════════════════════════
  if (req.method === 'POST') {
    const body = req.body || {};

    // ── Plugin reset setelah execute ──────────────────────
    if (body.action === 'none' || body.type === 'reset') {
      const pluginUser = sanitizeUser(body._user || body.user || '');
      if (pluginUser) clearCmd(pluginUser);
      return res.status(200).json({ status: 'reset' });
    }

    // ── Plugin status ─────────────────────────────────────
    if (body.type === 'status') {
      const u = sanitizeUser(body.user || '');
      return res.status(200).json({
        connected: isConnected(u),
        lastPoll:  lastPoll(u),
        age:       Date.now() - lastPoll(u),
      });
    }

    // ── Workspace data dari plugin ────────────────────────
    if (body.action === 'workspace_data') {
      const u = sanitizeUser(body._user || '');
      pushLog({ action: 'workspace_read', user: u });
      try {
        writeFileSync(getWsFile(u), JSON.stringify({ ...body, _ts: Date.now() }));
      } catch(_) {}
      return res.status(200).json({ status: 'ok', message: 'Workspace data disimpan' });
    }

    // ── Output/console data dari plugin ──────────────────
    if (body.action === 'output_data') {
      const u = sanitizeUser(body._user || '');
      saveOutput(u, body.outputs || []);
      return res.status(200).json({ status: 'ok', count: (body.outputs || []).length });
    }

    // ── Get logs (admin) ──────────────────────────────────
    if (body.type === 'get_logs') {
      try {
        const logs = existsSync(LOG_FILE) ? JSON.parse(readFileSync(LOG_FILE, 'utf8')) : [];
        return res.status(200).json({ logs });
      } catch(_) { return res.status(200).json({ logs: [] }); }
    }

    // ── Get history (admin) ───────────────────────────────
    if (body.type === 'get_history') {
      try {
        const hist = existsSync(HIST_FILE) ? JSON.parse(readFileSync(HIST_FILE, 'utf8')) : [];
        return res.status(200).json({ history: hist });
      } catch(_) { return res.status(200).json({ history: [] }); }
    }

    // ── Command dari web/AI → queue ke plugin user ────────
    if (body.action) {
      if (!VALID_ACTIONS.has(body.action)) {
        return res.status(400).json({ error: 'Action tidak valid: ' + body.action });
      }

      const targetUser = sanitizeUser(body._target_user || body._user || '');
      if (!targetUser) {
        return res.status(400).json({ error: '_target_user diperlukan untuk routing' });
      }

      const cmd = {
        ...body,
        _ts:          Date.now(),
        _user:        String(body._user || 'web').substring(0, 50),
        _target_user: targetUser,
        _apiKey:      undefined, // jangan simpan API key
      };

      setCmd(targetUser, cmd);

      pushLog({
        action: body.action,
        user:   body._user || 'web',
        target: targetUser,
        name:   body.name || body.script_name || '',
        parent: body.parent || '',
      });
      pushHistory({
        action:  body.action,
        details: body.name
          || (body.code ? body.code.substring(0, 80) + '...' : '')
          || JSON.stringify(body).substring(0, 100),
        user:   body._user || 'web',
        target: targetUser,
      });

      return res.status(200).json({
        status:          'ok',
        action:          body.action,
        target:          targetUser,
        pluginConnected: isConnected(targetUser),
      });
    }

    // ── Prompt logging ────────────────────────────────────
    if (body.type === 'prompt') {
      pushLog({ action: 'prompt', user: body.user || 'web', msg: (body.msg || '').substring(0, 100) });
      return res.status(200).json({ status: 'ok' });
    }

    return res.status(400).json({ error: 'Tipe request tidak dikenal' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
