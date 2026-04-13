// ─── lifidex (LIFI): Temple API ─────────────────────────────
// Menggunakan Temple API (LIFI proxy) untuk semua arah (CTD & DTC)
// sama seperti pada app folder @ADDON-DEV
// Temple Docs: https://temple-api-evm.prod.templewallet.com/api/swap-route
//
// PENTING unit amount:
//   Temple API → toAmount dalam BASE UNITS (Wei), di-handle dengan decOut oleh scan.js

async function fetchDexQuoteslifidex(chainId, srcToken, destToken, amountWei, decOut, decIn = 18, dir = 'ctd') {
    if (!isDexEnabled('lifidex')) return [];
    if (!amountWei || String(amountWei) === '0') return [];
    const cacheKey = `dex:lf:${chainId}:${srcToken}:${destToken}:${amountWei}:${dir}`;
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) return cached;

    try {
        const chainIdNum = Number(chainId);
        const userAddr = CFG.wallet || '0x0000000000000000000000000000000000000000';
        const slippagePercent = typeof getSlippageTolerance === 'function'
            ? String(getSlippageTolerance())
            : '0.3';  // default 0.3%
        const params = new URLSearchParams({
            fromChain: chainIdNum.toString(),
            toChain: chainIdNum.toString(),
            fromToken: srcToken,
            toToken: destToken,
            amount: amountWei.toString(),
            fromAddress: userAddr,
            slippage: slippagePercent,
        });
        const url = `https://temple-api-evm.prod.templewallet.com/api/swap-route?${params}`;
        const resp = await proxyFetch(url, {
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
        if (!resp.ok) return [];
        const data = await resp.json();
        if (!data?.toAmount) return [];
        
        // toAmount dari Temple API = base units (wei), JANGAN parseFloat agar tidak hilang presisi
        const amountOutWei = data.toAmount;
        if (!amountOutWei || String(amountOutWei) === '0') return [];
        
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
        
        // Kirim amount sebagai string wei (isHuman tidak di-set, ada decOut) untuk di-fromWei di scan.js
        const res = [{ amount: amountOutWei, dec: decOut, name: routeName, src: 'LF', feeSwapUsdt }];
        cacheSet(cacheKey, res, 900);
        return res;
    } catch { return []; }
}
