// ============================================================
// MOBILE SCANNER — core/base.js
// State global, DEX_LIST dari CONFIG_DEX, utility functions
// Storage: IndexedDB via core/db.js (bukan localStorage)
// ============================================================

// ─── CSS Variables: inject warna DEX & chain dari config ───
// Dipanggil satu kali di app init (setelah DOM ready)
function injectCssVariables() {
    const root = document.documentElement;
    // DEX colors dari CONFIG_DEX
    Object.entries(CONFIG_DEX).forEach(([key, d]) => {
        root.style.setProperty(`--dex-${key}-color`, d.color);
    });
    // Chain colors dari CONFIG_CHAINS
    Object.entries(CONFIG_CHAINS).forEach(([key, c]) => {
        root.style.setProperty(`--chain-${key}-color`, c.WARNA);
    });
    // CEX colors dari CONFIG_CEX
    Object.entries(CONFIG_CEX).forEach(([key, c]) => {
        root.style.setProperty(`--cex-${key}-color`, c.WARNA);
    });
}

// ─── DEX_LIST — di-derive dari CONFIG_DEX ──────────────────
// Tidak ada duplikasi data — semua dari config.js
const DEX_LIST = Object.entries(CONFIG_DEX).map(([key, d]) => ({
    key,
    label:        d.label,
    badge:        d.badge,
    color:        d.color,
    icon:         d.icon,
    hasCount:     d.hasCount,
    defaultCount: d.count,
    enabled:      d.enabled,
}));

// ─── Stable Coins ──────────────────────────────────────────
const STABLE_COINS = new Set([
    'USDT','USDC','BUSD','DAI','TUSD','FDUSD','USDD','USDP','FRAX',
    'LUSD','CRVUSD','PYUSD','GUSD','SUSD','MUSD','USDE','EUSD',
    'USDS','USD0','USDX',
]);

// ─── Runtime State (CFG) ───────────────────────────────────
// Dibuild dari CONFIG_DEX agar tidak hardcode per-DEX
function _buildDefaultDexCfg() {
    const out = {};
    Object.entries(CONFIG_DEX).forEach(([key, d]) => {
        out[key] = {
            active: d.enabled,
            ...(d.hasCount ? { count: d.count } : {}),
        };
    });
    return out;
}

let CFG = {
    username:    '',
    wallet:      '',
    interval:    CONFIG_MONITORING.loopJeda,
    sseTimeout:  CONFIG_DEX.metax.timing.timeout,
    soundMuted:  false,
    activeCex:   [],    // [] = semua aktif
    activeChains: [],   // [] = semua aktif
    pairType:    'all', // 'all' | 'stable' | 'non'
    autoLevel:   CONFIG_MONITORING.autoLevel,
    levelCount:  CONFIG_MONITORING.levelCount,
    dex:         _buildDefaultDexCfg(),
};

// ─── Legacy quoteCount sync (dipakai collectors) ────────────
function _syncLegacyDexCounts() {
    const d = CFG.dex || {};
    CFG.quoteCountMetax  = d.metax?.active  ? (d.metax?.count  || CONFIG_DEX.metax.count)  : 0;
    CFG.quoteCountOnekey = d.onekey?.active ? (d.onekey?.count || CONFIG_DEX.onekey.count) : 0;
}

// Membangun list slot DEX berurutan sesuai pilihan user
// Tiap slot = satu kolom di tabel (tanpa cap maxDexDisplay)
function getDexSlots() {
    const slots = [];
    for (const def of DEX_LIST) {
        if (!def.enabled) continue;
        const dc = CFG.dex?.[def.key];
        if (!dc?.active) continue;
        const count = def.hasCount ? (dc.count || def.defaultCount) : 1;
        for (let i = 0; i < count; i++) {
            slots.push({ key: def.key, label: def.label, badge: def.badge, color: def.color, routeIdx: i, routeTotal: count });
        }
    }
    return slots;
}

function totalQuoteCount() {
    return getDexSlots().length;
}

// ─── Enable helpers (dipakai collectors) ───────────────────
const getEnabledDexList = () => DEX_LIST.filter(d => d.enabled);

function isDexEnabled(key) {
    return !!(CONFIG_DEX[key]?.enabled && CFG.dex?.[key]?.active);
}
function isMetaxEnabled()      { return isDexEnabled('metax'); }
function isOnekeyEnabled()     { return isDexEnabled('onekey'); }
function isKyberEnabled()      { return isDexEnabled('kyber'); }
function isOkxEnabled()        { return isDexEnabled('okx'); }
function isOnekeyLifiEnabled() { return isDexEnabled('lifidex'); }
function isMatchaEnabled()     { return isDexEnabled('matcha'); }
function isAutoLevelEnabled()  { return CONFIG_MONITORING.autoLevel !== false; }

// ─── Token helpers ─────────────────────────────────────────
// getTokens/saveTokens sekarang ASYNC via IndexedDB
// Gunakan: const tokens = await getTokens();
const getTokens   = () => dbGetTokens();
const saveTokens  = (a) => dbSaveTokens(a);
const clearTokenCache = () => dbClearTokenCache();

const genId   = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const toWei   = (amt, dec) => {
    const n = Math.round(amt * 10 ** dec);
    if (!isFinite(n) || isNaN(n) || n <= 0) return '0';
    return BigInt(n).toString();
};
const fromWei = (w, dec) => parseFloat(w) / 10 ** dec;

const MAX_SAFE_WEI = BigInt('1' + '0'.repeat(27));
function diagnoseWei(amtWei) {
    if (amtWei === '0') return 'AMOUNT NOL';
    try { if (BigInt(amtWei) > MAX_SAFE_WEI) return 'MODAL BESAR'; } catch { }
    return null;
}

const fmt      = (v, d = 5) => (+v).toFixed(d);
const fmtPnl   = (v) => (v >= 0 ? '+' : '') + (+v).toFixed(2);

function fmtCompact(v, sigfigs = 4) {
    if (!isFinite(v) || isNaN(v) || v === 0) return '0';
    const abs  = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (abs >= 1)    return sign + abs.toFixed(2);
    if (abs >= 0.01) return sign + abs.toFixed(4);
    const str  = abs.toFixed(20);
    const dec  = str.split('.')[1] || '';
    const zeros = dec.match(/^0*/)[0].length;
    const sig   = dec.slice(zeros, zeros + sigfigs);
    return `${sign}0.{${zeros}}${sig}`;
}

// ─── In-Memory Cache (TTL) ─────────────────────────────────
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

// ─── Filtered Token List ───────────────────────────────────
let monitorSort    = 'az';   // 'az' | 'za' | 'rand'
let monitorFavOnly = false;
let _shuffledTokens = null;

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Sync version untuk dipakai komponen yang sudah punya tokens (hasil await)
function filterAndSortTokens(tokens) {
    const filtered = tokens.filter(t => {
        const cexOk   = CFG.activeCex.length === 0   || CFG.activeCex.includes(t.cex);
        const chainOk = CFG.activeChains.length === 0 || CFG.activeChains.includes(t.chain);
        const favOk   = !monitorFavOnly || t.favorite;
        const pairTk  = (t.tickerPair || 'USDT').toUpperCase();
        const isStable = STABLE_COINS.has(pairTk);
        const pairOk  = CFG.pairType === 'all' || (CFG.pairType === 'stable' ? isStable : !isStable);
        return cexOk && chainOk && favOk && pairOk;
    });
    if (monitorSort === 'za') return filtered.sort((a, b) => (b.ticker || '').localeCompare(a.ticker || ''));
    if (monitorSort === 'rand') {
        if (!_shuffledTokens) _shuffledTokens = shuffleArray([...filtered]);
        const ids = new Set(filtered.map(t => t.id));
        return _shuffledTokens.filter(t => ids.has(t.id));
    }
    return filtered.sort((a, b) => (a.ticker || '').localeCompare(b.ticker || ''));
}

// Async version untuk pemanggilan langsung
async function getFilteredTokens() {
    const tokens = await getTokens();
    return filterAndSortTokens(tokens);
}

// ─── Signal Sound ──────────────────────────────────────────
const _signalAudio = new Audio('audio.mp3');
_signalAudio.preload = 'auto';
function playSignalSound() {
    if (!window.AndroidBridge && CFG.soundMuted) return;
    try { _signalAudio.currentTime = 0; _signalAudio.play().catch(() => {}); } catch {}
}

function playCompleteSound() {
    if (!window.AndroidBridge && CFG.soundMuted) return;
    try {
        const audio = document.getElementById('audioComplete');
        if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
    } catch {}
}

// ─── Runtime flags ─────────────────────────────────────────
let scanning    = false;
let scanAbort   = false;
let autoReload  = false;
let signalCache = [];
const tgCooldown = new Map();
const wmCache    = {};
const _obCache   = {};
const _cardEls   = new Map();

// ─── Persist settings ──────────────────────────────────────
async function _persistCFG() {
    await dbSaveSettings(CFG);
}
