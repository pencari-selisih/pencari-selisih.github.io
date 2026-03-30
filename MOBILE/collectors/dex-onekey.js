// ─── ONEKEY METADEX: Multi-quote SSE ─────────────────────────
// Kolom ONEKEY (badge KY) — aggregator OneKey mengumpulkan semua provider
// (OKX, 1INCH, MATCHA/0x, dsb.) kecuali SwapLiFi (meta-of-meta).
// Mengembalikan top-N quotes berurutan dari terbaik.
//
// API: GET https://swap.onekeycn.com/swap/v1/quote/events (SSE stream)
// toAmount di response sudah human-readable (bukan wei) → dec: 0

const ONEKEY_META_NETWORK_MAP = {
    56: 'evm--56', 1: 'evm--1', 137: 'evm--137',
    42161: 'evm--42161', 8453: 'evm--8453',
};
const _ONEKEY_META_NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

// Nama provider yang lebih bersih
const _ONEKEY_PROV_NAMES = {
    'swapokx':   'OKX',
    'swap1inch': '1INCH',
    'swap0x':    'MATCHA',
    'swapkyber': 'KYBER',
};

function fetchDexQuotesOnekey(chainId, srcToken, destToken, amountWei, decIn) {
    if (!isOnekeyEnabled()) return Promise.resolve([]);
    const networkId = ONEKEY_META_NETWORK_MAP[Number(chainId)];
    if (!networkId) return Promise.resolve([]);

    const cacheKey = `dex:ky:${chainId}:${srcToken}:${destToken}:${amountWei}`;
    return cacheWrap(cacheKey, 900, () => new Promise(resolve => {
        try {
            const userAddr = CFG.wallet || '0x0000000000000000000000000000000000000000';
            const _decIn   = decIn != null ? decIn : 18;
            const fromAmt  = parseFloat(amountWei) / Math.pow(10, _decIn);
            if (!isFinite(fromAmt) || fromAmt <= 0) { resolve([]); return; }

            const fromAddr = srcToken.toLowerCase() === _ONEKEY_META_NATIVE ? '' : srcToken;
            const toAddr   = destToken.toLowerCase() === _ONEKEY_META_NATIVE ? '' : destToken;

            const params = new URLSearchParams({
                fromTokenAddress:        fromAddr,
                toTokenAddress:          toAddr,
                fromTokenAmount:         fromAmt.toString(),
                fromNetworkId:           networkId,
                toNetworkId:             networkId,
                protocol:                'Swap',
                userAddress:             userAddr,
                slippagePercentage:      '1',
                autoSlippage:            'true',
                receivingAddress:        userAddr,
                kind:                    'sell',
                toTokenAmount:           '0',
                denySingleSwapProvider:  '',
            });

            const maxCount = CFG.quoteCountOnekey || 3;
            const seen     = new Set();
            const quotes   = [];
            let done       = false;

            const url    = `https://swap.onekeycn.com/swap/v1/quote/events?${params}`;
            const es     = new EventSource(url);
            const timer  = setTimeout(() => {
                if (!done) { done = true; es.close(); resolve(quotes); }
            }, CFG.sseTimeout || 8000);

            es.onmessage = ev => {
                if (done) return;
                try {
                    const msg = JSON.parse(ev.data);
                    if (!Array.isArray(msg.data)) return;
                    msg.data.forEach(item => {
                        const provKey = String(item.info?.provider || '').toLowerCase();
                        if (provKey === 'swaplifi') return;   // skip meta-of-meta
                        if (seen.has(provKey)) return;
                        seen.add(provKey);
                        const toAmtH = parseFloat(item.toAmount);
                        if (!isFinite(toAmtH) || toAmtH <= 0) return;
                        const feeSwapUsdt = parseFloat(item.fee?.estimatedFeeFiatValue || 0) || 0;
                        const name = _ONEKEY_PROV_NAMES[provKey]
                            || (item.info?.providerName || provKey)
                                .toUpperCase().replace(/^SWAP/i, '');
                        quotes.push({ amount: toAmtH, dec: 0, name, src: 'KY', feeSwapUsdt });
                    });
                    if (quotes.length >= maxCount) {
                        done = true; clearTimeout(timer); es.close(); resolve(quotes);
                    }
                } catch { /* ignore malformed event */ }
            };

            es.onerror = () => {
                if (!done) { done = true; clearTimeout(timer); es.close(); resolve(quotes); }
            };
        } catch { resolve([]); }
    }));
}
