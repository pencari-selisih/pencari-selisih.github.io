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
            // DTC: gunakan Bungee API — filter hanya route KyberSwap
            const chainId = CONFIG_CHAINS[chainKey]?.Kode_Chain;
            if (!chainId) return [];
            const userAddr = CFG.wallet || '0x0000000000000000000000000000000000000000';
            const params = new URLSearchParams({
                userAddress:              userAddr,
                originChainId:            chainId,
                destinationChainId:       chainId,
                inputAmount:              amountWei.toString(),
                inputToken:               srcToken.toLowerCase(),
                outputToken:              destToken.toLowerCase(),
                enableManual:             'true',
                receiverAddress:          userAddr,
                refuel:                   'false',
                excludeBridges:           'cctp',
                useInbox:                 'false',
                enableMultipleAutoRoutes: 'true',
            });
            const bgUrl = `https://dedicated-backend.bungee.exchange/api/v1/bungee/quote?${params}`;
            const resp = await fetch(bgUrl, {
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'affiliate':    APP_DEV_CONFIG.bungeeAffiliate,
                    'x-api-key':    APP_DEV_CONFIG.bungeeApiKey,
                }
            });
            if (!resp.ok) return [];
            const data = await resp.json();
            if (!data?.success) return [];
            const result = data.result || {};
            const allRoutes = [...(result.manualRoutes || [])];
            if (result.autoRoute?.output?.amount) allRoutes.push(result.autoRoute);
            // Filter hanya route yang namanya mengandung "kyber"
            const kyberRoute = allRoutes.find(r => /kyber/i.test(r.routeDetails?.name || r.name || ''));
            if (!kyberRoute?.output?.amount) return [];
            const feeSwapUsdt = parseFloat(kyberRoute.gasFee?.feeInUsd || 0) || 0;
            const res = [{ amount: parseFloat(kyberRoute.output.amount), dec: decOut, name: 'KYBER', src: 'KB', feeSwapUsdt }];
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
