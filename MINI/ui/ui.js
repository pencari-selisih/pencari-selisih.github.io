// ─── URL Helpers for CEX/DEX Quick Links ──────
function _getCexTradeUrl(cexKey, ticker, pairTicker) {
    const sym  = (ticker || '').toUpperCase();
    const pair = (pairTicker || 'USDT').toUpperCase();
    switch (cexKey) {
        case 'binance': return `https://www.binance.com/en/trade/${sym}_${pair}`;
        case 'gate':    return `https://www.gate.io/trade/${sym}_${pair}`;
        case 'mexc':    return `https://www.mexc.com/exchange/${sym}_${pair}`;
        case 'indodax': return `https://indodax.com/market/${sym.toLowerCase()}idr`;
        default:        return '';
    }
}
function _getCexWithdrawUrl(cexKey, coin) {
    const c = (coin || '').toUpperCase();
    switch (cexKey) {
        case 'binance': return `https://www.binance.com/en/my/wallet/account/main/withdrawal/crypto/${c}`;
        case 'gate':    return `https://www.gate.com/myaccount/withdraw/${c}`;
        case 'mexc':    return `https://www.mexc.com/assets/withdraw/${c}`;
        case 'indodax': return `https://indodax.com/finance/${c}#kirim`;
        default:        return '';
    }
}
function _getCexDepositUrl(cexKey, coin) {
    const c = (coin || '').toUpperCase();
    switch (cexKey) {
        case 'binance': return `https://www.binance.com/en/my/wallet/account/main/deposit/crypto/${c}`;
        case 'gate':    return `https://www.gate.com/myaccount/deposit/${c}`;
        case 'mexc':    return `https://www.mexc.com/assets/deposit/${c}`;
        case 'indodax': return `https://indodax.com/finance/${c}`;
        default:        return '';
    }
}
function _getDexUrl(dexName, tok, dir) {
    const dn = (dexName || '').toLowerCase();
    if (!tok) return '';
    const chainCfg = CONFIG_CHAINS[tok.chain] || {};
    const chainId  = chainCfg.Kode_Chain || '';
    const scToken  = (tok.scToken || '').toLowerCase();
    const scPair   = (tok.scPair || chainCfg.USDT_SC || '').toLowerCase();
    // CTD = sell token on DEX (token→pair), DTC = buy token on DEX (pair→token)
    const from     = dir === 'dtc' ? scPair  : scToken;
    const to       = dir === 'dtc' ? scToken : scPair;
    if (!from || !to) {
        // Fallback tanpa SC: link generic
        if (dn.includes('meta') || dn === 'mm') return 'https://portfolio.metamask.io/bridge';
        if (dn.includes('jump') || dn.includes('lifi')) return 'https://jumper.exchange/';
        if (dn.includes('bungee')) return 'https://www.bungee.exchange/';
        return '';
    }
    const _kyberChain = { 56:'bnb', 1:'ethereum', 137:'polygon', 42161:'arbitrum', 8453:'base' }[chainId] || 'bnb';
    const _sushiChain = { 56:'bsc', 1:'ethereum', 137:'polygon', 42161:'arbitrum', 8453:'base' }[chainId] || 'bsc';
    const _ooChain    = { 56:'bsc', 1:'eth',      137:'polygon', 42161:'arbitrum', 8453:'base' }[chainId] || 'bsc';
    const _uniChain   = { 56:'bnb', 1:'ethereum', 137:'polygon', 42161:'arbitrum', 8453:'base' }[chainId] || 'bnb';
    const _matchaChain = { 56:'bsc', 1:'ethereum', 137:'polygon', 42161:'arbitrum', 8453:'base' }[chainId] || 'ethereum';
    if (dn.includes('meta') || dn === 'mm') return 'https://portfolio.metamask.io/bridge';
    if (dn.includes('jump') || dn.includes('lifi')) return `https://jumper.exchange/?fromChain=${chainId}&toChain=${chainId}&fromToken=${from}&toToken=${to}`;
    if (dn.includes('kyber')) return `https://kyberswap.com/swap/${_kyberChain}/${from}-to-${to}`;
    if (dn.includes('okx') || dn.includes('okdex')) return `https://www.okx.com/web3/dex-swap?inputChain=${chainId}&inputCurrency=${from}&outputChain=${chainId}&outputCurrency=${to}`;
    if (dn.includes('bungee')) return 'https://www.bungee.exchange/';
    if (/^0x\b|0x protocol|matcha/i.test(dn)) return `https://matcha.xyz/tokens/${_matchaChain}/${from}?buyAddress=${to}&buyChain=${chainId}`;
    if (/openocean|open.ocean/i.test(dn)) return `https://app.openocean.finance/swap/${_ooChain}/${from}/${to}`;
    if (/sushi/i.test(dn)) return `https://www.sushi.com/${_sushiChain}/swap?token0=${from}&token1=${to}`;
    if (/pancake/i.test(dn)) return `https://pancakeswap.finance/swap?inputCurrency=${from}&outputCurrency=${to}`;
    if (/uniswap|uni.v/i.test(dn)) return `https://app.uniswap.org/swap?inputCurrency=${from}&outputCurrency=${to}&chain=${_uniChain}`;
    if (/apeswap/i.test(dn)) return `https://app.apeswap.finance/swap?inputCurrency=${from}&outputCurrency=${to}`;
    if (/biswap/i.test(dn)) return `https://exchange.biswap.org/swap?inputCurrency=${from}&outputCurrency=${to}`;
    if (/camelot/i.test(dn)) return `https://app.camelot.exchange/swap?inputCurrency=${from}&outputCurrency=${to}`;
    if (/aerodrome/i.test(dn)) return `https://aerodrome.finance/swap?from=${from}&to=${to}`;
    if (/1inch/i.test(dn)) return `https://1inch.io/swap?src=${chainId}:${from}&dst=${chainId}:${to}`;
    if (/fly|flytrade/i.test(dn)) return `https://jumper.exchange/?fromChain=${chainId}&toChain=${chainId}&fromToken=${from}&toToken=${to}`;
    // Fallback: jumper aggregator
    return `https://jumper.exchange/?fromChain=${chainId}&toChain=${chainId}&fromToken=${from}&toToken=${to}`;
}

// ─── App Dialog Modal ─────────────────────────
// Menggantikan alert() dan confirm() bawaan browser
const MODAL_ICONS = { info: 'ℹ️', warn: '⚠️', error: '🗑️', success: '✅', delete: '🗑️' };

function _showModal(icon, title, bodyHtml, buttons, bodyLeft = false) {
    $('#appModalIcon').text(icon);
    $('#appModalTitle').text(title);
    $('#appModalBody').html(bodyHtml).toggleClass('text-left', bodyLeft);
    $('#appModalFooter').html(
        buttons.map((b, i) =>
            `<button class="app-modal-btn ${b.cls}" data-idx="${i}">${b.label}</button>`
        ).join('')
    );
    $('#appModal').addClass('open');
    $('#appModalFooter').off('click').on('click', '[data-idx]', function () {
        $('#appModal').removeClass('open');
        const cb = buttons[+$(this).data('idx')].action;
        if (cb) cb();
    });
}

function showAlert(msg, title, type, onClose) {
    const icon = MODAL_ICONS[type] || MODAL_ICONS.info;
    _showModal(icon, title || 'Info', msg,
        [{ label: 'OK', cls: 'btn-ok', action: onClose }]);
}

function showAlertList(items, title, onClose) {
    const body = '<ul>' + items.map(s => `<li>${s}</li>`).join('') + '</ul>';
    _showModal(MODAL_ICONS.warn, title || 'Perhatian', body,
        [{ label: 'OK', cls: 'btn-ok', action: onClose }], true);
}

function showConfirm(msg, title, labelOk, onOk, onCancel) {
    _showModal(MODAL_ICONS.delete, title || 'Konfirmasi', msg, [
        { label: 'Batal', cls: 'btn-cancel', action: onCancel },
        { label: labelOk || 'Ya', cls: 'btn-ok btn-danger', action: onOk },
    ]);
}

// ─── Settings ────────────────────────────────
function getAllFilteredTokens() {
    // Hitung semua token yg lolos filter CEX+chain+pairType, termasuk favorit (ignore monitorFavOnly)
    return getTokens().filter(t => {
        const cexOk = CFG.activeCex.length === 0 || CFG.activeCex.includes(t.cex);
        const chainOk = CFG.activeChains.length === 0 || CFG.activeChains.includes(t.chain);
        const pairTk = (t.tickerPair || 'USDT').toUpperCase();
        const isStable = STABLE_COINS.has(pairTk);
        const pairOk = CFG.pairType === 'all' || (CFG.pairType === 'stable' ? isStable : !isStable);
        return cexOk && chainOk && pairOk;
    });
}

function updateScanCount() {
    const allN = getAllFilteredTokens().length;  // semua koin (termasuk fav) untuk settings
    const n = getFilteredTokens().length;         // koin aktif untuk scan (bisa filtered by fav)
    $('#filterCoinCount').text(allN);
    if (!scanning) {
        $('#btnScanCount').text('[' + n + ' KOIN ]');
        $('#btnScan').prop('disabled', n === 0).toggleClass('disabled', n === 0);
    }
}

function renderFilterChips() {
    // CEX filter chips (multi-select toggle)
    $('#filterCexChips').html(Object.entries(CONFIG_CEX).map(([k, v]) => {
        const on = CFG.activeCex.length === 0 || CFG.activeCex.includes(k);
        return `<span class="fchip${on ? ' on' : ''}" data-key="${k}" data-type="cex"
          style="${on ? `background:${v.WARNA};color:#fff;` : ''}"
          onclick="toggleFilterChip(this,'cex')">
          <img src="icons/cex/${k}.png" class="chip-icon" onerror="this.style.display='none'">
          ${v.label}</span>`;
    }).join(''));
    // Chain filter chips (multi-select toggle)
    $('#filterChainChips').html(Object.entries(CONFIG_CHAINS).map(([k, v]) => {
        const on = CFG.activeChains.length === 0 || CFG.activeChains.includes(k);
        return `<span class="fchip${on ? ' on' : ''}" data-key="${k}" data-type="chain"
          style="${on ? `background:${v.WARNA};color:#fff;` : ''}"
          onclick="toggleFilterChip(this,'chain')">
          <img src="icons/chains/${k}.png" class="chip-icon" onerror="this.style.display='none'">
          ${v.label}</span>`;
    }).join(''));
    // Pair type chips — sync active state
    document.querySelectorAll('#filterPairTypeChips .pair-type-chip').forEach(el => {
        const active = el.dataset.val === (CFG.pairType || 'all');
        el.classList.toggle('on', active);
        el.style.background = active ? '#365cd3' : '';
        el.style.color = active ? '#fff' : '';
    });
}

function setPairTypeFilter(val) {
    CFG.pairType = val;
    _persistCFG();
    renderFilterChips();
    if (!scanning) buildMonitorRows();
    renderTokenList();
    updateScanCount();
    const labels = { all: 'Semua pair', stable: 'Pair Stable Coin', non: 'Pair Non-Stable' };
    showToast(`🔄 Filter pair: ${labels[val]}`);
}

function toggleFilterChip(el, type) {
    const key = el.dataset.key;
    const arr = type === 'cex' ? CFG.activeCex : CFG.activeChains;
    const cfg = type === 'cex' ? CONFIG_CEX : CONFIG_CHAINS;
    const label = cfg[key]?.label || key;
    const idx = arr.indexOf(key);
    // Jika semua aktif (arr kosong), berarti kita mulai dari "semua ON"
    // Klik pertama pada salah satu = matikan yang lain, aktifkan hanya ini
    if (arr.length === 0) {
        // Set semua menjadi aktif, lalu matikan yang diklik
        const all = Object.keys(cfg);
        arr.push(...all.filter(k => k !== key));
    } else if (idx >= 0) {
        arr.splice(idx, 1);
    } else {
        arr.push(key);
        // Jika semua aktif kembali → reset ke "semua" (arr kosong)
        if (arr.length === Object.keys(cfg).length) arr.splice(0);
    }
    renderFilterChips();
    _persistCFG();
    renderTokenList();
    updateScanCount();

    // Toast info status
    const isNowOn = arr.length === 0 || arr.includes(key);
    if (arr.length === 0) {
        showToast(`✅ Semua ${type === 'cex' ? 'CEX' : 'Chain'} aktif`);
    } else {
        showToast(`${isNowOn ? '✅ ' : '❌ '} ${label.toUpperCase()} ${isNowOn ? 'di ON-kan' : 'di OFF-kan'}`);
    }
}

function loadSettings() {
    const s = dbGet(LS_SETTINGS, null);
    if (s) Object.assign(CFG, s);
    if (!Array.isArray(CFG.activeCex)) CFG.activeCex = [];
    if (!Array.isArray(CFG.activeChains)) CFG.activeChains = [];
    if (!['all','stable','non'].includes(CFG.pairType)) CFG.pairType = 'all';
    // Migration: quoteCount legacy → dex config
    if (CFG.quoteCount && !CFG.quoteCountMetax) { CFG.quoteCountMetax = CFG.quoteCount; delete CFG.quoteCount; }
    if (!CFG.dex) CFG.dex = {};
    DEX_LIST.forEach(def => {
        if (!CFG.dex[def.key]) CFG.dex[def.key] = { active: true, modalCtD: 100, modalDtC: 80 };
    });
    if (!CFG.dex.metax?.count)  CFG.dex.metax.count  = CFG.quoteCountMetax  || CONFIG_DEX.metax?.count || 2;
    if (!CFG.dex.jumpx?.count)  CFG.dex.jumpx.count  = CFG.quoteCountJumpx  || CONFIG_DEX.jumpx?.count || 2;
    // Migrate any remaining legacy counts
    Object.entries(CONFIG_DEX).forEach(([k, cfg]) => {
        if (cfg.hasCount && CFG.dex[k] && !CFG.dex[k].count) {
            CFG.dex[k].count = cfg.count;
        }
    });
    _syncLegacyDexCounts();
    $('#setUsername').val(CFG.username);
    $('#setWallet').val(CFG.wallet);
    $('#setSoundMuted').prop('checked', !CFG.soundMuted); // centang = suara ON
    // Dynamic DEX settings — render from CONFIG_DEX
    const _dexSettingsContainer = document.getElementById('dexSettingsContainer');
    if (_dexSettingsContainer) {
        _dexSettingsContainer.innerHTML = '';
        Object.entries(CONFIG_DEX).forEach(([key, cfg]) => {
            if (!cfg.hasCount || !cfg.enabled) return;
            const div = document.createElement('div');
            div.className = 'settings-field';
            div.id = `fieldQuote_${key}`;
            div.innerHTML = `<label class="settings-label">DEX <span class="src-tag" style="background:${cfg.color};color:#fff;font-size:7px">${cfg.badge}</span></label>
                <input class="settings-input" id="setQuote_${key}" type="number" min="1" max="5" value="${CFG.dex[key]?.count || cfg.count}">`;
            _dexSettingsContainer.appendChild(div);
            // Bind change event
            div.querySelector('input').addEventListener('change', function() {
                const v = Math.min(5, Math.max(1, parseInt(this.value) || cfg.count));
                this.value = v;
                if (!CFG.dex[key]) CFG.dex[key] = {};
                CFG.dex[key].count = v;
                _syncLegacyDexCounts();
                saveSettings();
                showToast(`✓ ${cfg.label} Route: ${v}`);
            });
        });
    }
    // Auto Level CEX — selalu aktif, on/off via config.js defaultAutoLevel
    CFG.autoLevel = isAutoLevelEnabled();
    if (!isAutoLevelEnabled()) {
        $('#autoLevelField').hide();
    } else {
        $('#setLevelCount').val(CFG.levelCount ?? APP_DEV_CONFIG.defaultLevelCount);
    }
    // Speed chips — tandai yang aktif berdasarkan CFG.interval (jeda antar kelompok batch)
    const speeds = [800, 700, 500];
    const nearest = speeds.reduce((a, b) => Math.abs(b - CFG.interval) < Math.abs(a - CFG.interval) ? b : a);
    $('#speedChips .sort-btn').removeClass('active');
    $(`#speedChips [data-speed="${nearest}"]`).addClass('active');
    $('#topUsername').text('@' + (CFG.username || '-'));
    // Display app name & version dari config
    const appName = APP_DEV_CONFIG.appName || 'MONITORING PRICE';
    const ver = APP_DEV_CONFIG.appVersion || '';
    const verStr = 'v' + ver;
    const verEl = document.getElementById('appVersion');
    if (verEl) verEl.textContent = verStr;
    const obVer = document.getElementById('onboardVersion');
    if (obVer) obVer.textContent = verStr;
    const nameEl = document.getElementById('appNameDisplay');
    if (nameEl) nameEl.textContent = appName;
    const onboardNameEl = document.getElementById('onboardAppName');
    if (onboardNameEl) onboardNameEl.textContent = appName;
    const titleEl = document.getElementById('appTitle');
    if (titleEl) titleEl.textContent = appName;
    renderFilterChips();
    updateScanCount();
}
const EVM_RE = /^0x[0-9a-fA-F]{40}$/;

// ─── Auto-save helpers ────────────────────────
function _persistCFG() {
    dbSet(LS_SETTINGS, Object.assign({}, CFG));
}

// Simpan field non-kritis langsung saat berubah (tanpa toast)
function _autoSaveFields() {
    CFG.soundMuted = !$('#setSoundMuted').prop('checked'); // centang = suara ON = NOT muted
    CFG.levelCount = Math.min(4, Math.max(1, parseInt($('#setLevelCount').val()) || 2));
    _persistCFG();
    if (!scanning) buildMonitorRows();
    renderTokenList();
}

// ─── DEX Config (per-DEX modal & toggle aktif) ────
// Draft state — diisi saat modal dibuka, diterapkan saat Simpan
let _dexDraft = null;

function _initDraft() {
    _dexDraft = {};
    getEnabledDexList().forEach(def => {
        const src = (CFG.dex || {})[def.key] || {};
        _dexDraft[def.key] = {
            active:   src.active !== false,
            modalCtD: src.modalCtD != null ? src.modalCtD : 100,
            modalDtC: src.modalDtC != null ? src.modalDtC : 80,
            minPnl:   src.minPnl  != null ? src.minPnl  : 1,
        };
    });
}

function renderDexConfig() {
    const d = _dexDraft || CFG.dex || {};
    const html = getEnabledDexList().map(def => {
        const cfg = d[def.key] || {};
        const active = cfg.active !== false;
        const dis = active ? '' : 'disabled';
        return `<div class="dex-cfg-row dex-cfg-${def.key}${active ? ' dex-on' : ''}">
  <div class="dex-row-top">
    <span class="dex-sw-wrap" onclick="draftToggle('${def.key}')" title="${active ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}">
      <span class="dex-sw${active ? ' on' : ''}"></span>
    </span>
    <span class="dex-badge dex-badge-${def.key}">${def.badge}</span>
    <span class="dex-row-name">${def.label}</span>
    <span class="dex-active-lbl${active ? ' on' : ''}">${active ? '✅ AKTIF' : '❌ NONAKTIF'}</span>
  </div>
  <div class="dex-row-fields${active ? '' : ' dex-cfg-disabled'}">
    <div class="dex-field-grp">
      <span class="dex-lbl">CEX→DEX $</span>
      <input class="dex-inp" data-dex="${def.key}" data-field="modalCtD" type="number" min="1"
        value="${cfg.modalCtD}" ${dis} oninput="draftChange(this)">
    </div>
    <div class="dex-field-grp">
      <span class="dex-lbl">DEX→CEX $</span>
      <input class="dex-inp" data-dex="${def.key}" data-field="modalDtC" type="number" min="1"
        value="${cfg.modalDtC}" ${dis} oninput="draftChange(this)">
    </div>
    <div class="dex-field-grp">
      <span class="dex-lbl">Min PnL $</span>
      <input class="dex-inp" data-dex="${def.key}" data-field="minPnl" type="number" min="0" step="0.1"
        value="${cfg.minPnl}" ${dis} oninput="draftChange(this)">
    </div>
  </div>
</div>`;
    }).join('');
    $('#dexConfigList').html(html);
}

function draftToggle(key) {
    if (!_dexDraft) _initDraft();
    _dexDraft[key].active = !_dexDraft[key].active;
    renderDexConfig();
}

function draftChange(el) {
    if (!_dexDraft) return;
    const key   = el.dataset.dex;
    const field = el.dataset.field;
    const v = parseFloat(el.value);
    if (!isNaN(v)) _dexDraft[key][field] = v;
}

function saveDexModalAll() {
    if (!CFG.dex) CFG.dex = {};

    // Baca nilai langsung dari DOM (robust, tidak bergantung _dexDraft saja)
    const vals = {};
    getEnabledDexList().forEach(def => {
        const ctdEl = document.querySelector(`.dex-inp[data-dex="${def.key}"][data-field="modalCtD"]`);
        const dtcEl = document.querySelector(`.dex-inp[data-dex="${def.key}"][data-field="modalDtC"]`);
        const pnlEl = document.querySelector(`.dex-inp[data-dex="${def.key}"][data-field="minPnl"]`);
        const ctd = parseFloat(ctdEl?.value);
        const dtc = parseFloat(dtcEl?.value);
        const pnl = parseFloat(pnlEl?.value);
        vals[def.key] = {
            active:   _dexDraft?.[def.key]?.active ?? (CFG.dex?.[def.key]?.active !== false),
            modalCtD: !isNaN(ctd) ? ctd : (_dexDraft?.[def.key]?.modalCtD ?? CFG.dex?.[def.key]?.modalCtD ?? 100),
            modalDtC: !isNaN(dtc) ? dtc : (_dexDraft?.[def.key]?.modalDtC ?? CFG.dex?.[def.key]?.modalDtC ?? 80),
            minPnl:   !isNaN(pnl) ? pnl : (_dexDraft?.[def.key]?.minPnl   ?? CFG.dex?.[def.key]?.minPnl   ?? 1),
        };
    });

    // 1. Simpan ke CFG.dex (global bulk modal)
    getEnabledDexList().forEach(def => {
        if (!CFG.dex[def.key]) CFG.dex[def.key] = {};
        Object.assign(CFG.dex[def.key], vals[def.key]);
    });
    _syncLegacyDexCounts();
    _persistCFG();

    // 2. Apply ke dexModals: token terfilter + semua token favorit (meski di luar filter)
    const filteredIds = new Set(getAllFilteredTokens().map(t => t.id));
    const targetToks = getTokens().filter(t => filteredIds.has(t.id) || t.favorite);
    targetToks.forEach(t => {
        if (!t.dexModals) t.dexModals = {};
        getEnabledDexList().forEach(def => {
            const dr = vals[def.key];
            if (!t.dexModals[def.key]) t.dexModals[def.key] = {};
            t.dexModals[def.key].ctd = dr.modalCtD;
            t.dexModals[def.key].dtc = dr.modalDtC;
            t.dexModals[def.key].pnl = dr.minPnl;
        });
    });
    if (targetToks.length) {
        saveTokens(getTokens());
        renderTokenList();
    }

    _dexDraft = null;
    closeBulkModal();
    if (!scanning) buildMonitorRows();
    const favCount = targetToks.filter(t => t.favorite && !filteredIds.has(t.id)).length;
    const msg = favCount > 0
        ? `✅ Modal DEX disimpan — ${filteredIds.size} terfilter + ${favCount} favorit`
        : `✅ Modal DEX disimpan — diterapkan ke ${targetToks.length} koin terfilter`;
    showToast(msg);
}

function cancelDexModal() {
    _dexDraft = null;
    closeBulkModal();
}

function toggleDexActive(key) {
    if (!CFG.dex) CFG.dex = {};
    if (!CFG.dex[key]) CFG.dex[key] = { active: false, modalCtD: 100, modalDtC: 80 };
    CFG.dex[key].active = !CFG.dex[key].active;
    _syncLegacyDexCounts();
    _persistCFG();
    renderDexConfig();
    if (!scanning) buildMonitorRows();
    const def = DEX_LIST.find(d => d.key === key);
    showToast(`${def?.label || key.toUpperCase()}: ${CFG.dex[key].active ? '✅ Aktif' : '❌ Nonaktif'}`);
}

function saveDexModal(el) {
    const key = el.dataset.dex;
    const field = el.dataset.field;
    if (!CFG.dex) CFG.dex = {};
    if (!CFG.dex[key]) CFG.dex[key] = { active: true, modalCtD: 100, modalDtC: 80, minPnl: 1 };
    if (field === 'minPnl') {
        const v = Math.max(0, parseFloat(el.value) || 0);
        CFG.dex[key].minPnl = v;
        el.value = v;
    } else {
        const v = parseFloat(el.value);
        if (isNaN(v) || v < 1) return;
        CFG.dex[key][field] = v;
    }
    _persistCFG();
    const def = DEX_LIST.find(d => d.key === key);
    const lbl = field === 'modalCtD' ? 'CEX→DEX' : field === 'modalDtC' ? 'DEX→CEX' : 'Min PnL';
    showToast(`✓ ${def?.label || key.toUpperCase()} ${lbl}: $${el.value}`);
}

// Simpan username & wallet saat blur — validasi inline
function _saveUserInfo() {
    const username = $('#setUsername').val().trim();
    const wallet   = $('#setWallet').val().trim();
    $('#setUsername, #setWallet').removeClass('input-error');
    let hasErr = false;
    if (!username) { $('#setUsername').addClass('input-error'); hasErr = true; }
    if (!wallet) { $('#setWallet').addClass('input-error'); hasErr = true; }
    else if (!EVM_RE.test(wallet)) { $('#setWallet').addClass('input-error'); hasErr = true; }
    if (hasErr) return;
    CFG.username = username;
    CFG.wallet   = wallet;
    _persistCFG();
    $('#topUsername').text('@' + username);
    showToast('✓ Data pengguna tersimpan');
}

// Tetap ada untuk kompatibilitas (dipakai loadSettings & onboarding)
function saveSettings() { _saveUserInfo(); _autoSaveFields(); }

// ─── Onboarding ──────────────────────────────
function checkOnboarding() {
    if (!CFG.username || !CFG.wallet) openOnboarding();
}
function openOnboarding() {
    $('#obUsername').val(CFG.username); $('#obWallet').val(CFG.wallet);
    $('#onboardOverlay').addClass('open');
}
$('#btnOnboard').on('click', () => {
    const u = $('#obUsername').val().trim();
    const w = $('#obWallet').val().trim();
    $('#obUsername, #obWallet').removeClass('input-error');
    if (!u || !w) {
        if (!u) $('#obUsername').addClass('input-error');
        if (!w) $('#obWallet').addClass('input-error');
        showAlert('Username dan Wallet Address wajib diisi sebelum melanjutkan.', 'Data Belum Lengkap', 'warn');
        return;
    }
    if (!EVM_RE.test(w)) {
        $('#obWallet').addClass('input-error');
        showAlert('Wallet Address tidak valid.<br>Format: <b>0x</b> + tepat <b>40</b> karakter hex (0-9, a-f).', 'Format Wallet Salah', 'warn');
        return;
    }
    CFG.username = u; CFG.wallet = w;
    dbSet(LS_SETTINGS, Object.assign({}, CFG));
    $('#topUsername').text('@' + u);
    loadSettings();
    $('#onboardOverlay').removeClass('open');
});

// ─── Tab Lock / Unlock ────────────────────────
function lockTabs() {
    $('#navToken, #navSettings').addClass('disabled');
    $('.top-tab-btn[data-tab="tabToken"], .top-tab-btn[data-tab="tabSettings"]').addClass('disabled');
    $('#monSortBar .sort-btn').addClass('disabled').prop('disabled', true);
}
function unlockTabs() {
    $('#navToken, #navSettings').removeClass('disabled');
    $('.top-tab-btn[data-tab="tabToken"], .top-tab-btn[data-tab="tabSettings"]').removeClass('disabled');
    $('#monSortBar .sort-btn').removeClass('disabled').prop('disabled', false);
}
// ─── Bottom Navigation ───────────────────────
function switchTab(tabId) {
    if (!tabId) return;
    if (scanning && tabId !== 'tabMonitor') return; // locked during scan
    $('.nav-item').removeClass('active');
    $(`.nav-item[data-tab="${tabId}"]`).addClass('active');
    $('.top-tab-btn').removeClass('active');
    $(`.top-tab-btn[data-tab="${tabId}"]`).addClass('active');
    // Signal bar + scan controls hanya di tab Scanner
    const isMonitor = tabId === 'tabMonitor';
    $('#signalBar').css('display', isMonitor ? 'flex' : 'none');
    $('#scanFooter').css('display', isMonitor ? 'flex' : 'none');
    document.body.classList.toggle('no-signal-bar', !isMonitor);
    $('.tab-pane').removeClass('active');
    $('#' + tabId).addClass('active');
    window.scrollTo(0, 0);
    // Reset cache agar data selalu fresh dari localStorage saat pindah tab
    clearTokenCache();
    if (tabId === 'tabToken') { renderTokenList(); renderDexConfig(); }
    if (tabId === 'tabSettings') loadSettings();
    if (tabId === 'tabMonitor' && !scanning) {
        _lastBuildN = 0; // force full rebuild agar hasil scan lama terhapus
        _cardEls.clear();
        buildMonitorRows();
        _monitorNeedsRebuild = false;
    }
}
$('.nav-item[data-tab]').on('click', function () { switchTab($(this).data('tab')); });
$('.top-tab-btn[data-tab]').on('click', function () { switchTab($(this).data('tab')); });

// ─── Bottom Sheet ────────────────────────────
function openSheet(id) {
    resetSheetForm();
    if (id) fillSheetForm(id);
    $('#sheetTitle').text(id ? 'Edit Token' : 'Tambah Token');
    $('#editId').val(id || '');
    $('#sheetOverlay').addClass('open');
    setTimeout(() => $('#tokenSheet').addClass('open'), 10);
}
function closeSheet() {
    $('#tokenSheet').removeClass('open');
    $('#sheetOverlay').removeClass('open');
    $('#acToken, #acPair').hide();
    $('#tokenSheet .form-input').removeClass('input-error');
    $('#chainChips, #cexChips').removeClass('input-error');
}
$('#sheetOverlay, #btnSheetCancel').on('click', closeSheet);
$('#fabAdd').on('click', () => openSheet());
// Auto-hapus highlight error saat user mulai edit field
$('#tokenSheet').on('input change', '.form-input', function () { $(this).removeClass('input-error'); });

// ─── CEX & Chain Chips ───────────────────────
function renderCexChips(selected) {
    const html = Object.entries(CONFIG_CEX).map(([k, v]) =>
        `<span class="chip ${selected === k ? 'selected' : ''}" data-cex="${k}"
      style="${selected === k ? `background:${v.WARNA};` : ''}"
      onclick="selectCex('${k}')">
      <img src="icons/cex/${k}.png" class="chip-icon" onerror="this.style.display='none'">
      ${v.label}
    </span>`
    ).join('');
    $('#cexChips').html(html);
}
function selectCex(key) {
    renderCexChips(key);
    autoFillSymbols();
    const ticker = $('#fTicker').val().trim().toUpperCase();
    const pairTk = $('#fTickerPair').val().trim().toUpperCase();
    if (ticker && !isUsdtNoSymbol(key, ticker)) $('#fSymbolToken').attr('placeholder', 'sandIDR');
    if (pairTk && !isUsdtNoSymbol(key, pairTk)) $('#fSymbolPair').attr('placeholder', 'eduIDR');
}
function selectedCex() { return $('#cexChips .chip.selected').data('cex') || Object.keys(CONFIG_CEX)[0]; }

function renderChainChips(selected) {
    const html = Object.entries(CONFIG_CHAINS).map(([k, v]) =>
        `<span class="chip ${selected === k ? 'selected' : ''}" data-chain="${k}"
      style="${selected === k ? `background:${v.WARNA};` : ''}"
      onclick="selectChain('${k}')">
      <img src="icons/chains/${k}.png" class="chip-icon" onerror="this.style.display='none'">
      ${v.label}
    </span>`
    ).join('');
    $('#chainChips').html(html);
}
function selectChain(key) { renderChainChips(key); }
function selectedChain() { return $('#chainChips .chip.selected').data('chain') || 'bsc'; }

// ─── Auto-fill Symbol ────────────────────────
// USDT as ticker/pair never needs a CEX orderbook — 1 USDT = $1 by definition.
// e.g. Binance would generate invalid "USDTUSDT", Gate "USDT_USDT", etc.
const isUsdtNoSymbol = (_cex, ticker) => ticker.toUpperCase() === 'USDT';

function autoFillSymbols() {
    const cex = selectedCex();
    const ticker = $('#fTicker').val().trim();
    const pairTk = $('#fTickerPair').val().trim();
    const cfg = CONFIG_CEX[cex];

    if (ticker) {
        if (isUsdtNoSymbol(cex, ticker)) {
            $('#fSymbolToken').val('').attr('placeholder', 'USDT — otomatis $1');
        } else {
            $('#fSymbolToken').attr('placeholder', 'sandIDR').val(cfg.symbolFmt(ticker));
        }
    }
    if (pairTk) {
        if (isUsdtNoSymbol(cex, pairTk)) {
            $('#fSymbolPair').val('').attr('placeholder', 'USDT — otomatis $1');
        } else {
            $('#fSymbolPair').attr('placeholder', 'eduIDR').val(cfg.symbolFmt(pairTk));
        }
    }
}

// ─── Autocomplete ────────────────────────────
let acDebounce = null;
let acStore = { token: [], pair: [] };

function onTickerInput(type) {
    clearTimeout(acDebounce);
    autoFillSymbols();
    acDebounce = setTimeout(() => triggerAc(type), 300);
}
async function triggerAc(type) {
    const chain = selectedChain();
    const isToken = type === 'token';
    const q = (isToken ? $('#fTicker') : $('#fTickerPair')).val().trim().toUpperCase();
    const box = isToken ? $('#acToken') : $('#acPair');
    if (!q) { box.hide(); return; }

    box.html('<div class="ac-loading">⏳ Memuat...</div>').show();
    const data = await loadWm(chain);
    const res = data.filter(d =>
        d.ticker.toUpperCase().includes(q) || (d.nama_token || '').toUpperCase().includes(q)
    ).slice(0, 8);

    if (!res.length) { box.html('<div class="ac-loading">Tidak ditemukan — isi manual</div>'); return; }

    acStore[type] = res;
    const scShort = (sc) => sc ? sc.slice(0, 6) + '...' + sc.slice(-4) : '-';

    box.html(res.map((d, i) => `
    <div class="ac-item" data-type="${type}" data-idx="${i}">
      <span class="ac-ticker">${d.ticker}</span>
      <span class="ac-name">${d.nama_token || ''} | dec:${d.decimals} | ${scShort(d.sc)}</span>
    </div>`
    ).join('')).show();
}

$(document).on('click', '.ac-item', function () {
    const type = $(this).data('type');
    const idx = parseInt($(this).data('idx'));
    const d = acStore[type]?.[idx];
    if (d) acSelect(d, type);
});

function acSelect(d, type) {
    // Independent fills: TOKEN AC → only fills TOKEN fields; PAIR AC → only fills PAIR fields
    if (type === 'token') {
        $('#fTicker').val(d.ticker);
        $('#fScToken').val(d.sc || '');
        $('#fDecToken').val(d.decimals || 18);
        $('#acToken').hide();
    } else {
        $('#fTickerPair').val(d.ticker);
        $('#fScPair').val(d.sc || '');
        $('#fDecPair').val(d.decimals || 18);
        $('#acPair').hide();
    }
    autoFillSymbols();
}
async function loadWm(chain) {
    if (wmCache[chain]) return wmCache[chain];
    try {
        const url = CONFIG_CHAINS[chain]?.DATAJSON;
        if (!url) return [];
        const r = await fetch(url);
        wmCache[chain] = await r.json();
        return wmCache[chain];
    } catch { return []; }
}
$(document).on('click', function (e) {
    if (!$(e.target).closest('.ac-wrap').length) {
        $('#acToken,#acPair').hide();
    }
});

// ─── Sheet Form ──────────────────────────────
function _renderDexModalPerToken(dexModals) {
    const dm = dexModals || {};
    const html = getEnabledDexList().map(def => {
        const bulkCtD = CFG.dex?.[def.key]?.modalCtD || '';
        const bulkDtC = CFG.dex?.[def.key]?.modalDtC || '';
        const bulkPnl = CFG.dex?.[def.key]?.minPnl    || '';
        const ctdVal  = dm[def.key]?.ctd != null ? dm[def.key].ctd : '';
        const dtcVal  = dm[def.key]?.dtc != null ? dm[def.key].dtc : '';
        const pnlVal  = dm[def.key]?.pnl != null ? dm[def.key].pnl : '';
        const hasOverride = dm[def.key] != null;
        return `<div class="dex-modal-per-row${hasOverride ? ' dex-row-overridden' : ''}">
          <span class="dex-modal-per-badge dex-badge-${def.key}">${def.badge}</span>
          <span class="dex-modal-per-name">${def.label}</span>
          <div class="dex-modal-per-inputs">
            <div class="dex-modal-per-field">
              <span class="dex-modal-per-lbl">↑ CEX→DEX ($)</span>
              <input class="form-input dex-modal-inp" id="fDexCtD_${def.key}" data-dex="${def.key}" data-dir="ctd"
                type="number" min="1" placeholder="${bulkCtD || 'bulk'}" value="${ctdVal}">
            </div>
            <div class="dex-modal-per-field">
              <span class="dex-modal-per-lbl">↓ DEX→CEX ($)</span>
              <input class="form-input dex-modal-inp" id="fDexDtC_${def.key}" data-dex="${def.key}" data-dir="dtc"
                type="number" min="1" placeholder="${bulkDtC || 'bulk'}" value="${dtcVal}">
            </div>
            <div class="dex-modal-per-field dex-pnl-field">
              <span class="dex-modal-per-lbl">💰 Min PnL ($)</span>
              <input class="form-input dex-modal-inp" id="fDexPnl_${def.key}" data-dex="${def.key}" data-dir="pnl"
                type="number" min="0" step="0.1" placeholder="${bulkPnl || 'bulk'}" value="${pnlVal}">
            </div>
          </div>
        </div>`;
    }).join('');
    document.getElementById('dexModalPerToken').innerHTML = html;
}

function resetSheetForm() {
    $('#fTicker,#fSymbolToken,#fScToken,#fTickerPair,#fSymbolPair,#fScPair').val('');
    $('#fDecToken,#fDecPair').val(18);
    _renderDexModalPerToken({});
    renderCexChips('binance'); renderChainChips('bsc');
    $('#acToken,#acPair').hide();
}
function fillSheetForm(id) {
    const t = getTokens().find(x => x.id === id);
    if (!t) return;
    $('#fTicker').val(t.ticker); $('#fSymbolToken').val(t.symbolToken);
    $('#fScToken').val(t.scToken); $('#fDecToken').val(t.decToken);
    $('#fTickerPair').val(t.tickerPair); $('#fSymbolPair').val(t.symbolPair);
    $('#fScPair').val(t.scPair); $('#fDecPair').val(t.decPair);
    _renderDexModalPerToken(t.dexModals || {});
    renderCexChips(t.cex); renderChainChips(t.chain);
}

$('#btnSheetSave').on('click', () => {
    const ticker = $('#fTicker').val().trim().toUpperCase();
    const cex = selectedCex();
    const symbolToken = $('#fSymbolToken').val().trim().toUpperCase();
    const scToken = $('#fScToken').val().trim();
    const decTokenRaw = $('#fDecToken').val();
    const decToken = parseInt(decTokenRaw);
    const tickerPairRaw = $('#fTickerPair').val().trim().toUpperCase();
    const symbolPair = $('#fSymbolPair').val().trim().toUpperCase();
    const scPair = $('#fScPair').val().trim();
    const decPairRaw = $('#fDecPair').val();
    const decPair = parseInt(decPairRaw);
    const chain = selectedChain();

    // Hapus highlight error sebelumnya
    $('#tokenSheet .form-input').removeClass('input-error');
    $('#chainChips, #cexChips').removeClass('input-error');

    // Kumpulkan error: [fieldId, pesan]
    const errs = [];
    if (!cex) errs.push(['cexChips', 'Exchanger (CEX) belum dipilih']);
    if (!chain) errs.push(['chainChips', 'Network (Chain) belum dipilih']);

    // TOKEN — semua wajib
    if (!ticker)
        errs.push(['fTicker', 'Symbol TOKEN wajib diisi']);
    else if (!/^[A-Z0-9]+$/.test(ticker))
        errs.push(['fTicker', 'Symbol TOKEN hanya huruf/angka (A-Z, 0-9)']);

    if (!symbolToken && !isUsdtNoSymbol(cex, ticker))
        errs.push(['fSymbolToken', 'Ticker CEX Token wajib diisi']);

    if (!scToken)
        errs.push(['fScToken', 'SC Token wajib diisi']);
    else if (!/^0x[0-9a-fA-F]{40}$/.test(scToken))
        errs.push(['fScToken', 'SC Token tidak valid — harus 0x + tepat 40 karakter hex']);

    if (decTokenRaw === '' || isNaN(decToken) || decToken < 0 || decToken > 30)
        errs.push(['fDecToken', 'Decimal Token harus angka antara 0–30']);

    // PAIR — opsional untuk stablecoin (USDT)
    // Jika Symbol PAIR kosong → default pair = stablecoin (USDT), SC auto-fill dari USDT_SC
    if (tickerPairRaw && !/^[A-Z0-9]+$/.test(tickerPairRaw))
        errs.push(['fTickerPair', 'Symbol PAIR hanya huruf/angka (A-Z, 0-9)']);

    const tickerPair = tickerPairRaw || ticker;
    const isPairUsdt = tickerPair.toUpperCase() === 'USDT';
    const isPairSame = tickerPair === ticker;
    const pairNeedsData = !isPairSame && !isPairUsdt;

    // Jika PAIR bukan USDT dan bukan sama dgn TOKEN → data pair wajib lengkap
    if (pairNeedsData) {
        if (!symbolPair)
            errs.push(['fSymbolPair', 'Ticker CEX Pair wajib diisi jika PAIR bukan USDT']);
        if (!scPair)
            errs.push(['fScPair', 'SC Pair wajib diisi jika PAIR bukan USDT']);
        else if (!/^0x[0-9a-fA-F]{40}$/.test(scPair))
            errs.push(['fScPair', 'SC Pair tidak valid — harus 0x + tepat 40 karakter hex']);
    } else if (scPair && !/^0x[0-9a-fA-F]{40}$/.test(scPair)) {
        errs.push(['fScPair', 'SC Pair tidak valid — harus 0x + tepat 40 karakter hex']);
    }

    if (decPairRaw === '' || isNaN(decPair) || decPair < 0 || decPair > 30)
        errs.push(['fDecPair', 'Decimal Pair harus angka antara 0–30']);

    // Validasi per-DEX: jika diisi harus angka > 0
    getEnabledDexList().forEach(def => {
        const ctdRaw = ($(`#fDexCtD_${def.key}`).val() || '').trim();
        const dtcRaw = ($(`#fDexDtC_${def.key}`).val() || '').trim();
        const pnlRaw = ($(`#fDexPnl_${def.key}`).val() || '').trim();
        if (ctdRaw !== '' && (isNaN(parseFloat(ctdRaw)) || parseFloat(ctdRaw) <= 0))
            errs.push([`fDexCtD_${def.key}`, `Modal ${def.label} CEX→DEX harus > 0 atau dikosongkan`]);
        if (dtcRaw !== '' && (isNaN(parseFloat(dtcRaw)) || parseFloat(dtcRaw) <= 0))
            errs.push([`fDexDtC_${def.key}`, `Modal ${def.label} DEX→CEX harus > 0 atau dikosongkan`]);
        if (pnlRaw !== '' && (isNaN(parseFloat(pnlRaw)) || parseFloat(pnlRaw) < 0))
            errs.push([`fDexPnl_${def.key}`, `Min PnL ${def.label} harus ≥ 0 atau dikosongkan`]);
    });


    if (errs.length) {
        errs.forEach(([id]) => $('#' + id).addClass('input-error'));
        const firstEl = document.getElementById(errs[0][0]);
        if (firstEl) firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showAlertList(errs.map(e => e[1]), 'Validasi Form');
        return;
    }

    // Kumpulkan modal & pnl per-DEX (hanya yang diisi = override, kosong = ikut bulk)
    const dexModals = {};
    getEnabledDexList().forEach(def => {
        const ctdRaw = ($(`#fDexCtD_${def.key}`).val() || '').trim();
        const dtcRaw = ($(`#fDexDtC_${def.key}`).val() || '').trim();
        const pnlRaw = ($(`#fDexPnl_${def.key}`).val() || '').trim();
        const ctd = ctdRaw !== '' ? parseFloat(ctdRaw) : null;
        const dtc = dtcRaw !== '' ? parseFloat(dtcRaw) : null;
        const pnl = pnlRaw !== '' ? parseFloat(pnlRaw) : null;
        if (ctd !== null || dtc !== null || pnl !== null) {
            dexModals[def.key] = {};
            if (ctd !== null) dexModals[def.key].ctd = ctd;
            if (dtc !== null) dexModals[def.key].dtc = dtc;
            if (pnl !== null) dexModals[def.key].pnl = pnl;
        }
    });

    const tokens = getTokens();
    const id = $('#editId').val() || genId();
    const idx = tokens.findIndex(x => x.id === id);
    const tok = {
        id, ticker, cex, symbolToken, scToken, decToken,
        tickerPair, symbolPair, scPair, decPair,
        chain, dexModals,
        favorite: (idx >= 0 && tokens[idx].favorite) ? true : false,
    };
    if (idx >= 0) tokens[idx] = tok; else tokens.push(tok);
    saveTokens(tokens);
    renderTokenList();
    if (scanning) {
        showToast((idx >= 0 ? '✅ Koin diperbarui' : '✅ Koin ditambahkan') + ' — berlaku pada putaran berikutnya');
    } else {
        showToast(idx >= 0 ? '✅ Data koin berhasil diperbarui' : '✅ Data koin berhasil ditambahkan');
    }
    closeSheet();
});

// ─── Token List ──────────────────────────────
function isValidToken(t) {
    return !!(t.ticker && t.scToken && CONFIG_CEX[t.cex] && CONFIG_CHAINS[t.chain] &&
        (t.symbolToken || isUsdtNoSymbol(t.cex, t.ticker)));
}

let tokenSort = 'az'; // 'az' | 'za'
let tokenSearchQuery = '';
let _monitorNeedsRebuild = false; // flag: rebuild monitor saat kembali ke tab Scanner
let tokenFavFilter = false;
let tokenRenderLimit = 50;
let _renderDebounce = null;

function renderTokenList() {
    let tokens = getTokens();
    tokens = tokens.filter(t => {
        const cexOk = CFG.activeCex.length === 0 || CFG.activeCex.includes(t.cex);
        const chainOk = CFG.activeChains.length === 0 || CFG.activeChains.includes(t.chain);
        const pairTk = (t.tickerPair || 'USDT').toUpperCase();
        const isStable = STABLE_COINS.has(pairTk);
        const pairOk = CFG.pairType === 'all' || (CFG.pairType === 'stable' ? isStable : !isStable);
        return cexOk && chainOk && pairOk;
    });
    if (tokenSort === 'za') tokens = tokens.sort((a, b) => (b.ticker || '').localeCompare(a.ticker || ''));
    else tokens = tokens.sort((a, b) => (a.ticker || '').localeCompare(b.ticker || ''));
    if (tokenSearchQuery) {
        const q = tokenSearchQuery.toLowerCase();
        tokens = tokens.filter(t => {
            const ticker = (t.ticker || '').toLowerCase();
            const pair = (t.tickerPair || '').toLowerCase();
            const cex = (CONFIG_CEX[t.cex]?.label || t.cex || '').toLowerCase();
            const chain = (CONFIG_CHAINS[t.chain]?.label || t.chain || '').toLowerCase();
            return ticker.includes(q) || pair.includes(q) || cex.includes(q) || chain.includes(q);
        });
    }
    if (tokenFavFilter) tokens = tokens.filter(t => t.favorite);
    const favCount = tokens.filter(t => t.favorite).length;
    $('#tokenCount').text('TOTAL ' + tokens.length + ' KOIN');
    $('#favCount').text(favCount > 0 ? `⭐ ${favCount}/${tokens.length}` : '');
    const displayTokens = tokens.slice(0, tokenRenderLimit);
    if (!displayTokens.length) {
        $('#tokenList').html('<div class="token-list-empty">Belum ada token. Ketuk + untuk menambah.</div>');
    } else {
        let html = displayTokens.map(t => {
            const cexCfg = CONFIG_CEX[t.cex] || {};
            const chainCfg = CONFIG_CHAINS[t.chain] || {};
           // const tri = t.tickerPair && t.tickerPair !== t.ticker ? '↔️' : '→';
            const valid = isValidToken(t);
            const invalidBadge = valid ? '' : ' <span class="token-invalid-badge">⚠ Data kurang</span>';
            // WD/DP status icons inline (seperti header scanner)
            const _hasCexData = typeof getCexTokenStatus === 'function';
            const _stTok  = _hasCexData ? getCexTokenStatus(t.cex, t.ticker, t.chain, 1) : null;
            const _pairTk = (t.tickerPair || 'USDT').toUpperCase();
            const _stPair = _hasCexData ? getCexTokenStatus(t.cex, _pairTk, t.chain, 1) : null;
            const _wf     = t.cex !== 'indodax' && typeof isCexWalletFetched === 'function' && isCexWalletFetched(t.cex);
            const _icTok  = _wdpIcons(_stTok, _wf, t.cex, t.ticker);
            const _icPair = _wdpIcons(_stPair, _wf, t.cex, _pairTk);
            return `
    <div class="token-list-item${valid ? '' : ' token-invalid'}" id="li-${t.id}">
      <div class="token-list-row">
        <div class="token-list-badges">
          <div class="token-list-sym">
            <span class="tl-tok-name">${t.ticker}<span class="wdp-ic">${_icTok}</span></span>
            <span class="tl-tok-name">${t.tickerPair || t.ticker}<span class="wdp-ic">${_icPair}</span></span>
            ${invalidBadge}
          </div>
          <span class="badge-cex" style="background:${cexCfg.WARNA || '#555'}">
             ${cexCfg.label || t.cex}
          </span>
          <span class="badge-chain" style="background:${chainCfg.WARNA || '#555'}">
            ${chainCfg.label || t.chain}
          </span>
           <div class="token-list-actions-bar">
        <button class="tok-fav btn-icon ${t.favorite ? 'fav-active' : ''}" onclick="toggleFavorite('${t.id}')" title="Favorit">⭐</button>
        <button class="btn-icon" onclick="openSheet('${t.id}')">✏️</button>
        <button class="btn-icon danger" onclick="deleteToken('${t.id}')">🗑️</button>
      </div>
        </div>
        
        <div class="token-list-info">
          <div class="tl-dex-table">
            <span class="tl-dex-th"></span>
            <span class="tl-dex-th">CEX</span>
            <span class="tl-dex-th">DEX</span>
            <span class="tl-dex-th">PNL</span>
            ${getEnabledDexList().map(def => {
                const dm     = t.dexModals?.[def.key];
                const bulk   = CFG.dex?.[def.key] || {};
                const ctd    = dm?.ctd ?? bulk.modalCtD ?? '?';
                const dtc    = dm?.dtc ?? bulk.modalDtC ?? '?';
                const pnl    = dm?.pnl ?? t.minPnl ?? bulk.minPnl ?? null;
                const isOver = dm?.ctd != null || dm?.dtc != null;
                const pnlTxt = pnl != null ? `$${pnl}` : '-';
                return `<span class="tl-dex-tb tl-dex-badge-${def.key}${isOver ? ' tl-over' : ''}" title="${def.label}${isOver ? ' (override)' : ' (bulk)'}">${def.badge}</span>
                  <span class="tl-dex-tc tl-dex-tc-ctd">$${ctd}</span>
                  <span class="tl-dex-tc tl-dex-tc-dtc">$${dtc}</span>
                  <span class="tl-dex-tc tl-dex-tc-pnl">${pnlTxt}</span>`;
            }).join('')}
          </div>
        </div>
      </div>
     
    </div>`;
        }).join('');
        if (tokens.length > tokenRenderLimit) {
            const remaining = tokens.length - tokenRenderLimit;
            html += `<div class="load-more-wrap"><button class="btn-load-more" id="btnLoadMore">Tampilkan ${Math.min(remaining, 50)} lagi (${remaining} tersisa)</button></div>`;
        }
        $('#tokenList').html(html);
    }
    if (!scanning) {
        // Hanya rebuild monitor jika tab Scanner aktif; jika tidak, tandai perlu rebuild
        if ($('#tabMonitor').hasClass('active')) {
            buildMonitorRows();
        } else {
            _monitorNeedsRebuild = true;
        }
    }
    updateScanCount();
}

function deleteToken(id) {
    const tok = getTokens().find(x => x.id === id);
    const name = tok ? tok.ticker : 'token ini';
    showConfirm(
        `Koin <b>${name}</b> akan dihapus permanen dan tidak bisa dikembalikan.`,
        'Hapus Koin',
        'Hapus',
        () => {
            saveTokens(getTokens().filter(x => x.id !== id));
            if (scanning) {
                // Saat scanning: hapus card & chip dari DOM saja, jangan rebuild semua
                const card = document.getElementById('card-' + id);
                if (card) card.remove();
                const chip = document.getElementById('chip-' + id);
                if (chip) chip.remove();
                updateScanCount();
                // Force update count on stop button during scanning
                const remaining = getFilteredTokens().length;
                $('#btnScanCount').text('[' + remaining + ' KOIN ]');
                showToast(`🗑️ ${name} dihapus — berlaku pada putaran berikutnya`);
            } else {
                renderTokenList();
            }
        }
    );
}

// ─── CSV Export / Import ─────────────────────
// Kolom inti token (tidak termasuk dexModals — di-expand per-DEX di bawah)
const CSV_BASE_COLS = ['ticker', 'cex', 'symbolToken', 'scToken', 'decToken', 'tickerPair', 'symbolPair', 'scPair', 'decPair', 'chain', 'favorite'];
// Kolom info tambahan untuk export (read-only dari cache, tidak dipakai saat import)
const CSV_EXTRA_COLS = ['feeWd_token_usdt', 'feeWd_pair_usdt', 'wd_token_ok', 'dp_pair_ok'];
// Kolom per-DEX: dex_[key]_ctd, dex_[key]_dtc, dex_[key]_pnl
const _csvDexCols = () => DEX_LIST.flatMap(d => [
    `dex_${d.key}_ctd`, `dex_${d.key}_dtc`, `dex_${d.key}_pnl`
]);

$('#btnExport').on('click', () => {
    const tokens = getTokens();
    const dexCols = _csvDexCols();
    const allCols = [...CSV_BASE_COLS, ...dexCols, ...CSV_EXTRA_COLS];
    const rows = [allCols.join(','), ...tokens.map(t => {
        // Kolom inti
        const base = CSV_BASE_COLS.map(c => `"${t[c] ?? ''}"`);
        // Kolom per-DEX modal & PNL
        const dexVals = DEX_LIST.flatMap(d => {
            const dm = t.dexModals?.[d.key] || {};
            const bulk = CFG.dex?.[d.key] || {};
            const ctd = dm.ctd ?? bulk.modalCtD ?? '';
            const dtc = dm.dtc ?? bulk.modalDtC ?? '';
            const pnl = dm.pnl ?? bulk.minPnl ?? '';
            return [`"${ctd}"`, `"${dtc}"`, `"${pnl}"`];
        });
        // Kolom info fee WD dari cache (informatif saja)
        let feeWdTok = '', feeWdPair = '', wdOk = '', dpOk = '';
        if (typeof getCexTokenStatus === 'function') {
            const stTok = getCexTokenStatus(t.cex, t.ticker, t.chain, 1);
            const stPair = getCexTokenStatus(t.cex, t.tickerPair || 'USDT', t.chain, 1);
            if (stTok)  { feeWdTok = stTok.feeWd;  wdOk = stTok.withdrawEnable ? '1' : '0'; }
            if (stPair) { feeWdPair = stPair.feeWd; dpOk = stPair.depositEnable ? '1' : '0'; }
        }
        return [...base, ...dexVals, `"${feeWdTok}"`, `"${feeWdPair}"`, `"${wdOk}"`, `"${dpOk}"`].join(',');
    })];
    const csvContent = rows.join('\n');

    // Android WebView: blob URL download tidak didukung — pakai native bridge
    if (window.AndroidBridge) {
        window.AndroidBridge.saveFile('monitoring-tokens.csv', csvContent);
        return;
    }

    // Browser biasa: gunakan blob download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'monitoring-tokens.csv'; a.click();
});
$('#btnImportTrigger').on('click', () => $('#importFile').click());
// Parser CSV yang benar: menangani cell kosong, quoted value, dan CRLF
function parseCSVLine(line) {
    const result = [];
    let i = 0, val = '';
    while (i < line.length) {
        if (line[i] === '"') {
            i++;
            while (i < line.length) {
                if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; } // escaped quote
                else if (line[i] === '"') { i++; break; }
                else { val += line[i++]; }
            }
            // skip trailing chars until comma
            while (i < line.length && line[i] !== ',') i++;
        } else if (line[i] === ',') {
            result.push(val.trim());
            val = ''; i++;
            continue;
        } else {
            val += line[i++];
        }
        if (i < line.length && line[i] === ',') { result.push(val.trim()); val = ''; i++; }
    }
    result.push(val.replace(/\r/g, '').trim()); // last field
    return result;
}

$('#importFile').on('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
        try {
            const lines = ev.target.result.trim().split(/\r?\n/);
            // Baca header — strip BOM, quotes, whitespace
            const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').replace(/["\r]/g, '').trim());
            // Validasi: header 'ticker' harus ada
            if (!headers.includes('ticker')) {
                showAlert('Baris pertama file harus berisi header kolom dan minimal ada kolom <b>ticker</b>.', 'Format CSV Salah', 'error');
                return;
            }
            // Kolom extra (fee WD info) — diabaikan saat import, hanya untuk referensi
            const SKIP_COLS = new Set(['feeWd_token_usdt', 'feeWd_pair_usdt', 'wd_token_ok', 'dp_pair_ok']);
            // Kolom dex per-key yang akan di-parse ke dexModals
            const DEX_KEYS = DEX_LIST.map(d => d.key);

            // Parse semua baris CSV menjadi objek token
            const incoming = lines.slice(1)
                .filter(line => line.trim())
                .map(line => {
                    const vals = parseCSVLine(line);
                    const raw = {};
                    headers.forEach((h, i) => {
                        if (!SKIP_COLS.has(h)) raw[h] = (vals[i] ?? '').replace(/["\r]/g, '').trim();
                    });
                    // Bangun dexModals dari kolom dex_[key]_ctd/dtc/pnl
                    const dexModals = {};
                    DEX_KEYS.forEach(key => {
                        const ctd = parseFloat(raw[`dex_${key}_ctd`]);
                        const dtc = parseFloat(raw[`dex_${key}_dtc`]);
                        const pnl = parseFloat(raw[`dex_${key}_pnl`]);
                        if (isFinite(ctd) || isFinite(dtc) || isFinite(pnl)) {
                            dexModals[key] = {};
                            if (isFinite(ctd)) dexModals[key].ctd = ctd;
                            if (isFinite(dtc)) dexModals[key].dtc = dtc;
                            if (isFinite(pnl)) dexModals[key].pnl = pnl;
                        }
                        delete raw[`dex_${key}_ctd`];
                        delete raw[`dex_${key}_dtc`];
                        delete raw[`dex_${key}_pnl`];
                    });
                    raw.dexModals = dexModals;
                    raw.decToken = parseInt(raw.decToken) || 18;
                    raw.decPair  = parseInt(raw.decPair)  || 18;
                    raw.favorite = String(raw.favorite).toLowerCase() === 'true';
                    return raw;
                })
                .filter(t => t.ticker);

            if (!incoming.length) {
                showAlert('Tidak ada baris data koin yang valid di dalam file CSV.', 'Import Gagal', 'error');
                return;
            }

            // Upsert: cocokkan berdasarkan scToken + scPair + chain + cex
            const existing = getTokens();
            // Key: scToken|scPair|chain|cex (semua lowercase/trim untuk konsistensi)
            const makeKey = t => [
                (t.scToken  || '').toLowerCase().trim(),
                (t.scPair   || '').toLowerCase().trim(),
                (t.chain    || '').toLowerCase().trim(),
                (t.cex      || '').toLowerCase().trim()
            ].join('|');

            const resultMap = new Map(existing.map(t => [makeKey(t), t]));
            let added = 0, updated = 0;

            incoming.forEach(tok => {
                const key = makeKey(tok);
                if (resultMap.has(key)) {
                    // Update: timpa semua field kecuali id & favorite
                    const prev = resultMap.get(key);
                    resultMap.set(key, { ...tok, id: prev.id, favorite: prev.favorite });
                    updated++;
                } else {
                    // Tambah baru
                    resultMap.set(key, { ...tok, id: genId() });
                    added++;
                }
            });

            saveTokens([...resultMap.values()]);
            renderTokenList();
            const parts = [];
            if (added)   parts.push(`${added} koin baru`);
            if (updated) parts.push(`${updated} diperbarui`);
            showToast(`✅ Import: ${parts.join(', ')}`);
        } catch (err) { showAlert('Terjadi kesalahan saat membaca file:<br>' + err.message, 'Error Import', 'error'); }
    };
    r.readAsText(f);
    e.target.value = '';
});


// ─── Favorite Toggle ──────────────────────────
function toggleFavorite(id) {
    const tokens = getTokens();
    const idx = tokens.findIndex(t => t.id === id);
    if (idx < 0) return;
    tokens[idx].favorite = !tokens[idx].favorite;
    saveTokens(tokens);
    // Jika filter fav aktif di tab koin, re-render agar item hilang/muncul sesuai filter
    if (tokenFavFilter) { renderTokenList(); return; }
    // Update visual without full rebuild
    const monBtn = document.querySelector(`#card-${id} .mon-fav`);
    if (monBtn) monBtn.classList.toggle('fav-active', tokens[idx].favorite);
    const tokBtn = document.querySelector(`#li-${id} .tok-fav`);
    if (tokBtn) tokBtn.classList.toggle('fav-active', tokens[idx].favorite);
}

// ─── Monitor Cards Build ──────────────────────
const MON_CTD_COLOR = '#4a9a6a'; // hijau CEXtoDEX (beli CEX, jual DEX)
const MON_DTC_COLOR = '#c0504d'; // merah DEXtoCEX (beli DEX, jual CEX)

// ─── WD/DP Badge HTML (build-time, dari cache) ────────────
// Dipanggil saat buildMonitorRows & renderTokenList
// Mengembalikan HTML badge WD/WX, DP/DX per token+pair
function _buildWdBadgeHtml(cex, ticker, pairTicker, chain) {
    if (typeof getCexTokenStatus !== 'function') return '';
    const stTok  = getCexTokenStatus(cex, ticker, chain, 1);
    const stPair = (pairTicker && pairTicker.toUpperCase() !== 'USDT')
        ? getCexTokenStatus(cex, pairTicker, chain, 1) : null;

    if (!stTok && !stPair) return '<span class="wd-b wd-na">? WD &nbsp; ? DP</span>';

    const parts = [];
    if (stTok) {
        const wdOk = stTok.withdrawEnable;
        const dpOk = stTok.depositEnable;
        parts.push(`<span class="wd-b ${wdOk ? 'wd-ok' : 'wd-fail'}">${wdOk ? 'WD' : 'WX'} ${ticker}</span>`);
        parts.push(`<span class="wd-b ${dpOk ? 'wd-ok' : 'wd-fail'}">${dpOk ? 'DP' : 'DX'} ${ticker}</span>`);
    }
    if (stPair) {
        const wdOk = stPair.withdrawEnable;
        const dpOk = stPair.depositEnable;
        parts.push(`<span class="wd-b ${wdOk ? 'wd-ok' : 'wd-fail'}">${wdOk ? 'WD' : 'WX'} ${pairTicker}</span>`);
        parts.push(`<span class="wd-b ${dpOk ? 'wd-ok' : 'wd-fail'}">${dpOk ? 'DP' : 'DX'} ${pairTicker}</span>`);
    }
    return parts.join('');
}

// WD/DP status icons: [WD_icon][DP_icon]
// WD=withdraw, DP=deposit — ✅ terbuka, ⛔ ditutup, ? belum ada data
// ticker (optional): jika ada, badge dijadikan link ke halaman WD/DP CEX
function _wdpIcons(status, walletFetched, cexKey, ticker) {
    // Indodax: API tidak menyediakan status WD/DP asli → selalu ??
    if (cexKey === 'indodax') return '<span class="wdp-ic-inner wdp-na">??</span>';
    if (!status) return walletFetched
        ? '<span class="wdp-ic-inner wdp-unsupported"><span class="wdp-fail">WX</span> <span class="wdp-fail">DX</span></span>'
        : '<span class="wdp-ic-inner wdp-na">??</span>';
    const wdOk = status.withdrawEnable;
    const dpOk = status.depositEnable;
    const cexLbl = CONFIG_CEX[cexKey]?.label || cexKey;
    const coin = (ticker || '').toUpperCase();
    const wdUrl = ticker ? _getCexWithdrawUrl(cexKey, ticker) : '';
    const dpUrl = ticker ? _getCexDepositUrl(cexKey, ticker) : '';
    const wdSpan = `<span class="${wdOk ? 'wdp-ok' : 'wdp-fail'}">${wdOk ? 'WD' : 'WX'}</span>`;
    const dpSpan = `<span class="${dpOk ? 'wdp-ok' : 'wdp-fail'}">${dpOk ? 'DP' : 'DX'}</span>`;
    const wdHtml = wdUrl ? `<a href="${wdUrl}" target="_blank" rel="noopener" class="wdp-link" title="Withdraw ${coin} di ${cexLbl}" onclick="event.stopPropagation()">${wdSpan}</a>` : wdSpan;
    const dpHtml = dpUrl ? `<a href="${dpUrl}" target="_blank" rel="noopener" class="wdp-link" title="Deposit ${coin} di ${cexLbl}" onclick="event.stopPropagation()">${dpSpan}</a>` : dpSpan;
    return `<span class="wdp-ic-inner">${wdHtml} ${dpHtml}</span>`;
}

// ─── Monitor card helpers ──────────────────────
// Dibuat sekali di module scope agar tidak re-alloc tiap buildMonitorRows
let _lastBuildN = 0; // track column count; rebuild if changed

function _dexHdrCols(pfx, color, tokId, n) {
    let s = '';
    for (let i = 0; i < n; i++)
        s += `<td class="mon-dex-hdr" data-${pfx}-hdr="${i}" data-tok="${tokId}" data-dir="${pfx}" style="background:${color};cursor:pointer">-</td>`;
    return s;
}
function _dexDataCols(pfx, attr, n) {
    let s = '';
    for (let i = 0; i < n; i++) s += `<td class="mon-dex-cell" data-${pfx}-${attr}="${i}">-</td>`;
    return s;
}

function _buildSingleCard(t, n) {
    const cc = CONFIG_CEX[t.cex] || {};
    const ch = CONFIG_CHAINS[t.chain] || {};
    const pairTk = t.tickerPair || t.ticker;
    const chainColor = ch.WARNA || '#555';
    const _hasCexSt = typeof getCexTokenStatus === 'function';
    const _stTok  = _hasCexSt ? getCexTokenStatus(t.cex, t.ticker, t.chain, 1) : null;
    const _stPair = _hasCexSt ? getCexTokenStatus(t.cex, pairTk, t.chain, 1) : null;
    const _wf     = t.cex !== 'indodax' && typeof isCexWalletFetched === 'function' && isCexWalletFetched(t.cex);
    const _icTok  = _wdpIcons(_stTok, _wf, t.cex, t.ticker);
    const _icPair = _wdpIcons(_stPair, _wf, t.cex, pairTk);
    const _cexKey = t.cex.toUpperCase();
    const _walletInfo = ch.WALLET_CEX && ch.WALLET_CEX[_cexKey];
    const _explorerBase = ch.URL_Chain || '';
    function _mkStokLinks(sc, label) {
        if (!sc || !_walletInfo || !_explorerBase) return label;
        const addrs = [_walletInfo.address, _walletInfo.address2, _walletInfo.address3].filter(Boolean);
        const icons = addrs.map((addr, i) => {
            const url = `${_explorerBase}/token/${sc}?a=${addr}`;
            const tip = `Stok ${label} ${cc.label||t.cex}${i>0?' #'+(i+1):''} — klik buka di explorer`;
            return `<a href="${url}" target="_blank" rel="noopener" class="stok-link" title="${tip}" onclick="event.stopPropagation()"> 📦</a>`;
        }).join('');
        return `<span class="stok-name">${label}</span>${icons}`;
    }
    const _stokCtd = _mkStokLinks(t.scToken, t.ticker);
    const _stokDtc = _mkStokLinks(t.scPair, pairTk);
    const _pairScInfo = t.scPair || (pairTk.toUpperCase() === 'USDT' ? (ch.USDT_SC || '') : '');
    const _tokInfoUrl  = _explorerBase && t.scToken  ? `${_explorerBase}/token/${t.scToken}` : '';
    const _pairInfoUrl = _explorerBase && _pairScInfo ? `${_explorerBase}/token/${_pairScInfo}` : '';
    const _tokNameHtml  = _tokInfoUrl  ? `<a href="${_tokInfoUrl}"  target="_blank" rel="noopener" class="tok-info-link" onclick="event.stopPropagation()">${t.ticker}</a>`  : t.ticker;
    const _pairNameHtml = _pairInfoUrl ? `<a href="${_pairInfoUrl}" target="_blank" rel="noopener" class="tok-info-link" onclick="event.stopPropagation()">${pairTk}</a>` : pairTk;
    const _dflChain = { 56:'bsc', 1:'ethereum', 137:'polygon', 42161:'arbitrum', 8453:'base' }[ch.Kode_Chain] || '';
    const _dflUrl = (_dflChain && t.scToken && _pairScInfo)
        ? `https://swap.defillama.com/?chain=${_dflChain}&from=${t.scToken}&to=${_pairScInfo}`
        : '';
    const _dflLink = _dflUrl
        ? `<a href="${_dflUrl}" target="_blank" rel="noopener" class="dfl-link" title="Swap di DefiLlama (${t.ticker}→${pairTk})" onclick="event.stopPropagation()">DFL</a>`
        : '';

    const div = document.createElement('div');
    div.className = 'mon-card';
    div.id = 'card-' + t.id;
    div.style.borderLeft = `3px solid ${chainColor}`;
    div.innerHTML =
`<div class="mon-card-hdr" style="background:linear-gradient(135deg,${chainColor}55 0%,${chainColor}20 100%);border-bottom:2px solid ${chainColor}88">
  <span class="mon-sym">
    <span class="mon-num">0</span>
    <span class="mon-tok-name">${_tokNameHtml}<span class="wdp-ic" id="wdic-tok-${t.id}">${_icTok}</span></span>
    <span class="mon-vs">↔️</span>
    <span class="mon-tok-name">${_pairNameHtml}<span class="wdp-ic" id="wdic-pair-${t.id}">${_icPair}</span></span>
  </span>
  <span class="mon-card-actions">
    <span class="mon-cex-label" style="background:${cc.WARNA||'#555'}">${(cc.label||t.cex).toUpperCase()}</span>
    ${_dflLink}
    <span class="mon-chain-label" style="background:${chainColor}">${ch.label||t.chain.toUpperCase()}</span>
    <button class="btn-icon mon-act mon-fav ${t.favorite?'fav-active':''}" onclick="toggleFavorite('${t.id}')" title="Favorit">⭐</button>
    <button class="btn-icon mon-act" onclick="openSheet('${t.id}')" title="Edit Koin">✏️</button>
    <button class="btn-icon danger mon-act" onclick="deleteToken('${t.id}')" title="Hapus Koin">🗑️</button>
  </span>
</div>
<div class="mon-tables-wrap">
<div class="mon-table-scroll"><table class="mon-sub-table ctd-table">
  <thead><tr class="mon-sub-hdr">
    <td class="mon-lbl-hdr" style="background:${MON_CTD_COLOR}">${_stokCtd}<span class="hdr-amt" data-modal-hdr="ctd"><span class="tbl-status"></span></span></td>
    ${_dexHdrCols('ctd',MON_CTD_COLOR,t.id,n)}
  </tr></thead>
  <tbody>
    <tr class="mon-row-cex"><td class="mon-lbl-side"><span style='color:green;'>BELI [${t.ticker}]</span></td>${_dexDataCols('ctd','cex',n)}</tr>
    <tr class="mon-row-dex"><td class="mon-lbl-side"><span style='color:red;'>${t.ticker}→${pairTk}</span></td>${_dexDataCols('ctd','dex',n)}</tr>
    <tr class="mon-row-recv"><td class="mon-lbl-side">ALL FEE</td>${_dexDataCols('ctd','fee',n)}</tr>
    <tr class="mon-row-pnl"><td class="mon-lbl-side">💰 PNL</td>${_dexDataCols('ctd','pnl',n)}</tr>
  </tbody>
</table></div>
<div class="mon-table-scroll"><table class="mon-sub-table dtc-table">
  <thead><tr class="mon-sub-hdr">
    <td class="mon-lbl-hdr" style="background:${MON_DTC_COLOR}">${_stokDtc}<span class="hdr-amt" data-modal-hdr="dtc"><span class="tbl-status"></span></span></td>
    ${_dexHdrCols('dtc',MON_DTC_COLOR,t.id,n)}
  </tr></thead>
  <tbody>
    <tr class="mon-row-dex"><td class="mon-lbl-side"><span style='color:green;'>${pairTk}→${t.ticker}</span></td>${_dexDataCols('dtc','dex',n)}</tr>
    <tr class="mon-row-cex"><td class="mon-lbl-side lbl-pair"><span style='color:red;'>JUAL [${t.ticker}]</span></td>${_dexDataCols('dtc','cex',n)}</tr>
    <tr class="mon-row-recv"><td class="mon-lbl-side">ALL FEE</td>${_dexDataCols('dtc','fee',n)}</tr>
    <tr class="mon-row-pnl"><td class="mon-lbl-side">💰 PNL</td>${_dexDataCols('dtc','pnl',n)}</tr>
  </tbody>
</table></div>
</div>`;
    return div;
}

function _cacheCard(t, card) {
    const els = {
        card,
        numEl:       card.querySelector('.mon-num'),
        wdTokEl:     document.getElementById('wdic-tok-'  + t.id),
        wdPairEl:    document.getElementById('wdic-pair-' + t.id),
        modalCtdHdr: null, modalDtcHdr: null,
        ctdStatus: null, dtcStatus: null,
        ctdHdr: [], ctdCex: [], ctdDex: [], ctdFee: [], ctdPnl: [],
        dtcHdr: [], dtcCex: [], dtcDex: [], dtcFee: [], dtcPnl: [],
    };
    card.querySelectorAll('[data-modal-hdr],[data-ctd-hdr],[data-ctd-cex],[data-ctd-dex],[data-ctd-fee],[data-ctd-pnl],[data-dtc-hdr],[data-dtc-cex],[data-dtc-dex],[data-dtc-fee],[data-dtc-pnl]').forEach(el => {
        const d = el.dataset;
        if (d.modalHdr === 'ctd') { els.modalCtdHdr = el; return; }
        if (d.modalHdr === 'dtc') { els.modalDtcHdr = el; return; }
        if (d.ctdHdr !== undefined) { els.ctdHdr[+d.ctdHdr] = el; return; }
        if (d.ctdCex !== undefined) { els.ctdCex[+d.ctdCex] = el; return; }
        if (d.ctdDex !== undefined) { els.ctdDex[+d.ctdDex] = el; return; }
        if (d.ctdFee !== undefined) { els.ctdFee[+d.ctdFee] = el; return; }
        if (d.ctdPnl !== undefined) { els.ctdPnl[+d.ctdPnl] = el; return; }
        if (d.dtcHdr !== undefined) { els.dtcHdr[+d.dtcHdr] = el; return; }
        if (d.dtcCex !== undefined) { els.dtcCex[+d.dtcCex] = el; return; }
        if (d.dtcDex !== undefined) { els.dtcDex[+d.dtcDex] = el; return; }
        if (d.dtcFee !== undefined) { els.dtcFee[+d.dtcFee] = el; return; }
        if (d.dtcPnl !== undefined) { els.dtcPnl[+d.dtcPnl] = el; }
    });
    const statEls = card.querySelectorAll('.tbl-status');
    els.ctdStatus = statEls[0] || null;
    els.dtcStatus = statEls[1] || null;
    _cardEls.set(t.id, els);
}

let _buildBatchToken = null; // token untuk cancel batch build lama
let _buildCompleteCallback = null; // callback setelah _finalizeBuildOrder selesai

function buildMonitorRows(tokenList) {
    const tokens = tokenList || getFilteredTokens();
    _clearAllSignalChips();
    for (const k in _obCache) delete _obCache[k];
    updateNoSignalNotice();

    const monList = document.getElementById('monitorList');
    if (!tokens.length) {
        _cardEls.clear();
        _lastBuildN = 0;
        _buildBatchToken = null;
        monList.innerHTML = '<div class="token-list-empty">Tidak ada token. Tambahkan KOIN di menu DATA KOIN.</div>';
        return;
    }

    const n = totalQuoteCount();

    // Jika jumlah kolom DEX berubah → wajib rebuild semua kartu
    if (n !== _lastBuildN) {
        _cardEls.clear();
        monList.textContent = '';
        _lastBuildN = n;
    }

    const newIds = new Set(tokens.map(t => t.id));

    // Hapus kartu token yang sudah dihapus dari daftar
    for (const id of [..._cardEls.keys()]) {
        if (!newIds.has(id)) {
            document.getElementById('card-' + id)?.remove();
            _cardEls.delete(id);
        }
    }

    // Render batch pertama (card yang terlihat di viewport) langsung, sisanya bertahap via rAF
    const FIRST_BATCH = 30;
    const batchToken = {};
    _buildBatchToken = batchToken;

    function _buildBatch(startIdx) {
        if (_buildBatchToken !== batchToken) return; // build baru dimulai, cancel yang ini
        const end = Math.min(startIdx + (startIdx === 0 ? FIRST_BATCH : 50), tokens.length);
        const frag = document.createDocumentFragment();
        for (let i = startIdx; i < end; i++) {
            const t = tokens[i];
            if (!_cardEls.has(t.id)) {
                const card = _buildSingleCard(t, n);
                frag.appendChild(card);
                _cacheCard(t, card);
            }
        }
        if (frag.childElementCount) monList.appendChild(frag);

        if (end < tokens.length) {
            requestAnimationFrame(() => _buildBatch(end));
        } else {
            // Semua card sudah dibuat — urutkan dan beri nomor
            _finalizeBuildOrder(tokens, monList);
        }
    }

    _buildBatch(0);
}

function _finalizeBuildOrder(tokens, monList) {
    // Urutkan ulang: pindahkan node DOM yang sudah ada ke urutan baru
    // appendChild pada node yang sudah ada = move (bukan clone) — sangat murah
    for (const t of tokens) {
        const card = document.getElementById('card-' + t.id);
        if (card) monList.appendChild(card);
    }
    // Update nomor urut (cached via els.numEl)
    tokens.forEach((t, idx) => {
        const numEl = _cardEls.get(t.id)?.numEl;
        if (numEl) numEl.textContent = idx + 1;
    });
    // Panggil callback scroll jika ada (dari signal chip click saat tab switch)
    if (_buildCompleteCallback) {
        const cb = _buildCompleteCallback;
        _buildCompleteCallback = null;
        requestAnimationFrame(cb);
    }
}

// ─── Signal Chips ─────────────────────────────
// Cached DOM references & chip counter to avoid querySelector scans
const _signalBarEl = null; // lazy-init below
let _signalChipCount = 0;
function _getSignalBar() { return document.getElementById('signalScroll'); }

function _onSigScroll(el) {
    const bar = document.getElementById('signalBar');
    if (!bar) return;
    bar.classList.toggle('can-scroll-l', el.scrollLeft > 2);
    bar.classList.toggle('can-scroll-r', el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
}

function _onSigArr(dir) {
    const sc = document.getElementById('signalScroll');
    if (!sc) return;
    sc.scrollLeft += dir * 180;
    _onSigScroll(sc);
}

function _clearAllSignalChips() {
    const bar = _getSignalBar();
    if (!bar) return;
    // Hapus chip-group beserta isinya (chip-group::after adalah separator)
    const groups = bar.querySelectorAll('.chip-group');
    for (let i = groups.length - 1; i >= 0; i--) groups[i].remove();
    _signalChipCount = 0;
}

function updateNoSignalNotice() {
    const el = document.getElementById('noSignalNotice');
    if (!el) return;
    el.style.display = (scanning && _signalChipCount === 0) ? 'inline-flex' : 'none';
}

function updateSignalChips(tok, signals, dir) {
    const bar = _getSignalBar();
    if (!bar) return;
    const groupId = `chip-group-${dir.toLowerCase()}-${tok.id}`;
    const prefix  = `chip-${dir.toLowerCase()}-${tok.id}-`;

    // Hapus chip lama yang sudah tidak ada sinyalnya
    const activeSrcs = new Set(signals.map(r => r.src));
    const group = document.getElementById(groupId);
    if (group) {
        const existing = group.querySelectorAll(`[id^="${prefix}"]`);
        for (let i = existing.length - 1; i >= 0; i--) {
            if (!activeSrcs.has(existing[i].id.slice(prefix.length))) {
                existing[i].remove();
                _signalChipCount--;
            }
        }
        // Hapus grup jika kosong
        if (!group.querySelector('.signal-chip')) { group.remove(); }
    }

    if (!signals.length) { updateNoSignalNotice(); return; }

    // Ambil atau buat grup wrapper
    let grp = document.getElementById(groupId);
    if (!grp) {
        grp = document.createElement('div');
        grp.className = 'chip-group';
        grp.id = groupId;
        bar.prepend(grp);
    }

    const cexCfg  = CONFIG_CEX[tok.cex] || {};
    const cexLabel = (cexCfg.label || tok.cex || '').toUpperCase();
    const dirClass = dir === 'CTD' ? 'dir-ctd' : 'dir-dtc';

    signals.forEach(r => {
        const chipId = `${prefix}${r.src}`;
        const _dexM   = dir === 'CTD' ? (r.dexModalCtD || tok.modalCtD) : (r.dexModalDtC || tok.modalDtC);
        const modalLbl = _dexM ? `$${_dexM}` : '';
        let chip = document.getElementById(chipId);
        if (!chip) {
            chip = document.createElement('div');
            chip.className = 'signal-chip chip-' + dir.toLowerCase();
            chip.id = chipId;
            chip.dataset.tokId = tok.id;
            chip.dataset.dir = dir;
            grp.appendChild(chip);
            _signalChipCount++;
        }
        const dexSrc   = r.src || '';
        const _chipSrcCfg = Object.values(CONFIG_DEX).find(c => c.src === dexSrc);
        const dexName  = _chipSrcCfg && !_chipSrcCfg.hasCount ? _chipSrcCfg.label : (r.name ? r.name.toUpperCase() : 'DEX');
        const dexBadge = _chipSrcCfg && _chipSrcCfg.hasCount ? _chipSrcCfg.badge : '';
        const dexSrcCls = dexSrc.toLowerCase();
        const badgeHtml = dexBadge ? `<span class="src-tag ${dexSrcCls}">${dexBadge}</span>` : '';
        const pairTicker = tok.tickerPair || 'USDT';
        // Simpan index kolom untuk navigasi langsung ke kolom DEX yang tepat
        chip.dataset.hdrIdx = r.hdrIdx ?? '';
        // Nomor koin dari card yang sudah dirender
        const _cardNum = document.getElementById('card-' + tok.id)?.querySelector('.mon-num')?.textContent || '?';
        // Baris 1 (route exchange): CTD = CEX→DEX, DTC = DEX→CEX
        const routeLabel = dir === 'CTD'
            ? `${cexLabel}→${badgeHtml}${badgeHtml ? ' ' : ''}${dexName}`
            : `${badgeHtml}${badgeHtml ? ' ' : ''}${dexName}→${cexLabel}`;
        // Baris 2 (arah aset): CTD = TOKEN→PAIR, DTC = PAIR→TOKEN
        const assetLabel = dir === 'CTD'
            ? `${tok.ticker}→${pairTicker}`
            : `${pairTicker}→${tok.ticker}`;
        const pnlClass = r.pnl >= 0 ? 'chip-pnl-pos' : 'chip-pnl-neg';

        chip.innerHTML = `
            <div class="chip-row-top">
                <span class="chip-num">#${_cardNum}</span>
                <img src="icons/chains/${tok.chain}.png" class="chip-icon" onerror="this.style.display='none'">
                <span class="chip-route ${dirClass}">${routeLabel}</span>
            </div>
            <div class="chip-row-bottom">
                <span class="chip-asset">${assetLabel}</span>
                <span class="chip-sep">|</span>
                <span class="chip-modal">${modalLbl}</span>
                <span class="chip-sep">|</span>
                <span class="chip-pnl ${pnlClass}">${fmtPnl(r.pnl)}$</span>
            </div>`;
        chip.className = 'signal-chip chip-' + dir.toLowerCase() + (r.pnl < 0 ? ' loss' : '');
    });

    updateNoSignalNotice();
    const sc = document.getElementById('signalScroll');
    if (sc) _onSigScroll(sc);
}

// ─── Toast ────────────────────────────────────
let _toastTimer = null;
function showToast(msg, duration = 2200) {
    const el = document.getElementById('toastMsg');
    if (!el) return;
    clearTimeout(_toastTimer);
    el.textContent = msg;
    el.classList.add('show');
    _toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ─── Settings Auto-Save Bindings ──────────────
// Username & wallet: simpan + validasi saat focus hilang
$('#setUsername, #setWallet').on('blur', _saveUserInfo);

// Speed chips: pilih & simpan langsung
$('#speedChips').on('click', '.sort-btn', function () {
    $('#speedChips .sort-btn').removeClass('active');
    $(this).addClass('active');
    CFG.interval = parseInt($(this).data('speed'));
    _persistCFG();
    showToast('✓ Kecepatan SCANNER: ' + $(this).text());
});

// Semua field lain: auto-save + toast saat berubah
$('#setSoundMuted').on('change', function () {
    _autoSaveFields();
    showToast(this.checked ? '🔔 Notifikasi suara aktif' : '🔕 Notifikasi suara dimatikan');
});
$('#setLevelCount').on('change', function () {
    const clamped = Math.min(4, Math.max(1, parseInt($(this).val()) || 2));
    $(this).val(clamped);
    _autoSaveFields();
    showToast('✓ Level CEX: ' + clamped);
});
// NOTE: DEX route count handlers are now dynamically bound in loadSettings() from CONFIG_DEX

// ─── Reload with Toast ───────────────────────
function reloadWithToast() {
    sessionStorage.setItem('justReloaded', '1');
    location.reload();
}

// ─── Sort & Search Handlers ──────────────────
// Scanner sort
$('#monSortBar').on('click', '.sort-btn:not(#monFavFilter):not(#btnAutoReload)', function () {
    monitorSort = $(this).data('sort');
    _shuffledTokens = null; // clear cache agar random mengacak ulang
    $('#monSortBar .sort-btn:not(#monFavFilter):not(#btnAutoReload)').removeClass('active');
    $(this).addClass('active');
    // Hapus signal chips & rebuild cards (termasuk saat scanning)
    _clearAllSignalChips();
    updateNoSignalNotice();
    _lastScanTokenKey = null; // force rebuild pada ronde berikutnya
    buildMonitorRows();
});

// Scanner favorite filter
$('#monFavFilter').on('click', function () {
    monitorFavOnly = !monitorFavOnly;
    $(this).toggleClass('active', monitorFavOnly);
    if (!scanning) buildMonitorRows();
    updateScanCount();
});

// Koin sort
$('#tokSortAZ, #tokSortZA').on('click', function () {
    tokenSort = $(this).data('sort');
    $('#tokSortAZ, #tokSortZA').removeClass('active');
    $(this).addClass('active');
    tokenRenderLimit = 50;
    renderTokenList();
});

// Koin fav filter
$('#tokFavFilter').on('click', function () {
    tokenFavFilter = !tokenFavFilter;
    $(this).toggleClass('active', tokenFavFilter);
    tokenRenderLimit = 50;
    renderTokenList();
});

// Koin search
$('#tokenSearch').on('input', function () {
    tokenSearchQuery = $(this).val().trim();
    tokenRenderLimit = 50;
    clearTimeout(_renderDebounce);
    _renderDebounce = setTimeout(renderTokenList, 150);
});

// ─── Orderbook Tooltip ────────────────────────
let _tooltipHideTimer = null;
let _tooltipEl = null;
function _getTooltip() { return _tooltipEl || (_tooltipEl = document.getElementById('obTooltip')); }
function showObTooltip(el) {
    clearTimeout(_tooltipHideTimer);
    const tokId = el.dataset.tok;
    const dir = el.dataset.dir; // 'ctd' or 'dtc'
    const ob = _obCache[tokId];
    const tooltip = _getTooltip();
    if (!tooltip) return;

    // Build token/pair/CEX/DEX info header
    const tok = getTokens().find(t => t.id === tokId);
    const cexLabel = tok ? (CONFIG_CEX[tok.cex]?.label || tok.cex).toUpperCase() : '?';
    const chainLabel = tok ? (CONFIG_CHAINS[tok.chain]?.label || tok.chain).toUpperCase() : '?';
    const tokenSym = tok ? tok.ticker : '?';
    const pairSym = tok ? (tok.tickerPair || tok.ticker) : '?';
    const dexName = el.dataset.dexName || el.textContent.trim() || '?';
    // Fee detail dari dataset header element (per kolom DEX)
    const _feeWdLabel = dir === 'ctd' ? tokenSym : pairSym;
    const _modalSet    = parseFloat(el.dataset.modalSet) || 0;
    const _modalActual = el.dataset.modalActual !== '' && el.dataset.modalActual != null ? parseFloat(el.dataset.modalActual) : null;
    const _modalInsuf  = _modalSet > 0 && _modalActual != null && _modalActual < _modalSet;
    const _modalInline = _modalSet > 0
        ? (_modalInsuf
            ? `<span class="ob-tip-modal-set">$${_modalSet} ✖</span> <span class="ob-tip-sep-pipe">|</span> <span class="ob-tip-modal-insuf">$${_modalActual} ✅</span>`
            : `<span class="ob-tip-modal-ok">$${_modalSet} ✅</span>`)
        : '';
    const _cexFee1  = parseFloat(el.dataset.cexFee1) || 0;
    const _cexFee2  = parseFloat(el.dataset.cexFee2) || 0;
    const _feeWd    = parseFloat(el.dataset.feeWd) || (ob ? (dir === 'ctd' ? (ob.feeWdCtD || 0) : 0) : 0);
    const _feeSwap  = parseFloat(el.dataset.feeSwap) || 0;
    const _totalFee  = parseFloat(el.dataset.totalFee)  || (_cexFee1 + _cexFee2 + _feeWd + _feeSwap);
    const _pnlKotor  = parseFloat(el.dataset.pnlKotor)  || 0;
    const _pnlBersih = parseFloat(el.dataset.pnlBersih) || 0;
    const _minPnl    = el.dataset.minPnl != null && el.dataset.minPnl !== '' ? parseFloat(el.dataset.minPnl) : null;
    const _buyLabel  = dir === 'ctd' ? `Fee Beli ${tokenSym} (CEX)` : `Fee Beli ${pairSym} (CEX)`;
    const _sellLabel = dir === 'ctd' ? `Fee Jual ${pairSym} (CEX)` : `Fee Jual ${tokenSym} (CEX)`;
    const _pnlKotorSign  = _pnlKotor  >= 0 ? '+' : '';
    const _pnlBersihSign = _pnlBersih >= 0 ? '+' : '';
    const _pnlBersihCls  = _pnlBersih >= 0 ? 'pnl-pos' : 'pnl-neg';
    const _feeDetailHtml = (_cexFee1 > 0 || _cexFee2 > 0 || _feeWd >= 0 || _feeSwap > 0)
        ? `<div class="ob-tip-fee-detail">${_cexFee1 > 0 ? `
            <div class="ob-tip-fee-row"><span class="ob-tip-lbl">${_buyLabel}</span><span class="ob-tip-feewd-val">-${_cexFee1.toFixed(3)}$</span></div>` : ''}${_cexFee2 > 0 ? `
            <div class="ob-tip-fee-row"><span class="ob-tip-lbl">${_sellLabel}</span><span class="ob-tip-feewd-val">-${_cexFee2.toFixed(3)}$</span></div>` : ''}
            <div class="ob-tip-fee-row"><span class="ob-tip-lbl">Fee WD ${_feeWdLabel}</span><span class="ob-tip-feewd-val">-${_feeWd.toFixed(3)}$</span></div>${_feeSwap > 0 ? `
            <div class="ob-tip-fee-row"><span class="ob-tip-lbl">Fee Swap (DEX)</span><span class="ob-tip-feewd-val">-${_feeSwap.toFixed(3)}$</span></div>` : ''}
            <div class="ob-tip-fee-row ob-tip-fee-total"><span class="ob-tip-lbl">Total Fee</span><span class="ob-tip-feewd-val">-${_totalFee.toFixed(3)}$</span></div>
          </div>
          <div class="ob-tip-pnl-summary">
            <div class="ob-tip-fee-row"><span class="ob-tip-lbl">PNL Kotor</span><span class="ob-tip-pnl-gross">${_pnlKotorSign}${_pnlKotor.toFixed(3)}$</span></div>
            <div class="ob-tip-fee-row"><span class="ob-tip-lbl">All Fee</span><span class="ob-tip-feewd-val">-${_totalFee.toFixed(3)}$</span></div>
            <div class="ob-tip-fee-row ob-tip-pnl-net-row"><span class="ob-tip-lbl">PNL Bersih</span><span class="${_pnlBersihCls} ob-tip-pnl-net">${_pnlBersihSign}${_pnlBersih.toFixed(3)}$</span></div>
            ${_minPnl != null ? `<div class="ob-tip-fee-row ob-tip-minpnl-row"><span class="ob-tip-lbl">Min PNL (set)</span><span class="ob-tip-minpnl-val${_pnlBersih >= _minPnl ? ' ob-tip-minpnl-ok' : ' ob-tip-minpnl-no'}">$${_minPnl.toFixed(2)}${_pnlBersih >= _minPnl ? ' ✅' : ' ✖'}</span></div>` : ''}
          </div>`
        : '';
    // CTD: tampilkan token → pair; DTC: tampilkan pair → token
    const _infoToken = dir === 'ctd' ? `${tokenSym}→${pairSym}` : `${pairSym}→${tokenSym}`;
    const infoHeader = `<div class="ob-tip-info">
      <div class="ob-tip-info-row1">
        <span class="ob-tip-lbl">CEX</span> <b>${cexLabel}</b>
        <span class="ob-tip-arrow">→</span>
        <span class="ob-tip-lbl">DEX</span> <b>${dexName}</b>
      </div>
      <div class="ob-tip-info-row2">
        <b>${_infoToken}</b>
        <span class="ob-tip-sep-pipe">[${chainLabel}]</span>
        ${_modalInline ? `<span class="ob-tip-sep-pipe">|</span> <span class="ob-tip-lbl">MODAL</span> ${_modalInline}` : ''}
      </div>
    </div>${_feeDetailHtml}`;

    const actionsHtml = '';

    if (!ob || (!ob.asks.length && !ob.bids.length)) {
        tooltip.innerHTML = infoHeader + '<div class="ob-tip-empty">Data orderbook belum tersedia.<br>Tunggu hasil scanning.</div>';
    } else {
        // Harga CEX (LX auto level atau L1) dan DEX (effPrice kolom ini)
        const cexAsk   = ob.dispAsk || ob.askPrice || 0;
        const cexBid   = ob.dispBid || ob.bidPrice || 0;
        const dexPrice = parseFloat(el.dataset.effprice) || 0;
        // CtD: beli di CEX (ask), jual di DEX (effPrice)
        // DtC: beli di DEX (effPrice), jual di CEX (bid)
        const buyPrice  = dir === 'ctd' ? cexAsk  : dexPrice;
        const sellPrice = dir === 'ctd' ? dexPrice : cexBid;
        const buyLabel  = dir === 'ctd' ? 'HARGA BUY CEX'  : 'HARGA BUY DEX';
        const sellLabel = dir === 'ctd' ? 'HARGA SELL DEX' : 'HARGA SELL CEX';

        const fmtIDR = (v) => {
            const idr = v * usdtRate;
            if (idr <= 0) return '0';
            if (idr < 1) return idr.toFixed(4);
            if (idr < 1000) return idr.toFixed(2);
            return Math.round(idr).toLocaleString('id-ID');
        };
        const fmtPr = (p) => `${fmtCompact(p)}$ [Rp.${fmtIDR(p)}]`;

        const priceHeader = `
          <div class="ob-tip-prices">
            <div class="ob-tip-price-row">
              <span class="ob-tip-buy">${buyLabel}</span>
              <span class="ob-sep"> : </span>
              <span>${fmtPr(buyPrice)}</span>
            </div>
            <div class="ob-tip-price-row">
              <span class="ob-tip-sell">${sellLabel}</span>
              <span class="ob-sep"> : </span>
              <span>${fmtPr(sellPrice)}</span>
            </div>
          </div>`;

        const obList = dir === 'ctd' ? (ob.asks || []) : (ob.bids || []);
        const dirLabel = dir === 'ctd' ? 'BELI (CEX→DEX)' : 'JUAL (DEX→CEX)';
        const titleCls = dir === 'ctd' ? 'ob-tip-buy' : 'ob-tip-sell';

        const levelCount = CFG.levelCount ?? APP_DEV_CONFIG.defaultLevelCount;
        const rows = obList.slice(0, levelCount).map(([price, vol], i) => {
            const total = price * vol;
            const sep = i > 0 ? '<div class="ob-tip-level-sep"></div>' : '';
            return `${sep}<div class="ob-tip-ob-row">
              <span class="ob-tip-ob-lvl">L${i + 1}</span>
              <span class="ob-tip-ob-price">${fmtPr(price)}</span>
              <span class="ob-sep">:</span>
              <span class="ob-tip-ob-vol">${total.toFixed(2)}$ [Rp.${fmtIDR(total)}]</span>
            </div>`;
        }).join('');

        tooltip.innerHTML = `
          ${infoHeader}
          ${priceHeader}
          <div class="ob-tip-ob-section">
            <div class="ob-tip-title ${titleCls}">ORDERBOOK CEX — ${dirLabel}</div>
            ${rows || '<div class="ob-tip-empty">Tidak ada data</div>'}
          </div>`;
    }

    // Position tooltip
    const rect = el.getBoundingClientRect();
    const tipW = 290;
    let left = rect.left + window.scrollX;
    if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8;
    if (left < 4) left = 4;
    tooltip.style.left = left + 'px';
    tooltip.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    tooltip.classList.add('visible');
}
function hideObTooltip() {
    clearTimeout(_tooltipHideTimer);
    _tooltipHideTimer = setTimeout(() => {
        const tooltip = _getTooltip();
        if (tooltip) tooltip.classList.remove('visible');
    }, 120);
}
// Close tooltip when tapping elsewhere
document.addEventListener('touchstart', function (e) {
    if (!e.target.closest('[data-dir]') && !e.target.closest('#obTooltip')) {
        const tooltip = _getTooltip();
        if (tooltip) tooltip.classList.remove('visible');
    }
}, { passive: true });

// ─── Lazy UI Extra Loader (Calculator + Bulk) ─────────
let _uiExtraLoading = null;
function _loadUiExtra() {
    if (window.__uiExtraLoaded) return Promise.resolve();
    if (_uiExtraLoading) return _uiExtraLoading;
    _uiExtraLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'ui/ui-extra.js';
        s.onload = () => { window.__uiExtraLoaded = true; resolve(); };
        s.onerror = () => { _uiExtraLoading = null; showToast('Gagal memuat modul kalkulator'); reject(new Error('ui-extra load failed')); };
        document.body.appendChild(s);
    });
    return _uiExtraLoading;
}

function openCalcModal() {
    _loadUiExtra().then(() => { if (typeof window.openCalcModal === 'function') window.openCalcModal(); });
}
function closeCalcModal() {
    const el = document.getElementById('calcOverlay');
    if (el) el.classList.remove('open');
}
function openBulkModal() {
    _initDraft();
    renderDexConfig();
    const el = document.getElementById('bulkOverlay');
    if (el) el.classList.add('open');
}
function closeBulkModal() {
    const el = document.getElementById('bulkOverlay');
    if (el) el.classList.remove('open');
}
function onCalcField(source) {
    _loadUiExtra().then(() => { if (typeof window.onCalcField === 'function') window.onCalcField(source); });
}
function calcUpdatePrice() {
    _loadUiExtra().then(() => { if (typeof window.calcUpdatePrice === 'function') window.calcUpdatePrice(); });
}
function calcCekToken() {
    _loadUiExtra().then(() => { if (typeof window.calcCekToken === 'function') window.calcCekToken(); });
}
function refreshCalcRate() {
    _loadUiExtra().then(() => { if (typeof window.refreshCalcRate === 'function') window.refreshCalcRate(); });
}
function convFromUsdt() {
    _loadUiExtra().then(() => { if (typeof window.convFromUsdt === 'function') window.convFromUsdt(); });
}
function convFromIdr() {
    _loadUiExtra().then(() => { if (typeof window.convFromIdr === 'function') window.convFromIdr(); });
}
function calcCustomConv() {
    _loadUiExtra().then(() => { if (typeof window.calcCustomConv === 'function') window.calcCustomConv(); });
}
// ─── Load More: event delegation on #tokenList ───
$('#tokenList').on('click', '#btnLoadMore', function () {
    tokenRenderLimit += 50;
    renderTokenList();
});

// ─── Signal chip: event delegation ───────────
$('#signalBar').on('click', '.signal-chip', function () {
    const tokId  = this.dataset.tokId;
    const dir    = (this.dataset.dir || '').toLowerCase(); // 'ctd' | 'dtc'
    const hdrIdx = this.dataset.hdrIdx;

    function _doScroll() {
        const card = document.getElementById('card-' + tokId);
        if (!card) return;
        // Navigasi langsung ke kolom DEX via index (tidak bergantung pada data-src)
        const dexHdr = hdrIdx !== '' && hdrIdx != null
            ? card.querySelector(`.mon-dex-hdr[data-${dir}-hdr="${hdrIdx}"]`)
            : null;
        const target = dexHdr || card;
        // FIX: Gunakan scrollTo manual alih-alih scrollIntoView smooth.
        // scrollIntoView smooth bisa meleset jika DOM berubah (scan result masuk)
        // selama animasi scroll berlangsung.
        const rect = target.getBoundingClientRect();
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const viewH = window.innerHeight || document.documentElement.clientHeight;
        const targetY = scrollY + rect.top - (viewH / 2) + (rect.height / 2);
        window.scrollTo({ top: Math.max(0, targetY), behavior: 'auto' });
        card.classList.add('card-flash');
        setTimeout(() => card.classList.remove('card-flash'), 1600);
    }

    // Wrapper: tunggu 2 rAF agar pending DOM mutations (scan results) selesai
    function _scrollAfterSettle() {
        requestAnimationFrame(() => requestAnimationFrame(_doScroll));
    }

    const isMonitorActive = !!document.getElementById('tabMonitor')?.classList.contains('active');
    if (!isMonitorActive) {
        if (scanning) {
            // Scan aktif: kartu sudah ada di DOM, tab switch tanpa rebuild
            switchTab('tabMonitor');
            _scrollAfterSettle();
        } else {
            // Tidak scan: tab switch memicu buildMonitorRows (batched rAF)
            // Pasang callback — akan dipanggil setelah _finalizeBuildOrder selesai
            _buildCompleteCallback = _doScroll;
            switchTab('tabMonitor');
        }
    } else {
        // Sudah di tab monitor — tunggu DOM settle lalu scroll
        _scrollAfterSettle();
    }
});

// ─── Tooltip hover keep-open ─────────────────
// Tooltip tetap terbuka saat cursor berada di atasnya (untuk klik link)
$('#obTooltip')
    .on('mouseenter', function () { clearTimeout(_tooltipHideTimer); })
    .on('mouseleave', function () { hideObTooltip(); });

// ─── Event delegation untuk tooltip DEX header ───
// Gantikan 65K+ inline onmouseenter/onmouseleave/ontouchstart per cell
// dengan 3 listener tunggal di container (#monitorList)
(function () {
    const ml = document.getElementById('monitorList');
    if (!ml) return;
    ml.addEventListener('mouseover', function (e) {
        const hdr = e.target.closest('.mon-dex-hdr[data-tok]');
        if (hdr) showObTooltip(hdr, e);
    });
    ml.addEventListener('mouseout', function (e) {
        if (!e.target.closest('.mon-dex-hdr[data-tok]')) return;
        if (!e.relatedTarget || !e.relatedTarget.closest('.mon-dex-hdr[data-tok]')) hideObTooltip();
    });
    ml.addEventListener('touchstart', function (e) {
        const hdr = e.target.closest('.mon-dex-hdr[data-tok]');
        if (hdr) { showObTooltip(hdr, e); e.stopPropagation(); }
    }, { passive: false });
})();

// ─── Init ────────────────────────────────────
$(function () {
    (window._dbReady || Promise.resolve()).then(function () {
    // Restore auto-reload state
    autoReload = !!dbGet('scanAutoReload', false);
    _applyAutoReload();
    loadSettings();
    renderDexConfig();
    renderCexChips('indodax');
    renderChainChips('bsc');
    renderTokenList();   // also builds monitor skeleton via buildMonitorRows()
    checkOnboarding();
    // Sync signalBar + scanFooter visibility dengan tab aktif saat load
    const initTab = $('.nav-item.active[data-tab]').data('tab') || 'tabMonitor';
    const initMonitor = initTab === 'tabMonitor';
    $('#signalBar').css('display', initMonitor ? 'flex' : 'none');
    $('#scanFooter').css('display', initMonitor ? 'flex' : 'none');
    document.body.classList.toggle('no-signal-bar', !initMonitor);
    // Init USDT rate
    fetchUsdtRate().then(() => {
        if (typeof window._updateCalcRateDisplay === 'function') window._updateCalcRateDisplay();
    });
    // Toast after reload
    if (sessionStorage.getItem('justReloaded')) {
        sessionStorage.removeItem('justReloaded');
        showToast('Reload berhasil!');
    }
    }); // end _dbReady.then
});
