// ─── KYBER: KyberSwap + Krystal[filter Kyber] paralel ────────
// CTD : KyberSwap Aggregator API (direct) + Krystal filter Kyber → ambil terbaik
// DTC : Bungee API (filter Kyber route) + Krystal filter Kyber → ambil terbaik
// Bungee dipakai untuk DTC karena KyberSwap hanya support satu arah swap optimal.

const KYBER_CHAIN_MAP = {
    bsc: 'bsc', ethereum: 'ethereum', polygon: 'polygon',
    arbitrum: 'arbitrum', base: 'base',
};

// Bandingkan dua hasil: return yang human-readable-nya lebih besar
function _bestKyber(a, b) {
    if (!a && !b) return null;
    if (!a) return b;
    if (!b) return a;
    const aH = a.amount / Math.pow(10, a.dec || 0);
    const bH = b.amount / Math.pow(10, b.dec || 0);
    return bH >= aH ? b : a;
}

// Kyber direct (CTD)
async function _fetchKyberDirect(chainName, srcToken, destToken, amountWei, decOut) {
    try {
        const url = `https://aggregator-api.kyberswap.com/${chainName}/api/v1/routes` +
            `?tokenIn=${srcToken}&tokenOut=${destToken}&amountIn=${amountWei}&gasInclude=true`;
        const resp = await fetch(url, { headers: { 'x-client-id': 'hybridapp' } });
        if (!resp.ok) return null;
        const data = await resp.json();
        const rs = data?.data?.routeSummary;
        if (!rs?.amountOut) return null;
        const feeSwapUsdt = parseFloat(rs.gasUsd || rs.gas || 0) || 0;
        return { amount: parseFloat(rs.amountOut), dec: decOut, name: 'KYBER', src: 'KB', feeSwapUsdt };
    } catch { return null; }
}

// Bungee filter Kyber (DTC)
async function _fetchBungeeKyber(chainId, srcToken, destToken, amountWei, decOut) {
    try {
        const userAddr = CFG.wallet || '0x0000000000000000000000000000000000000000';
        const params = new URLSearchParams({
            userAddress: userAddr, originChainId: chainId, destinationChainId: chainId,
            inputAmount: amountWei.toString(), inputToken: srcToken.toLowerCase(),
            outputToken: destToken.toLowerCase(), enableManual: 'true',
            receiverAddress: userAddr, refuel: 'false', excludeBridges: 'cctp',
            useInbox: 'false', enableMultipleAutoRoutes: 'true',
        });
        const resp = await fetch(`https://dedicated-backend.bungee.exchange/api/v1/bungee/quote?${params}`, {
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'affiliate':    APP_DEV_CONFIG.bungeeAffiliate,
                'x-api-key':    APP_DEV_CONFIG.bungeeApiKey,
            }
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        if (!data?.success) return null;
        const result    = data.result || {};
        const allRoutes = [...(result.manualRoutes || [])];
        if (result.autoRoute?.output?.amount) allRoutes.push(result.autoRoute);
        const route = allRoutes.find(r => /kyber/i.test(r.routeDetails?.name || r.name || ''));
        if (!route?.output?.amount) return null;
        const feeSwapUsdt = parseFloat(route.gasFee?.feeInUsd || 0) || 0;
        return { amount: parseFloat(route.output.amount), dec: decOut, name: 'KYBER', src: 'KB', feeSwapUsdt };
    } catch { return null; }
}

async function fetchDexQuotesKyber(chainKey, srcToken, destToken, amountWei, decOut, decIn = 18, dir = 'ctd') {
    if (!isKyberEnabled()) return [];
    if (!amountWei || String(amountWei) === '0') return [];
    const cacheKey = `dex:kb:${chainKey}:${srcToken}:${destToken}:${amountWei}:${dir}`;
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) return cached;

    return cacheWrap(cacheKey, 900, async () => {
        try {
            const chainId = CONFIG_CHAINS[chainKey]?.Kode_Chain;
            let primary = null, krystal = null;

            if (dir === 'dtc') {
                [primary, krystal] = await Promise.all([
                    chainId ? _fetchBungeeKyber(chainId, srcToken, destToken, amountWei, decOut) : null,
                    chainId ? fetchKrystalForKyber(chainId, srcToken, destToken, amountWei)      : null,
                ]);
            } else {
                const chainName = KYBER_CHAIN_MAP[chainKey];
                [primary, krystal] = await Promise.all([
                    chainName ? _fetchKyberDirect(chainName, srcToken, destToken, amountWei, decOut) : null,
                    chainId   ? fetchKrystalForKyber(chainId, srcToken, destToken, amountWei)        : null,
                ]);
            }
            const best = _bestKyber(primary, krystal);
            return best ? [best] : [];
        } catch { return []; }
    });
}
