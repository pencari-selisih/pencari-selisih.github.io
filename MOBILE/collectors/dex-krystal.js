// ─── KRYSTAL: Utility bersama untuk KYBER & OKX ─────────────
// Tidak lagi kolom tersendiri di scanner.
// Digunakan sebagai sumber paralel oleh dex-kyber.js dan dex-okx.js
// agar load API terdistribusi dan coverage lebih baik.
//
// Endpoint : GET https://api.krystal.app/{chain}/v2/swap/allRates
// Method   : GET — tidak perlu API key, tidak perlu CORS proxy

const KRYSTAL_CHAIN_MAP = {
    56: 'bsc', 1: 'ethereum', 137: 'polygon', 42161: 'arbitrum', 8453: 'base',
};
const KRYSTAL_PLATFORM_WALLET = '0x168E4c3AC8d89B00958B6bE6400B066f0347DDc9';

// Fetch raw Krystal rates (shared cache agar KYBER & OKX tidak double-fetch)
async function _fetchKrystalRates(chainId, srcToken, destToken, amountWei) {
    const cacheKey = `krystal:raw:${chainId}:${srcToken}:${destToken}:${amountWei}`;
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) return cached; // bisa berupa Promise (concurrent) atau array
    try {
        const chainName = KRYSTAL_CHAIN_MAP[Number(chainId)];
        if (!chainName) { cacheSet(cacheKey, [], 900); return []; }
        const url = `https://api.krystal.app/${chainName}/v2/swap/allRates` +
            `?src=${srcToken}&srcAmount=${amountWei}&dest=${destToken}` +
            `&platformWallet=${KRYSTAL_PLATFORM_WALLET}`;
        const promise = fetch(url).then(async resp => {
            if (!resp.ok) return [];
            const data = await resp.json();
            return data?.rates || [];
        }).catch(() => []);
        cacheSet(cacheKey, promise, 900);
        return promise;
    } catch { return []; }
}

// Parse single Krystal rate → object kompatibel dengan computeQuotePnl
function _parseKrystalRate(rate, srcTag, forceName) {
    try {
        if (!rate) return null;
        const amountOut = rate.amount || rate.destAmount || rate.toAmount || rate.amountOut;
        if (!amountOut) return null;
        const dec  = rate.decimals ?? rate.destDecimals ?? 18;
        const name = forceName || (rate.platform || rate.exchange || rate.name || 'KRYSTAL').toUpperCase();
        return { amount: parseFloat(amountOut), dec, name, src: srcTag, feeSwapUsdt: 0 };
    } catch { return null; }
}

// Ambil quote Kyber dari Krystal (filter platform: KyberSwap)
async function fetchKrystalForKyber(chainId, srcToken, destToken, amountWei) {
    const rates = await _fetchKrystalRates(chainId, srcToken, destToken, amountWei);
    const hit   = rates.find(r => /kyber/i.test(r.platform || r.exchange || r.name || ''));
    return _parseKrystalRate(hit, 'KB', 'KYBER');
}

// Ambil quote OKX dari Krystal (filter platform: OKX Dex)
async function fetchKrystalForOkx(chainId, srcToken, destToken, amountWei) {
    const rates = await _fetchKrystalRates(chainId, srcToken, destToken, amountWei);
    const hit   = rates.find(r => /okx/i.test(r.platform || r.exchange || r.name || ''));
    return _parseKrystalRate(hit, 'OX', 'OKXDEX');
}
