// ─── LIFI: Temple API + C98 Superlink[LiFi] paralel ──────────
// Kolom LIFI (badge LF) diambil dari dua sumber paralel:
// Temple: GET https://temple-api-evm.prod.templewallet.com/api/swap-route  (LiFi proxy, tanpa API key)
// C98   : POST https://superlink-server.coin98.tech/quote  backer=['LiFi'] (via CORS proxy)
// Output terbesar yang digunakan.

const _LIFI_C98_NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const _LIFI_C98_WALLET  = '0xB7B10292EE6c5828b20eB0942C8c1275E8344800';

// Sumber 1: Temple API (LiFi proxy, EVM)
// Response: estimate.toAmount → wei string
async function _fetchLifiTemple(chainId, srcToken, destToken, amountWei, decOut) {
    try {
        const wallet = CFG.wallet || '0x0000000000000000000000000000000000000000';
        const params = new URLSearchParams({
            fromChain:   chainId.toString(),
            toChain:     chainId.toString(),
            fromToken:   srcToken,
            toToken:     destToken,
            fromAmount:  amountWei.toString(),
            fromAddress: wallet,
            slippage:    '0.03',
            order:       'RECOMMENDED',
        });
        const resp = await fetch(
            `https://temple-api-evm.prod.templewallet.com/api/swap-route?${params}`
        );
        if (!resp.ok) return null;
        const data = await resp.json();
        const toAmount = data?.estimate?.toAmount;
        if (!toAmount) return null;
        const feeSwapUsdt = parseFloat(data?.estimate?.gasCosts?.[0]?.amountUSD || 0) || 0;
        return { amount: parseFloat(toAmount), dec: decOut, name: 'LIFIDEX', src: 'LF', feeSwapUsdt };
    } catch { return null; }
}

// Sumber 2: C98 Superlink dengan backer LiFi
// Response: data[0].amount → dalam token decimal units (setara wei)
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

        const body = JSON.stringify({
            isAuto: true, amount, token0, token1,
            backer: ['LiFi'],
            wallet: _LIFI_C98_WALLET,
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
        return { amount: parseFloat(toAmt), dec: decOut, name: 'LIFIDEX', src: 'LF', feeSwapUsdt: 0 };
    } catch { return null; }
}

// Helper: konversi ke human-readable untuk perbandingan
function _liHuman(r) { return r ? r.amount / Math.pow(10, r.dec || 0) : -1; }

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
