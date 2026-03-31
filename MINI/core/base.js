/* ═══════════════════════════════════════════════
   SCANNER PRICE CRYPTO — app.js
   Dual DEX Aggregator: METAX + JUMPX
   Full application logic (jQuery 3.7 + Native JS)
═══════════════════════════════════════════════ */

// ─── Storage Keys ────────────────────────────
const LS_TOKENS   = 'cexdex_tokens';
const LS_SETTINGS = 'cexdex_settings';

// ─── Runtime State ───────────────────────────
const STABLE_COINS = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FDUSD', 'USDD', 'USDP', 'FRAX', 'LUSD', 'CRVUSD', 'PYUSD', 'GUSD', 'SUSD', 'MUSD', 'USDE', 'EUSD', 'USDS', 'USD0', 'USDX']);

// ─── DEX List — auto-generated from CONFIG_DEX ──
const DEX_LIST = Object.entries(CONFIG_DEX).map(([key, cfg]) => ({
    key,
    label: cfg.label,
    badge: cfg.badge,
    src: cfg.src,
    hasCount: cfg.hasCount,
    defaultCount: cfg.count,
}));

let CFG = {
    username: '',
    wallet: '',
    interval: 800,    // ms — jeda antar kelompok batch (dikontrol user via speed chips)
    soundMuted: false,
    activeCex: [],    // [] = semua aktif
    activeChains: [], // [] = semua aktif
    pairType: 'all',  // 'all' | 'stable' | 'non'
    autoLevel: APP_DEV_CONFIG.defaultAutoLevel,
    levelCount: APP_DEV_CONFIG.defaultLevelCount,
    dex: {},
};

// ─── CSS Color Injection (config.js → CSS custom properties) ─
// Menjadikan config.js sebagai satu-satunya sumber kebenaran warna.
// CSS hanya menggunakan var(--dex-*), var(--cex-*), var(--chain-*).
(function _applyConfigColors() {
    const root = document.documentElement;
    Object.entries(CONFIG_DEX).forEach(([key, cfg]) => {
        if (cfg.color) root.style.setProperty('--dex-' + key, cfg.color);
    });
    Object.entries(CONFIG_CEX).forEach(([key, cfg]) => {
        if (cfg.WARNA) root.style.setProperty('--cex-' + key, cfg.WARNA);
    });
    Object.entries(CONFIG_CHAINS).forEach(([key, cfg]) => {
        if (cfg.WARNA) root.style.setProperty('--chain-' + key, cfg.WARNA);
    });
})();

// Init CFG.dex dari CONFIG_DEX defaults
(function _initCfgDex() {
    Object.entries(CONFIG_DEX).forEach(([key, cfg]) => {
        CFG.dex[key] = {
            active: cfg.enabled,
            modalCtD: cfg.modalCtD,
            modalDtC: cfg.modalDtC,
            count: cfg.count,
        };
    });
})();

// Sync legacy quoteCount fields — diperlukan oleh collectors (dex-metax, jumpx)
function _syncLegacyDexCounts() {
    const d = CFG.dex || {};
    Object.entries(CONFIG_DEX).forEach(([key, cfg]) => {
        if (cfg.hasCount) {
            CFG['quoteCount_' + key] = d[key]?.active ? (d[key]?.count || cfg.count) : 0;
        }
    });
    // Legacy compat aliases
    CFG.quoteCountMetax = CFG.quoteCount_metax || 0;
    CFG.quoteCountJumpx = CFG.quoteCount_jumpx || 0;
}

function totalQuoteCount() {
    const d = CFG.dex || {};
    let total = 0;
    Object.entries(CONFIG_DEX).forEach(([key, cfg]) => {
        if (!cfg.enabled) return;
        if (d[key]?.active === false) return;
        total += cfg.hasCount ? (d[key]?.count || cfg.count) : 1;
    });
    return Math.min(total, APP_DEV_CONFIG.maxDexDisplay || 8);
}

// Generik: cek apakah DEX tertentu aktif (developer + user toggle)
function isDexEnabled(key) {
    const cfg = CONFIG_DEX[key];
    if (!cfg || !cfg.enabled) return false;
    return CFG.dex?.[key]?.active !== false;
}

// Legacy compat — tetap berfungsi agar kode lama tidak crash
function isMetaxEnabled() { return isDexEnabled('metax'); }
function isJumpxEnabled() { return isDexEnabled('jumpx'); }
function isKyberEnabled() { return isDexEnabled('kyber'); }
function isOkxEnabled() { return isDexEnabled('okx'); }
function islifidexEnabled() { return isDexEnabled('lifidex'); }
function isAutoLevelEnabled() { return APP_DEV_CONFIG.defaultAutoLevel !== false; }

// DEX yang diizinkan tampil di UI — dikendalikan developer lewat CONFIG_DEX.enabled
const getEnabledDexList = () => DEX_LIST.filter(def => CONFIG_DEX[def.key]?.enabled !== false);

// Kembalikan token yang lolos filter CEX+chain, diurutkan sesuai monitorSort
let monitorSort = 'az'; // 'az' | 'za' | 'rand'
let monitorFavOnly = false; // jika true, hanya tampilkan koin favorit di scanner
let _shuffledTokens = null; // cache untuk random sort

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function getFilteredTokens() {
    const filtered = getTokens()
        .filter(t => {
            const cexOk = CFG.activeCex.length === 0 || CFG.activeCex.includes(t.cex);
            const chainOk = CFG.activeChains.length === 0 || CFG.activeChains.includes(t.chain);
            const favOk = !monitorFavOnly || t.favorite;
            const pairTk = (t.tickerPair || 'USDT').toUpperCase();
            const isStable = STABLE_COINS.has(pairTk);
            const pairOk = CFG.pairType === 'all' || (CFG.pairType === 'stable' ? isStable : !isStable);
            return cexOk && chainOk && favOk && pairOk;
        });
    if (monitorSort === 'za') return filtered.sort((a, b) => (b.ticker || '').localeCompare(a.ticker || ''));
    if (monitorSort === 'rand') {
        if (!_shuffledTokens) _shuffledTokens = shuffleArray([...filtered]);
        // Filter cached list to only include tokens that still exist
        const ids = new Set(filtered.map(t => t.id));
        return _shuffledTokens.filter(t => ids.has(t.id));
    }
    return filtered.sort((a, b) => (a.ticker || '').localeCompare(b.ticker || ''));
}

// ─── Signal Sound ─────────────────────────────
const _signalAudio = new Audio('audio.mp3');
_signalAudio.preload = 'auto';
function playSignalSound() {
    // Android WebView: selalu bunyi (bypass setting mute di web)
    // Browser biasa: ikuti setting CFG.soundMuted
    if (!window.AndroidBridge && CFG.soundMuted) return;
    try {
        _signalAudio.currentTime = 0;
        _signalAudio.play().catch(() => { });
    } catch { }
}

// ─── Complete Sound (ronde selesai) ───────────
function playCompleteSound() {
    if (!window.AndroidBridge && CFG.soundMuted) return;
    try {
        const audio = document.getElementById('audioComplete');
        if (audio) { audio.currentTime = 0; audio.play().catch(() => { }); }
    } catch { }
}
let scanning = false;
let scanAbort = false;
let autoReload = false; // default: sekali scan
let signalCache = [];
const tgCooldown = new Map(); // tokenId → timestamp
const wmCache = {};           // chain → data array
const _obCache = {};          // tokenId → { bids, asks, bidPrice, askPrice }
const _cardEls = new Map();  // tokenId → cached DOM element references

// ─── Utility ─────────────────────────────────
let _tokenCache = null;
const getTokens = () => {
    if (_tokenCache) return _tokenCache;
    _tokenCache = dbGet(LS_TOKENS, []);
    if (!Array.isArray(_tokenCache)) _tokenCache = [];
    return _tokenCache;
};
const saveTokens = (a) => {
    // Guard: jangan simpan array kosong jika sebelumnya ada data — cegah data hilang akibat race condition
    if (!a || !a.length) {
        const existing = dbGet(LS_TOKENS);
        if (Array.isArray(existing) && existing.length > 0) {
            console.warn('[saveTokens] Blocked empty save — existing data preserved (' + existing.length + ' tokens)');
            return;
        }
    }
    _tokenCache = a;
    dbSet(LS_TOKENS, a);
};
const clearTokenCache = () => { _tokenCache = null; };
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const toWei = (amt, dec) => {
    const n = Math.round(amt * 10 ** dec);
    if (!isFinite(n) || isNaN(n) || n <= 0) return '0';
    return BigInt(n).toString();
};
const fromWei = (w, dec) => parseFloat(w) / 10 ** dec;

// Diagnose problematic wei amounts before sending to DEX API
// Returns a short reason string, or null if amount looks OK
const MAX_SAFE_WEI = BigInt('1' + '0'.repeat(27)); // 1e27 upper limit
function diagnoseWei(amtWei) {
    if (amtWei === '0') return 'AMOUNT NOL';
    try { if (BigInt(amtWei) > MAX_SAFE_WEI) return 'MODAL BESAR'; } catch { }
    return null;
}
const fmt = (v, d = 5) => (+v).toFixed(d);
const fmtPnl = (v) => (v >= 0 ? '+' : '') + (+v).toFixed(2);

// Compact format: 0.0007950 → "0.{3}7950", 0.085 → "0.0850", 1.23 → "1.23"
function fmtCompact(v, sigfigs = 4) {
    if (!isFinite(v) || isNaN(v) || v === 0) return '0';
    const abs = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (abs >= 1) return sign + abs.toFixed(2);
    if (abs >= 0.01) return sign + abs.toFixed(4);
    const str = abs.toFixed(20);
    const dec = str.split('.')[1] || '';
    const zeros = dec.match(/^0*/)[0].length;
    const sig = dec.slice(zeros, zeros + sigfigs);
    return `${sign}0.{${zeros}}${sig}`;
}

// ─── Simple In-Memory Cache (TTL) ────────────
const _memCache = new Map();
function cacheGet(key) {
    const item = _memCache.get(key);
    if (!item) return undefined;
    if (Date.now() > item.exp) { _memCache.delete(key); return undefined; }
    return item.val;
}
function cacheSet(key, val, ttlMs) {
    _memCache.set(key, { val, exp: Date.now() + ttlMs });
    return val;
}
function cacheWrap(key, ttlMs, fn) {
    const cached = cacheGet(key);
    if (cached !== undefined) return cached;
    const val = fn();
    if (val !== undefined) cacheSet(key, val, ttlMs);
    if (val && typeof val.then === 'function') {
        val.catch(() => { _memCache.delete(key); });
    }
    return val;
}

// ─── 429 Error Counter (untuk adaptive delay) ──
let _429count = 0;
function bump429() { _429count++; }
function get429Count() { return _429count; }
function reset429Count() { _429count = 0; }

// ─── sleep helper ─────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── fetchWithRetry — Exponential Backoff ─────
// Wraps fetch() with retry logic for 429 (Too Many Requests) dan 5xx errors.
// Timeout & jeda sekarang diatur di level CEX/DEX (CONFIG_CEX[k].timeout, CONFIG_DEX[k].timeout)
// dan TIDAK dikelola di sini. fetchWithRetry hanya mengurus retry.
// Jika opts.signal sudah disediakan (dari caller), digunakan langsung.
async function fetchWithRetry(url, opts = {}, maxRetries = 1, baseDelay = 500) {
    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const resp = await fetch(url, opts);
            if (resp.status === 429 || (resp.status >= 500 && resp.status < 600)) {
                bump429();
                if (attempt < maxRetries) {
                    const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 300;
                    await sleep(delay);
                    continue;
                }
            }
            return resp;
        } catch (err) {
            // AbortError = timeout dari caller → lempar langsung, tidak retry
            if (err.name === 'AbortError') throw err;
            lastErr = err;
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 300;
                await sleep(delay);
            }
        }
    }
    throw lastErr || new Error('fetchWithRetry exhausted');
}

// ─── CORS Proxy Fetch ─────────────────────────
// Rate-limiting sekarang diatur per-CEX/DEX via CONFIG_CEX[k].jeda / CONFIG_DEX[k].jeda.
// proxyFetch hanya build URL proxy lalu delegate ke fetchWithRetry.
function proxyFetch(targetUrl, opts = {}) {
    const proxyUrl = APP_DEV_CONFIG.corsProxy + encodeURIComponent(targetUrl);
    return fetchWithRetry(proxyUrl, opts);
}

// ─── Staggered Promise Execution ──────────────
// Utility: jalankan array fungsi async dengan concurrency + jitter terkontrol.
// Tidak lagi digunakan oleh scan engine (diganti Promise.all + sleep per batch).
// Dipertahankan untuk kemungkinan penggunaan lain.
async function staggeredPromiseAll(fns, concurrency = 4, gapMs = 200) {
    const results = new Array(fns.length);
    let nextIdx = 0;

    async function runWorker() {
        while (nextIdx < fns.length) {
            const idx = nextIdx++;
            if (idx >= concurrency && gapMs > 0) {
                await sleep(gapMs + Math.random() * 100);
            }
            try {
                results[idx] = await fns[idx]();
            } catch (err) {
                results[idx] = undefined;
            }
        }
    }

    const workers = [];
    for (let w = 0; w < Math.min(concurrency, fns.length); w++) {
        if (w > 0 && gapMs > 0) await sleep(Math.floor(gapMs / 2));
        workers.push(runWorker());
    }
    await Promise.all(workers);
    return results;
}
