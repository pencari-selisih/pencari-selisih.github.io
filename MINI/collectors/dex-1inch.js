// ─── 1INCH: Enkrypt MEW API Aggregator REST ─────────────────
// Menggunakan partners.mewapi.io (Enkrypt) sebagai proxy 1inch v6.0
// Endpoint: GET /oneinch/v6.0/{chainId}/swap?...
// Response: { dstAmount, tx: { from, to, data, value, gas, gasPrice } }
//
// PENTING unit amount:
//   dstAmount = BASE UNITS (Wei) → di-parse dengan decOut oleh scan.js

async function fetchDexQuotes1inch(chainId, srcToken, destToken, amountWei, decOut) {
    if (!isDexEnabled('oneinch')) return [];
    if (!amountWei || String(amountWei) === '0') return [];
    const cacheKey = `dex:oi:${chainId}:${srcToken}:${destToken}:${amountWei}`;
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) return cached;

    try {
        const userAddr = CFG.wallet || '0x7809151cfef645a14a52f5903de04cb9d2a0d14b';

        // ✅ Get dynamic slippage
        const slippagePercent = typeof getSlippageTolerance === 'function'
            ? String(getSlippageTolerance())
            : '0.3';

        // Normalize native token addresses
        const nativeAddresses = ['0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', '0x0000000000000000000000000000000000000000'];
        const src = nativeAddresses.includes(srcToken.toLowerCase())
            ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : srcToken.toLowerCase();
        const dst = nativeAddresses.includes(destToken.toLowerCase())
            ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : destToken.toLowerCase();

        const params = new URLSearchParams({
            src,
            dst,
            amount: amountWei.toString(),
            from: userAddr,
            receiver: userAddr,
            slippage: slippagePercent,
            fee: '0.875',
            referrer: '0x365d358dc96ae70c35a1e338a9a7645313d1231b',
            disableEstimate: 'true'
        });

        const targetUrl = `https://partners.mewapi.io/oneinch/v6.0/${chainId}/swap?${params.toString()}`;
        const url = `https://still-limit-bddf.gemul-putra.workers.dev/${targetUrl}`;
        const data = await $.getJSON(url);
        if (!data?.dstAmount) return [];

        // dstAmount = base units (wei) → kirim apa adanya, decOut akan di-handle scan.js
        const amountOutWei = data.dstAmount;
        if (!amountOutWei || String(amountOutWei) === '0') return [];

        // Gas fee estimation
        let feeSwapUsdt = 0;
        try {
            const gasPrice = parseFloat(data.tx?.gasPrice || 0);
            const gasUnits = parseFloat(data.tx?.gas || 0);
            if (gasPrice > 0 && gasUnits > 0) {
                // gasPrice in wei, gas in units → total gas cost in native token
                // Will be overridden by chainGasFallback in scan.js if needed
                feeSwapUsdt = 0; // let scan.js use chainGasFallback for accuracy
            }
        } catch (_) { }

        const res = [{ amount: amountOutWei, dec: decOut, name: '1INCH', src: 'OI', feeSwapUsdt }];
        cacheSet(cacheKey, res, 900);
        return res;
    } catch { return []; }
}
