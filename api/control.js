/**
 * api/control.js - NEXUS AI Command Center for FIINYTID25
 * Alamat Cloud: https://nexusai-com.vercel.app/api/control
 * * Deskripsi: Menangani sinkronisasi antara Web Dashboard dan Plugin Roblox Studio.
 */

let currentCommand = { 
    action: "none", 
    name: "", 
    color: [255, 255, 255], 
    code: "", 
    timestamp: Date.now() 
};

export default function handler(req, res) {
    // ═══════════════════════════════════════
    //  KONFIGURASI CORS (Penting untuk Roblox)
    // ═══════════════════════════════════════
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // ═══════════════════════════════════════
    //  1. MENERIMA PERINTAH (POST)
    // ═══════════════════════════════════════
    if (req.method === 'POST') {
        const data = req.body;

        // Reset Server jika Plugin mengirim sinyal 'none' setelah eksekusi
        if (data.action === "none") {
            currentCommand = { action: "none", timestamp: Date.now() };
            return res.status(200).json({ status: "Server Reset", message: "Siap menerima perintah baru!" });
        }

        // PRIORITAS UTAMA: Injeksi Script Langsung dari Gemini (Hasil sendCommand)
        if (data.action === "inject_script" && data.code) {
            currentCommand = {
                action: "inject_script",
                code: data.code,
                timestamp: Date.now()
            };
            return res.status(200).json({ 
                status: "Success", 
                message: "Script dari Gemini berhasil di-upload ke Cloud!", 
                data: currentCommand 
            });
        }

        // LOGIKA CADANGAN (Jika user mengirim pesan tanpa lewat sistem Gemini)
        const prompt = data.msg ? data.msg.toLowerCase() : "";
        
        if (prompt.includes("part") || prompt.includes("objek")) {
            currentCommand = {
                action: "create_part",
                name: "Nexus_Object_" + Math.floor(Math.random() * 1000),
                color: [Math.random() * 255, Math.random() * 255, Math.random() * 255],
                timestamp: Date.now()
            };
        } else if (prompt.includes("hapus") || prompt.includes("bersihkan") || prompt.includes("clear")) {
            currentCommand = { 
                action: "clear_workspace",
                timestamp: Date.now()
            };
        } else if (prompt !== "") {
            // Default jika ada pesan masuk tapi tidak terdeteksi keyword
            currentCommand = {
                action: "inject_script",
                code: `warn("[NEXUS CLOUD]: Perintah diterima: ${prompt}")`,
                timestamp: Date.now()
            };
        }

        return res.status(200).json({ 
            status: "Success", 
            message: "Perintah diproses oleh Cloud!", 
            data: currentCommand 
        });
    }

    // ═══════════════════════════════════════
    //  2. MENGIRIM KE ROBLOX (GET Polling)
    // ═══════════════════════════════════════
    if (req.method === 'GET') {
        // Mengirimkan perintah yang sedang aktif saat ini ke Plugin Roblox
        return res.status(200).json(currentCommand);
    }

    // Jika method tidak dikenal
    return res.status(405).json({ error: "Method not allowed" });
}
