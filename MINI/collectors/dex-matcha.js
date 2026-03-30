// ─── MATCHA: Delta API (CTD) + Rainbow API (DTC) ─────────────
// CTD: 1Delta Matcha Proxy — same format as 0x API, no API key
// DTC: Rainbow Swap API — 0x source, no API key
// Docs Delta: https://api.1delta.io/swap/allowance-holder/quote
// Docs Rainbow: https://swap.p.rainbow.me/v1/quote

async function fetchDexQuotesMatcha(chainKey, srcToken, destToken, amountWei, decOut, decIn = 18, dir = 'ctd') {
    if (!isDexEnabled('matcha')) return [];
    if (!amountWei || String(amountWei) === '0') return [];
    const cacheKey = `dex:ma:${chainKey}:${srcToken}:${destToken}:${amountWei}:${dir}`;
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) return cached;

    const chainId = CONFIG_CHAINS[chainKey]?.Kode_Chain;
    if (!chainId) return [];
    const userAddr = CFG.wallet || '0x0000000000000000000000000000000000000000';

    try {
        if (dir === 'dtc') {
            // DTC: Rainbow API (0x source)
            const params = new URLSearchParams({
                allowFallback:       'true',
                buyToken:            destToken,
                chainId:             String(chainId),
                currency:            'USD',
                enableNewChainSwaps: 'true',
                fromAddress:         userAddr,
                sellToken:           srcToken,
                slippage:            '2',
                source:              '0x',
                sellAmount:          String(amountWei),
            });
            const url = `https://swap.p.rainbow.me/v1/quote?${params}`;
            const resp = await proxyFetch(url, { method: 'GET' });
            if (!resp.ok) return [];
            const data = await resp.json();
            if (!data?.buyAmount) return [];
            const amountOut = parseFloat(data.buyAmount);
            // Parse gas fee from fees.gasFee.amount (wei native) → USD
            let feeSwapUsdt = 0;
            try {
                if (data.fees?.gasFee?.amount) {
                    const gasFeeWei = parseFloat(data.fees.gasFee.amount);
                    if (gasFeeWei > 0) {
                        const gasData = dbGet('scp_gasFees', []);
                        const gasInfo = gasData.find(g => String(g.chain || '').toLowerCase() === chainKey);
                        if (gasInfo?.tokenPrice) {
                            feeSwapUsdt = (gasFeeWei / 1e18) * gasInfo.tokenPrice;
                        }
                    }
                }
            } catch (_) {}
            const res = [{ amount: amountOut, dec: decOut, name: 'MATCHA', src: 'MA', feeSwapUsdt }];
            cacheSet(cacheKey, res, 900);
            return res;
        } else {
            // CTD: Delta API (1Delta proxy for 0x)
            const params = new URLSearchParams({
                chainId:              String(chainId),
                sellToken:            srcToken,
                buyToken:             destToken,
                sellAmount:           String(amountWei),
                taker:                userAddr,
                slippageBps:          '30',
                tradeSurplusRecipient: userAddr,
                aggregator:           '0x',
            });
            const url = `https://api.1delta.io/swap/allowance-holder/quote?${params}`;
            const resp = await proxyFetch(url, { method: 'GET' });
            if (!resp.ok) return [];
            const data = await resp.json();
            if (!data?.buyAmount) return [];
            const amountOut = parseFloat(data.buyAmount);
            let feeSwapUsdt = 0;
            try {
                if (data.fees?.gasFee?.amount) {
                    const gasFeeWei = parseFloat(data.fees.gasFee.amount);
                    if (gasFeeWei > 0) {
                        const gasData = dbGet('scp_gasFees', []);
                        const gasInfo = gasData.find(g => String(g.chain || '').toLowerCase() === chainKey);
                        if (gasInfo?.tokenPrice) {
                            feeSwapUsdt = (gasFeeWei / 1e18) * gasInfo.tokenPrice;
                        }
                    }
                }
            } catch (_) {}
            const res = [{ amount: amountOut, dec: decOut, name: 'MATCHA', src: 'MA', feeSwapUsdt }];
            cacheSet(cacheKey, res, 900);
            return res;
        }
    } catch { return []; }
}
