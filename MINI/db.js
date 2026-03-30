// ============================================================
// db.js — IndexedDB wrapper (key-value store)
//
// API:
//   dbGet(key, fallback) — sync read dari in-memory mirror
//   dbSet(key, value)    — sync memory write + async IDB persist
//   _dbReady             — Promise, resolve setelah init + migrasi selesai
//
// Strategi:
//   - Saat init, semua data di-preload dari IDB ke _kv (in-memory mirror)
//   - Reads selalu sync (dari _kv)
//   - Writes sync ke _kv + fire-and-forget ke IDB
//   - Migrasi otomatis dari localStorage pada first run
// ============================================================

const _DB_NAME    = 'miniScanner';
const _DB_VERSION = 1;
const _STORE      = 'kv';

// Key-value localStorage yang akan dimigrasikan ke IDB
const _MIGRATE_KEYS = [
    'cexdex_tokens',
    'cexdex_settings',
    'hybrid_cex_wallet',
    'scanAutoReload',
    'scp_gasFees',
];

let _db = null;
let _kv = {};   // in-memory mirror — satu-satunya sumber untuk reads

// ─── Public API ───────────────────────────────
function dbGet(key, fallback) {
    return Object.prototype.hasOwnProperty.call(_kv, key) ? _kv[key] : fallback;
}

function dbSet(key, value) {
    _kv[key] = value;
    if (!_db) return;
    try {
        const tx = _db.transaction(_STORE, 'readwrite');
        tx.objectStore(_STORE).put(value, key);
    } catch (e) {
        console.warn('[db] write failed:', key, e);
    }
}

// ─── Internal helpers ─────────────────────────
function _idbLoadAll() {
    return new Promise((resolve) => {
        let keysResult = [], valsResult = [];
        try {
            const tx  = _db.transaction(_STORE, 'readonly');
            const st  = tx.objectStore(_STORE);
            st.getAllKeys().onsuccess = (e) => { keysResult = e.target.result || []; };
            st.getAll().onsuccess    = (e) => { valsResult = e.target.result || []; };
            tx.oncomplete = () => {
                const obj = {};
                keysResult.forEach((k, i) => { obj[k] = valsResult[i]; });
                resolve(obj);
            };
            tx.onerror = () => resolve({});
        } catch (e) {
            resolve({});
        }
    });
}

function _migrate() {
    for (const key of _MIGRATE_KEYS) {
        const raw = localStorage.getItem(key);
        if (raw === null) continue;
        let val;
        try   { val = JSON.parse(raw); }
        catch { val = raw; }
        // scanAutoReload: simpan sebagai boolean
        if (key === 'scanAutoReload') val = (val === '1' || val === true);
        _kv[key] = val;
        dbSet(key, val);
        localStorage.removeItem(key);
    }
    dbSet('_migrated', true);
}

// ─── Init (dipanggil sekali saat db.js dimuat) ─
function dbInit() {
    return new Promise((resolve) => {
        if (!window.indexedDB) {
            console.warn('[db] IndexedDB not supported, using in-memory only');
            return resolve();
        }
        const req = indexedDB.open(_DB_NAME, _DB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(_STORE)) {
                db.createObjectStore(_STORE);
            }
        };

        req.onsuccess = async (e) => {
            _db = e.target.result;
            _kv = await _idbLoadAll();
            if (!_kv['_migrated']) _migrate();
            resolve();
        };

        req.onerror = () => {
            // Fallback: tetap lanjut tanpa IDB (data hanya di memory)
            console.warn('[db] IndexedDB open failed, in-memory only');
            _db = null;
            resolve();
        };
    });
}

// Mulai init segera; simpan promise agar scripts lain bisa await
window._dbReady = dbInit();
