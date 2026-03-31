// ─── KYBER: KyberSwap Aggregator REST API ────
// CTD: Kyber Aggregator API langsung
// DTC: Krystal allRates API (filter KyberSwap)
// Docs: https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator
const KYBER_CHAIN_MAP = {
    bsc: 'bsc', ethereum: 'ethereum', polygon: 'polygon',
    arbitrum: 'arbitrum', base: 'base',
};
const KRYSTAL_CHAIN_ID_MAP = {
    56: 'bsc', 1: 'ethereum', 137: 'polygon', 42161: 'arbitrum', 8453: 'base',
};
const KRYSTAL_PLATFORM_WALLET_KB = '0x168E4c3AC8d89B00958B6bE6400B066f0347DDc9';

async function fetchDexQuotesKyber(chainKey, srcToken, destToken, amountWei, decOut, decIn = 18, dir = 'ctd') {
    if (!isDexEnabled('kyber')) return [];
    if (!amountWei || String(amountWei) === '0') return [];
    const cacheKey = `dex:kb:${chainKey}:${srcToken}:${destToken}:${amountWei}:${dir}`;
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) return cached;
    try {
        if (dir === 'dtc') {
            // DTC: Krystal allRates API — filter platform "KyberSwap"
            const chainId = CONFIG_CHAINS[chainKey]?.Kode_Chain;
            const chainName = KRYSTAL_CHAIN_ID_MAP[Number(chainId)];
            if (!chainName) return [];
            const url = `https://api.krystal.app/${chainName}/v2/swap/allRates` +
                `?src=${srcToken}&srcAmount=${amountWei}&dest=${destToken}` +
                `&platformWallet=${KRYSTAL_PLATFORM_WALLET_KB}`;
            const resp = await fetchWithRetry(url);
            if (!resp.ok) return [];
            const data = await resp.json();
            const rates = data?.rates || [];
            // Filter: hanya ambil rate yang platform mengandung "kyber"
            const match = rates.find(r =>
                /kyber/i.test(r.platform || r.exchange || r.name || '')
            );
            if (!match?.amount) return [];
            // Gas fee: estimatedGas * gwei * tokenPrice / 1e9
            let feeSwapUsdt = 0;
            try {
                const gasUnits = parseFloat(match.estimatedGas || match.estGasConsumed || 0);
                if (gasUnits > 0) {
                    const gasData = dbGet('scp_gasFees', []);
                    const gasInfo = gasData.find(g => String(g.chain || '').toLowerCase() === chainKey);
                    if (gasInfo?.gwei && gasInfo?.tokenPrice) {
                        feeSwapUsdt = (gasUnits * gasInfo.gwei * gasInfo.tokenPrice) / 1e9;
                    }
                }
            } catch (_) {}
            const dec = match.decimals ?? match.destDecimals ?? decOut;
            const name = (match.platform || 'KYBER').toUpperCase();
            const res = [{ amount: parseFloat(match.amount), dec, name, src: 'KB', feeSwapUsdt }];
            cacheSet(cacheKey, res, 900);
            return res;
        } else {
            // CTD: Kyber Aggregator API langsung
            const chainName = KYBER_CHAIN_MAP[chainKey];
            if (!chainName) return [];
            const url = `https://aggregator-api.kyberswap.com/${chainName}/api/v1/routes` +
                `?tokenIn=${srcToken}&tokenOut=${destToken}&amountIn=${amountWei}&gasInclude=true`;
            const resp = await fetchWithRetry(url, { headers: { 'x-client-id': 'hybridapp' } });
            if (!resp.ok) return [];
            const data = await resp.json();
            const rs = data?.data?.routeSummary;
            const amountOut = rs?.amountOut;
            if (!amountOut) return [];
            const feeSwapUsdt = parseFloat(rs?.gasUsd || rs?.gas || 0) || 0;
            const res = [{ amount: parseFloat(amountOut), dec: decOut, name: 'KYBER', src: 'KB', feeSwapUsdt }];
            cacheSet(cacheKey, res, 900);
            return res;
        }
    } catch { return []; }
}
