// ─── METAX: MetaMask Bridge SSE ──────────────
function fetchDexQuotesMetax(chainId, srcToken, destToken, amountWei) {
    const cacheKey = `dex:mx:${chainId}:${srcToken}:${destToken}:${amountWei}`;
    return cacheWrap(cacheKey, 900, () => new Promise(resolve => {
        const userAddr = CFG.wallet || '0x0000000000000000000000000000000000000000';
        const slippagePercent = typeof getSlippageTolerance === 'function'
            ? String(getSlippageTolerance())
            : '0.3';  // default 0.3%
        const params = new URLSearchParams({
            walletAddress: userAddr, destWalletAddress: userAddr,
            srcChainId: chainId, destChainId: chainId,
            srcTokenAddress: srcToken, destTokenAddress: destToken,
            srcTokenAmount: amountWei,
            insufficientBal: 'true', resetApproval: 'false',
            gasIncluded: 'true', gasIncluded7702: 'false', slippage: slippagePercent
        });
        const url = `https://bridge.api.cx.metamask.io/getQuoteStream?${params}`;
        const quotes = []; let done = false;
        const es = new EventSource(url);
        const timer = setTimeout(() => { if (!done) { done = true; es.close(); resolve(quotes); } }, CFG.sseTimeout || CONFIG_DEX.metax?.timeout || 6000);
        es.addEventListener('quote', ev => {
            try {
                quotes.push(JSON.parse(ev.data));
                if (quotes.length >= CFG.quoteCountMetax) { done = true; clearTimeout(timer); es.close(); resolve(quotes); }
            } catch { }
        });
        es.onerror = () => { if (!done) { done = true; clearTimeout(timer); es.close(); resolve(quotes); } };
    }));
}

function parseDexQuoteMetax(q) {
    try {
        const dest = q.quote?.destTokenAmount || q.destTokenAmount || '0';
        const dec = q.quote?.destAsset?.decimals || 18;
        const name = (q.quote?.bridgeId || q.bridgeId || 'DEX').toString().toUpperCase();
        const feeSwapUsdt = parseFloat(
            q.quote?.gasFee?.amountInUSD ||
            q.gasFee?.amountInUSD ||
            q.quote?.totalNetworkFee?.amountInUSD ||
            q.totalNetworkFee?.amountInUSD ||
            0
        ) || 0;
        return { amount: parseFloat(dest), dec, name, src: 'MX', feeSwapUsdt };
    } catch { return null; }
}
