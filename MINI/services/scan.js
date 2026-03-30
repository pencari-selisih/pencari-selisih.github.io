// ─── PnL Calculator ──────────────────────────
// feeWdUsdt  : biaya withdrawal dari CEX dalam USDT
// feeSwapUsdt: biaya swap DEX dalam USDT — diambil dari respons DEX (gasCostUSD / gasUsd)
// isPairStable: true jika PAIR adalah stablecoin → tidak perlu trade ke-2 di CEX
// direction  : 'ctd' = CEX→DEX, 'dtc' = DEX→CEX
// Fee rules:
//   CTD: feetrade + feewd + feeswap
//   DTC: feeswap + feetrade (tanpa feewd)
function calcPnl(modal, pairAmt, bidPair, cexKey, feeWdUsdt = 0, isPairStable = false, direction = 'ctd', feeSwapUsdt = 0) {
    const fee = APP_DEV_CONFIG.fees[cexKey] || 0.001;
    const pairValue = pairAmt * bidPair;
    let cexFee1, cexFee2, wdFee;
    if (direction === 'ctd') {
        // CTD: BELI TOKEN di CEX (fee1) → WD token → swap DEX → (JUAL PAIR di CEX jika pair bukan stable, fee2)
        cexFee1 = modal * fee;
        cexFee2 = isPairStable ? 0 : pairValue * fee;
        wdFee = feeWdUsdt || 0;
    } else {
        // DTC: swap DEX → JUAL TOKEN di CEX (fee2), tidak perlu WD dari CEX
        cexFee1 = isPairStable ? 0 : modal * fee;
        cexFee2 = pairValue * fee;
        wdFee = 0;
    }
    const feeSwap = feeSwapUsdt || 0;
    const pnlKotor = pairValue - modal;
    return {
        pnl: pnlKotor - cexFee1 - cexFee2 - wdFee - feeSwap,
        pnlKotor,
        pairValue, cexFee1, cexFee2, wdFee, feeSwap,
        totalFee: cexFee1 + cexFee2 + wdFee + feeSwap
    };
}

// ─── Scan Engine ──────────────────────────────
// feeSwapUsdt diambil dari parsed.feeSwapUsdt (field dari masing-masing DEX collector)
// MetaX : q.quote.gasFee.amountInUSD
// JumpX : route.gasCostUSD
// Kyber : routeSummary.gasUsd
// OKX   : estimateGasFee wei * nativePrice
// Jika DEX tidak return (= 0): gunakan chainGasFallback dari eth_gasPrice × gasUnits × nativePrice
// Jika chainGasFallback juga 0: feeSwap = 0 (tidak ada estimasi)
function computeQuotePnl(parsed, destDec, bidPrice, modal, cexKey, askPrice, direction, feeWdUsdt = 0, isPairStable = false, chainGasFallback = 0) {
    const recv = fromWei(parsed.amount + '', parsed.dec || destDec);
    const recvUSDT = recv * bidPrice;
    const feeSwapUsdt = parsed.feeSwapUsdt > 0 ? parsed.feeSwapUsdt : chainGasFallback;
    if (direction === 'ctd') {
        const tokensIn = askPrice > 0 ? modal / askPrice : 0;
        const effPrice = tokensIn > 0 ? recvUSDT / tokensIn : 0;
        const { pnl, pnlKotor, cexFee1, cexFee2, wdFee, feeSwap, totalFee } = calcPnl(modal, recv, bidPrice, cexKey, feeWdUsdt, isPairStable, 'ctd', feeSwapUsdt);
        return { name: parsed.name, src: parsed.src, recvUSDT, effPrice, pnl, pnlKotor, cexFee1, cexFee2, wdFee, feeSwap, totalFee };
    } else {
        const effPrice = recv > 0 ? modal / recv : 0;
        const { pnl, pnlKotor, cexFee1, cexFee2, wdFee, feeSwap, totalFee } = calcPnl(modal, recv, bidPrice, cexKey, feeWdUsdt, isPairStable, 'dtc', feeSwapUsdt);
        return { name: parsed.name, src: parsed.src, recvUSDT, effPrice, pnl, pnlKotor, cexFee1, cexFee2, wdFee, feeSwap, totalFee };
    }
}

// ─── Auto Level Calculation ──────────────────
// Hitung weighted avg price & actual modal dari orderbook depth
function calculateAutoVolume(orderbook, maxModal, levels, side) {
    try {
        const book = (orderbook[side] || []).slice(0, Math.min(levels, 4));
        if (!book.length) return null;
        let totalUSDT = 0, totalCoins = 0, lastPrice = 0, levelsUsed = 0;
        for (let i = 0; i < book.length; i++) {
            const price = parseFloat(book[i][0]), amount = parseFloat(book[i][1]);
            if (!price || !amount) continue;
            const volUSDT = price * amount;
            lastPrice = price;
            levelsUsed = i + 1;
            if (totalUSDT + volUSDT >= maxModal) {
                const remaining = maxModal - totalUSDT;
                totalCoins += remaining / price;
                totalUSDT = maxModal;
                break;
            }
            totalUSDT += volUSDT;
            totalCoins += amount;
        }
        if (totalCoins <= 0 || totalUSDT <= 0) return null;
        return { actualModal: totalUSDT, avgPrice: totalUSDT / totalCoins, lastLevelPrice: lastPrice, levelsUsed };
    } catch { return null; }
}

// ─── WD/DP Icons di Header Card ───────────────
// Update icon ✅⛔ di sebelah nama token & pair di header card
function _updateWdBadge(card, tok, stToken, stPair, cardEls, walletFetched) {
    const tokEl = cardEls?.wdTokEl || document.getElementById('wdic-tok-' + tok.id);
    const pairEl = cardEls?.wdPairEl || document.getElementById('wdic-pair-' + tok.id);
    const pairSym = (tok.tickerPair || 'USDT').toUpperCase();
    if (tokEl) tokEl.innerHTML = _wdpIcons(stToken, walletFetched, tok.cex, tok.ticker);
    if (pairEl) pairEl.innerHTML = _wdpIcons(stPair, walletFetched, tok.cex, pairSym);
}

// Refresh semua WD/DP icon di card yang sudah dirender (dipanggil setelah wallet data diupdate)
function refreshAllWdIcons() {
    if (typeof getCexTokenStatus !== 'function' || typeof isCexWalletFetched !== 'function') return;
    const tokens = typeof getTokens === 'function' ? getTokens() : [];
    _cardEls.forEach((els, tokId) => {
        const tok = tokens.find(t => t.id === tokId);
        if (!tok) return;
        const pairSym = (tok.tickerPair || 'USDT').toUpperCase();
        const stToken = getCexTokenStatus(tok.cex, tok.ticker, tok.chain, 1);
        const stPair = getCexTokenStatus(tok.cex, pairSym, tok.chain, 1);
        const wf = tok.cex !== 'indodax' && isCexWalletFetched(tok.cex);
        if (els.wdTokEl) els.wdTokEl.innerHTML = _wdpIcons(stToken, wf, tok.cex, tok.ticker);
        if (els.wdPairEl) els.wdPairEl.innerHTML = _wdpIcons(stPair, wf, tok.cex, pairSym);
    });
}


async function scanToken(tok) {
    const chainCfg = CONFIG_CHAINS[tok.chain];
    if (!chainCfg) return;
    const els = _cardEls.get(tok.id);
    const card = els?.card || document.getElementById('card-' + tok.id);
    if (!card) return;
    const n = totalQuoteCount();

    // 1. Fetch CEX orderbook for TOKEN
    let obToken;
    if (!tok.symbolToken) {
        obToken = { askPrice: 1.0, bidPrice: 1.0, bids: [], asks: [] };
    } else {
        obToken = await fetchOrderbook(tok.cex, tok.symbolToken);
        if (!obToken || obToken.error) { setCardStatus(card, 'ERROR: KONEKSI EXCHANGER'); return; }
    }
    // Cache orderbook for tooltip
    _obCache[tok.id] = { bids: obToken.bids || [], asks: obToken.asks || [], bidPrice: obToken.bidPrice, askPrice: obToken.askPrice };

    // 2. Fetch CEX orderbook for PAIR (if triangular)
    let bidPair = 1, askPair = 1;
    const isTriangular = tok.tickerPair && tok.tickerPair !== tok.ticker && tok.symbolPair
        && tok.tickerPair.toUpperCase() !== 'USDT';
    if (isTriangular) {
        const obPair = await fetchOrderbook(tok.cex, tok.symbolPair);
        if (obPair && !obPair.error) { askPair = obPair.askPrice; bidPair = obPair.bidPrice; }
    }

    let pairSc = tok.scPair || '';
    let pairDec = tok.decPair || 18;
    if (tok.tickerPair && tok.tickerPair.toUpperCase() === 'USDT') {
        pairSc = CONFIG_CHAINS[tok.chain]?.USDT_SC || pairSc;
        pairDec = CONFIG_CHAINS[tok.chain]?.USDT_DEC ?? pairDec;
    }
    if (!pairSc || !tok.scToken) { setCardStatus(card, 'SC kosong'); return; }

    // 2b. Ambil fee WD & status WD/DP dari cache CEX wallet
    // CTD: user beli token di CEX → WD token ke wallet → swap ke pair di DEX
    // DTC: user swap pair → token di DEX → deposit token ke CEX → jual, lalu WD pair
    const pairSymbol = (tok.tickerPair || 'USDT').toUpperCase();
    const isPairStable = STABLE_COINS.has(pairSymbol);
    const feeWdCtD = (typeof getCexFeeWdUsdt === 'function')
        ? getCexFeeWdUsdt(tok.cex, tok.ticker, tok.chain, obToken.askPrice) : 0;
    // DTC + pair stablecoin: tidak perlu WD stablecoin dari CEX (diasumsikan sudah ada di DEX wallet)
    const feeWdDtC = isPairStable ? 0 : (typeof getCexFeeWdUsdt === 'function')
        ? getCexFeeWdUsdt(tok.cex, pairSymbol, tok.chain, bidPair || 1) : 0;

    // Status WD/DP: tampilkan badge di card
    const stToken = (typeof getCexTokenStatus === 'function')
        ? getCexTokenStatus(tok.cex, tok.ticker, tok.chain, obToken.askPrice) : null;
    const stPair = (typeof getCexTokenStatus === 'function')
        ? getCexTokenStatus(tok.cex, pairSymbol, tok.chain, bidPair || 1) : null;
    // Indodax: API tidak punya status WD/DP asli → walletFetched = false agar tidak diblock dan tampil ??
    const walletFetched = tok.cex !== 'indodax' && typeof isCexWalletFetched === 'function' && isCexWalletFetched(tok.cex);
    _updateWdBadge(card, tok, stToken, stPair, els, walletFetched);

    // Block flag:
    // - Jika stToken ada: block sesuai flag withdrawEnable / depositEnable
    // - Jika stToken null & wallet sudah di-fetch: token tidak disuport di chain ini → block keduanya
    // - Jika stToken null & wallet belum di-fetch: data belum ada → tidak diblock
    const blockCtD = stToken !== null ? stToken.withdrawEnable === false : walletFetched;
    const blockDtC = stToken !== null ? stToken.depositEnable === false : walletFetched;

    // Tampilkan notice DITUTUP di header tabel jika blocked
    if (blockCtD) {
        const ctdStatus = els?.ctdStatus;
        if (ctdStatus) { ctdStatus.textContent = ' ⛔ WD DITUTUP'; ctdStatus.className = 'tbl-status tbl-status-err'; }
    }
    if (blockDtC) {
        const dtcStatus = els?.dtcStatus;
        if (dtcStatus) { dtcStatus.textContent = ' ⛔ DP DITUTUP'; dtcStatus.className = 'tbl-status tbl-status-err'; }
    }

    // 3. Reference modal untuk display & diagnostics (tok fallback atau DEX pertama aktif)
    const _refModalCtD = tok.modalCtD || Object.values(CFG.dex || {}).find(d => d.active)?.modalCtD || 100;
    const _refModalDtC = tok.modalDtC || Object.values(CFG.dex || {}).find(d => d.active)?.modalDtC || 80;

    // Reference auto level (untuk harga display di kolom CEX dan cache tooltip)
    const alCtD_ref = CFG.autoLevel && obToken.asks?.length
        ? calculateAutoVolume(obToken, _refModalCtD, CFG.levelCount, 'asks') : null;
    const alDtC_ref = CFG.autoLevel && obToken.bids?.length
        ? calculateAutoVolume(obToken, _refModalDtC, CFG.levelCount, 'bids') : null;
    const askCtD = alCtD_ref ? alCtD_ref.avgPrice : obToken.askPrice;
    const bidDtC = alDtC_ref ? alDtC_ref.avgPrice : obToken.bidPrice;
    const dispAskCtD = alCtD_ref ? alCtD_ref.lastLevelPrice : obToken.askPrice;
    const dispBidDtC = alDtC_ref ? alDtC_ref.lastLevelPrice : obToken.bidPrice;

    // Per-DEX auto level: per-DEX token modal → default token modal → DEX global → ref
    function _dexEffCtD(dexKey) {
        const modal = tok.dexModals?.[dexKey]?.ctd || tok.modalCtD || CFG.dex?.[dexKey]?.modalCtD || _refModalCtD;
        if (CFG.autoLevel && obToken.asks?.length) {
            const al = calculateAutoVolume(obToken, modal, CFG.levelCount, 'asks');
            return {
                modal: al ? al.actualModal : modal, price: al ? al.avgPrice : obToken.askPrice,
                full: !al || al.actualModal >= modal * 0.99
            };
        }
        return { modal, price: obToken.askPrice, full: true };
    }
    function _dexEffDtC(dexKey) {
        const modal = tok.dexModals?.[dexKey]?.dtc || tok.modalDtC || CFG.dex?.[dexKey]?.modalDtC || _refModalDtC;
        if (CFG.autoLevel && obToken.bids?.length) {
            const al = calculateAutoVolume(obToken, modal, CFG.levelCount, 'bids');
            return {
                modal: al ? al.actualModal : modal, price: al ? al.avgPrice : obToken.bidPrice,
                full: !al || al.actualModal >= modal * 0.99
            };
        }
        return { modal, price: obToken.bidPrice, full: true };
    }

    const dxCtD = {}; const dxDtC = {};
    Object.keys(CONFIG_DEX).forEach(k => { dxCtD[k] = _dexEffCtD(k); dxDtC[k] = _dexEffDtC(k); });

    // Simpan dispAsk/dispBid + fee WD ke cache agar tooltip bisa mengaksesnya
    _obCache[tok.id].dispAsk = dispAskCtD;
    _obCache[tok.id].dispBid = dispBidDtC;
    _obCache[tok.id].feeWdCtD = feeWdCtD;
    _obCache[tok.id].feeWdDtC = feeWdDtC;
    _obCache[tok.id].pairSym = pairSymbol;
    _obCache[tok.id].isPairStable = isPairStable;

    // 4. Fetch DEX quotes — per-DEX wei sesuai modal masing-masing
    const _wCtD = (eff) => toWei(eff.price > 0 ? eff.modal / eff.price : 0, tok.decToken);
    const _wDtC = (eff) => toWei(isTriangular ? (askPair > 0 ? eff.modal / askPair : 0) : eff.modal, pairDec);

    // Kolom kiri hanya menampilkan link stok — tidak perlu update modal/badge di sini
    // Helper format fee cell: hanya tampilkan total fee
    function _fmtFeeCell(wdFee, tradeFee, swapFee = 0) {
        const total = wdFee + tradeFee + swapFee;
        return `-${total.toFixed(2)}$`;
    }

    const _refWeiCtD = toWei(askCtD > 0 ? _refModalCtD / askCtD : 0, tok.decToken);
    const _refWeiDtC = toWei(isTriangular ? (askPair > 0 ? _refModalDtC / askPair : 0) : _refModalDtC, pairDec);
    const diagCtD = diagnoseWei(_refWeiCtD);
    const diagDtC = diagnoseWei(_refWeiDtC);
    const chainId = chainCfg.Kode_Chain;
    // ── Dynamic DEX fetch registry ──
    // Maps CONFIG_DEX key → { ctd: Promise, dtc: Promise } fetch functions
    const _dexFetchMap = {
        metax: {
            ctd: () => fetchDexQuotesMetax(chainId, tok.scToken, pairSc, _wCtD(dxCtD.metax)),
            dtc: () => fetchDexQuotesMetax(chainId, pairSc, tok.scToken, _wDtC(dxDtC.metax))
        },
        jumpx: {
            ctd: () => fetchDexQuotesJumpx(chainId, tok.scToken, pairSc, _wCtD(dxCtD.jumpx)),
            dtc: () => fetchDexQuotesJumpx(chainId, pairSc, tok.scToken, _wDtC(dxDtC.jumpx))
        },
        kyber: {
            ctd: () => fetchDexQuotesKyber(tok.chain, tok.scToken, pairSc, _wCtD(dxCtD.kyber), pairDec, tok.decToken, 'ctd'),
            dtc: () => fetchDexQuotesKyber(tok.chain, pairSc, tok.scToken, _wDtC(dxDtC.kyber), tok.decToken, pairDec, 'dtc')
        },
        okx: {
            ctd: () => fetchDexQuotesOkx(chainId, tok.scToken, pairSc, _wCtD(dxCtD.okx), pairDec, tok.decToken, tok.ticker, pairSymbol, 'ctd'),
            dtc: () => fetchDexQuotesOkx(chainId, pairSc, tok.scToken, _wDtC(dxDtC.okx), tok.decToken, pairDec, pairSymbol, tok.ticker, 'dtc')
        },
        lifidex: {
            ctd: () => fetchDexQuoteslifidex(chainId, tok.scToken, pairSc, _wCtD(dxCtD.lifidex), pairDec, tok.decToken, 'ctd'),
            dtc: () => fetchDexQuoteslifidex(chainId, pairSc, tok.scToken, _wDtC(dxDtC.lifidex), tok.decToken, pairDec, 'dtc')
        },
        matcha: {
            ctd: () => fetchDexQuotesMatcha(tok.chain, tok.scToken, pairSc, _wCtD(dxCtD.matcha), pairDec, tok.decToken, 'ctd'),
            dtc: () => fetchDexQuotesMatcha(tok.chain, pairSc, tok.scToken, _wDtC(dxDtC.matcha), tok.decToken, pairDec, 'dtc')
        },
        onekey: {
            ctd: () => fetchDexQuotesOnekey(chainId, tok.scToken, pairSc, _wCtD(dxCtD.onekey), pairDec, tok.decToken),
            dtc: () => fetchDexQuotesOnekey(chainId, pairSc, tok.scToken, _wDtC(dxDtC.onekey), tok.decToken, pairDec)
        },
    };


    // ── Streaming DEX render ─────────────────────────────────────────────────
    // Setiap DEX dipanggil paralel. Begitu satu DEX resolve → kolom UI langsung
    // diisi (re-sort + re-render) tanpa menunggu DEX lain selesai.
    // SSE (metax, onekey)  : resolve ketika N quote terkumpul atau sseTimeout
    // REST (kyber, okx, dll): resolve dalam < 2 detik → kolom terisi lebih cepat
    const _SSE_KEYS        = new Set(['metax', 'onekey']);
    const _enabledKeys     = Object.keys(CONFIG_DEX).filter(k => isDexEnabled(k));
    const tokMinPnl        = (isFinite(tok.minPnl) && tok.minPnl !== null) ? tok.minPnl : 1;
    const chainGasFee      = _chainGasEstimateUsdt[chainId] || 0;

    // Normalisasi nama DEX dan filter offlist
    const _normDexName = nm => {
        const u = (nm || '').toUpperCase().trim();
        if (/^0X(\s|$|-|_|PROTOCOL|EXCHANGE)/i.test(u) || u === '0X') return 'MATCHA';
        if (u === 'OKX' || u.startsWith('OKX ') || u === 'OKXDEX') return 'OKXDEX';
        if (u.includes('KYBERSWAP')) return 'KYBER';
        if (u.startsWith('SUSHI')) return 'SUSHI';
        return u;
    };
    const _offList = (APP_DEV_CONFIG.offDexResultScan || []).map(s => s.toUpperCase());
    const _isOff = name => { const u = (name || '').toUpperCase(); return _offList.some(o => u.includes(o)); };
    const _dexParsers = {
        metax:  q => { const p = typeof parseDexQuoteMetax === 'function' ? parseDexQuoteMetax(q) : null; if (!p) return null; p.name = _normDexName(p.name); return _isOff(p.name) ? null : p; },
        jumpx:  q => { const p = typeof parseDexQuoteJumpx === 'function' ? parseDexQuoteJumpx(q) : null; if (!p) return null; p.name = _normDexName(p.name); return _isOff(p.name) ? null : p; },
        kyber:  q => { if (!q) return null; q.name = _normDexName(q.name); return _isOff(q.name) ? null : q; },
        okx:    q => { if (!q) return null; q.name = _normDexName(q.name); return _isOff(q.name) ? null : q; },
        lifidex:q => { if (!q) return null; q.name = _normDexName(q.name); return _isOff(q.name) ? null : q; },
        matcha: q => { if (!q) return null; q.name = _normDexName(q.name); return _isOff(q.name) ? null : q; },
        onekey: q => { if (!q) return null; q.name = _normDexName(q.name); return _isOff(q.name) ? null : q; },
    };

    // Running state — diupdate tiap DEX resolve
    const _runCtD = []; const _runDtC = [];
    const _dexRaw = {}; _enabledKeys.forEach(k => { _dexRaw[k] = { ctd: [], dtc: [] }; });

    // Helpers UI
    const _tradeUrl   = typeof _getCexTradeUrl === 'function' ? _getCexTradeUrl(tok.cex, tok.ticker, pairSymbol) : '';
    const _cexPHtml   = (txt, url) => url ? `<a href="${url}" target="_blank" rel="noopener" class="cex-price-link">${txt}</a>` : txt;
    const _dexPHtml   = (txt, dexName, dir) => { const url = typeof _getDexUrl === 'function' ? _getDexUrl(dexName, tok, dir) : ''; return url ? `<a href="${url}" target="_blank" rel="noopener" class="dex-price-link">${txt}</a>` : txt; };

    // buildMissingLabels: isi slot kosong dengan nama DEX + status error
    function _buildMissing(allData, rawData) {
        const labels = [];
        _enabledKeys.forEach(k => {
            const cfg = CONFIG_DEX[k];
            const existing = allData.filter(r => r.src === cfg.src).length;
            const expected = cfg.hasCount ? (CFG.dex?.[k]?.count || cfg.count) : 1;
            const raw = rawData[k] || [];
            for (let i = existing; i < expected; i++) {
                labels.push({ name: cfg.label, error: raw.length === 0 ? 'NO QUOTE' : 'NO ROUTE' });
            }
        });
        return labels;
    }

    // _renderCols: re-render seluruh kolom CTD+DTC berdasarkan state terkini
    // Dipanggil setiap kali ada DEX baru yang resolve
    function _renderCols() {
        _runCtD.sort((a, b) => b.pnl - a.pnl);
        _runDtC.sort((a, b) => b.pnl - a.pnl);
        const ctdData = _runCtD.slice(0, n);
        const dtcData = _runDtC.slice(0, n);
        const missingCtD = blockCtD ? [] : _buildMissing(_runCtD, _dexRaw);
        const missingDtC = _buildMissing(_runDtC, _dexRaw);

        // ── Fill CEX harga di semua kolom (sekali, tidak berubah) ──
        const ctdSt = els?.ctdStatus; if (!blockCtD && ctdSt) ctdSt.textContent = '';
        const dtcSt = els?.dtcStatus; if (!blockDtC && dtcSt) dtcSt.textContent = '';
        for (let i = 0; i < n; i++) {
            const cc = els?.ctdCex[i]; if (cc) { if (blockCtD) { cc.textContent = '—'; cc.className = 'mon-dex-cell mc-ask'; } else { cc.innerHTML = _cexPHtml(`↑ ${fmtCompact(dispAskCtD)}$`, _tradeUrl); cc.className = 'mon-dex-cell mc-ask'; } }
            const dc = els?.dtcCex[i]; if (dc) { if (blockDtC) { dc.textContent = '—'; dc.className = 'mon-dex-cell mc-bid'; } else { dc.innerHTML = _cexPHtml(`↓ ${fmtCompact(dispBidDtC)}$`, _tradeUrl); dc.className = 'mon-dex-cell mc-bid'; } }
        }

        // ── CTD table ──────────────────────────────────────────────
        if (blockCtD) {
            const h0 = els?.ctdHdr[0]; if (h0) { h0.textContent = `⛔ WD ${tok.ticker}`; h0.className = 'mon-dex-hdr mon-dex-hdr-err'; }
            for (let i = 1; i < n; i++) { const h = els?.ctdHdr[i]; if (h) { h.textContent = '—'; h.className = 'mon-dex-hdr'; } }
            const d0 = els?.ctdDex[0]; if (d0) { d0.textContent = 'WITHDRAW DITUTUP'; d0.className = 'mon-dex-cell mc-err'; }
            for (let i = 1; i < n; i++) { const d = els?.ctdDex[i]; if (d) { d.textContent = '—'; d.className = 'mon-dex-cell mc-muted'; } }
            for (let i = 0; i < n; i++) { const f = els?.ctdFee[i]; if (f) { f.textContent = '—'; f.className = 'mon-dex-cell mc-muted'; } const p = els?.ctdPnl[i]; if (p) { p.textContent = '—'; p.className = 'mon-dex-cell mc-muted'; } }
        } else if (!ctdData.length) {
            const reason = diagCtD || 'TIDAK ADA LP / DEX';
            const h0 = els?.ctdHdr[0]; if (h0) { h0.textContent = reason; h0.className = 'mon-dex-hdr mon-dex-hdr-err'; }
            for (let i = 1; i < n; i++) { const h = els?.ctdHdr[i]; if (h) { h.textContent = '—'; h.className = 'mon-dex-hdr'; } }
            const hint = diagCtD === 'MODAL BESAR' ? '↓ Kecilkan Modal' : diagCtD === 'AMOUNT NOL' ? '↓ Cek Harga CEX' : '↓ KOIN TIDAK ADA DI DEX / LP';
            const d0 = els?.ctdDex[0]; if (d0) { d0.textContent = hint; d0.className = 'mon-dex-cell mc-err'; }
            for (let i = 1; i < n; i++) { const d = els?.ctdDex[i]; if (d) { d.textContent = '—'; d.className = 'mon-dex-cell mc-muted'; } }
        } else {
            ctdData.forEach((r, i) => {
                r.hdrIdx = i;
                const hdrEl = els?.ctdHdr[i] || card.querySelector(`.mon-dex-hdr[data-dir="ctd"][data-ctd-hdr="${i}"]`);
                const cexEl = els?.ctdCex[i]; const dexEl = els?.ctdDex[i]; const feeEl = els?.ctdFee[i]; const pnlEl = els?.ctdPnl[i];
                const isSignal = r.pnl >= (r.dexMinPnl ?? tokMinPnl); const sigCls = isSignal ? ' col-signal' : '';
                const _sc = Object.values(CONFIG_DEX).find(c => c.src === r.src);
                const nm = _sc && !_sc.hasCount ? _sc.label : (r.name || '').slice(0, 6).toUpperCase();
                const tag = _sc && _sc.hasCount ? `<span class="src-tag" style="background:${_sc.color};color:#fff;font-size:6px">${_sc.badge}</span>` : '';
                const ms = r.dexModalCtD; const insuf = r.modalFull === false && r.modalActual && ms && r.modalActual < ms;
                const mlbl = insuf ? `<span class="hdr-modal-set">$${ms}</span> | <span class="hdr-modal-act">$${r.modalActual}✅</span>` : (ms ? `<span class="hdr-modal-ok">$${ms}✅</span>` : '');
                if (hdrEl) { hdrEl.innerHTML = nm + (tag ? ' ' + tag : '') + (mlbl ? `<span class="hdr-dex-modal">${mlbl}</span>` : ''); hdrEl.className = 'mon-dex-hdr'; hdrEl.dataset.effprice = r.effPrice; hdrEl.dataset.cexFee1 = r.cexFee1.toFixed(4); hdrEl.dataset.cexFee2 = r.cexFee2.toFixed(4); hdrEl.dataset.feeWd = r.wdFee.toFixed(4); hdrEl.dataset.feeSwap = (r.feeSwap || 0).toFixed(6); hdrEl.dataset.totalFee = r.totalFee.toFixed(6); hdrEl.dataset.pnlKotor = (r.pnlKotor || 0).toFixed(4); hdrEl.dataset.pnlBersih = r.pnl.toFixed(4); hdrEl.dataset.modalSet = ms || ''; hdrEl.dataset.modalActual = r.modalActual != null ? r.modalActual : ''; hdrEl.dataset.minPnl = (r.dexMinPnl ?? tokMinPnl).toFixed(2); hdrEl.dataset.dexName = nm + (_sc && _sc.hasCount ? ' ' + _sc.badge : ''); hdrEl.dataset.src = r.src; }
                if (cexEl) { cexEl.innerHTML = _cexPHtml(`↑ ${fmtCompact(dispAskCtD)}$`, _tradeUrl); cexEl.className = 'mon-dex-cell mc-ask' + sigCls; }
                if (dexEl) { dexEl.innerHTML = _dexPHtml(`↓ ${fmtCompact(r.effPrice)}$`, r.name, 'ctd'); dexEl.className = 'mon-dex-cell mc-bid' + sigCls; }
                if (feeEl) { feeEl.textContent = _fmtFeeCell(r.wdFee, r.cexFee1 + r.cexFee2, r.feeSwap || 0); feeEl.className = 'mon-dex-cell mc-recv' + sigCls; }
                if (pnlEl) { const cls = r.pnl >= 0 ? 'pnl-pos' : 'pnl-neg'; pnlEl.textContent = `${fmtPnl(r.pnl)}$`; pnlEl.className = `mon-dex-cell mc-pnl ${cls}` + sigCls; pnlEl.title = `${r.name || 'DEX'}\nMin PNL: $${(r.dexMinPnl ?? tokMinPnl).toFixed(2)}\nPNL: ${fmtPnl(r.pnl)}$`; }
            });
            for (let i = ctdData.length; i < n; i++) {
                const lbl = missingCtD[i - ctdData.length];
                const h = els?.ctdHdr[i]; const c = els?.ctdCex[i]; const d = els?.ctdDex[i]; const f = els?.ctdFee[i]; const p = els?.ctdPnl[i];
                if (h) { h.textContent = lbl ? lbl.name : '—'; h.className = lbl ? 'mon-dex-hdr mon-dex-hdr-muted' : 'mon-dex-hdr'; }
                if (c) { c.textContent = '-'; c.className = 'mon-dex-cell mc-muted'; }
                if (d) { d.textContent = lbl ? lbl.error : '-'; d.className = lbl ? 'mon-dex-cell mc-err-sm' : 'mon-dex-cell mc-muted'; }
                if (f) { f.textContent = '-'; f.className = 'mon-dex-cell mc-muted'; }
                if (p) { p.textContent = '-'; p.className = 'mon-dex-cell mc-muted'; }
            }
        }

        // ── DTC table ──────────────────────────────────────────────
        if (blockDtC) {
            const h0 = els?.dtcHdr[0]; if (h0) { h0.textContent = `⛔ DP ${tok.ticker}`; h0.className = 'mon-dex-hdr mon-dex-hdr-err'; }
            for (let i = 1; i < n; i++) { const h = els?.dtcHdr[i]; if (h) { h.textContent = '—'; h.className = 'mon-dex-hdr'; } }
            const d0 = els?.dtcDex[0]; if (d0) { d0.textContent = 'DEPOSIT DITUTUP'; d0.className = 'mon-dex-cell mc-err'; }
            for (let i = 1; i < n; i++) { const d = els?.dtcDex[i]; if (d) { d.textContent = '—'; d.className = 'mon-dex-cell mc-muted'; } }
            for (let i = 0; i < n; i++) { const f = els?.dtcFee[i]; if (f) { f.textContent = '—'; f.className = 'mon-dex-cell mc-muted'; } const p = els?.dtcPnl[i]; if (p) { p.textContent = '—'; p.className = 'mon-dex-cell mc-muted'; } }
        } else if (!dtcData.length) {
            const reason = diagDtC || '';
            const h0 = els?.dtcHdr[0]; if (h0) { h0.textContent = reason; h0.className = 'mon-dex-hdr mon-dex-hdr-err'; }
            for (let i = 1; i < n; i++) { const h = els?.dtcHdr[i]; if (h) { h.textContent = '—'; h.className = 'mon-dex-hdr'; } }
            const hint = diagDtC === 'MODAL BESAR' ? '↓ Kecilkan Modal' : diagDtC === 'AMOUNT NOL' ? '↓ Cek Harga CEX' : '↓ KOIN TIDAK ADA DI DEX / LP';
            const d0 = els?.dtcDex[0]; if (d0) { d0.textContent = hint; d0.className = 'mon-dex-cell mc-err'; }
            for (let i = 1; i < n; i++) { const d = els?.dtcDex[i]; if (d) { d.textContent = '—'; d.className = 'mon-dex-cell mc-muted'; } }
        } else {
            dtcData.forEach((r, i) => {
                r.hdrIdx = i;
                const hdrEl = els?.dtcHdr[i] || card.querySelector(`.mon-dex-hdr[data-dir="dtc"][data-dtc-hdr="${i}"]`);
                const cexEl = els?.dtcCex[i]; const dexEl = els?.dtcDex[i]; const feeEl = els?.dtcFee[i]; const pnlEl = els?.dtcPnl[i];
                const isSignal = r.pnl >= (r.dexMinPnl ?? tokMinPnl); const sigCls = isSignal ? ' col-signal' : '';
                const _sc = Object.values(CONFIG_DEX).find(c => c.src === r.src);
                const nm = _sc && !_sc.hasCount ? _sc.label : (r.name || '').slice(0, 6).toUpperCase();
                const tag = _sc && _sc.hasCount ? `<span class="src-tag" style="background:${_sc.color};color:#fff;font-size:6px">${_sc.badge}</span>` : '';
                const ms = r.dexModalDtC; const insuf = r.modalFull === false && r.modalActual && ms && r.modalActual < ms;
                const mlbl = insuf ? `<span class="hdr-modal-set">$${ms}</span> | <span class="hdr-modal-act">$${r.modalActual}✅</span>` : (ms ? `<span class="hdr-modal-ok">$${ms}✅</span>` : '');
                if (hdrEl) { hdrEl.innerHTML = nm + (tag ? ' ' + tag : '') + (mlbl ? `<span class="hdr-dex-modal">${mlbl}</span>` : ''); hdrEl.className = 'mon-dex-hdr'; hdrEl.dataset.effprice = r.effPrice; hdrEl.dataset.cexFee1 = r.cexFee1.toFixed(4); hdrEl.dataset.cexFee2 = r.cexFee2.toFixed(4); hdrEl.dataset.feeWd = r.wdFee.toFixed(4); hdrEl.dataset.feeSwap = (r.feeSwap || 0).toFixed(6); hdrEl.dataset.totalFee = r.totalFee.toFixed(6); hdrEl.dataset.pnlKotor = (r.pnlKotor || 0).toFixed(4); hdrEl.dataset.pnlBersih = r.pnl.toFixed(4); hdrEl.dataset.modalSet = ms || ''; hdrEl.dataset.modalActual = r.modalActual != null ? r.modalActual : ''; hdrEl.dataset.minPnl = (r.dexMinPnl ?? tokMinPnl).toFixed(2); hdrEl.dataset.dexName = nm + (_sc && _sc.hasCount ? ' ' + _sc.badge : ''); hdrEl.dataset.src = r.src; }
                if (cexEl) { cexEl.innerHTML = _cexPHtml(`↓ ${fmtCompact(dispBidDtC)}$`, _tradeUrl); cexEl.className = 'mon-dex-cell mc-bid' + sigCls; }
                if (dexEl) { dexEl.innerHTML = _dexPHtml(`↑ ${fmtCompact(r.effPrice)}$`, r.name, 'dtc'); dexEl.className = 'mon-dex-cell mc-ask' + sigCls; }
                if (feeEl) { feeEl.textContent = _fmtFeeCell(r.wdFee, r.cexFee1 + r.cexFee2, r.feeSwap || 0); feeEl.className = 'mon-dex-cell mc-recv' + sigCls; }
                if (pnlEl) { const cls = r.pnl >= 0 ? 'pnl-pos' : 'pnl-neg'; pnlEl.textContent = `${fmtPnl(r.pnl)}$`; pnlEl.className = `mon-dex-cell mc-pnl ${cls}` + sigCls; pnlEl.title = `${r.name || 'DEX'}\nMin PNL: $${(r.dexMinPnl ?? tokMinPnl).toFixed(2)}\nPNL: ${fmtPnl(r.pnl)}$`; }
            });
            for (let i = dtcData.length; i < n; i++) {
                const lbl = missingDtC[i - dtcData.length];
                const h = els?.dtcHdr[i]; const c = els?.dtcCex[i]; const d = els?.dtcDex[i]; const f = els?.dtcFee[i]; const p = els?.dtcPnl[i];
                if (h) { h.textContent = lbl ? lbl.name : '—'; h.className = lbl ? 'mon-dex-hdr mon-dex-hdr-muted' : 'mon-dex-hdr'; }
                if (c) { c.textContent = '-'; c.className = 'mon-dex-cell mc-muted'; }
                if (d) { d.textContent = lbl ? lbl.error : '-'; d.className = lbl ? 'mon-dex-cell mc-err-sm' : 'mon-dex-cell mc-muted'; }
                if (f) { f.textContent = '-'; f.className = 'mon-dex-cell mc-muted'; }
                if (p) { p.textContent = '-'; p.className = 'mon-dex-cell mc-muted'; }
            }
        }
    }

    // _onDexResult: dipanggil tiap DEX resolve — parse, push, render langsung
    function _onDexResult(dk, dir, rawResults) {
        const parser = _dexParsers[dk];
        if (!parser || !rawResults?.length) { _renderCols(); return; }
        _dexRaw[dk][dir] = rawResults;
        if (dir === 'ctd' && !blockCtD) {
            rawResults.forEach(q => {
                const p = parser(q); if (!p) return;
                const r = computeQuotePnl(p, pairDec, bidPair, dxCtD[dk].modal, tok.cex, dxCtD[dk].price, 'ctd', feeWdCtD, isPairStable, chainGasFee);
                r.dexModalCtD = tok.dexModals?.[dk]?.ctd || tok.modalCtD || CFG.dex?.[dk]?.modalCtD;
                r.modalFull   = dxCtD[dk].full; r.modalActual = Math.round(dxCtD[dk].modal);
                r.dexMinPnl   = tok.dexModals?.[dk]?.pnl ?? tokMinPnl ?? CFG.dex?.[dk]?.minPnl ?? 1;
                _runCtD.push(r);
            });
        } else if (dir === 'dtc' && !blockDtC) {
            rawResults.forEach(q => {
                const p = parser(q); if (!p) return;
                const r = computeQuotePnl(p, tok.decToken, dxDtC[dk].price, dxDtC[dk].modal, tok.cex, dxCtD[dk].price, 'dtc', 0, isPairStable, chainGasFee);
                r.dexModalDtC = tok.dexModals?.[dk]?.dtc || tok.modalDtC || CFG.dex?.[dk]?.modalDtC;
                r.modalFull   = dxDtC[dk].full; r.modalActual = Math.round(dxDtC[dk].modal);
                r.dexMinPnl   = tok.dexModals?.[dk]?.pnl ?? tokMinPnl ?? CFG.dex?.[dk]?.minPnl ?? 1;
                _runDtC.push(r);
            });
        }
        _renderCols();
    }

    // Render awal: isi header CEX + show status "loading..." di kolom DEX
    // Kolom DEX akan diisi secara progresif saat tiap DEX resolve
    { // IIFE scope
        const ctdSt = els?.ctdStatus; if (!blockCtD && ctdSt) ctdSt.textContent = '';
        const dtcSt = els?.dtcStatus; if (!blockDtC && dtcSt) dtcSt.textContent = '';
        for (let i = 0; i < n; i++) {
            const cc = els?.ctdCex[i]; if (cc) { cc.innerHTML = blockCtD ? '—' : `<a href="${_tradeUrl}" target="_blank" rel="noopener" class="cex-price-link">↑ ${fmtCompact(dispAskCtD)}$</a>`; cc.className = 'mon-dex-cell mc-ask'; }
            const dc = els?.dtcCex[i]; if (dc) { dc.innerHTML = blockDtC ? '—' : `<a href="${_tradeUrl}" target="_blank" rel="noopener" class="cex-price-link">↓ ${fmtCompact(dispBidDtC)}$</a>`; dc.className = 'mon-dex-cell mc-bid'; }
            const cd = els?.ctdDex[i]; if (cd && !blockCtD) { cd.textContent = '…'; cd.className = 'mon-dex-cell mc-muted'; }
            const dd = els?.dtcDex[i]; if (dd && !blockDtC) { dd.textContent = '…'; dd.className = 'mon-dex-cell mc-muted'; }
        }
    }

    // ── DEX fetch: semua DEX dijalankan paralel (Promise.all) ────────────────────
    // Setiap DEX key meluncurkan CTD + DTC bersamaan.
    // Timeout per-call dari CONFIG_DEX[k].timeout (AbortController).
    // Jeda per-DEX (CONFIG_DEX[k].jeda) diaplikasikan setelah kedua call selesai.

    // Helper: bungkus satu fetch DEX dengan AbortController timeout
    function _callDex(key, fn) {
        const timeoutMs = CONFIG_DEX[key]?.timeout || 8000;
        const ctrl      = new AbortController();
        const tid       = setTimeout(() => ctrl.abort(), timeoutMs);
        // fn() tidak menerima signal — DEX collectors pakai fetchWithRetry internal.
        // Kita race fn() vs timeout promise untuk cap waktu maksimal.
        const timeoutP  = new Promise(res => setTimeout(() => res([]), timeoutMs));
        return Promise.race([fn(), timeoutP]).finally(() => clearTimeout(tid));
    }

    // Susun semua promise: per DEX key, CTD + DTC serentak, lalu jeda
    const _dexPromises = _enabledKeys.map(async (k) => {
        const fm = _dexFetchMap[k];
        if (!fm) return;
        const jedaMs = CONFIG_DEX[k]?.jeda || 0;
        const [rCtD, rDtC] = await Promise.all([
            _callDex(k, fm.ctd).catch(() => []),
            _callDex(k, fm.dtc).catch(() => []),
        ]);
        _onDexResult(k, 'ctd', rCtD);
        _onDexResult(k, 'dtc', rDtC);
        if (jedaMs > 0) await sleep(jedaMs);
    });

    // Tunggu semua DEX selesai
    await Promise.allSettled(_dexPromises);

    // ── Signal + Telegram (dilakukan setelah semua DEX selesai) ───────────────
    _runCtD.sort((a, b) => b.pnl - a.pnl); _runDtC.sort((a, b) => b.pnl - a.pnl);
    const _ctdFinal = _runCtD.slice(0, n); const _dtcFinal = _runDtC.slice(0, n);
    const bestCtD = (!blockCtD && _ctdFinal.length) ? _ctdFinal[0].pnl : -999;
    const bestDtC = (!blockDtC && _dtcFinal.length) ? _dtcFinal[0].pnl : -999;
    const best    = Math.max(bestCtD, bestDtC);
    const ctdProfit = !blockCtD ? _ctdFinal.filter(r => r.pnl >= (r.dexMinPnl ?? tokMinPnl)) : [];
    const dtcProfit = !blockDtC ? _dtcFinal.filter(r => r.pnl >= (r.dexMinPnl ?? tokMinPnl)) : [];
    updateSignalChips(tok, ctdProfit, 'CTD');
    updateSignalChips(tok, dtcProfit, 'DTC');
    const bestMinPnl = _ctdFinal[0] ? (_ctdFinal[0].dexMinPnl ?? tokMinPnl) : (_dtcFinal[0] ? (_dtcFinal[0].dexMinPnl ?? tokMinPnl) : tokMinPnl);
    if (best >= bestMinPnl) {
        card.classList.add('has-signal');
        const ctdSignals = _ctdFinal.filter(r => r.pnl >= (r.dexMinPnl ?? tokMinPnl));
        const dtcSignals = _dtcFinal.filter(r => r.pnl >= (r.dexMinPnl ?? tokMinPnl));
        sendTelegram(tok, best, { ctdSignals, dtcSignals, modalCtD: _refModalCtD, modalDtC: _refModalDtC, buyPriceCtD: dispAskCtD, sellPriceDtC: dispBidDtC });
    } else {
        card.classList.remove('has-signal');
    }
    if (!blockCtD && !blockDtC) setCardStatus(card, '');

}

// Show error/status in both sub-table headers; clear when msg is empty
function setCardStatus(card, msg) {
    const id = card.id.replace('card-', '');
    const els = _cardEls.get(id);
    const statEls = els ? [els.ctdStatus, els.dtcStatus].filter(Boolean)
        : Array.from(card.querySelectorAll('.tbl-status'));
    statEls.forEach(el => {
        el.textContent = msg ? ` ⚠ ${msg}` : '';
        el.className = msg ? 'tbl-status tbl-status-err' : 'tbl-status';
    });
}

// ─── Telegram + Android Notification ─────────────────────────────────────
async function sendTelegram(tok, pnl, info) {
    const now = Date.now();
    const last = tgCooldown.get(tok.id) || 0;
    if (now - last < APP_DEV_CONFIG.telegramCooldown * 60000) return;
    tgCooldown.set(tok.id, now);
    playSignalSound();

    const appName = APP_DEV_CONFIG.appName || 'MONITORING PRICE';
    const appVer = APP_DEV_CONFIG.appVersion ? ' v' + APP_DEV_CONFIG.appVersion : '';
    const chain = CONFIG_CHAINS[tok.chain]?.label || tok.chain.toUpperCase();
    const cexLbl = CONFIG_CEX[tok.cex]?.label || tok.cex;
    const pairLbl = tok.tickerPair && tok.tickerPair !== tok.ticker ? tok.tickerPair : tok.ticker;
    const wallet = CFG.wallet ? CFG.wallet.slice(0, 10) + '.....' + CFG.wallet.slice(-10) : '-';
    const pnlSign = pnl >= 0 ? '+' : '';
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fmtP = (p) => p > 0 ? (p < 0.0001 ? p.toExponential(3) : p < 1 ? p.toFixed(6) : p < 1000 ? p.toFixed(4) : p.toFixed(2)) + '$' : '-';
    const fmtPnl2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(2) + '$';

    const ctdSignals = info?.ctdSignals || [];
    const dtcSignals = info?.dtcSignals || [];
    const modalCtD = info?.modalCtD ?? tok.modalCtD;
    const modalDtC = info?.modalDtC ?? tok.modalDtC;
    const buyPriceCtD = info?.buyPriceCtD || 0;   // harga ask CEX untuk CTD
    const sellPriceDtC = info?.sellPriceDtC || 0; // harga bid CEX untuk DTC

    // ── Android notification ──────────────────────────────────────────────
    if (window.AndroidBridge) {
        const title = `🟢 ${appName} — SIGNAL: ${tok.ticker}↔${pairLbl}`;
        const body = `${cexLbl} [${chain}]  PnL: ${pnlSign}${pnl.toFixed(2)}$`;
        window.AndroidBridge.showNotification(title, body);
    }

    if (!APP_DEV_CONFIG.telegramBotToken || APP_DEV_CONFIG.telegramBotToken.length < 20) return;

    // ── Helper links ──────────────────────────────────────────────────────
    const chainCfg2 = CONFIG_CHAINS[tok.chain];
    const chainId2 = chainCfg2?.Kode_Chain || '';
    const _pairSc = tok.scPair || chainCfg2?.USDT_SC || '';
    const _kyberChain = { 56: 'bnb', 1: 'ethereum', 137: 'polygon', 42161: 'arbitrum', 8453: 'base' }[chainId2] || 'bnb';
    const _tradeSym = tok.symbolToken || (tok.ticker + 'USDT');

    const _tradeLink = ({
        binance: `https://www.binance.com/en/trade/${_tradeSym}`,
        gate: `https://www.gate.io/trade/${_tradeSym}`, mexc: `https://www.mexc.com/exchange/${_tradeSym}`,
        indodax: `https://indodax.com/market/${tok.symbolToken || tok.ticker.toLowerCase() + 'idr'}`
    })[tok.cex] || '';

    function _swapLink(_src, fromSc, toSc, dexName) {
        const n = (dexName || '').toLowerCase();
        const _sushiChain = { 56: 'bsc', 1: 'ethereum', 137: 'polygon', 42161: 'arbitrum', 8453: 'base' }[chainId2] || 'bsc';
        const _ooChain = { 56: 'bsc', 1: 'eth', 137: 'polygon', 42161: 'arbitrum', 8453: 'base' }[chainId2] || 'bsc';
        const _uniChain = { 56: 'bnb', 1: 'ethereum', 137: 'polygon', 42161: 'arbitrum', 8453: 'base' }[chainId2] || 'bnb';
        const from = fromSc.toLowerCase();
        const to = toSc.toLowerCase();
        // ── Deteksi dari nama DEX (lebih akurat dari src) ─────────────────────
        if (/^0x\b|0x protocol/i.test(n)) {
            const _matchaChain = { 56: 'bsc', 1: 'ethereum', 137: 'polygon', 42161: 'arbitrum', 8453: 'base' }[chainId2] || 'ethereum';
            return `https://matcha.xyz/tokens/${_matchaChain}/${from}?buyAddress=${to}&buyChain=${chainId2}`;
        }
        if (/1inch/i.test(n))
            return `https://1inch.io/swap?src=${chainId2}:${from}&dst=${chainId2}:${to}`;
        if (/kyber/i.test(n))
            return `https://kyberswap.com/swap/${_kyberChain}/${fromSc}-to-${toSc}`;
        if (/openocean|open.ocean/i.test(n))
            return `https://app.openocean.finance/swap/${_ooChain}/${fromSc}/${toSc}`;
        if (/sushi/i.test(n))
            return `https://www.sushi.com/${_sushiChain}/swap?token0=${fromSc}&token1=${toSc}`;
        if (/pancake/i.test(n))
            return `https://pancakeswap.finance/swap?inputCurrency=${fromSc}&outputCurrency=${toSc}`;
        if (/uniswap|uni.v/i.test(n))
            return `https://app.uniswap.org/swap?inputCurrency=${fromSc}&outputCurrency=${toSc}&chain=${_uniChain}`;
        if (/apeswap/i.test(n))
            return `https://app.apeswap.finance/swap?inputCurrency=${fromSc}&outputCurrency=${toSc}`;
        if (/biswap/i.test(n))
            return `https://exchange.biswap.org/swap?inputCurrency=${fromSc}&outputCurrency=${toSc}`;
        if (/camelot/i.test(n))
            return `https://app.camelot.exchange/swap?inputCurrency=${fromSc}&outputCurrency=${toSc}`;
        if (/aerodrome/i.test(n))
            return `https://aerodrome.finance/swap?from=${fromSc}&to=${toSc}`;
        if (/okx|okdex/i.test(n))
            return `https://www.okx.com/web3/dex-swap?inputChain=${chainId2}&inputCurrency=${fromSc}&outputChain=${chainId2}&outputCurrency=${toSc}`;
        // ── Fallback: DEX tidak dikenal → aggregator netral ───────────────────
        return `https://jumper.exchange/?fromChain=${chainId2}&toChain=${chainId2}&fromToken=${fromSc}&toToken=${toSc}`;
    }
    function _wdLink(ticker) {
        return ({
            binance: `https://www.binance.com/en/my/wallet/account/main/withdrawal/crypto/${ticker}`,
            gate: `https://www.gate.io/myaccount/withdraw/${ticker}`,
            mexc: `https://www.mexc.com/assets/withdraw?currency=${ticker}`,
            indodax: `https://indodax.com/account/withdraw/idr`
        })[tok.cex] || '';
    }
    function _dpLink(ticker) {
        return ({
            binance: `https://www.binance.com/en/my/wallet/account/main/deposit/crypto/${ticker}`,
            gate: `https://www.gate.io/myaccount/deposit/${ticker}`,
            mexc: `https://www.mexc.com/assets/deposit?currency=${ticker}`,
            indodax: `https://indodax.com/account/deposit/idr`
        })[tok.cex] || '';
    }
    function _lnk(url, txt) { return url ? `<a href="${url}">${txt}</a>` : txt; }
    function _badge(src) { return src === 'MX' ? '[MX]' : src === 'JX' ? '[JM]' : src === 'OK' ? '[KY]' : ''; }

    // ── Build one section per arah yang ada signalnya ─────────────────────
    function _section(signals, dir, modal, cexPrice) {
        if (!signals.length) return '';
        const arrow = dir === 'CTD' ? '⬆️' : '⬇️';
        const dirLabel = dir === 'CTD' ? 'CEX→DEX' : 'DEX→CEX';
        const fromSc = dir === 'CTD' ? tok.scToken : _pairSc;
        const toSc = dir === 'CTD' ? _pairSc : tok.scToken;
        // CTD: TOKEN ⇄ PAIR  |  DTC: PAIR ⇄ TOKEN
        const coinPair = dir === 'CTD'
            ? `${esc(tok.ticker)} ⇄ ${esc(pairLbl)}`
            : `${esc(pairLbl)} ⇄ ${esc(tok.ticker)}`;
        // WD/DP
        const wdTk = dir === 'CTD' ? tok.ticker : pairLbl;
        const dpTk = dir === 'CTD' ? pairLbl : tok.ticker;
        const wdPart = _lnk(_wdLink(wdTk), `WD ${esc(wdTk)}`);
        const dpPart = _lnk(_dpLink(dpTk), `DP ${esc(dpTk)}`);
        const wdLine = dir === 'CTD' ? `💳 ${wdPart} | ${dpPart}` : `💳 ${dpPart} | ${wdPart}`;

        const cexTxt = _tradeLink ? _lnk(_tradeLink, esc(cexLbl).toUpperCase()) : esc(cexLbl).toUpperCase();

        // Tiap DEX signal = satu blok ringkas
        const dexBlocks = signals.map(r => {
            const badge = _badge(r.src);
            const dexLink = _swapLink(r.src, fromSc, toSc, r.name);
            const dexTxt = _lnk(dexLink, `${badge ? badge + ' ' : ''}${esc(r.name)}`);
            // CTD: beli di CEX (cexPrice), jual di DEX (effPrice)
            // DTC: beli di DEX (effPrice), jual di CEX (cexPrice)
            const buyPr = dir === 'CTD' ? cexPrice : r.effPrice;
            const sellPr = dir === 'CTD' ? r.effPrice : cexPrice;
            const bruto = r.pnlKotor != null ? fmtPnl2(r.pnlKotor) : '-';
            const tradeFlow = dir === 'CTD' ? `${cexTxt} -> ${dexTxt}` : `${dexTxt} -> ${cexTxt}`;
            return `🏦 ${tradeFlow}
💲 Buy:${fmtP(buyPr)} ➜ Sell:${fmtP(sellPr)}
💵 Modal:$${modal}  |  💰 PNL NET : <b>${fmtPnl2(r.pnl)}</b>
🔄 PNL BRUTO :${bruto} | FEE ALL:-$${r.totalFee.toFixed(2)}`;
        }).join('\n┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n');

        return `${arrow} <b>${coinPair}</b>  [ <i>${dirLabel}</i> ]
${dexBlocks}
${wdLine}`;
    }

    const _ctdSec = _section(ctdSignals, 'CTD', modalCtD, buyPriceCtD);
    const _dtcSec = _section(dtcSignals, 'DTC', modalDtC, sellPriceDtC);
    const _body = [_ctdSec, _dtcSec].filter(Boolean).join('\n━━━\n');

    const msg =
        `🟢 <b>${esc(appName)}${appVer}</b>
👤 @${esc(CFG.username || 'user')}  •  🔗 <b>${esc(chain)}</b>
━━━━━━━━━━━━━━━
${_body}
━━━━━━━━━━━━━━━
👛 <code>${esc(wallet)}</code>`;

    try {
        await fetch(`https://api.telegram.org/bot${APP_DEV_CONFIG.telegramBotToken}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: APP_DEV_CONFIG.telegramGroupId, text: msg, parse_mode: 'HTML', disable_web_page_preview: true })
        });
    } catch { }
}

// ─── Reset Monitor Cells ──────────────────────
// Kosongkan semua sel tabel dan sinyal setelah setiap ronde selesai
function resetMonitorCells() {
    const n = totalQuoteCount();
    _cardEls.forEach(els => {
        const card = els.card;
        if (!card) return;
        card.classList.remove('has-signal');
        card.querySelectorAll('.card-status').forEach(el => el.textContent = '');
        if (els.ctdStatus) { els.ctdStatus.textContent = ''; els.ctdStatus.className = 'tbl-status'; }
        if (els.dtcStatus) { els.dtcStatus.textContent = ''; els.dtcStatus.className = 'tbl-status'; }
        for (let i = 0; i < n; i++) {
            const ctdH = els.ctdHdr[i]; if (ctdH) { ctdH.textContent = '-'; ctdH.className = 'mon-dex-hdr'; }
            const ctdC = els.ctdCex[i]; if (ctdC) { ctdC.textContent = '-'; ctdC.className = 'mon-dex-cell'; }
            const ctdD = els.ctdDex[i]; if (ctdD) { ctdD.textContent = '-'; ctdD.className = 'mon-dex-cell'; }
            const ctdF = els.ctdFee[i]; if (ctdF) { ctdF.textContent = '-'; ctdF.className = 'mon-dex-cell'; }
            const ctdP = els.ctdPnl[i]; if (ctdP) { ctdP.textContent = '-'; ctdP.className = 'mon-dex-cell'; }
            const dtcH = els.dtcHdr[i]; if (dtcH) { dtcH.textContent = '-'; dtcH.className = 'mon-dex-hdr'; }
            const dtcC = els.dtcCex[i]; if (dtcC) { dtcC.textContent = '-'; dtcC.className = 'mon-dex-cell'; }
            const dtcD = els.dtcDex[i]; if (dtcD) { dtcD.textContent = '-'; dtcD.className = 'mon-dex-cell'; }
            const dtcF = els.dtcFee[i]; if (dtcF) { dtcF.textContent = '-'; dtcF.className = 'mon-dex-cell'; }
            const dtcP = els.dtcPnl[i]; if (dtcP) { dtcP.textContent = '-'; dtcP.className = 'mon-dex-cell'; }
        }
    });
    _clearAllSignalChips();
}

// ─── Scan Loop ───────────────────────────────
let _scanRound = 0;
let _lastScanTokenKey = null; // cache key: cegah rebuild monitor cards jika urutan tidak berubah
// Gas estimate per chainId dalam USD — diisi sekali saat start scan
let _chainGasEstimateUsdt = {};

// ─── Scan Timer ──────────────────────────────
let _scanTimerStart = 0;
let _scanTimerInterval = null;

function _fmtElapsed(ms) {
    const elapsed = Math.floor(ms / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    return h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function _startScanTimer() {
    _scanTimerStart = Date.now();
    // Reset semua timer badge
    const bTimer = document.getElementById('scanBadgeTimer');
    const dTimer = document.getElementById('scanDoneTimer');
    const sTimer = document.getElementById('scanStopTimer');
    if (bTimer) bTimer.textContent = '00:00';
    if (dTimer) dTimer.textContent = '';
    if (sTimer) sTimer.textContent = '';
    _scanTimerInterval = setInterval(() => {
        const el = document.getElementById('scanBadgeTimer');
        if (el) el.textContent = _fmtElapsed(Date.now() - _scanTimerStart);
    }, 1000);
}

// reason: 'manual' | 'done'
function _stopScanTimer(reason) {
    if (_scanTimerInterval) { clearInterval(_scanTimerInterval); _scanTimerInterval = null; }
    const finalTime = _fmtElapsed(Date.now() - _scanTimerStart);
    if (reason === 'done') {
        const el = document.getElementById('scanDoneTimer');
        if (el) el.textContent = finalTime;
    } else {
        const el = document.getElementById('scanStopTimer');
        if (el) el.textContent = finalTime;
    }
    // Bersihkan timer di badge scanning
    const bTimer = document.getElementById('scanBadgeTimer');
    if (bTimer) bTimer.textContent = '';
}

async function runScan() {
    if (scanning) return;
    scanning = true; scanAbort = false;
    _startScanTimer();
    document.body.classList.add('is-scanning');
    $('#btnScanIcon').text('■'); $('#btnScanLbl').text('STOP'); $('#btnScan').addClass('stop');
    $('#btnScanCount').text('');
    $('#scanBadge').addClass('active');
    _clearAllSignalChips();
    $('#notStartedNotice').hide();
    $('#scanDoneNotice').hide();
    $('#scanStopNotice').hide();
    updateNoSignalNotice();
    lockTabs();
    if (!getFilteredTokens().length) { showToast('Tidak ada token aktif! Periksa filter di Pengaturan.'); stopScan(); return; }
    showToast('▶ Scanning dimulai…');
    try { if (window.AndroidBridge && AndroidBridge.startBackgroundService) AndroidBridge.startBackgroundService(); } catch (e) { }
    await fetchUsdtRate();

    // Fetch gas price sekali di awal scan untuk semua chain yang aktif
    _chainGasEstimateUsdt = {};
    const activeChainIds = [...new Set(getFilteredTokens().map(t => CONFIG_CHAINS[t.chain]?.Kode_Chain).filter(Boolean))];
    await Promise.all(activeChainIds.map(async id => {
        _chainGasEstimateUsdt[id] = await fetchChainGasEstimateUsdt(id);
    }));

    const BATCH_SIZE = APP_DEV_CONFIG.scanBatchSize || 4;

    while (!scanAbort) {
        _scanRound++;
        for (const k in _obCache) delete _obCache[k];
        await fetchUsdtRate();
        if (monitorSort === 'rand') _shuffledTokens = null;
        const tokens = getFilteredTokens();
        if (!tokens.length) break;
        const tokenKey = tokens.map(t => t.id).join(',');
        if (_lastScanTokenKey !== tokenKey) {
            buildMonitorRows(tokens);
            _lastScanTokenKey = tokenKey;
        }

        for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
            if (scanAbort) break;
            const batch = tokens.slice(i, Math.min(i + BATCH_SIZE, tokens.length));
            const pct = Math.round(Math.min(i + BATCH_SIZE, tokens.length) / tokens.length * 100);
            $('#scanBar').css('width', pct + '%');
            $('#btnScanCount').text(`[ ${Math.min(i + BATCH_SIZE, tokens.length)}/${tokens.length}] KOIN`);

            // ── Semua koin dalam batch dijalankan PARALEL ──────────────────────────
            await Promise.all(batch.map(tok => scanToken(tok).catch(() => {})));

            // Jeda antar kelompok — satu-satunya parameter kecepatan dikontrol user
            if (!scanAbort && i + BATCH_SIZE < tokens.length) {
                await sleep(CFG.interval);
            }
        }

        if (!scanAbort) {
            $('#scanBar').css('width', '0%');
            if (!autoReload) {
                showToast(`✅ Scan selesai!`);
                playCompleteSound();
                break;
            }
            // Auto-reload: jeda CFG.interval lalu ronde berikutnya
            const roundSec = Math.round(CFG.interval / 1000);
            showToast(`✅ Ronde ${_scanRound} selesai — jeda ${roundSec}s...`, CFG.interval - 200);
            playCompleteSound();
            await sleep(CFG.interval);
            if (!scanAbort) {
                resetMonitorCells();
                _clearAllSignalChips();
                updateNoSignalNotice();
            }
        }
    }
    stopScan(scanAbort ? 'manual' : 'done');
}
function stopScan(reason = 'manual') {
    scanning = false; scanAbort = true;
    _stopScanTimer(reason);
    document.body.classList.remove('is-scanning');
    _lastScanTokenKey = null; // reset agar scan berikutnya rebuild cards bersih
    $('#btnScanIcon').text('▶'); $('#btnScanLbl').text('START'); $('#btnScan').removeClass('stop');
    updateScanCount();
    $('#scanBadge').removeClass('active');
    $('#scanBar').css('width', '0%');
    // Tampilkan notice sesuai kondisi
    $('#notStartedNotice').hide();
    $('#scanDoneNotice').hide();
    $('#scanStopNotice').hide();
    $('#noSignalNotice').hide();
    if (_scanRound === 0) {
        // Belum pernah scan sama sekali
        $('#notStartedNotice').show();
    } else if (reason === 'done') {
        // Scan selesai natural (semua koin sudah discan)
        $('#scanDoneNotice').show();
        showToast('✅ Scanning selesai');
    } else {
        // Dihentikan manual oleh user
        $('#scanStopNotice').show();
        showToast('■ Scanning dihentikan');
    }
    unlockTabs();
    // Stop Android Foreground Service
    try { if (window.AndroidBridge && AndroidBridge.stopBackgroundService) AndroidBridge.stopBackgroundService(); } catch (e) { }
}
$('#btnScan').on('click', () => {
    if (scanning) { scanAbort = true; stopScan('manual'); }
    else { runScan(); }
});

// ─── Auto-Reload Toggle ───────────────────────
function _applyAutoReload() {
    const btn = document.getElementById('btnAutoReload');
    if (!btn) return;
    if (autoReload) {
        btn.classList.add('active');
        btn.textContent = '🔁';
        btn.title = 'Mode: Auto-Reload (aktif)';
    } else {
        btn.classList.remove('active');
        btn.textContent = '🔄';
        btn.title = 'Mode: Sekali Scan';
    }
}
$('#btnAutoReload').on('click', function () {
    if (scanning) return; // jangan ubah saat scanning berlangsung
    autoReload = !autoReload;
    dbSet('scanAutoReload', autoReload);
    _applyAutoReload();
    showToast(autoReload ? '🔁 Auto Reload Scanner Aktif' : '🔂 Sekali Scan Aktif');
});
