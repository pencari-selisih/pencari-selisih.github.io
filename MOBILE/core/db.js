// ============================================================
// core/db.js — IndexedDB Storage Layer (via Dexie.js)
// Menggantikan localStorage untuk penyimpanan token & settings
// Compatible dengan Android WebView (Chromium-based, Android 4.4+)
// ============================================================

const _db = new Dexie('MobileScannerDB');

_db.version(1).stores({
    tokens:   '++_idbKey, id, ticker, cex, chain',
    settings: 'key',
});

// ─── Internal helpers ────────────────────────
async function _dbGetAllTokens() {
    const rows = await _db.tokens.toArray();
    return rows.map(r => { const t = { ...r }; delete t._idbKey; return t; });
}

async function _dbSaveAllTokens(arr) {
    await _db.tokens.clear();
    if (arr && arr.length) await _db.tokens.bulkAdd(arr);
}

// ─── Token API ───────────────────────────────
// Semua fungsi async — gunakan await saat memanggil

let _tokenCacheDB = null; // in-memory cache agar tidak bolak-balik IndexedDB per frame

async function dbGetTokens() {
    if (_tokenCacheDB) return _tokenCacheDB;
    _tokenCacheDB = await _dbGetAllTokens();
    return _tokenCacheDB;
}

async function dbSaveTokens(arr) {
    // Guard: jangan simpan array kosong jika sebelumnya ada data
    if (!arr || !arr.length) {
        const existing = await _dbGetAllTokens();
        if (existing.length > 0) {
            console.warn('[dbSaveTokens] Blocked empty save — existing data preserved (' + existing.length + ' tokens)');
            return;
        }
    }
    _tokenCacheDB = arr;
    await _dbSaveAllTokens(arr);
}

function dbClearTokenCache() {
    _tokenCacheDB = null;
}

// ─── Settings API ────────────────────────────

async function dbGetSettings() {
    try {
        const row = await _db.settings.get('cfg');
        return row ? row.value : null;
    } catch { return null; }
}

async function dbSaveSettings(obj) {
    try {
        await _db.settings.put({ key: 'cfg', value: obj });
    } catch (e) {
        console.error('[dbSaveSettings] failed:', e);
    }
}

// ─── Migration: localStorage → IndexedDB ────
// Dipanggil sekali saat app pertama kali dijalankan
// Jika ada data di localStorage, pindahkan ke IndexedDB lalu hapus
async function dbMigrateFromLocalStorage() {
    const LS_TOKENS   = 'cexdex_tokens';
    const LS_SETTINGS = 'cexdex_settings';
    try {
        const existingTokens = await _dbGetAllTokens();
        if (existingTokens.length === 0) {
            const raw = localStorage.getItem(LS_TOKENS);
            if (raw) {
                const tokens = JSON.parse(raw);
                if (Array.isArray(tokens) && tokens.length > 0) {
                    await _dbSaveAllTokens(tokens);
                    localStorage.removeItem(LS_TOKENS);
                    console.info('[dbMigrate] Migrated ' + tokens.length + ' tokens from localStorage → IndexedDB');
                }
            }
        }
        const existingCfg = await dbGetSettings();
        if (!existingCfg) {
            const rawCfg = localStorage.getItem(LS_SETTINGS);
            if (rawCfg) {
                const cfg = JSON.parse(rawCfg);
                await dbSaveSettings(cfg);
                localStorage.removeItem(LS_SETTINGS);
                console.info('[dbMigrate] Migrated settings from localStorage → IndexedDB');
            }
        }
    } catch (e) {
        console.warn('[dbMigrate] Migration error (non-fatal):', e);
    }
}
