// ─── lifidex (LIFI): Temple API (CTD) + C98 Superlink (DTC) ─
// CTD: Temple API (LIFI proxy) — single-quote
// DTC: C98 Superlink tanpa filter backer — ambil best quote dari semua backer
// Temple Docs: https://temple-api-evm.prod.templewallet.com/api/swap-route
// C98 Docs: https://superlink-server.coin98.tech/quote

const LIFI_C98_NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const LIFI_C98_WALLET = '0xB7B10292EE6c5828b20eB0942C8c1275E8344800';
const LIFI_C98_NATIVE_SYMBOLS = { '1': 'ETH', '56': 'BNB', '137': 'MATIC', '42161': 'ETH', '8453': 'ETH' };

async function fetchDexQuoteslifidex(chainId, srcToken, destToken, amountWei, decOut, decIn = 18, dir = 'ctd') {
    if (!isDexEnabled('lifidex')) return [];
    if (!amountWei || String(amountWei) === '0') return [];
    const cacheKey = `dex:lf:${chainId}:${srcToken}:${destToken}:${amountWei}:${dir}`;
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) return cached;

    try {
        if (dir === 'dtc') {
            // DTC: C98 Superlink tanpa filter backer — best quote dari semua provider
            const _decIn = decIn != null ? decIn : 18;
            const amount = parseFloat(amountWei) / Math.pow(10, _decIn);
            if (!isFinite(amount) || amount <= 0) return [];

            const isNativeSrc = srcToken.toLowerCase() === LIFI_C98_NATIVE;
            const isNativeDst = destToken.toLowerCase() === LIFI_C98_NATIVE;
            const token0 = { chainId: Number(chainId), decimals: _decIn };
            if (isNativeSrc) token0.symbol = LIFI_C98_NATIVE_SYMBOLS[String(chainId)] || 'ETH';
            else token0.address = srcToken;
            const token1 = { chainId: Number(chainId), decimals: decOut };
            if (isNativeDst) token1.symbol = LIFI_C98_NATIVE_SYMBOLS[String(chainId)] || 'ETH';
            else token1.address = destToken;

            const body = JSON.stringify({
                isAuto: true, amount, token0, token1,
                wallet: LIFI_C98_WALLET,
                // NO backer filter → best quote dari semua provider
            });
            const targetUrl = 'https://superlink-server.coin98.tech/quote';
            const resp = await proxyFetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body,
            });
            if (!resp.ok) return [];
            const data = await resp.json();
            if (!data?.data || !Array.isArray(data.data) || data.data.length === 0) return [];

            // Sort by amount descending, pick the best
            const sorted = data.data
                .filter(q => Number.isFinite(parseFloat(q.amount)) && parseFloat(q.amount) > 0)
                .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
            if (sorted.length === 0) return [];
            const best = sorted[0];
            const toAmt = parseFloat(best.amount);
            const backerUsed = String(best.id || best.name || 'C98').toUpperCase();
            let feeSwapUsdt = 0;
            try {
                if (best.additionalData?.gas?.amountUSD) {
                    const gasUsd = parseFloat(best.additionalData.gas.amountUSD);
                    if (Number.isFinite(gasUsd) && gasUsd > 0) feeSwapUsdt = gasUsd;
                }
            } catch (_) { }
            // dec = decOut karena C98 amount sudah human-readable
            const res = [{ amount: toAmt, dec: decOut, name: `LIFI (${backerUsed})`, src: 'LF', feeSwapUsdt }];
            cacheSet(cacheKey, res, 900);
            return res;
        } else {
            // CTD: Temple API (LIFI proxy)
            const chainIdNum = Number(chainId);
            const userAddr = CFG.wallet || '0x0000000000000000000000000000000000000000';
            const params = new URLSearchParams({
                fromChain: chainIdNum.toString(),
                toChain: chainIdNum.toString(),
                fromToken: srcToken,
                toToken: destToken,
                amount: amountWei.toString(),
                fromAddress: userAddr,
                slippage: '0.005',
            });
            const url = `https://temple-api-evm.prod.templewallet.com/api/swap-route?${params}`;
            const resp = await proxyFetch(url, {
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
            });
            if (!resp.ok) return [];
            const data = await resp.json();
            if (!data?.toAmount) return [];
            const amountOut = parseFloat(data.toAmount);
            if (!isFinite(amountOut) || amountOut <= 0) return [];
            let feeSwapUsdt = 0;
            try {
                const gasCostUsd = parseFloat(data.gasCostUSD || 0);
                if (Number.isFinite(gasCostUsd) && gasCostUsd > 0 && gasCostUsd < 100) {
                    feeSwapUsdt = gasCostUsd;
                }
            } catch (_) { }
            // Extract tool name from steps
            let routeName = 'LIFI';
            try {
                if (data.steps?.length > 0) {
                    const toolName = data.steps[0]?.toolDetails?.name || data.steps[0]?.tool || '';
                    if (toolName) routeName = String(toolName).toUpperCase();
                }
            } catch (_) { }
            // toAmount dari Temple API = base units (wei), perlu convert
            const res = [{ amount: amountOut, dec: decOut, name: routeName, src: 'LF', feeSwapUsdt }];
            cacheSet(cacheKey, res, 900);
            return res;
        }
    } catch { return []; }
}
