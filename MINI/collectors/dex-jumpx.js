// ─── JUMPX: LiFi/Jumper Brave Endpoint ─────────────
// Menggunakan Brave Wallet Li.Fi Advanced Routes endpoint
// sama seperti pada app folder @ADDON-DEV

function fetchDexQuotesJumpx(chainId, srcToken, destToken, amountWei) {
    if (!isJumpxEnabled()) return Promise.resolve([]);
    const cacheKey = `dex:jx:${chainId}:${srcToken}:${destToken}:${amountWei}`;
    return cacheWrap(cacheKey, 900, () => new Promise(async resolve => {
        try {
            const userAddr = CFG.wallet || '0x0000000000000000000000000000000000000000';
            const slippageDecimal = typeof getSlippageAsDecimal === 'function'
                ? getSlippageAsDecimal()
                : 0.003;  // default 0.3% → 0.003

            const urlParams = new URLSearchParams({
                fromToken: srcToken.toLowerCase(),
                toToken: destToken.toLowerCase(),
                fromChain: chainId.toString(),
                toChain: chainId.toString(),
                fromAddress: userAddr,
                toAddress: userAddr,
                fromAmount: amountWei.toString(),
                slippage: slippageDecimal.toString(),
                fee: '0.0069',
                integrator: 'nightly2',
                allowExchanges: 'all',
                order: 'CHEAPEST',
                maxPriceImpact: '0.15'
            });

            const body = {
                fromAddress: userAddr,
                fromAmount: amountWei.toString(),
                fromChainId: Number(chainId),
                fromTokenAddress: srcToken.toLowerCase(),
                toChainId: Number(chainId),
                toTokenAddress: destToken.toLowerCase(),
                options: {
                    integrator: "jumper.exchange",
                    order: "CHEAPEST",
                    maxPriceImpact: 0.4,
                    jitoBundle: true,
                    allowSwitchChain: true,
                    executionType: "all"
                }
            };

            const resp = await proxyFetch(`https://lifi.wallet.brave.com/v1/advanced/routes?${urlParams.toString()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!resp.ok) { resolve([]); return; }
            const data = await resp.json();
            const routes = data?.routes || [];
            
            // Urutkan berdasarkan toAmount dari tertinggi ke terendah (CHEAPEST)
            const sortedRoutes = routes.sort((a, b) => {
                const amtA = BigInt(a.toAmount || 0);
                const amtB = BigInt(b.toAmount || 0);
                if (amtA > amtB) return -1;
                if (amtA < amtB) return 1;
                return 0;
            });
            
            resolve(sortedRoutes.slice(0, CFG.quoteCountJumpx));
        } catch { resolve([]); }
    }));
}

function parseDexQuoteJumpx(route) {
    try {
        if (!route || !route.toAmount) return null;
        // JANGAN parseFloat agar wei string utuh presisinya (disesuaikan dengan scan.js)
        const amount = route.toAmount; 
        const dec = route.toToken?.decimals || 18;
        let name = 'JUMPX';
        if (route.steps && route.steps.length > 0) {
            const stepTools = route.steps.map(s => s.tool).filter(t => t);
            if (stepTools.length > 0) {
                name = `JMP-${stepTools[0].toUpperCase()}`;
            }
        }
        const feeSwapUsdt = parseFloat(route.gasCostUSD || 0) || 0;
        return { amount, dec, name, src: 'JX', feeSwapUsdt };
    } catch { return null; }
}
