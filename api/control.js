// api/control.js — NEXUS AI RELAY v5 ULTIMATE
// Enhanced relay: matches Roblox Studio connector actions
// AI dipanggil langsung dari browser (index.html)
import { readFileSync, writeFileSync, existsSync } from 'fs';

const CMD_FILE  = '/tmp/nexus_cmd.json';
const POLL_FILE = '/tmp/nexus_poll.txt';
const LOG_FILE  = '/tmp/nexus_log.json';
const HIST_FILE = '/tmp/nexus_hist.json';

function getCmd()   { try{ if(existsSync(CMD_FILE)) return JSON.parse(readFileSync(CMD_FILE,'utf8')); }catch(_){} return {action:'none'}; }
function setCmd(c)  { try{ writeFileSync(CMD_FILE, JSON.stringify(c)); }catch(_){} }
function bumpPoll() { try{ writeFileSync(POLL_FILE, String(Date.now())); }catch(_){} }
function lastPoll() { try{ return parseInt(readFileSync(POLL_FILE,'utf8')||'0'); }catch(_){ return 0; } }

function pushLog(entry) {
  try {
    let logs = existsSync(LOG_FILE) ? JSON.parse(readFileSync(LOG_FILE,'utf8')) : [];
    logs.unshift({...entry, ts: Date.now()});
    if(logs.length > 200) logs = logs.slice(0,200);
    writeFileSync(LOG_FILE, JSON.stringify(logs));
  } catch(_) {}
}

function pushHistory(entry) {
  try {
    let hist = existsSync(HIST_FILE) ? JSON.parse(readFileSync(HIST_FILE,'utf8')) : [];
    hist.unshift({...entry, ts: Date.now()});
    if(hist.length > 50) hist = hist.slice(0,50);
    writeFileSync(HIST_FILE, JSON.stringify(hist));
  } catch(_) {}
}

// Validate action whitelist
const VALID_ACTIONS = new Set([
  'none','create_part','batch_create','inject_script','clear_workspace',
  'delete_object','modify_part','set_lighting','change_baseplate',
  'create_spawn','create_folder','create_team','print_output','add_effect',
  'fill_terrain','create_gui','insert_model','run_code','select_object',
  'clone_object','set_game_info','get_studio_mode','start_stop_play',
  'run_script_in_play_mode','get_console_output'
]);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if(req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: Plugin polling ─────────────────────────────────────
  if(req.method === 'GET') {
    bumpPoll();
    const cmd = getCmd();

    // If check=1, also return plugin connection status
    if(req.query.check) {
      const lp = lastPoll();
      return res.status(200).json({
        ...cmd,
        _pluginConnected: (Date.now() - lp) < 8000,
        _lastPoll: lp
      });
    }
    return res.status(200).json(cmd);
  }

  // ── POST ────────────────────────────────────────────────────
  if(req.method === 'POST') {
    let body = req.body || {};

    // Plugin: execution-done / reset signal
    if(body.action === 'none' || body.type === 'reset') {
      setCmd({action:'none'});
      return res.status(200).json({status:'reset'});
    }

    // Check plugin connection status
    if(body.type === 'status') {
      const lp = lastPoll();
      const connected = (Date.now() - lp) < 8000;
      return res.status(200).json({ connected, lastPoll: lp, age: Date.now()-lp });
    }

    // Get execution logs
    if(body.type === 'get_logs') {
      try {
        const logs = existsSync(LOG_FILE) ? JSON.parse(readFileSync(LOG_FILE,'utf8')) : [];
        return res.status(200).json({ logs });
      } catch(_) { return res.status(200).json({ logs: [] }); }
    }

    // Get build history
    if(body.type === 'get_history') {
      try {
        const hist = existsSync(HIST_FILE) ? JSON.parse(readFileSync(HIST_FILE,'utf8')) : [];
        return res.status(200).json({ history: hist });
      } catch(_) { return res.status(200).json({ history: [] }); }
    }

    // Direct command from web/AI
    if(body.action) {
      // Validate action
      if(!VALID_ACTIONS.has(body.action)) {
        return res.status(400).json({ error: 'Invalid action: ' + body.action });
      }

      // Sanitize & set command
      const cmd = {
        ...body,
        _ts:   Date.now(),
        _user: String(body._user || 'web').substring(0, 50),
      };
      setCmd(cmd);

      // Log it
      pushLog({
        action: body.action,
        user:   body._user || 'web',
        name:   body.name || body.script_name || '',
        parent: body.parent || '',
      });
      pushHistory({
        action:  body.action,
        details: body.name || body.script_name || JSON.stringify(body).substring(0,100),
        user:    body._user || 'web',
      });

      return res.status(200).json({
        status:  'ok',
        command: cmd,
        pluginConnected: (Date.now() - lastPoll()) < 8000,
      });
    }

    // Prompt type (from web chat → AI processes → sends action)
    if(body.type === 'prompt') {
      // Just log it; AI handles the actual processing client-side
      pushLog({ action: 'prompt', user: body.user || 'web', msg: (body.msg||'').substring(0,100) });
      return res.status(200).json({ status: 'ok', received: true });
    }

    return res.status(400).json({ error: 'Unknown request type' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
