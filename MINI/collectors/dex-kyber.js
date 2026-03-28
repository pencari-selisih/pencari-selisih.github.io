// ─── KYBER: KyberSwap Aggregator REST API ────
// Docs: https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/developer-guides/execute-a-swap-with-the-aggregator-api
const KYBER_CHAIN_MAP = {
    bsc: 'bsc', ethereum: 'ethereum', polygon: 'polygon',
    arbitrum: 'arbitrum', base: 'base',
};

async function fetchDexQuotesKyber(chainKey, srcToken, destToken, amountWei, decOut, decIn = 18, dir = 'ctd') {
    if (!isKyberEnabled()) return [];
    if (!amountWei || String(amountWei) === '0') return [];
    const cacheKey = `dex:kb:${chainKey}:${srcToken}:${destToken}:${amountWei}:${dir}`;
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) return cached;
    try {
        if (dir === 'dtc') {
            // DTC: gunakan Krystal allRates API — filter hanya route Kyber
            const chainName = KYBER_CHAIN_MAP[chainKey];
            if (!chainName) return [];
            const platformWallet = '0x168E4c3AC8d89B00958B6bE6400B066f0347DDc9';
            const url = `https://api.krystal.app/${chainName}/v2/swap/allRates` +
                `?src=${srcToken}&srcAmount=${amountWei}&dest=${destToken}&platformWallet=${platformWallet}`;
            const resp = await fetch(url);
            if (!resp.ok) return [];
            const data = await resp.json();
            const rates = data?.rates || [];
            // Filter hanya DEX Kyber dari semua rate yang dikembalikan Krystal
            const kyberRate = rates.find(r => /kyber/i.test(r.platform || r.exchange || r.name || ''));
            if (!kyberRate) return [];
            const amountOut = kyberRate.amount || kyberRate.destAmount || kyberRate.toAmount || kyberRate.amountOut;
            if (!amountOut) return [];
            const res = [{ amount: parseFloat(amountOut), dec: decOut, name: 'KYBER', src: 'KB', feeSwapUsdt: 0 }];
            cacheSet(cacheKey, res, 900);
            return res;
        } else {
            // CTD: gunakan Kyber Aggregator API langsung
            const chainName = KYBER_CHAIN_MAP[chainKey];
            if (!chainName) return [];
            const url = `https://aggregator-api.kyberswap.com/${chainName}/api/v1/routes` +
                `?tokenIn=${srcToken}&tokenOut=${destToken}&amountIn=${amountWei}&gasInclude=true`;
            const resp = await fetch(url, { headers: { 'x-client-id': 'hybridapp' } });
            if (!resp.ok) return [];
            const data = await resp.json();
            const rs = data?.data?.routeSummary;
            const amountOut = rs?.amountOut;
            if (!amountOut) return [];
            // gasUsd: gas cost in USD dari Kyber response (gasInclude=true di URL)
            const feeSwapUsdt = parseFloat(rs?.gasUsd || rs?.gas || 0) || 0;
            const res = [{ amount: parseFloat(amountOut), dec: decOut, name: 'KYBER', src: 'KB', feeSwapUsdt }];
            cacheSet(cacheKey, res, 900);
            return res;
        }
    } catch { return []; }
}
