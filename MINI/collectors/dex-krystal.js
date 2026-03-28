// ─── KRYSTAL: allRates API ──────────────────────
// Kolom KR di scanner — provider: Krystal DEX Aggregator
// Filter: semua DEX dikembalikan KECUALI Kyber (sudah ditangani kolom KB).
// Endpoint: https://api.krystal.app/{chain}/v2/swap/allRates
// Method: GET

const KRYSTAL_CHAIN_MAP = {
    56: 'bsc', 1: 'ethereum', 137: 'polygon', 42161: 'arbitrum', 8453: 'base',
};
const KRYSTAL_PLATFORM_WALLET = '0x168E4c3AC8d89B00958B6bE6400B066f0347DDc9';

function fetchDexQuotesKrystal(chainId, srcToken, destToken, amountWei) {
    if (!isKrystalEnabled()) return Promise.resolve([]);
    const cacheKey = `dex:bg:${chainId}:${srcToken}:${destToken}:${amountWei}`;
    return cacheWrap(cacheKey, 900, () => new Promise(async resolve => {
        try {
            const chainName = KRYSTAL_CHAIN_MAP[Number(chainId)];
            if (!chainName) { resolve([]); return; }
            const url = `https://api.krystal.app/${chainName}/v2/swap/allRates` +
                `?src=${srcToken}&srcAmount=${amountWei}&dest=${destToken}` +
                `&platformWallet=${KRYSTAL_PLATFORM_WALLET}`;
            const resp = await fetch(url);
            if (!resp.ok) { resolve([]); return; }
            const data = await resp.json();
            const rates = data?.rates || [];
            if (!rates.length) { resolve([]); return; }
            // Exclude Kyber — sudah ada di kolom KB
            const filtered = rates.filter(r =>
                !/kyber/i.test(r.platform || r.exchange || r.name || '')
            );
            resolve(filtered.slice(0, CFG.quoteCountKrystal));
        } catch { resolve([]); }
    }));
}

function parseDexQuoteKrystal(rate) {
    try {
        if (!rate) return null;
        const amountOut = rate.amount || rate.destAmount || rate.toAmount || rate.amountOut;
        if (!amountOut) return null;
        const dec  = rate.decimals ?? rate.destDecimals ?? 18;
        const name = (rate.platform || rate.exchange || rate.name || 'KRYSTAL').toUpperCase();
        return { amount: parseFloat(amountOut), dec, name, src: 'KR', feeSwapUsdt: 0 };
    } catch { return null; }
}
