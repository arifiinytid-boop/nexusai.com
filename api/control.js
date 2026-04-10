// api/control.js - NEXUS AI Command Center for FIINYTID25
let currentCommand = { action: "none", name: "", color: [255, 255, 255], code: "" };

export default function handler(req, res) {
    // Header agar bisa diakses dari mana saja
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // 1. MENERIMA PERINTAH (Dari Web atau Plugin)
    if (req.method === 'POST') {
        const data = req.body;

        // Jika Plugin mengirim sinyal reset setelah eksekusi
        if (data.action === "none") {
            currentCommand = { action: "none" };
            return res.status(200).json({ status: "Server Reset" });
        }

        // LOGIKA PEMROSESAN PERINTAH AI
        const prompt = data.msg ? data.msg.toLowerCase() : "";
        
        if (prompt.includes("part") || prompt.includes("objek")) {
            currentCommand = {
                action: "create_part",
                name: "Nexus_Generated_Obj",
                color: [Math.random()*255, Math.random()*255, Math.random()*255]
            };
        } else if (prompt.includes("hapus") || prompt.includes("bersihkan")) {
            currentCommand = { action: "clear_workspace" };
        } else if (prompt.includes("script") || prompt.includes("sistem") || prompt.includes("buatkan")) {
            // AI akan mencoba membuatkan script berdasarkan prompt
            currentCommand = {
                action: "inject_script",
                code: `-- Script otomatis untuk FIINYTID25\n-- Prompt: ${prompt}\n\nprint("NEXUS AI: Menjalankan sistem ${prompt}...")\n` + 
                      (prompt.includes("day") ? "game.Lighting.ClockTime = 14" : "print('Sistem Aktif!')")
            };
        } else {
            // Jika perintah bebas, kirim sebagai script print
            currentCommand = {
                action: "inject_script",
                code: `warn("NEXUS AI menerima pesan: ${prompt}")`
            };
        }

        return res.status(200).json({ message: "Perintah diterima oleh Cloud!", data: currentCommand });
    }

    // 2. MENGIRIM PERINTAH KE ROBLOX (GET Polling)
    if (req.method === 'GET') {
        return res.status(200).json(currentCommand);
    }
}
