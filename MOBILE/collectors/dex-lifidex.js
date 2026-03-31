// ─── LIFI: Temple API + C98 Superlink[LiFi] paralel ──────────
// Kolom LIFI (badge LF) diambil dari dua sumber paralel:
// Temple: GET https://temple-api-evm.prod.templewallet.com/api/swap-route  (LiFi proxy, tanpa API key)
// C98   : POST https://superlink-server.coin98.tech/quote  backer=['LiFi'] (via CORS proxy)
// Output terbesar yang digunakan.

const _LIFI_C98_NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

// Sumber 1: Temple API (LiFi proxy, EVM)
// Response: toAmount → wei string (root level), gasCostUSD → USD string (root level)
async function _fetchLifiTemple(chainId, srcToken, destToken, amountWei, decOut) {
    try {
        const wallet = CFG.wallet || '0x0000000000000000000000000000000000000000';
        const params = new URLSearchParams({
            fromChain:   chainId.toString(),
            toChain:     chainId.toString(),
            fromToken:   srcToken,
            toToken:     destToken,
            amount:      amountWei.toString(),
            fromAddress: wallet,
            slippage:    '0.005',
        });
        const targetUrl = `https://temple-api-evm.prod.templewallet.com/api/swap-route?${params}`;
        const proxyUrl  = APP_DEV_CONFIG.corsProxy + encodeURIComponent(targetUrl);
        const resp = await fetch(proxyUrl);
        if (!resp.ok) return null;
        const data = await resp.json();
        const toAmount = data?.toAmount;
        if (!toAmount) return null;
        const feeSwapUsdt = parseFloat(data?.gasCostUSD || 0) || 0;
        return { amount: parseFloat(toAmount), dec: decOut, name: 'LIFIDEX', src: 'LF', feeSwapUsdt };
    } catch { return null; }
}

// Sumber 2: C98 Superlink dengan backer LiFi
// Response: data[0].amount → human-readable (bukan wei) → dec: 0
async function _fetchLifiC98(chainId, srcToken, destToken, amountWei, decOut, decIn) {
    try {
        const _decIn = decIn != null ? decIn : 18;
        const amount = parseFloat(amountWei) / Math.pow(10, _decIn);
        if (!isFinite(amount) || amount <= 0) return null;

        const isNativeSrc = srcToken.toLowerCase() === _LIFI_C98_NATIVE;
        const isNativeDst = destToken.toLowerCase() === _LIFI_C98_NATIVE;
        const token0 = { chainId, decimals: _decIn };
        if (!isNativeSrc) token0.address = srcToken;
        const token1 = { chainId, decimals: decOut };
        if (!isNativeDst) token1.address = destToken;

        const wallet = CFG.wallet || '0x0000000000000000000000000000000000000000';
        const body = JSON.stringify({
            isAuto: true, amount, token0, token1,
            backer: ['LiFi'],
            wallet,
        });
        const targetUrl = 'https://superlink-server.coin98.tech/quote';
        const proxyUrl  = APP_DEV_CONFIG.corsProxy + encodeURIComponent(targetUrl);
        const resp = await fetch(proxyUrl, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body,
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        const toAmt = data?.data?.[0]?.amount;
        if (toAmt == null) return null;
        return { amount: parseFloat(toAmt), dec: 0, name: 'LIFIDEX', src: 'LF', feeSwapUsdt: 0 };
    } catch { return null; }
}

// Helper: konversi ke human-readable untuk perbandingan
function _liHuman(r) { return r ? r.amount / Math.pow(10, r.dec ?? 0) : -1; }

function fetchDexQuotesOnekeyLifi(chainId, srcToken, destToken, amountWei, decOut, decIn) {
    if (!isOnekeyLifiEnabled()) return Promise.resolve([]);
    if (!amountWei || String(amountWei) === '0') return Promise.resolve([]);
    const cacheKey = `dex:lf:${chainId}:${srcToken}:${destToken}:${amountWei}`;
    return cacheWrap(cacheKey, 900, async () => {
        try {
            const [temple, c98] = await Promise.all([
                _fetchLifiTemple(chainId, srcToken, destToken, amountWei, decOut),
                _fetchLifiC98(chainId, srcToken, destToken, amountWei, decOut, decIn),
            ]);
            const best = _liHuman(temple) >= _liHuman(c98) ? temple : c98;
            return best ? [best] : [];
        } catch { return []; }
    });
}
