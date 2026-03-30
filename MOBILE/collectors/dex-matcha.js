// ─── MATCHA: 1Delta proxy + Rainbow proxy paralel ─────────────
// Kolom MATCHA (badge MA) = 0x Protocol via dua proxy publik (tanpa API key):
// 1Delta : GET https://api.1delta.io/swap/allowance-holder/quote  (aggregator=0x)
// Rainbow: GET https://swap.p.rainbow.me/v1/quote                (source=0x)
// Keduanya mengembalikan buyAmount dalam wei. Output terbesar yang digunakan.

// Sumber 1: 1Delta (0x proxy)
async function _fetchMatcha1Delta(chainId, srcToken, destToken, amountWei, decOut) {
    try {
        const wallet = CFG.wallet || '0x0000000000000000000000000000000000000000';
        const params = new URLSearchParams({
            chainId:               chainId.toString(),
            sellToken:             srcToken,
            buyToken:              destToken,
            sellAmount:            amountWei.toString(),
            taker:                 wallet,
            slippageBps:           '30',
            tradeSurplusRecipient: wallet,
            aggregator:            '0x',
        });
        const resp = await fetch(`https://api.1delta.io/swap/allowance-holder/quote?${params}`);
        if (!resp.ok) return null;
        const data = await resp.json();
        if (!data?.buyAmount) return null;
        const feeSwapUsdt = parseFloat(data?.fees?.gasFee || 0) || 0;
        return { amount: parseFloat(data.buyAmount), dec: decOut, name: 'MATCHA', src: 'MA', feeSwapUsdt };
    } catch { return null; }
}

// Sumber 2: Rainbow (0x proxy)
async function _fetchMatchaRainbow(chainId, srcToken, destToken, amountWei, decOut) {
    try {
        const wallet = CFG.wallet || '0x0000000000000000000000000000000000000000';
        const params = new URLSearchParams({
            allowFallback:        'true',
            buyToken:             destToken,
            sellToken:            srcToken,
            chainId:              chainId.toString(),
            currency:             'USD',
            enableNewChainSwaps:  'true',
            fromAddress:          wallet,
            slippage:             '2',
            source:               '0x',
            sellAmount:           amountWei.toString(),
        });
        const resp = await fetch(`https://swap.p.rainbow.me/v1/quote?${params}`);
        if (!resp.ok) return null;
        const data = await resp.json();
        if (!data?.buyAmount) return null;
        const feeSwapUsdt = parseFloat(
            data?.fees?.gasFee?.amount || data?.gas?.usdValue || 0
        ) || 0;
        return { amount: parseFloat(data.buyAmount), dec: decOut, name: 'MATCHA', src: 'MA', feeSwapUsdt };
    } catch { return null; }
}

function fetchDexQuotesMatcha(chainId, srcToken, destToken, amountWei, decOut) {
    if (!isMatchaEnabled()) return Promise.resolve([]);
    if (!amountWei || String(amountWei) === '0') return Promise.resolve([]);
    const cacheKey = `dex:ma:${chainId}:${srcToken}:${destToken}:${amountWei}`;
    return cacheWrap(cacheKey, 900, async () => {
        try {
            const [delta, rainbow] = await Promise.all([
                _fetchMatcha1Delta(chainId, srcToken, destToken, amountWei, decOut),
                _fetchMatchaRainbow(chainId, srcToken, destToken, amountWei, decOut),
            ]);
            // Keduanya dalam wei (dec = decOut) → bandingkan langsung
            const best = (!delta && !rainbow) ? null
                       : (!delta) ? rainbow
                       : (!rainbow) ? delta
                       : (delta.amount >= rainbow.amount ? delta : rainbow);
            return best ? [best] : [];
        } catch { return []; }
    });
}
