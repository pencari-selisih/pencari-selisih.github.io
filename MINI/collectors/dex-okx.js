// ─── OKX DEX via Coin98 Superlink (CTD) + Krystal filter (DTC) ──
// CTD: C98 Superlink POST — backer: OKX
// DTC: Krystal allRates API — filter platform "OKX Dex"
const _C98_NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const _C98_WALLET = '0xB7B10292EE6c5828b20eB0942C8c1275E8344800';
const _C98_NATIVE_SYMBOLS = { '1': 'ETH', '56': 'BNB', '137': 'MATIC', '42161': 'ETH', '8453': 'ETH' };
const KRYSTAL_CHAIN_ID_MAP_OX = {
    56: 'bsc', 1: 'ethereum', 137: 'polygon', 42161: 'arbitrum', 8453: 'base',
};
const KRYSTAL_PLATFORM_WALLET_OX = '0x168E4c3AC8d89B00958B6bE6400B066f0347DDc9';

async function fetchDexQuotesOkx(chainId, srcToken, destToken, amountWei, decOut, decIn = 18, symIn = '', symOut = '', dir = 'ctd') {
    if (!isDexEnabled('okx')) return [];
    if (!amountWei || String(amountWei) === '0') return [];
    const cacheKey = `dex:ox:${chainId}:${srcToken}:${destToken}:${amountWei}:${dir}`;
    return cacheWrap(cacheKey, 900, async () => {
        try {
            if (dir === 'dtc') {
                // DTC: Krystal allRates API — filter platform "OKX Dex"
                const chainName = KRYSTAL_CHAIN_ID_MAP_OX[Number(chainId)];
                if (!chainName) return [];
                const url = `https://api.krystal.app/${chainName}/v2/swap/allRates` +
                    `?src=${srcToken}&srcAmount=${amountWei}&dest=${destToken}` +
                    `&platformWallet=${KRYSTAL_PLATFORM_WALLET_OX}`;
                const resp = await fetchWithRetry(url);
                if (!resp.ok) return [];
                const data = await resp.json();
                const rates = data?.rates || [];
                // Filter: hanya ambil rate yang platform mengandung "okx"
                const match = rates.find(r =>
                    /okx/i.test(r.platform || r.exchange || r.name || '')
                );
                if (!match?.amount) return [];
                let feeSwapUsdt = 0;
                try {
                    const gasUnits = parseFloat(match.estimatedGas || match.estGasConsumed || 0);
                    if (gasUnits > 0) {
                        const gasData = dbGet('scp_gasFees', []);
                        const chainKey = Object.keys(CONFIG_CHAINS).find(k =>
                            String(CONFIG_CHAINS[k].Kode_Chain) === String(chainId)
                        );
                        const gasInfo = gasData.find(g =>
                            String(g.chain || '').toLowerCase() === (chainKey || '').toLowerCase()
                        );
                        if (gasInfo?.gwei && gasInfo?.tokenPrice) {
                            feeSwapUsdt = (gasUnits * gasInfo.gwei * gasInfo.tokenPrice) / 1e9;
                        }
                    }
                } catch (_) {}
                const dec = match.decimals ?? match.destDecimals ?? decOut;
                const name = (match.platform || 'OKX').toUpperCase();
                return [{ amount: parseFloat(match.amount), dec, name, src: 'OX', feeSwapUsdt }];
            } else {
                // CTD: C98 Superlink — backer OKX
                const userAddr = CFG.wallet || '0x0000000000000000000000000000000000000000';
                const amount = parseFloat(amountWei) / Math.pow(10, decIn);
                if (!isFinite(amount) || amount <= 0) return [];
                const isNativeSrc = srcToken.toLowerCase() === _C98_NATIVE;
                const isNativeDst = destToken.toLowerCase() === _C98_NATIVE;
                const token0 = { chainId: Number(chainId), decimals: decIn };
                if (isNativeSrc) token0.symbol = _C98_NATIVE_SYMBOLS[String(chainId)] || 'ETH';
                else token0.address = srcToken;
                const token1 = { chainId: Number(chainId), decimals: decOut };
                if (isNativeDst) token1.symbol = _C98_NATIVE_SYMBOLS[String(chainId)] || 'ETH';
                else token1.address = destToken;
                const body = JSON.stringify({
                    isAuto: true, amount, token0, token1,
                    backer: ['OKX'], wallet: userAddr,
                });
                const targetUrl = 'https://superlink-server.coin98.tech/quote';
                const resp = await proxyFetch(targetUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=utf-8' },
                    body,
                });
                if (!resp.ok) return [];
                const data = await resp.json();
                const d = data?.data?.[0];
                const toAmt = d?.amount;
                if (toAmt == null) return [];
                return [{ amount: parseFloat(toAmt), dec: decOut, name: 'OKXDEX', src: 'OX', feeSwapUsdt: 0 }];
            }
        } catch { return []; }
    });
}
