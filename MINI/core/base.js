/* ═══════════════════════════════════════════════
   SCANNER PRICE CRYPTO — app.js
   Dual DEX Aggregator: METAX + JUMPX
   Full application logic (jQuery 3.7 + Native JS)
═══════════════════════════════════════════════ */

// ─── LocalStorage Keys ───────────────────────
const LS_TOKENS = 'cexdex_tokens';
const LS_SETTINGS = 'cexdex_settings';

// ─── Runtime State ───────────────────────────
const STABLE_COINS = new Set(['USDT','USDC','BUSD','DAI','TUSD','FDUSD','USDD','USDP','FRAX','LUSD','CRVUSD','PYUSD','GUSD','SUSD','MUSD','USDE','EUSD','USDS','USD0','USDX']);

// ─── DEX List — metadata setiap DEX aggregator ─
const DEX_LIST = [
    { key: 'metax',  label: 'METAX',  badge: 'MT', hasCount: true,  defaultCount: APP_DEV_CONFIG.defaultQuoteCountMetax  },
    { key: 'jumpx',  label: 'LIFI',   badge: 'LF', hasCount: true,  defaultCount: APP_DEV_CONFIG.defaultQuoteCountJumpx  },
    { key: 'kyber',  label: 'KYBER',  badge: 'KB', hasCount: false, defaultCount: 1 },
    { key: 'okx',    label: 'OKX',    badge: 'OK', hasCount: false, defaultCount: 1 },
    { key: 'krystal', label: 'KRYSTAL', badge: 'KC', hasCount: true,  defaultCount: APP_DEV_CONFIG.defaultQuoteCountKrystal  },
];

let CFG = {
    username: '',
    wallet: '',
    interval: APP_DEV_CONFIG.defaultInterval,
    sseTimeout: APP_DEV_CONFIG.defaultSseTimeout,
    // Legacy fields — di-sync dari CFG.dex.*.count agar collectors tetap berfungsi
    quoteCountMetax:  APP_DEV_CONFIG.defaultQuoteCountMetax,
    quoteCountJumpx:  APP_DEV_CONFIG.defaultQuoteCountJumpx,
    quoteCountKrystal: APP_DEV_CONFIG.defaultQuoteCountKrystal,
    soundMuted: false,
    activeCex: [],    // [] = semua aktif
    activeChains: [], // [] = semua aktif
    pairType: 'all',  // 'all' | 'stable' | 'non'
    autoLevel: APP_DEV_CONFIG.defaultAutoLevel,
    levelCount: APP_DEV_CONFIG.defaultLevelCount,
    dex: {
        metax:  { active: true,  modalCtD: 100, modalDtC: 80, count: APP_DEV_CONFIG.defaultQuoteCountMetax  },
        jumpx:  { active: APP_DEV_CONFIG.defaultQuoteCountJumpx  > 0, modalCtD: 100, modalDtC: 80, count: APP_DEV_CONFIG.defaultQuoteCountJumpx  },
        kyber:  { active: APP_DEV_CONFIG.defaultEnableKyber === true, modalCtD: 100, modalDtC: 80 },
        okx:    { active: APP_DEV_CONFIG.defaultEnableOkx   === true, modalCtD: 100, modalDtC: 80 },
        krystal: { active: APP_DEV_CONFIG.defaultQuoteCountKrystal > 0, modalCtD: 100, modalDtC: 80, count: APP_DEV_CONFIG.defaultQuoteCountKrystal },
    },
};

// Sync legacy quoteCount fields dari CFG.dex — diperlukan oleh collectors (dex-metax, jumpx, krystal)
function _syncLegacyDexCounts() {
    const d = CFG.dex || {};
    CFG.quoteCountMetax   = d.metax?.active   ? (d.metax?.count   || APP_DEV_CONFIG.defaultQuoteCountMetax)   : 0;
    CFG.quoteCountJumpx   = d.jumpx?.active   && APP_DEV_CONFIG.defaultQuoteCountJumpx > 0
        ? (d.jumpx?.count  || APP_DEV_CONFIG.defaultQuoteCountJumpx)  : 0;
    CFG.quoteCountKrystal = d.krystal?.active ? (d.krystal?.count || APP_DEV_CONFIG.defaultQuoteCountKrystal) : 0;
}

function totalQuoteCount() {
    const d = CFG.dex || {};
    const raw = (d.metax?.active  ? (d.metax?.count  || APP_DEV_CONFIG.defaultQuoteCountMetax)  : 0)
        + (d.jumpx?.active  && APP_DEV_CONFIG.defaultQuoteCountJumpx > 0 ? (d.jumpx?.count  || APP_DEV_CONFIG.defaultQuoteCountJumpx)  : 0)
        + (isKyberEnabled() ? 1 : 0)
        + (isOkxEnabled()   ? 1 : 0)
        + (d.krystal?.active ? (d.krystal?.count || APP_DEV_CONFIG.defaultQuoteCountKrystal) : 0);
    return Math.min(raw, APP_DEV_CONFIG.maxDexDisplay || 6);
}

function isMetaxEnabled()     { return !!(CFG.dex?.metax?.active  && APP_DEV_CONFIG.defaultQuoteCountMetax  > 0); }
function isJumpxEnabled()     { return !!(CFG.dex?.jumpx?.active  && APP_DEV_CONFIG.defaultQuoteCountJumpx  > 0); }
function isAutoLevelEnabled() { return APP_DEV_CONFIG.defaultAutoLevel !== false; }
function isKyberEnabled()     { return !!(CFG.dex?.kyber?.active  && APP_DEV_CONFIG.defaultEnableKyber === true); }
function isOkxEnabled()       { return !!(CFG.dex?.okx?.active    && APP_DEV_CONFIG.defaultEnableOkx   === true); }
function isKrystalEnabled()   { return !!(CFG.dex?.krystal?.active && (CFG.dex?.krystal?.count || 0) > 0); }

// DEX yang diizinkan tampil di UI (bulk modal, CRUD form, token list chip)
// — dikendalikan developer lewat config.js, bukan user
const _DEX_ENABLED_BY_CONFIG = {
    metax:  () => APP_DEV_CONFIG.defaultQuoteCountMetax  > 0,
    jumpx:  () => APP_DEV_CONFIG.defaultQuoteCountJumpx  > 0,
    kyber:  () => APP_DEV_CONFIG.defaultEnableKyber === true,
    okx:    () => APP_DEV_CONFIG.defaultEnableOkx   === true,
    krystal: () => APP_DEV_CONFIG.defaultQuoteCountKrystal > 0,
};
const getEnabledDexList = () => DEX_LIST.filter(def => _DEX_ENABLED_BY_CONFIG[def.key]?.() !== false);

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
    try { _tokenCache = JSON.parse(localStorage.getItem(LS_TOKENS)) || []; } catch { _tokenCache = []; }
    return _tokenCache;
};
const saveTokens = (a) => {
    // Guard: jangan simpan array kosong jika sebelumnya ada data — cegah data hilang akibat race condition
    if (!a || !a.length) {
        try {
            const existing = JSON.parse(localStorage.getItem(LS_TOKENS));
            if (Array.isArray(existing) && existing.length > 0) {
                console.warn('[saveTokens] Blocked empty save — existing data preserved (' + existing.length + ' tokens)');
                return;
            }
        } catch { }
    }
    _tokenCache = a;
    try {
        localStorage.setItem(LS_TOKENS, JSON.stringify(a));
    } catch (e) {
        console.error('[saveTokens] localStorage write failed:', e);
    }
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
