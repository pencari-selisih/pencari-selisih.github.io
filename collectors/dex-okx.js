// ─── OKX DEX via Coin98 Superlink ────────────────────────────
// Docs: https://superlink-server.coin98.tech/quote
// POST JSON — tanpa API key, tanpa signing
const _C98_NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const _C98_WALLET  = '0xB7B10292EE6c5828b20eB0942C8c1275E8344800';

async function fetchDexQuotesOkx(chainId, srcToken, destToken, amountWei, decOut, decIn = 18, symIn = '', symOut = '') {
    if (!isOkxEnabled()) return [];
    const cacheKey = `dex:ox:${chainId}:${srcToken}:${destToken}:${amountWei}`;
    return cacheWrap(cacheKey, 900, async () => {
        try {
            if (!amountWei || String(amountWei) === '0') return [];
            const amount = parseFloat(amountWei) / Math.pow(10, decIn);
            if (!isFinite(amount) || amount <= 0) return [];

            const isNativeSrc = srcToken.toLowerCase() === _C98_NATIVE;
            const isNativeDst = destToken.toLowerCase() === _C98_NATIVE;

            const token0 = { chainId, symbol: symIn, decimals: decIn };
            if (!isNativeSrc) token0.address = srcToken;

            const token1 = { chainId, symbol: symOut, decimals: decOut };
            if (!isNativeDst) token1.address = destToken;

            const body = JSON.stringify({
                isAuto: true,
                amount,
                token0,
                token1,
                backer: ['OKX'],
                wallet: _C98_WALLET,
            });

            const targetUrl = 'https://superlink-server.coin98.tech/quote';
            const proxyUrl = APP_DEV_CONFIG.corsProxy + encodeURIComponent(targetUrl);
            const resp = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body,
            });
            if (!resp.ok) return [];
            const data = await resp.json();
            const d = data?.data?.[0];
            const toAmt = d?.amount;
            if (toAmt == null) return [];
            // Coin98 tidak mengembalikan biaya gas — feeSwapUsdt = 0
            // Akan di-fallback ke chainGasFallback di scan.js
            return [{ amount: parseFloat(toAmt), dec: decOut, name: 'OKXDEX', src: 'OX', feeSwapUsdt: 0 }];
        } catch { return []; }
    });
}
