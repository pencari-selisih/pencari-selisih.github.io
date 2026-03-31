// ─── ONEKEY MetaDEX: SSE Multi-Quote Aggregator ──────────────
// API  : GET https://swap.onekeycn.com/swap/v1/quote/events (SSE stream)
// Chain: BSC, Ethereum, Polygon, Arbitrum, Base
// Note : toAmount di response sudah human-readable (bukan wei)
// Provider: SwapOKX(OKX), Swap1inch(1INCH), Swap0x(MATCHA) — skip SwapLifi

const ONEKEY_META_NETWORK_MAP = {
    56: 'evm--56', 1: 'evm--1', 137: 'evm--137',
    42161: 'evm--42161', 8453: 'evm--8453',
};
const ONEKEY_META_PROVIDER_MAP = {
    'swapokx':   'OKX',
    'swap1inch': '1INCH',
    'swap0x':    'MATCHA',
};
const _ONEKEY_META_NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function fetchDexQuotesOnekey(chainId, srcToken, destToken, amountWei, decOut, decIn) {
    if (!isDexEnabled('onekey')) return Promise.resolve([]);
    const networkId = ONEKEY_META_NETWORK_MAP[Number(chainId)];
    if (!networkId) return Promise.resolve([]);

    const cacheKey = `dex:ok:${chainId}:${srcToken}:${destToken}:${amountWei}`;
    return cacheWrap(cacheKey, 900, () => new Promise(resolve => {
        try {
            const userAddr = CFG.wallet || '0x0000000000000000000000000000000000000000';
            const _decIn = decIn != null ? decIn : 18;
            const fromAmt = parseFloat(amountWei) / Math.pow(10, _decIn);
            if (!isFinite(fromAmt) || fromAmt <= 0) { resolve([]); return; }

            const fromAddr = srcToken.toLowerCase() === _ONEKEY_META_NATIVE ? '' : srcToken;
            const toAddr = destToken.toLowerCase() === _ONEKEY_META_NATIVE ? '' : destToken;

            const params = new URLSearchParams({
                fromTokenAddress:      fromAddr,
                toTokenAddress:        toAddr,
                fromTokenAmount:       fromAmt.toString(),
                fromNetworkId:         networkId,
                toNetworkId:           networkId,
                protocol:              'Swap',
                userAddress:           userAddr,
                slippagePercentage:    '1',
                autoSlippage:          'true',
                receivingAddress:      userAddr,
                kind:                  'sell',
                denySingleSwapProvider: '',
            });

            const url = `https://swap.onekeycn.com/swap/v1/quote/events?${params}`;
            const quotes = [];
            let done = false;
            const maxQuotes = CFG.dex?.onekey?.count || CONFIG_DEX.onekey.count || 2;

            const es = new EventSource(url);
            const timer = setTimeout(() => {
                if (!done) { done = true; es.close(); resolve(quotes); }
            }, CFG.sseTimeout || 6000);

            es.onmessage = ev => {
                if (done) return;
                try {
                    const msg = JSON.parse(ev.data);
                    if (!msg.data || !Array.isArray(msg.data)) return;

                    for (const item of msg.data) {
                        const providerKey = String(item.info?.provider || '').toLowerCase();
                        // Skip SwapLifi (meta-of-meta)
                        if (providerKey === 'swaplifi') continue;
                        if (!item.toAmount) continue;

                        const toAmountHuman = parseFloat(item.toAmount);
                        if (!isFinite(toAmountHuman) || toAmountHuman <= 0) continue;

                        const dexName = ONEKEY_META_PROVIDER_MAP[providerKey] ||
                            String(item.info?.providerName || providerKey).toUpperCase();

                        let feeSwapUsdt = 0;
                        try {
                            const gasLimit = parseFloat(item.gasLimit || 0);
                            if (gasLimit > 0) {
                                const gasData = dbGet('scp_gasFees', []);
                                const chainKey = Object.keys(CONFIG_CHAINS).find(k =>
                                    String(CONFIG_CHAINS[k].Kode_Chain) === String(chainId)
                                );
                                const gasInfo = gasData.find(g =>
                                    String(g.chain || '').toLowerCase() === (chainKey || '').toLowerCase()
                                );
                                if (gasInfo?.gwei && gasInfo?.tokenPrice) {
                                    feeSwapUsdt = (gasLimit * gasInfo.gwei * gasInfo.tokenPrice) / 1e9;
                                }
                            }
                        } catch (_) {}

                        // dec = 0 karena OneKey toAmount sudah human-readable
                        quotes.push({ amount: toAmountHuman, dec: 0, name: dexName, src: 'OK', feeSwapUsdt });
                    }

                    // Cek apakah sudah cukup quotes
                    if (msg.totalQuoteCount && quotes.length >= msg.totalQuoteCount) {
                        done = true;
                        clearTimeout(timer);
                        es.close();
                        // Sort by amount descending, ambil top N
                        quotes.sort((a, b) => b.amount - a.amount);
                        resolve(quotes.slice(0, maxQuotes));
                    }
                } catch { /* ignore malformed event */ }
            };

            es.onerror = () => {
                if (!done) {
                    done = true;
                    clearTimeout(timer);
                    es.close();
                    quotes.sort((a, b) => b.amount - a.amount);
                    resolve(quotes.slice(0, maxQuotes));
                }
            };
        } catch { resolve([]); }
    }));
}
