// ─── OKX DEX: C98 Superlink + Krystal[filter OKX] paralel ───
// Dua sumber dipakai agar beban tidak terpusat di satu endpoint.
// Sumber terbaik (output terbesar) yang digunakan.
//
// C98    : POST https://superlink-server.coin98.tech/quote  (via CORS proxy)
// Krystal: GET  https://api.krystal.app/{chain}/v2/swap/allRates (direct)

const _C98_NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

// Fetch OKX quote via C98 Superlink
async function _fetchOkxC98(chainId, srcToken, destToken, amountWei, decOut, decIn, symIn, symOut) {
    try {
        const amount = parseFloat(amountWei) / Math.pow(10, decIn);
        if (!isFinite(amount) || amount <= 0) return null;

        const isNativeSrc = srcToken.toLowerCase() === _C98_NATIVE;
        const isNativeDst = destToken.toLowerCase() === _C98_NATIVE;
        const token0 = { chainId, symbol: symIn, decimals: decIn };
        if (!isNativeSrc) token0.address = srcToken;
        const token1 = { chainId, symbol: symOut, decimals: decOut };
        if (!isNativeDst) token1.address = destToken;

        const wallet = CFG.wallet || '0x0000000000000000000000000000000000000000';
        const body = JSON.stringify({ isAuto: true, amount, token0, token1, backer: ['OKX'], wallet });
        const targetUrl = 'https://superlink-server.coin98.tech/quote';
        const proxyUrl  = APP_DEV_CONFIG.corsProxy + encodeURIComponent(targetUrl);
        const resp = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body,
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        const toAmt = data?.data?.[0]?.amount;
        if (toAmt == null) return null;
        return { amount: parseFloat(toAmt), dec: 0, name: 'OKXDEX', src: 'OX', feeSwapUsdt: 0 };
    } catch { return null; }
}

// Pilih sumber dengan output terbesar
function _bestOkx(a, b) {
    if (!a && !b) return null;
    if (!a) return b;
    if (!b) return a;
    const aH = a.amount / Math.pow(10, a.dec ?? 0);
    const bH = b.amount / Math.pow(10, b.dec ?? 0);
    return bH >= aH ? b : a;
}

async function fetchDexQuotesOkx(chainId, srcToken, destToken, amountWei, decOut, decIn = 18, symIn = '', symOut = '') {
    if (!isOkxEnabled()) return [];
    if (!amountWei || String(amountWei) === '0') return [];
    const cacheKey = `dex:ox:${chainId}:${srcToken}:${destToken}:${amountWei}`;
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) return cached;

    return cacheWrap(cacheKey, 900, async () => {
        try {
            const [c98, krystal] = await Promise.all([
                _fetchOkxC98(chainId, srcToken, destToken, amountWei, decOut, decIn, symIn, symOut),
                fetchKrystalForOkx(chainId, srcToken, destToken, amountWei),
            ]);
            const best = _bestOkx(c98, krystal);
            return best ? [best] : [];
        } catch { return []; }
    });
}
