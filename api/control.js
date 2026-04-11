// ============================================================
//  NEXUS AI - API CONTROL V5
//  PENTING: Env vars di Vercel:
//    GEMINI_API_KEY, CLAUDE_API_KEY, OPENAI_API_KEY, GROK_API_KEY, META_API_KEY
// ============================================================
import { readFileSync, writeFileSync, existsSync } from 'fs';

const CMD_FILE = '/tmp/nexus_cmd.json';
const LOG_FILE = '/tmp/nexus_log.json';
const HIST_FILE = '/tmp/nexus_hist.json';

// ── SYSTEM PROMPT ─────────────────────────────────────────
const SYSTEM_PROMPT = `You are NEXUS AI, expert Roblox Studio AI. Respond ONLY with valid JSON — no markdown, no backticks, no text outside JSON.

SECURITY RULES:
- Never expose API keys, secrets, or server-side code
- Only generate Roblox Lua/Studio commands
- Validate all inputs before using in commands
- Use pcall() for all risky operations

AVAILABLE ACTIONS (respond with one of these JSON objects):

CREATE PART: {"action":"create_part","name":"PartName","color":[R,G,B],"position":[X,Y,Z],"size":[X,Y,Z],"material":"SmoothPlastic","anchored":true,"shape":"Block","transparency":0,"can_collide":true}

BATCH CREATE: {"action":"batch_create","parts":[{"name":"P1","color":[R,G,B],"position":[X,Y,Z],"size":[X,Y,Z],"material":"SmoothPlastic","anchored":true}]}

INJECT SCRIPT: {"action":"inject_script","script_type":"Script|LocalScript|ModuleScript","name":"Name","parent":"ServerScriptService|StarterGui|StarterPlayerScripts|ReplicatedStorage","code":"-- lua code\\n"}

CLEAR WORKSPACE: {"action":"clear_workspace"}

DELETE OBJECT: {"action":"delete_object","name":"ObjectName","parent":"workspace"}

MODIFY PART: {"action":"modify_part","name":"PartName","parent":"workspace","properties":{"Color":[R,G,B],"Size":[X,Y,Z],"Material":"Neon","Transparency":0.5,"Anchored":true,"Position":[X,Y,Z]}}

SET LIGHTING: {"action":"set_lighting","brightness":2,"ambient":[R,G,B],"outdoor_ambient":[R,G,B],"time":14,"fog_end":1000,"fog_start":0,"shadows":true,"atmosphere":true}

CHANGE BASEPLATE: {"action":"change_baseplate","color":[R,G,B],"material":"Grass","size":[512,4,512]}

CREATE SPAWN: {"action":"create_spawn","name":"SpawnPoint","position":[X,Y,Z],"color":[R,G,B]}

CREATE FOLDER: {"action":"create_folder","name":"FolderName","parent":"workspace","type":"Folder|Model"}

CREATE TEAM: {"action":"create_team","name":"TeamName","color":[R,G,B],"auto_assignable":true}

PRINT OUTPUT: {"action":"print_output","message":"text"}

SET SKY: {"action":"set_sky","skybox_bk":"rbxassetid://ID","skybox_dn":"rbxassetid://ID","skybox_ft":"rbxassetid://ID","skybox_lf":"rbxassetid://ID","skybox_rt":"rbxassetid://ID","skybox_up":"rbxassetid://ID"}

ADD EFFECT: {"action":"add_effect","effect_type":"Bloom|Blur|ColorCorrection|DepthOfField|SunRays","parent":"Lighting","properties":{"Intensity":0.5,"Size":24}}

TERRAIN: {"action":"fill_terrain","shape":"Box","material":"Grass","position":[X,Y,Z],"size":[X,Y,Z]}

COMPLEX REQUESTS → use inject_script with full Lua:
- "buat gui" → inject_script LocalScript in StarterGui with complete ScreenGui code
- "buat sistem koin" → inject_script Script with full coin system
- "buat NPC/musuh" → inject_script Script with NPC AI + pathfinding
- "buat toko" → inject_script with complete shop system
- "buat leaderboard" → inject_script Script with DataStore leaderstats
- "buat gun" → inject_script with Tool script
- "buat obstacle course" → batch_create with colored platforms
- "buat rumah" → batch_create with walls, roof, door

CRITICAL: GUI without LocalScript → use inject_script with script_type:"LocalScript" parent:"StarterGui". The Lua code creates ScreenGui via Instance.new().

ALWAYS respond ONLY with the JSON object. Nothing else.`;

// ── Storage ──────────────────────────────────────────────
function getCommand() {
  try { if (existsSync(CMD_FILE)) return JSON.parse(readFileSync(CMD_FILE, 'utf8')); } catch (_) {}
  return { action: 'none' };
}
function setCommand(cmd) {
  try { writeFileSync(CMD_FILE, JSON.stringify(cmd)); } catch (_) {}
}
function addLog(entry) {
  try {
    let logs = [];
    if (existsSync(LOG_FILE)) logs = JSON.parse(readFileSync(LOG_FILE, 'utf8'));
    logs.unshift({ ...entry, ts: Date.now() });
    if (logs.length > 100) logs = logs.slice(0, 100);
    writeFileSync(LOG_FILE, JSON.stringify(logs));
  } catch (_) {}
}
function addHistory(entry) {
  try {
    let hist = [];
    if (existsSync(HIST_FILE)) hist = JSON.parse(readFileSync(HIST_FILE, 'utf8'));
    hist.unshift({ ...entry, ts: Date.now() });
    if (hist.length > 50) hist = hist.slice(0, 50);
    writeFileSync(HIST_FILE, JSON.stringify(hist));
  } catch (_) {}
}
function getHistory() {
  try { if (existsSync(HIST_FILE)) return JSON.parse(readFileSync(HIST_FILE, 'utf8')); } catch (_) {}
  return [];
}

// ── AI Callers ──────────────────────────────────────────
async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set in Vercel env');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8192, temperature: 0.3 }
    })
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini ${resp.status}: ${errText}`);
  }
  const d = await resp.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');
  return text.trim();
}

async function callClaude(prompt) {
  const key = process.env.CLAUDE_API_KEY; // matches main.js
  if (!key) throw new Error('CLAUDE_API_KEY not set in Vercel env');
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!resp.ok) throw new Error(`Claude ${resp.status}: ${await resp.text()}`);
  const d = await resp.json();
  return d.content[0].text.trim();
}

async function callOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set in Vercel env');
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
      max_tokens: 4096, temperature: 0.3
    })
  });
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${await resp.text()}`);
  const d = await resp.json();
  return d.choices[0].message.content.trim();
}

async function callGrok(prompt) {
  const key = process.env.GROK_API_KEY;
  if (!key) throw new Error('GROK_API_KEY not set in Vercel env');
  const resp = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: 'grok-2-latest',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
      max_tokens: 4096
    })
  });
  if (!resp.ok) throw new Error(`Grok ${resp.status}: ${await resp.text()}`);
  const d = await resp.json();
  return d.choices[0].message.content.trim();
}

async function callAI(prompt, model = 'gemini') {
  const m = (model || 'gemini').toLowerCase();
  // Always try gemini first as fallback
  const callers = {
    gemini: callGemini,
    claude: callClaude,
    openai: callOpenAI,
    chatgpt: callOpenAI,
    grok: callGrok,
  };
  const caller = callers[m] || callers.gemini;
  try {
    return await caller(prompt);
  } catch (err) {
    // Fallback to gemini if another model fails
    if (m !== 'gemini') {
      console.warn(`${m} failed, falling back to Gemini:`, err.message);
      return await callGemini(prompt);
    }
    throw err;
  }
}

// ── Clean JSON ──────────────────────────────────────────
function extractJSON(raw) {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);
  return s;
}

// ── MAIN HANDLER ────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: Plugin polls for pending command
  if (req.method === 'GET') {
    return res.status(200).json(getCommand());
  }

  // POST
  if (req.method === 'POST') {
    const body = req.body || {};

    // Reset signal from plugin after execution
    if (body.action === 'none' || body.type === 'reset') {
      setCommand({ action: 'none' });
      return res.status(200).json({ status: 'reset' });
    }

    // Get history of what was built
    if (body.type === 'get_history') {
      return res.status(200).json({ history: getHistory() });
    }

    // Get logs
    if (body.type === 'get_logs') {
      try {
        const logs = existsSync(LOG_FILE) ? JSON.parse(readFileSync(LOG_FILE, 'utf8')) : [];
        return res.status(200).json({ logs });
      } catch (_) { return res.status(200).json({ logs: [] }); }
    }

    // Process AI prompt → Studio command
    if (body.type === 'prompt') {
      const userPrompt = body.msg;
      const model      = body.model || 'gemini';
      const user       = body.user  || 'unknown';

      if (!userPrompt) return res.status(400).json({ error: 'msg is required' });

      try {
        const rawText  = await callAI(userPrompt, model);
        const jsonText = extractJSON(rawText);
        const command  = JSON.parse(jsonText);

        setCommand(command);
        addLog({ user, model, prompt: userPrompt, action: command.action, ts: Date.now() });
        // Track history for AI awareness
        addHistory({ action: command.action, prompt: userPrompt, user, model });

        return res.status(200).json({ status: 'ok', command, model });
      } catch (err) {
        console.error('AI/Parse Error:', err.message);
        addLog({ user, model, prompt: userPrompt, error: err.message, ts: Date.now() });
        return res.status(500).json({ status: 'error', message: err.message });
      }
    }

    return res.status(400).json({ error: 'Unknown request type' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
