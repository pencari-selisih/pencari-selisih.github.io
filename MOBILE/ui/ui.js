// ============================================================
// MOBILE SCANNER — ui/ui.js
// Adaptasi dari MINI/ui/ui.js:
// - getTokens() / saveTokens() → ASYNC (IndexedDB via db.js)
// - Settings → UIkit modal (#modalSettings)
// - Token form → UIkit modal (#modalToken)
// - Bulk DEX modal → UIkit modal (#modalBulk)
// - App alert/confirm → UIkit modal (#modalAppDialog)
// - DEX settings grid → dirender dari CONFIG_DEX (source of truth)
// ============================================================

// ─── URL Helpers ─────────────────────────────────────────
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
    const from     = dir === 'dtc' ? scPair  : scToken;
    const to       = dir === 'dtc' ? scToken : scPair;
    if (!from || !to) {
        if (dn.includes('meta') || dn === 'mm')         return 'https://portfolio.metamask.io/bridge';
        if (dn.includes('jump') || dn.includes('lifi')) return 'https://jumper.exchange/';
        return '';
    }
    const _kyberChain = { 56:'bnb',1:'ethereum',137:'polygon',42161:'arbitrum',8453:'base' }[chainId] || 'bnb';
    const _ooChain    = { 56:'bsc',1:'eth',137:'polygon',42161:'arbitrum',8453:'base' }[chainId] || 'bsc';
    const _matchaChain = { 56:'bsc',1:'ethereum',137:'polygon',42161:'arbitrum',8453:'base' }[chainId] || 'ethereum';
    if (dn.includes('meta') || dn === 'mm')             return 'https://portfolio.metamask.io/bridge';
    if (dn.includes('jump') || dn.includes('lifi'))     return `https://jumper.exchange/?fromChain=${chainId}&toChain=${chainId}&fromToken=${from}&toToken=${to}`;
    if (dn.includes('kyber'))                           return `https://kyberswap.com/swap/${_kyberChain}/${from}-to-${to}`;
    if (dn.includes('okx') || dn.includes('okdex'))    return `https://www.okx.com/web3/dex-swap?inputChain=${chainId}&inputCurrency=${from}&outputChain=${chainId}&outputCurrency=${to}`;
    if (/^0x\b|0x protocol|matcha/i.test(dn))          return `https://matcha.xyz/tokens/${_matchaChain}/${from}?buyAddress=${to}&buyChain=${chainId}`;
    if (/openocean/i.test(dn))                          return `https://app.openocean.finance/swap/${_ooChain}/${from}/${to}`;
    return `https://jumper.exchange/?fromChain=${chainId}&toChain=${chainId}&fromToken=${from}&toToken=${to}`;
}

// ─── App Dialog Modal (UIkit) ─────────────────────────────
function _showModal(icon, title, bodyHtml, buttons, bodyLeft = false) {
    $('#appModalIcon').text(icon);
    $('#appModalTitle').text(title);
    $('#appModalBody').html(bodyHtml);
    if (bodyLeft) $('#appModalBody').css('text-align', 'left');
    else $('#appModalBody').css('text-align', 'center');
    $('#appModalFooter').html(
        buttons.map((b, i) =>
            `<button class="app-modal-btn ${b.cls}" data-idx="${i}">${b.label}</button>`
        ).join('')
    );
    $('#appModalFooter').off('click').on('click', '[data-idx]', function () {
        UIkit.modal('#modalAppDialog').hide();
        const cb = buttons[+$(this).data('idx')].action;
        if (cb) cb();
    });
    UIkit.modal('#modalAppDialog').show();
}

const MODAL_ICONS = { info: 'ℹ️', warn: '⚠️', error: '🗑️', success: '✅', delete: '🗑️' };
function showAlert(msg, title, type, onClose) {
    _showModal(MODAL_ICONS[type] || MODAL_ICONS.info, title || 'Info', msg,
        [{ label: 'OK', cls: 'btn-ok', action: onClose }]);
}
function showAlertList(items, title, onClose) {
    const body = '<ul style="text-align:left">' + items.map(s => `<li>${s}</li>`).join('') + '</ul>';
    _showModal(MODAL_ICONS.warn, title || 'Perhatian', body,
        [{ label: 'OK', cls: 'btn-ok', action: onClose }], true);
}
function showConfirm(msg, title, labelOk, onOk, onCancel) {
    _showModal(MODAL_ICONS.delete, title || 'Konfirmasi', msg, [
        { label: 'Batal',        cls: 'btn-cancel', action: onCancel },
        { label: labelOk || 'Ya', cls: 'btn-ok btn-danger', action: onOk },
    ]);
}

// ─── Settings ─────────────────────────────────────────────
async function getAllFilteredTokens() {
    const tokens = await getTokens();
    return tokens.filter(t => {
        const cexOk   = CFG.activeCex.length === 0   || CFG.activeCex.includes(t.cex);
        const chainOk = CFG.activeChains.length === 0 || CFG.activeChains.includes(t.chain);
        const pairTk  = (t.tickerPair || 'USDT').toUpperCase();
        const isStable = STABLE_COINS.has(pairTk);
        const pairOk  = CFG.pairType === 'all' || (CFG.pairType === 'stable' ? isStable : !isStable);
        return cexOk && chainOk && pairOk;
    });
}

async function updateScanCount() {
    const all = await getAllFilteredTokens();
    const filtered = await getFilteredTokens();
    const allN = all.length;
    const n    = filtered.length;
    $('#filterCoinCount').text(allN);
    if (!scanning) {
        $('#btnScanCount').text('[' + n + ' KOIN ]');
        $('#btnScan').prop('disabled', n === 0).toggleClass('disabled', n === 0);
    }
    const favN = all.filter(t => t.favorite).length;
    $('#monFavCount').text(favN > 0 ? ' ' + favN : '');
}

function renderFilterChips() {
    $('#filterCexChips').html(Object.entries(CONFIG_CEX).map(([k, v]) => {
        const on = CFG.activeCex.length === 0 || CFG.activeCex.includes(k);
        return `<span class="fchip${on ? ' on' : ''}" data-key="${k}" data-type="cex"
          style="${on ? `background:${v.WARNA};` : ''}"
          onclick="toggleFilterChip(this,'cex')">
          <img src="icons/cex/${k}.png" class="chip-icon" onerror="this.style.display='none'">
          ${v.label}</span>`;
    }).join(''));
    $('#filterChainChips').html(Object.entries(CONFIG_CHAINS).map(([k, v]) => {
        const on = CFG.activeChains.length === 0 || CFG.activeChains.includes(k);
        return `<span class="fchip${on ? ' on' : ''}" data-key="${k}" data-type="chain"
          style="${on ? `background:${v.WARNA};` : ''}"
          onclick="toggleFilterChip(this,'chain')">
          <img src="icons/chains/${k}.png" class="chip-icon" onerror="this.style.display='none'">
          ${v.label}</span>`;
    }).join(''));
    document.querySelectorAll('#filterPairTypeChips .pair-type-chip').forEach(el => {
        const active = el.dataset.val === (CFG.pairType || 'all');
        el.classList.toggle('on', active);
        el.style.background = active ? '#365cd3' : '';
        el.style.color      = active ? '#fff' : '';
    });
}

function setPairTypeFilter(val) {
    CFG.pairType = val;
    _persistCFG();
    renderFilterChips();
    if (!scanning) buildMonitorRows();
    renderTokenList();
    updateScanCount();
}

function toggleFilterChip(el, type) {
    const key = el.dataset.key;
    const arr = type === 'cex' ? CFG.activeCex : CFG.activeChains;
    const cfg = type === 'cex' ? CONFIG_CEX : CONFIG_CHAINS;
    const idx = arr.indexOf(key);
    if (arr.length === 0) {
        const all = Object.keys(cfg);
        arr.push(...all.filter(k => k !== key));
    } else if (idx >= 0) {
        arr.splice(idx, 1);
    } else {
        arr.push(key);
        if (arr.length === Object.keys(cfg).length) arr.splice(0);
    }
    renderFilterChips();
    _persistCFG();
    renderTokenList();
    updateScanCount();
    const label = cfg[key]?.label || key;
    const isNowOn = arr.length === 0 || arr.includes(key);
    if (arr.length === 0) showToast(`✅ Semua ${type === 'cex' ? 'CEX' : 'Chain'} aktif`);
    else showToast(`${isNowOn ? '✅' : '❌'} ${label.toUpperCase()} ${isNowOn ? 'di ON-kan' : 'di OFF-kan'}`);
}

// DEX settings grid — dirender dari CONFIG_DEX (source of truth)
function renderDexSettings() {
    const html = getEnabledDexList().map(def => {
        const dc = CFG.dex?.[def.key] || {};
        const active = dc.active !== false;
        const color  = def.color;
        let countHtml = '';
        if (def.hasCount) {
            const cnt = dc.count || def.defaultCount;
            countHtml = `<span class="dex-row-lbl">Jumlah DEX:</span>
              <input type="number" min="1" max="6" value="${cnt}"
                data-dex="${def.key}" data-field="count"
                onchange="_onDexSettingChange(this)"
                style="width:44px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:3px 5px;color:var(--text);font-size:11px;text-align:center">`;
        }
        return `<div class="dex-cfg-row dex-cfg-${def.key}${active ? '' : ' dex-off'}"
            style="border-left-color:${color}">
          <span class="dex-row-badge dex-badge-${def.key}"
            style="background:${color}">${def.badge}</span>
          <span class="dex-row-name" style="color:${color}">${def.label}</span>
          <div class="dex-row-fields">${countHtml}</div>
          <label style="display:flex;align-items:center;gap:4px;margin-left:auto;font-size:10px;color:var(--text-muted)">
            <input type="checkbox" class="dex-row-toggle"
              data-dex="${def.key}" data-field="active"
              onchange="_onDexSettingChange(this)"
              ${active ? 'checked' : ''}>
            <span>${active ? 'ON' : 'OFF'}</span>
          </label>
        </div>`;
    }).join('');
    $('#dexSettingsGrid').html(html);
}

function _onDexSettingChange(el) {
    const key   = el.dataset.dex;
    const field = el.dataset.field;
    if (!CFG.dex[key]) CFG.dex[key] = {};
    if (field === 'active') {
        const active = el.checked;
        CFG.dex[key].active = active;
        // Update label next to checkbox
        const lbl = el.nextElementSibling;
        if (lbl) lbl.textContent = active ? 'ON' : 'OFF';
        // Toggle dex-off class on row
        el.closest('.dex-cfg-row')?.classList.toggle('dex-off', !active);
        _syncLegacyDexCounts();
        _persistCFG();
        showToast(`${DEX_LIST.find(d => d.key === key)?.label || key}: ${active ? '✅ Aktif' : '❌ Nonaktif'}`);
    } else if (field === 'count') {
        const v = Math.min(5, Math.max(1, parseInt(el.value) || 1));
        el.value = v;
        CFG.dex[key].count = v;
        _syncLegacyDexCounts();
        _persistCFG();
        showToast(`✓ JUMLAH DEX ${DEX_LIST.find(d=>d.key===key)?.label||key} : ${v} `);
    }
}

async function loadSettings() {
    // Baca dari IndexedDB
    const stored = await dbGetSettings();
    if (stored) Object.assign(CFG, stored);
    if (!Array.isArray(CFG.activeCex))   CFG.activeCex   = [];
    if (!Array.isArray(CFG.activeChains)) CFG.activeChains = [];
    if (!['all','stable','non'].includes(CFG.pairType)) CFG.pairType = 'all';
    if (!CFG.dex) CFG.dex = _buildDefaultDexCfg();
    DEX_LIST.forEach(def => {
        if (!CFG.dex[def.key]) CFG.dex[def.key] = { active: def.enabled, modalCtD: def.modalCtD || 100, modalDtC: def.modalDtC || 80 };
        if (def.hasCount && !CFG.dex[def.key].count) CFG.dex[def.key].count = def.defaultCount;
    });
    _syncLegacyDexCounts();

    // Populate settings modal fields
    $('#setUsername').val(CFG.username);
    $('#setWallet').val(CFG.wallet);
    $('#setSoundMuted').prop('checked', !CFG.soundMuted);
    const speeds = [800, 700, 500];
    const nearest = speeds.reduce((a, b) => Math.abs(b - CFG.interval) < Math.abs(a - CFG.interval) ? b : a);
    $('#speedChips .sort-btn').removeClass('active');
    $(`#speedChips [data-speed="${nearest}"]`).addClass('active');

    // App name/version
    const appName = APP_DEV_CONFIG.appName || 'MOBILE SCANNER';
    const verStr  = 'v' + (APP_DEV_CONFIG.appVersion || '');
    $('#appVersion').text(verStr);
    $('#onboardVersion').text(verStr);
    $('#appNameDisplay').text(appName);
    $('#onboardAppName').text(appName);
    $('#appTitle').text(appName);

    renderDexSettings();
    renderFilterChips();
    await updateScanCount();
}

const EVM_RE = /^0x[0-9a-fA-F]{40}$/;

function _saveUserInfo() {
    const username = $('#setUsername').val().trim();
    const wallet   = $('#setWallet').val().trim();
    let hasErr = false;
    if (!username) hasErr = true;
    if (!wallet || !EVM_RE.test(wallet)) hasErr = true;
    if (hasErr) return;
    CFG.username = username;
    CFG.wallet   = wallet;
    _persistCFG();
    showToast('✓ Data pengguna tersimpan');
}

function _autoSaveFields() {
    CFG.soundMuted = !$('#setSoundMuted').prop('checked');
    _persistCFG();
    if (!scanning) buildMonitorRows();
    renderTokenList();
}

function saveSettings() {
    _saveUserInfo();
    _autoSaveFields();
}

// ─── Onboarding ───────────────────────────────────────────
function checkOnboarding() {
    if (!CFG.username || !CFG.wallet) openOnboarding();
}
function openOnboarding() {
    $('#obUsername').val(CFG.username || '');
    $('#obWallet').val(CFG.wallet || '');
    $('#onboardOverlay').show();
}
$('#btnOnboard').on('click', () => {
    const u = $('#obUsername').val().trim();
    const w = $('#obWallet').val().trim();
    if (!u || !w) {
        showAlert('Username dan Wallet Address wajib diisi.', 'Data Belum Lengkap', 'warn');
        return;
    }
    if (!EVM_RE.test(w)) {
        showAlert('Wallet Address tidak valid.<br>Format: <b>0x</b> + tepat <b>40</b> karakter hex.', 'Format Wallet Salah', 'warn');
        return;
    }
    CFG.username = u; CFG.wallet = w;
    _persistCFG();
    loadSettings();
    $('#onboardOverlay').hide();
});

// ─── Block settings/editor modals during scanning (kalkulator tetap bisa diakses)
['#modalSettings', '#modalBulk', '#modalToken'].forEach(sel => {
    UIkit.util.on(sel, 'beforeshow', e => {
        if (scanning) { e.preventDefault(); showToast('⛔ Hentikan scan terlebih dahulu'); }
    });
});

// ─── Tab Navigation ───────────────────────────────────────
function switchTab(tabId) {
    if (!tabId) return;
    if (tabId === 'tabSettings') {
        if (scanning) { showToast('⛔ Hentikan scan terlebih dahulu'); return; }
        UIkit.modal('#modalSettings').show();
        return;
    }
    if (scanning && tabId !== 'tabMonitor') return;
    $('.nav-item').removeClass('active');
    $(`.nav-item[data-tab="${tabId}"]`).addClass('active');
    $('.top-tab-btn').removeClass('active');
    $(`.top-tab-btn[data-tab="${tabId}"]`).addClass('active');
    const isMonitor = tabId === 'tabMonitor';
    $('#scanCtrl').css('display', isMonitor ? 'flex' : 'none');
    document.body.classList.toggle('fab-hidden', !isMonitor);
    $('.tab-pane').hide();
    $('#' + tabId).show();
    if (tabId === 'tabMonitor') { $('#signalBar').show(); } else { $('#signalBar').hide(); }
    window.scrollTo(0, 0);
    clearTokenCache();
    if (tabId === 'tabToken') { renderTokenList(); renderDexConfig(); }
    if (tabId === 'tabMonitor' && !scanning) {
        _lastBuildN = 0;
        _cardEls.clear();
        buildMonitorRows();
        _monitorNeedsRebuild = false;
    }
}
$('.nav-item[data-tab]').on('click', function () { switchTab($(this).data('tab')); });
$('.top-tab-btn[data-tab]').on('click', function () { switchTab($(this).data('tab')); });

// Settings modal: populate fields when opened
UIkit.util.on('#modalSettings', 'show', function () { loadSettings(); });

// ─── Token Form — Bottom Sheet ────────────────────────────
function openSheet(id) {
    if (scanning) { showToast('⛔ Hentikan scan terlebih dahulu'); return; }
    resetSheetForm();
    if (id) fillSheetForm(id);
    $('#sheetTitle').text(id ? 'Edit Token' : 'Tambah KOIN');
    $('#editId').val(id || '');
    $('#sheetOverlay').addClass('open');
    setTimeout(() => $('#tokenSheet').addClass('open'), 10);
    document.body.style.overflow = 'hidden';
}
function closeSheet() {
    $('#tokenSheet').removeClass('open');
    $('#sheetOverlay').removeClass('open');
    document.body.style.overflow = '';
    $('#acToken, #acPair').hide();
    $('#tokenSheet .form-input').removeClass('input-error');
}
$('#sheetOverlay, #btnSheetCancel').on('click', closeSheet);
$('#tokenSheet').on('input change', '.form-input', function () { $(this).removeClass('input-error'); });

$('#fabAdd').on('click', () => openSheet());

// ─── CEX & Chain Chips ────────────────────────────────────
function renderCexChips(selected) {
    const html = Object.entries(CONFIG_CEX).map(([k, v]) =>
        `<span class="cex-chip${selected === k ? ' active' : ''}" data-cex="${k}"
      style="${selected === k ? `background:${v.WARNA};border-color:${v.WARNA}` : ''}"
      onclick="selectCex('${k}')">
      <img src="icons/cex/${k}.png" class="chip-icon" onerror="this.style.display='none'">
      ${v.label}</span>`
    ).join('');
    $('#cexChips').html(html);
}
function selectCex(key) {
    renderCexChips(key);
    autoFillSymbols();
}
function selectedCex() { return $('#cexChips .cex-chip.active').data('cex') || Object.keys(CONFIG_CEX)[0]; }

function renderChainChips(selected) {
    const html = Object.entries(CONFIG_CHAINS).map(([k, v]) =>
        `<span class="chain-chip${selected === k ? ' active' : ''}" data-chain="${k}"
      style="${selected === k ? `background:${v.WARNA};border-color:${v.WARNA}` : ''}"
      onclick="selectChain('${k}')">
      <img src="icons/chains/${k}.png" class="chip-icon" onerror="this.style.display='none'">
      ${v.label}</span>`
    ).join('');
    $('#chainChips').html(html);
}
function selectChain(key) { renderChainChips(key); }
function selectedChain() { return $('#chainChips .chain-chip.active').data('chain') || 'bsc'; }

const isUsdtNoSymbol = (_cex, ticker) => ticker.toUpperCase() === 'USDT';
function autoFillSymbols() {
    const cex    = selectedCex();
    const ticker = $('#fTicker').val().trim();
    const pairTk = $('#fTickerPair').val().trim();
    const cfg    = CONFIG_CEX[cex];
    if (ticker) {
        if (isUsdtNoSymbol(cex, ticker)) $('#fSymbolToken').val('').attr('placeholder', 'USDT — otomatis $1');
        else $('#fSymbolToken').attr('placeholder', 'e.g. SANDUSDT').val(cfg.symbolFmt(ticker));
    }
    if (pairTk) {
        if (isUsdtNoSymbol(cex, pairTk)) $('#fSymbolPair').val('').attr('placeholder', 'USDT — otomatis $1');
        else $('#fSymbolPair').attr('placeholder', 'Pair CEX').val(cfg.symbolFmt(pairTk));
    }
}

// ─── Autocomplete ─────────────────────────────────────────
let acDebounce = null;
let acStore = { token: [], pair: [] };
function onTickerInput(type) {
    clearTimeout(acDebounce);
    autoFillSymbols();
    acDebounce = setTimeout(() => triggerAc(type), 300);
}
async function triggerAc(type) {
    const chain   = selectedChain();
    const isToken = type === 'token';
    const q       = (isToken ? $('#fTicker') : $('#fTickerPair')).val().trim().toUpperCase();
    const box     = isToken ? $('#acToken') : $('#acPair');
    if (!q) { box.hide(); return; }
    box.html('<div class="ac-item">⏳ Memuat...</div>').addClass('open').show();
    const data = await loadWm(chain);
    const res  = data.filter(d =>
        d.ticker.toUpperCase().includes(q) || (d.nama_token || '').toUpperCase().includes(q)
    ).slice(0, 8);
    if (!res.length) { box.html('<div class="ac-item">Tidak ditemukan — isi manual</div>'); return; }
    acStore[type] = res;
    const scShort = (sc) => sc ? sc.slice(0, 6) + '...' + sc.slice(-4) : '-';
    box.html(res.map((d, i) => `
        <div class="ac-item" data-type="${type}" data-idx="${i}">
          <span style="font-weight:700">${d.ticker}</span>
          <span style="font-size:10px;color:var(--text-muted)"> ${d.nama_token || ''} | dec:${d.decimals} | ${scShort(d.sc)}</span>
        </div>`
    ).join('')).addClass('open').show();
}
$(document).on('click', '.ac-item', function () {
    const type = $(this).data('type');
    const idx  = parseInt($(this).data('idx'));
    const d    = acStore[type]?.[idx];
    if (d) acSelect(d, type);
});
function acSelect(d, type) {
    if (type === 'token') {
        $('#fTicker').val(d.ticker);
        $('#fScToken').val(d.sc || '');
        $('#fDecToken').val(d.decimals || 18);
        $('#acToken').hide().removeClass('open');
    } else {
        $('#fTickerPair').val(d.ticker);
        $('#fScPair').val(d.sc || '');
        $('#fDecPair').val(d.decimals || 18);
        $('#acPair').hide().removeClass('open');
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
    if (!$(e.target).closest('.ac-wrap').length) $('#acToken,#acPair').hide().removeClass('open');
});

// ─── Sheet Form ────────────────────────────────────────────
function _renderDexModalPerToken(dexModals) {
    const dm   = dexModals || {};
    const rows = getEnabledDexList().map(def => {
        const bulkCtD = CFG.dex?.[def.key]?.modalCtD || '';
        const bulkDtC = CFG.dex?.[def.key]?.modalDtC || '';
        const bulkPnl = CFG.dex?.[def.key]?.minPnl   || '';
        const ctdVal  = dm[def.key]?.ctd != null ? dm[def.key].ctd : '';
        const dtcVal  = dm[def.key]?.dtc != null ? dm[def.key].dtc : '';
        const pnlVal  = dm[def.key]?.pnl != null ? dm[def.key].pnl : '';
        return `<div class="dmp-row">
          <span class="dmp-badge" style="background:${def.color}">${def.badge}</span>
          <input class="dmp-inp" id="fDexCtD_${def.key}" data-dex="${def.key}" data-dir="ctd"
            type="number" min="1" placeholder="${bulkCtD || '-'}" value="${ctdVal}">
          <input class="dmp-inp" id="fDexDtC_${def.key}" data-dex="${def.key}" data-dir="dtc"
            type="number" min="1" placeholder="${bulkDtC || '-'}" value="${dtcVal}">
          <input class="dmp-inp" id="fDexPnl_${def.key}" data-dex="${def.key}" data-dir="pnl"
            type="number" min="0" step="0.1" placeholder="${bulkPnl || '-'}" value="${pnlVal}">
        </div>`;
    }).join('');
    document.getElementById('dexModalPerToken').innerHTML =
        `<div class="dmp-hdr">
          <span></span>
          <span>CEX→DEX</span>
          <span>DEX→CEX</span>
          <span>Min PNL</span>
        </div>` + rows;
}

function resetSheetForm() {
    $('#fTicker,#fSymbolToken,#fScToken,#fTickerPair,#fSymbolPair,#fScPair').val('');
    $('#fDecToken,#fDecPair').val(18);
    _renderDexModalPerToken({});
    renderCexChips('binance'); renderChainChips('bsc');
    $('#acToken,#acPair').hide().removeClass('open');
}
async function fillSheetForm(id) {
    const tokens = await getTokens();
    const t = tokens.find(x => x.id === id);
    if (!t) return;
    $('#fTicker').val(t.ticker);    $('#fSymbolToken').val(t.symbolToken);
    $('#fScToken').val(t.scToken);  $('#fDecToken').val(t.decToken);
    $('#fTickerPair').val(t.tickerPair); $('#fSymbolPair').val(t.symbolPair);
    $('#fScPair').val(t.scPair);    $('#fDecPair').val(t.decPair);
    _renderDexModalPerToken(t.dexModals || {});
    renderCexChips(t.cex); renderChainChips(t.chain);
}

$('#btnSheetSave').on('click', async () => {
    const ticker       = $('#fTicker').val().trim().toUpperCase();
    const cex          = selectedCex();
    const symbolToken  = $('#fSymbolToken').val().trim().toUpperCase();
    const scToken      = $('#fScToken').val().trim();
    const decToken     = parseInt($('#fDecToken').val());
    const tickerPairRaw = $('#fTickerPair').val().trim().toUpperCase();
    const symbolPair   = $('#fSymbolPair').val().trim().toUpperCase();
    const scPair       = $('#fScPair').val().trim();
    const decPair      = parseInt($('#fDecPair').val());
    const chain        = selectedChain();

    const errs = [];
    if (!cex)    errs.push(['cexChips',    'Exchanger belum dipilih']);
    if (!chain)  errs.push(['chainChips',  'Network belum dipilih']);
    if (!ticker) errs.push(['fTicker',     'Symbol TOKEN wajib diisi']);
    else if (!/^[A-Z0-9]+$/.test(ticker)) errs.push(['fTicker', 'Symbol TOKEN hanya huruf/angka']);
    if (!symbolToken && !isUsdtNoSymbol(cex, ticker)) errs.push(['fSymbolToken', 'Ticker CEX Token wajib diisi']);
    if (!scToken) errs.push(['fScToken', 'SC Token wajib diisi']);
    else if (!/^0x[0-9a-fA-F]{40}$/.test(scToken)) errs.push(['fScToken', 'SC Token tidak valid']);
    if (isNaN(decToken) || decToken < 0 || decToken > 30) errs.push(['fDecToken', 'Decimal Token harus 0–30']);

    const tickerPair  = tickerPairRaw || 'USDT';
    const isPairUsdt  = tickerPair.toUpperCase() === 'USDT';
    const isPairSame  = tickerPair === ticker;
    const pairNeeds   = !isPairSame && !isPairUsdt;
    if (pairNeeds) {
        if (!symbolPair) errs.push(['fSymbolPair', 'Ticker CEX Pair wajib diisi']);
        if (!scPair)     errs.push(['fScPair',     'SC Pair wajib diisi']);
        else if (!/^0x[0-9a-fA-F]{40}$/.test(scPair)) errs.push(['fScPair', 'SC Pair tidak valid']);
    } else if (scPair && !/^0x[0-9a-fA-F]{40}$/.test(scPair)) {
        errs.push(['fScPair', 'SC Pair tidak valid']);
    }
    if (isNaN(decPair) || decPair < 0 || decPair > 30) errs.push(['fDecPair', 'Decimal Pair harus 0–30']);

    if (errs.length) {
        showAlertList(errs.map(e => e[1]), 'Validasi Form');
        return;
    }

    const dexModals = {};
    getEnabledDexList().forEach(def => {
        const ctd = parseFloat(($(`#fDexCtD_${def.key}`).val() || '').trim());
        const dtc = parseFloat(($(`#fDexDtC_${def.key}`).val() || '').trim());
        const pnl = parseFloat(($(`#fDexPnl_${def.key}`).val() || '').trim());
        if (isFinite(ctd) || isFinite(dtc) || isFinite(pnl)) {
            dexModals[def.key] = {};
            if (isFinite(ctd)) dexModals[def.key].ctd = ctd;
            if (isFinite(dtc)) dexModals[def.key].dtc = dtc;
            if (isFinite(pnl)) dexModals[def.key].pnl = pnl;
        }
    });

    const tokens = await getTokens();
    const id  = $('#editId').val() || genId();
    const idx = tokens.findIndex(x => x.id === id);
    const tok = {
        id, ticker, cex, symbolToken, scToken, decToken,
        tickerPair, symbolPair, scPair, decPair, chain, dexModals,
        favorite: (idx >= 0 && tokens[idx].favorite) ? true : false,
    };
    if (idx >= 0) tokens[idx] = tok; else tokens.push(tok);
    await saveTokens(tokens);
    renderTokenList();
    showToast(idx >= 0 ? '✅ Data koin berhasil diperbarui' : '✅ Data koin berhasil ditambahkan');
    closeSheet();
});

// ─── Token List ────────────────────────────────────────────
function isValidToken(t) {
    return !!(t.ticker && t.scToken && CONFIG_CEX[t.cex] && CONFIG_CHAINS[t.chain] &&
        (t.symbolToken || isUsdtNoSymbol(t.cex, t.ticker)));
}

let tokenSort        = 'az';
let tokenSearchQuery = '';
let _monitorNeedsRebuild = false;
let tokenFavFilter   = false;
let tokenRenderLimit = 50;
let _renderDebounce  = null;

async function renderTokenList() {
    let tokens = await getTokens();
    tokens = tokens.filter(t => {
        const cexOk   = CFG.activeCex.length === 0   || CFG.activeCex.includes(t.cex);
        const chainOk = CFG.activeChains.length === 0 || CFG.activeChains.includes(t.chain);
        const pairTk  = (t.tickerPair || 'USDT').toUpperCase();
        const isStable = STABLE_COINS.has(pairTk);
        const pairOk  = CFG.pairType === 'all' || (CFG.pairType === 'stable' ? isStable : !isStable);
        return cexOk && chainOk && pairOk;
    });
    if (tokenSort === 'za') tokens = tokens.sort((a, b) => (b.ticker || '').localeCompare(a.ticker || ''));
    else tokens = tokens.sort((a, b) => (a.ticker || '').localeCompare(b.ticker || ''));
    if (tokenSearchQuery) {
        const q = tokenSearchQuery.toLowerCase();
        tokens = tokens.filter(t =>
            (t.ticker || '').toLowerCase().includes(q) ||
            (t.tickerPair || '').toLowerCase().includes(q) ||
            (CONFIG_CEX[t.cex]?.label || t.cex || '').toLowerCase().includes(q) ||
            (CONFIG_CHAINS[t.chain]?.label || t.chain || '').toLowerCase().includes(q)
        );
    }
    if (tokenFavFilter) tokens = tokens.filter(t => t.favorite);
    const favCnt = tokens.filter(t => t.favorite).length;
    $('#tokenCount').text('TOTAL ' + tokens.length + ' KOIN');
    $('#favCount').text(favCnt > 0 ? `⭐ ${favCnt}/${tokens.length}` : '');

    const display = tokens.slice(0, tokenRenderLimit);
    if (!display.length) {
        $('#tokenList').html('<div class="tab-empty-msg">Belum ada koin. Ketuk + untuk menambah.</div>');
    } else {
        let html = display.map(t => {
            const cexCfg   = CONFIG_CEX[t.cex] || {};
            const chainCfg = CONFIG_CHAINS[t.chain] || {};
            const valid    = isValidToken(t);
            const _hasCexData = typeof getCexTokenStatus === 'function';
            const _pairTk  = (t.tickerPair || 'USDT').toUpperCase();
            const _stTok   = _hasCexData ? getCexTokenStatus(t.cex, t.ticker, t.chain, 1) : null;
            const _stPair  = _hasCexData ? getCexTokenStatus(t.cex, _pairTk, t.chain, 1) : null;
            const _wf      = t.cex !== 'indodax' && typeof isCexWalletFetched === 'function' && isCexWalletFetched(t.cex);
            const _icTok   = _wdpIcons(_stTok, _wf, t.cex, t.ticker);
            const _icPair  = _wdpIcons(_stPair, _wf, t.cex, _pairTk);
            const dexRows  = getEnabledDexList().map(def => {
                const dm    = t.dexModals?.[def.key];
                const bulk  = CFG.dex?.[def.key] || {};
                const ctd   = dm?.ctd  ?? bulk.modalCtD ?? '?';
                const dtc   = dm?.dtc  ?? bulk.modalDtC ?? '?';
                const pnl   = dm?.pnl  ?? t.minPnl ?? bulk.minPnl ?? null;
                const isOver = dm?.ctd != null || dm?.dtc != null;
                const pnlTxt = pnl != null ? `$${pnl}` : '-';
                return `<span class="tl-dex-tb tl-dex-badge-${def.key}${isOver ? ' tl-over' : ''}" title="${isOver?'Override per-token':'Bulk setting'}">${def.label}</span>
                  <span class="tl-dex-tc tl-dex-tc-ctd">$${ctd}</span>
                  <span class="tl-dex-tc tl-dex-tc-dtc">$${dtc}</span>
                  <span class="tl-dex-tc tl-dex-tc-pnl">${pnlTxt}</span>`;
            }).join('');
            return `
    <div class="token-list-item${valid ? '' : ' token-invalid'}" id="li-${t.id}">
      <div class="token-list-row">
        <div class="token-list-badges">
         <div class="token-list-actions-bar">
            <button class="tok-fav btn-icon${t.favorite ? ' fav-active' : ''}" onclick="toggleFavorite('${t.id}')" title="Favorit">⭐</button>
            <button class="btn-icon" onclick="openSheet('${t.id}')" title="Edit">✏️</button>
            <button class="btn-icon danger" onclick="deleteToken('${t.id}')" title="Hapus">🗑️</button>
          </div>
          <div class="token-list-sym">
            <span class="tl-tok-name">${t.ticker}<span class="wdp-ic" id="wdic-tok-${t.id}">${_icTok}</span></span>
            <span class="tl-tok-name">${_pairTk}<span class="wdp-ic" id="wdic-pair-${t.id}">${_icPair}</span></span>
            ${valid ? '' : '<span class="token-invalid-badge">⚠ Data kurang</span>'}
          </div>
          <span class="badge-cex" style="background:${cexCfg.WARNA||'#555'}">${cexCfg.label||t.cex}</span>
          <span class="badge-chain" style="background:${chainCfg.WARNA||'#555'}">${chainCfg.label||t.chain}</span>
         
        </div>
        <div class="token-list-info">
          <div class="tl-dex-table">
            <span class="tl-dex-th"></span>
            <span class="tl-dex-th">CEX→DEX</span>
            <span class="tl-dex-th">DEX→CEX</span>
            <span class="tl-dex-th">Min PNL</span>
            ${dexRows}
          </div>
        </div>
      </div>
    </div>`;
        }).join('');
        if (tokens.length > tokenRenderLimit) {
            const rem = tokens.length - tokenRenderLimit;
            html += `<div style="text-align:center;padding:10px">
              <button class="btn-outline" id="btnLoadMore">Tampilkan ${Math.min(rem,50)} lagi (${rem} tersisa)</button>
            </div>`;
        }
        $('#tokenList').html(html);
    }
    if (!scanning) {
        if ($('#tabMonitor').is(':visible')) buildMonitorRows();
        else _monitorNeedsRebuild = true;
    }
    await updateScanCount();
}

async function deleteToken(id) {
    if (scanning) { showToast('⛔ Hentikan scan terlebih dahulu'); return; }
    const tokens = await getTokens();
    const tok    = tokens.find(x => x.id === id);
    const name   = tok ? tok.ticker : 'token ini';
    showConfirm(
        `Koin <b>${name}</b> akan dihapus permanen.`,
        'Hapus Koin', 'Hapus',
        async () => {
            const toks = await getTokens();
            await saveTokens(toks.filter(x => x.id !== id));
            if (scanning) {
                document.getElementById('card-' + id)?.remove();
                updateScanCount();
                showToast(`🗑️ ${name} dihapus`);
            } else {
                renderTokenList();
            }
        }
    );
}

// ─── CSV Export / Import ───────────────────────────────────
const CSV_BASE_COLS  = ['ticker','cex','symbolToken','scToken','decToken','tickerPair','symbolPair','scPair','decPair','chain','favorite'];
const CSV_EXTRA_COLS = ['feeWd_token_usdt','feeWd_pair_usdt','wd_token_ok','dp_pair_ok'];
const _csvDexCols    = () => DEX_LIST.flatMap(d => [`dex_${d.key}_ctd`,`dex_${d.key}_dtc`,`dex_${d.key}_pnl`]);

$('#btnExport').on('click', async () => {
    const tokens  = await getTokens();
    const dexCols = _csvDexCols();
    const allCols = [...CSV_BASE_COLS, ...dexCols, ...CSV_EXTRA_COLS];
    const rows = [allCols.join(','), ...tokens.map(t => {
        const base = CSV_BASE_COLS.map(c => `"${t[c] ?? ''}"`);
        const dexVals = DEX_LIST.flatMap(d => {
            const dm   = t.dexModals?.[d.key] || {};
            const bulk = CFG.dex?.[d.key] || {};
            return [`"${dm.ctd ?? bulk.modalCtD ?? ''}"`, `"${dm.dtc ?? bulk.modalDtC ?? ''}"`, `"${dm.pnl ?? bulk.minPnl ?? ''}"`];
        });
        let feeWdTok = '', feeWdPair = '', wdOk = '', dpOk = '';
        if (typeof getCexTokenStatus === 'function') {
            const stTok  = getCexTokenStatus(t.cex, t.ticker, t.chain, 1);
            const stPair = getCexTokenStatus(t.cex, t.tickerPair || 'USDT', t.chain, 1);
            if (stTok)  { feeWdTok = stTok.feeWd;  wdOk = stTok.withdrawEnable ? '1' : '0'; }
            if (stPair) { feeWdPair = stPair.feeWd; dpOk = stPair.depositEnable ? '1' : '0'; }
        }
        return [...base, ...dexVals, `"${feeWdTok}"`, `"${feeWdPair}"`, `"${wdOk}"`, `"${dpOk}"`].join(',');
    })];
    const csvContent = rows.join('\n');
    if (window.AndroidBridge) { window.AndroidBridge.saveFile('monitoring-tokens.csv', csvContent); return; }
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'monitoring-tokens.csv'; a.click();
});
$('#btnImportTrigger').on('click', () => $('#importFile').click());
function parseCSVLine(line) {
    const result = []; let i = 0, val = '';
    while (i < line.length) {
        if (line[i] === '"') {
            i++;
            while (i < line.length) {
                if (line[i] === '"' && line[i+1] === '"') { val += '"'; i += 2; }
                else if (line[i] === '"') { i++; break; }
                else { val += line[i++]; }
            }
            while (i < line.length && line[i] !== ',') i++;
        } else if (line[i] === ',') { result.push(val.trim()); val = ''; i++; continue; }
        else { val += line[i++]; }
        if (i < line.length && line[i] === ',') { result.push(val.trim()); val = ''; i++; }
    }
    result.push(val.replace(/\r/g, '').trim());
    return result;
}
$('#importFile').on('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = async ev => {
        try {
            const lines   = ev.target.result.trim().split(/\r?\n/);
            const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/,'').replace(/["\r]/g,'').trim());
            if (!headers.includes('ticker')) {
                showAlert('File harus berisi header kolom dengan minimal kolom <b>ticker</b>.', 'Format CSV Salah', 'error'); return;
            }
            const SKIP_COLS = new Set(['feeWd_token_usdt','feeWd_pair_usdt','wd_token_ok','dp_pair_ok']);
            const DEX_KEYS  = DEX_LIST.map(d => d.key);
            const incoming  = lines.slice(1).filter(l => l.trim()).map(line => {
                const vals = parseCSVLine(line);
                const raw  = {};
                headers.forEach((h, i) => { if (!SKIP_COLS.has(h)) raw[h] = (vals[i] ?? '').replace(/["\r]/g,'').trim(); });
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
                    delete raw[`dex_${key}_ctd`]; delete raw[`dex_${key}_dtc`]; delete raw[`dex_${key}_pnl`];
                });
                raw.dexModals = dexModals;
                raw.decToken  = parseInt(raw.decToken) || 18;
                raw.decPair   = parseInt(raw.decPair)  || 18;
                raw.favorite  = String(raw.favorite).toLowerCase() === 'true';
                return raw;
            }).filter(t => t.ticker);
            if (!incoming.length) { showAlert('Tidak ada baris data koin yang valid.', 'Import Gagal', 'error'); return; }
            const existing  = await getTokens();
            const makeKey   = t => [(t.scToken||'').toLowerCase().trim(),(t.scPair||'').toLowerCase().trim(),(t.chain||'').toLowerCase().trim(),(t.cex||'').toLowerCase().trim()].join('|');
            const resultMap = new Map(existing.map(t => [makeKey(t), t]));
            let added = 0, updated = 0;
            incoming.forEach(tok => {
                const key = makeKey(tok);
                if (resultMap.has(key)) { const prev = resultMap.get(key); resultMap.set(key, { ...tok, id: prev.id, favorite: prev.favorite }); updated++; }
                else { resultMap.set(key, { ...tok, id: genId() }); added++; }
            });
            await saveTokens([...resultMap.values()]);
            renderTokenList();
            const parts = [];
            if (added)   parts.push(`${added} koin baru`);
            if (updated) parts.push(`${updated} diperbarui`);
            showToast(`✅ Import: ${parts.join(', ')}`);
        } catch (err) { showAlert('Kesalahan membaca file:<br>' + err.message, 'Error Import', 'error'); }
    };
    r.readAsText(f);
    e.target.value = '';
});

// ─── Favorite Toggle ──────────────────────────────────────
async function toggleFavorite(id) {
    const tokens = await getTokens();
    const idx    = tokens.findIndex(t => t.id === id);
    if (idx < 0) return;
    tokens[idx].favorite = !tokens[idx].favorite;
    await saveTokens(tokens);
    const isFav = tokens[idx].favorite;
    const ticker = tokens[idx].ticker || id;
    showToast(isFav ? `⭐ ${ticker} ditambah ke Favorit` : `☆ ${ticker} dihapus dari Favorit`);
    const favN = tokens.filter(t => t.favorite).length;
    $('#monFavCount').text(favN > 0 ? ' ' + favN : '');
    if (tokenFavFilter) { renderTokenList(); return; }
    // Update scanner card ⭐
    document.querySelector(`#card-${id} .mon-fav`)?.classList.toggle('fav-active', isFav);
    // Update token list ⭐ (class tok-fav di action-bar)
    document.querySelector(`#li-${id} .tok-fav`)?.classList.toggle('fav-active', isFav);
}

// ─── Bulk DEX Modal ───────────────────────────────────────
let _dexDraft = null;
function _initDraft() {
    _dexDraft = {};
    getEnabledDexList().forEach(def => {
        const src = (CFG.dex || {})[def.key] || {};
        _dexDraft[def.key] = { active: src.active !== false, modalCtD: src.modalCtD ?? 100, modalDtC: src.modalDtC ?? 80, minPnl: src.minPnl ?? 1 };
    });
}
function renderDexConfig() {
    const d = _dexDraft || CFG.dex || {};
    const html = getEnabledDexList().map(def => {
        const cfg    = d[def.key] || {};
        const active = cfg.active !== false;
        const color  = def.color;
        return `<div class="dex-cfg-row dex-cfg-${def.key}" style="border-left-color:${color}">
  <div class="dex-row-id">
    <span class="dex-row-badge" style="background:${color}">${def.badge}</span>
    <span class="dex-row-name" style="color:${color}">${def.label}</span>
  </div>
  <div class="dex-row-fields">
    <div class="dex-field-grp">
      <span class="dex-row-lbl">CEX→DEX</span>
      <input data-dex="${def.key}" data-field="modalCtD" type="number" min="1"
        value="${cfg.modalCtD}" onchange="draftChange(this)">
    </div>
    <div class="dex-field-grp">
      <span class="dex-row-lbl">DEX→CEX</span>
      <input data-dex="${def.key}" data-field="modalDtC" type="number" min="1"
        value="${cfg.modalDtC}" onchange="draftChange(this)">
    </div>
    <div class="dex-field-grp">
      <span class="dex-row-lbl">Min PNL</span>
      <input data-dex="${def.key}" data-field="minPnl" type="number" min="0" step="0.1"
        value="${cfg.minPnl}" onchange="draftChange(this)">
    </div>
  </div>
</div>`;
    }).join('');
    $('#dexConfigList').html(html);
}
function draftToggle(key, el) {
    if (!_dexDraft) _initDraft();
    _dexDraft[key].active = el.checked;
    renderDexConfig();
}
function draftChange(el) {
    if (!_dexDraft) return;
    const key   = el.dataset.dex;
    const field = el.dataset.field;
    const v = parseFloat(el.value);
    if (!isNaN(v)) _dexDraft[key][field] = v;
}
async function saveDexModalAll() {
    if (!CFG.dex) CFG.dex = {};
    const vals = {};
    getEnabledDexList().forEach(def => {
        const ctdEl = document.querySelector(`.dex-cfg-row [data-dex="${def.key}"][data-field="modalCtD"]`);
        const dtcEl = document.querySelector(`.dex-cfg-row [data-dex="${def.key}"][data-field="modalDtC"]`);
        const pnlEl = document.querySelector(`.dex-cfg-row [data-dex="${def.key}"][data-field="minPnl"]`);
        const ctd   = parseFloat(ctdEl?.value);
        const dtc   = parseFloat(dtcEl?.value);
        const pnl   = parseFloat(pnlEl?.value);
        vals[def.key] = {
            active:   _dexDraft?.[def.key]?.active ?? (CFG.dex?.[def.key]?.active !== false),
            modalCtD: !isNaN(ctd) ? ctd : (_dexDraft?.[def.key]?.modalCtD ?? CFG.dex?.[def.key]?.modalCtD ?? 100),
            modalDtC: !isNaN(dtc) ? dtc : (_dexDraft?.[def.key]?.modalDtC ?? CFG.dex?.[def.key]?.modalDtC ?? 80),
            minPnl:   !isNaN(pnl) ? pnl : (_dexDraft?.[def.key]?.minPnl   ?? CFG.dex?.[def.key]?.minPnl   ?? 1),
        };
    });
    getEnabledDexList().forEach(def => {
        if (!CFG.dex[def.key]) CFG.dex[def.key] = {};
        Object.assign(CFG.dex[def.key], vals[def.key]);
    });
    _syncLegacyDexCounts();
    _persistCFG();
    const filteredIds = new Set((await getAllFilteredTokens()).map(t => t.id));
    const allToks = await getTokens();
    const targetToks = allToks.filter(t => filteredIds.has(t.id) || t.favorite);
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
    if (targetToks.length) { await saveTokens(allToks); renderTokenList(); }
    _dexDraft = null;
    closeBulkModal();
    if (!scanning) buildMonitorRows();
    showToast(`✅ Modal DEX disimpan — ${targetToks.length} koin terfilter`);
}
function cancelDexModal() { _dexDraft = null; closeBulkModal(); }
function openBulkModal()  { _initDraft(); renderDexConfig(); UIkit.modal('#modalBulk').show(); }
function closeBulkModal() { UIkit.modal('#modalBulk').hide(); }

// ─── Monitor Cards ─────────────────────────────────────────
const MON_CTD_COLOR = '#4a9a6a';
const MON_DTC_COLOR = '#c0504d';

function _buildWdBadgeHtml(cex, ticker, pairTicker, chain) {
    if (typeof getCexTokenStatus !== 'function') return '';
    const stTok  = getCexTokenStatus(cex, ticker, chain, 1);
    const stPair = (pairTicker && pairTicker.toUpperCase() !== 'USDT')
        ? getCexTokenStatus(cex, pairTicker, chain, 1) : null;
    if (!stTok && !stPair) return '<span class="wd-b wd-na">? WD&nbsp;? DP</span>';
    const parts = [];
    if (stTok) {
        parts.push(`<span class="wd-b ${stTok.withdrawEnable ? 'wd-ok' : 'wd-fail'}">${stTok.withdrawEnable ? 'WD' : 'WX'} ${ticker}</span>`);
        parts.push(`<span class="wd-b ${stTok.depositEnable ? 'wd-ok' : 'wd-fail'}">${stTok.depositEnable ? 'DP' : 'DX'} ${ticker}</span>`);
    }
    if (stPair) {
        parts.push(`<span class="wd-b ${stPair.withdrawEnable ? 'wd-ok' : 'wd-fail'}">${stPair.withdrawEnable ? 'WD' : 'WX'} ${pairTicker}</span>`);
        parts.push(`<span class="wd-b ${stPair.depositEnable ? 'wd-ok' : 'wd-fail'}">${stPair.depositEnable ? 'DP' : 'DX'} ${pairTicker}</span>`);
    }
    return parts.join('');
}
function _wdpIcons(status, walletFetched, cexKey, ticker) {
    if (cexKey === 'indodax') return '<span class="wdp-na">??</span>';
    if (!status) return walletFetched
        ? '<span class="wdp-fail">WX DX</span>'
        : '<span class="wdp-na">??</span>';
    const wdOk = status.withdrawEnable;
    const dpOk = status.depositEnable;
    const wdUrl = ticker ? _getCexWithdrawUrl(cexKey, ticker) : '';
    const dpUrl = ticker ? _getCexDepositUrl(cexKey, ticker) : '';
    const wdSpan = `<span class="${wdOk ? 'wdp-ok' : 'wdp-fail'}">${wdOk ? 'WD' : 'WX'}</span>`;
    const dpSpan = `<span class="${dpOk ? 'wdp-ok' : 'wdp-fail'}">${dpOk ? 'DP' : 'DX'}</span>`;
    const wdHtml = wdUrl ? `<a href="${wdUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${wdSpan}</a>` : wdSpan;
    const dpHtml = dpUrl ? `<a href="${dpUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${dpSpan}</a>` : dpSpan;
    return `<span class="wdp-ic-inner">${wdHtml} ${dpHtml}</span>`;
}

let _lastBuildN = 0;
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
    const _stTok   = typeof getCexTokenStatus === 'function' ? getCexTokenStatus(t.cex, t.ticker, t.chain, 1) : null;
    const _stPair  = typeof getCexTokenStatus === 'function' ? getCexTokenStatus(t.cex, pairTk, t.chain, 1) : null;
    const _wf      = t.cex !== 'indodax' && typeof isCexWalletFetched === 'function' && isCexWalletFetched(t.cex);
    const _icTok   = _wdpIcons(_stTok, _wf, t.cex, t.ticker);
    const _icPair  = _wdpIcons(_stPair, _wf, t.cex, pairTk);
    const _cexKey  = t.cex.toUpperCase();
    const _walletInfo  = ch.WALLET_CEX?.[_cexKey];
    const _explorerBase = ch.URL_Chain || '';
    function _mkStokLinks(sc, label) {
        if (!sc || !_walletInfo || !_explorerBase) return label;
        const addrs = [_walletInfo.address, _walletInfo.address2, _walletInfo.address3].filter(Boolean);
        const icons = addrs.map((addr, i) => {
            const url = `${_explorerBase}/token/${sc}?a=${addr}`;
            return `<a href="${url}" target="_blank" rel="noopener" class="stok-link" onclick="event.stopPropagation()">&nbsp;📦</a>`;
        }).join('');
        return `<span>${label}</span>${icons}`;
    }
    const _stokCtd = _mkStokLinks(t.scToken, t.ticker);
    const _stokDtc = _mkStokLinks(t.scPair, pairTk);
    const _pairScInfo   = t.scPair || (pairTk.toUpperCase() === 'USDT' ? (ch.USDT_SC || '') : '');
    const _tokInfoUrl   = _explorerBase && t.scToken   ? `${_explorerBase}/token/${t.scToken}` : '';
    const _pairInfoUrl  = _explorerBase && _pairScInfo ? `${_explorerBase}/token/${_pairScInfo}` : '';
    const _tokNameHtml  = _tokInfoUrl  ? `<a href="${_tokInfoUrl}"  target="_blank" rel="noopener" class="tok-info-link" onclick="event.stopPropagation()">${t.ticker}</a>` : t.ticker;
    const _pairNameHtml = _pairInfoUrl ? `<a href="${_pairInfoUrl}" target="_blank" rel="noopener" class="tok-info-link" onclick="event.stopPropagation()">${pairTk}</a>`  : pairTk;
    const _dflChain = { 56:'bsc',1:'ethereum',137:'polygon',42161:'arbitrum',8453:'base' }[ch.Kode_Chain] || '';
    const _dflUrl   = (_dflChain && t.scToken && _pairScInfo)
        ? `https://swap.defillama.com/?chain=${_dflChain}&from=${t.scToken}&to=${_pairScInfo}` : '';
    const _dflLink  = _dflUrl ? `<a href="${_dflUrl}" target="_blank" rel="noopener" class="dfl-link" onclick="event.stopPropagation()">DFL</a>` : '';

    const div = document.createElement('div');
    div.className = 'mon-card';
    div.id = 'card-' + t.id;
    div.style.borderLeft = `3px solid ${chainColor}`;
    div.innerHTML =
`<div class="mon-card-hdr" style="background:linear-gradient(135deg,${chainColor}55,${chainColor}20)">
  <span class="mon-sym">
    <span class="mon-num">0</span>
    <span>${_tokNameHtml}<span class="wdp-ic" id="wdic-tok-${t.id}">${_icTok}</span></span>
    <span style="color:var(--text-dim)">↔️</span>
    <span>${_pairNameHtml}<span class="wdp-ic" id="wdic-pair-${t.id}">${_icPair}</span></span>
  </span>
  <span class="mon-card-actions">
    <span class="mon-cex-label" style="background:${cc.WARNA||'#555'}">${(cc.label||t.cex).toUpperCase()}</span>
    ${_dflLink}
    <span class="mon-chain-label" style="background:${chainColor}">${ch.label||t.chain.toUpperCase()}</span>
    <button class="btn-icon mon-fav${t.favorite?' fav-active':''}" onclick="toggleFavorite('${t.id}')">⭐</button>
    <button class="btn-icon" onclick="openSheet('${t.id}')">✏️</button>
    <button class="btn-icon danger" onclick="deleteToken('${t.id}')">🗑️</button>
  </span>
</div>
<div class="mon-tables-wrap">
<div class="mon-table-scroll"><table class="mon-sub-table ctd-table">
  <thead><tr>
    <td class="mon-lbl-hdr" style="background:${MON_CTD_COLOR}">${_stokCtd}<span data-modal-hdr="ctd"><span class="tbl-status"></span></span></td>
    ${_dexHdrCols('ctd',MON_CTD_COLOR,t.id,n)}
  </tr></thead>
  <tbody>
    <tr><td class="mon-lbl-side lbl-buy">BELI [${t.ticker}]</td>${_dexDataCols('ctd','cex',n)}</tr>
    <tr><td class="mon-lbl-side lbl-sell">${t.ticker}→${pairTk}</td>${_dexDataCols('ctd','dex',n)}</tr>
    <tr><td class="mon-lbl-side">ALL FEE</td>${_dexDataCols('ctd','fee',n)}</tr>
    <tr class="mon-row-pnl"><td class="mon-lbl-side">💰 PNL</td>${_dexDataCols('ctd','pnl',n)}</tr>
  </tbody>
</table></div>
<div class="mon-table-scroll"><table class="mon-sub-table dtc-table">
  <thead><tr>
    <td class="mon-lbl-hdr" style="background:${MON_DTC_COLOR}">${_stokDtc}<span data-modal-hdr="dtc"><span class="tbl-status"></span></span></td>
    ${_dexHdrCols('dtc',MON_DTC_COLOR,t.id,n)}
  </tr></thead>
  <tbody>
    <tr><td class="mon-lbl-side lbl-buy">${pairTk}→${t.ticker}</td>${_dexDataCols('dtc','dex',n)}</tr>
    <tr><td class="mon-lbl-side lbl-sell">JUAL [${t.ticker}]</td>${_dexDataCols('dtc','cex',n)}</tr>
    <tr><td class="mon-lbl-side">ALL FEE</td>${_dexDataCols('dtc','fee',n)}</tr>
    <tr class="mon-row-pnl"><td class="mon-lbl-side">💰 PNL</td>${_dexDataCols('dtc','pnl',n)}</tr>
  </tbody>
</table></div>
</div>`;
    return div;
}

function _cacheCard(t, card) {
    const els = { card, numEl: card.querySelector('.mon-num'), wdTokEl: document.getElementById('wdic-tok-'+t.id), wdPairEl: document.getElementById('wdic-pair-'+t.id), modalCtdHdr: null, modalDtcHdr: null, ctdStatus: null, dtcStatus: null, ctdHdr:[], ctdCex:[], ctdDex:[], ctdFee:[], ctdPnl:[], dtcHdr:[], dtcCex:[], dtcDex:[], dtcFee:[], dtcPnl:[] };
    card.querySelectorAll('[data-modal-hdr],[data-ctd-hdr],[data-ctd-cex],[data-ctd-dex],[data-ctd-fee],[data-ctd-pnl],[data-dtc-hdr],[data-dtc-cex],[data-dtc-dex],[data-dtc-fee],[data-dtc-pnl]').forEach(el => {
        const d = el.dataset;
        if (d.modalHdr==='ctd'){els.modalCtdHdr=el;return}
        if (d.modalHdr==='dtc'){els.modalDtcHdr=el;return}
        if (d.ctdHdr!==undefined){els.ctdHdr[+d.ctdHdr]=el;return}
        if (d.ctdCex!==undefined){els.ctdCex[+d.ctdCex]=el;return}
        if (d.ctdDex!==undefined){els.ctdDex[+d.ctdDex]=el;return}
        if (d.ctdFee!==undefined){els.ctdFee[+d.ctdFee]=el;return}
        if (d.ctdPnl!==undefined){els.ctdPnl[+d.ctdPnl]=el;return}
        if (d.dtcHdr!==undefined){els.dtcHdr[+d.dtcHdr]=el;return}
        if (d.dtcCex!==undefined){els.dtcCex[+d.dtcCex]=el;return}
        if (d.dtcDex!==undefined){els.dtcDex[+d.dtcDex]=el;return}
        if (d.dtcFee!==undefined){els.dtcFee[+d.dtcFee]=el;return}
        if (d.dtcPnl!==undefined){els.dtcPnl[+d.dtcPnl]=el}
    });
    const statEls = card.querySelectorAll('.tbl-status');
    els.ctdStatus = statEls[0]||null; els.dtcStatus = statEls[1]||null;
    _cardEls.set(t.id, els);
}

let _buildBatchToken = null;
let _buildCompleteCallback = null;

async function buildMonitorRows(tokenList) {
    const tokens = tokenList || await getFilteredTokens();
    _clearAllSignalChips();
    for (const k in _obCache) delete _obCache[k];
    updateNoSignalNotice();
    const monList = document.getElementById('monitorList');
    if (!tokens.length) {
        _cardEls.clear(); _lastBuildN = 0; _buildBatchToken = null;
        monList.innerHTML = '<div class="tab-empty-msg">Tidak ada token. Tambahkan KOIN di menu DATA KOIN.</div>';
        return;
    }
    const n = totalQuoteCount();
    if (n !== _lastBuildN) { _cardEls.clear(); monList.textContent = ''; _lastBuildN = n; }
    const newIds = new Set(tokens.map(t => t.id));
    for (const id of [..._cardEls.keys()]) {
        if (!newIds.has(id)) { document.getElementById('card-'+id)?.remove(); _cardEls.delete(id); }
    }
    const batchToken = {};
    _buildBatchToken = batchToken;
    function _buildBatch(startIdx) {
        if (_buildBatchToken !== batchToken) return;
        const end  = Math.min(startIdx + (startIdx === 0 ? 30 : 50), tokens.length);
        const frag = document.createDocumentFragment();
        for (let i = startIdx; i < end; i++) {
            const t = tokens[i];
            if (!_cardEls.has(t.id)) { const card = _buildSingleCard(t, n); frag.appendChild(card); _cacheCard(t, card); }
        }
        if (frag.childElementCount) monList.appendChild(frag);
        if (end < tokens.length) requestAnimationFrame(() => _buildBatch(end));
        else _finalizeBuildOrder(tokens, monList);
    }
    _buildBatch(0);
}
function _finalizeBuildOrder(tokens, monList) {
    for (const t of tokens) { const card = document.getElementById('card-'+t.id); if (card) monList.appendChild(card); }
    tokens.forEach((t, idx) => { const numEl = _cardEls.get(t.id)?.numEl; if (numEl) numEl.textContent = idx + 1; });
    if (_buildCompleteCallback) { const cb = _buildCompleteCallback; _buildCompleteCallback = null; requestAnimationFrame(cb); }
}

// ─── Signal Chips ──────────────────────────────────────────
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
    if (sc) { sc.scrollLeft += dir * 180; _onSigScroll(sc); }
}
function _clearAllSignalChips() {
    const bar = _getSignalBar();
    if (!bar) return;
    bar.querySelectorAll('.chip-group').forEach(g => g.remove());
    _signalChipCount = 0;
}
function updateNoSignalNotice() {
    const el = document.getElementById('noSignalNotice');
    if (el) el.style.display = (scanning && _signalChipCount === 0) ? 'inline-flex' : 'none';
}
function updateSignalChips(tok, signals, dir) {
    const bar = _getSignalBar();
    if (!bar) return;
    const groupId = `chip-group-${dir.toLowerCase()}-${tok.id}`;
    const prefix  = `chip-${dir.toLowerCase()}-${tok.id}-`;
    const activeSrcs = new Set(signals.map(r => r.src));
    const group = document.getElementById(groupId);
    if (group) {
        const existing = group.querySelectorAll(`[id^="${prefix}"]`);
        for (let i = existing.length - 1; i >= 0; i--) {
            if (!activeSrcs.has(existing[i].id.slice(prefix.length))) { existing[i].remove(); _signalChipCount--; }
        }
        if (!group.querySelector('.signal-chip')) group.remove();
    }
    if (!signals.length) { updateNoSignalNotice(); return; }
    let grp = document.getElementById(groupId);
    if (!grp) { grp = document.createElement('div'); grp.className = 'chip-group'; grp.id = groupId; bar.prepend(grp); }
    const cexCfg   = CONFIG_CEX[tok.cex] || {};
    const cexLabel = (cexCfg.label || tok.cex || '').toUpperCase();
    signals.forEach(r => {
        const chipId   = `${prefix}${r.src}`;
        const _dexM    = dir === 'CTD' ? (r.dexModalCtD || tok.modalCtD) : (r.dexModalDtC || tok.modalDtC);
        const modalLbl = _dexM ? `$${_dexM}` : '';
        let chip = document.getElementById(chipId);
        if (!chip) {
            chip = document.createElement('div');
            chip.className = 'signal-chip chip-' + dir.toLowerCase();
            chip.id = chipId;
            chip.dataset.tokId = tok.id;
            chip.dataset.dir   = dir;
            grp.appendChild(chip);
            _signalChipCount++;
        }
        const dexSrc   = r.src || '';
        const dexName  = r.name ? r.name.toUpperCase() : 'DEX';
        const dexBadge = dexSrc==='MX'?'MT':dexSrc==='JX'?'JM':dexSrc==='KR'?'KR':dexSrc==='KB'?'KB':dexSrc==='OK'?'OK':dexSrc==='LF'?'LF':'';
        const dexSrcCls = dexSrc==='KR'?'kr':dexSrc==='LF'?'lf':dexSrc.toLowerCase();
        const badgeHtml = dexBadge ? `<span class="src-tag ${dexSrcCls}">${dexBadge}</span>` : '';
        const pairTicker = tok.tickerPair || 'USDT';
        chip.dataset.hdrIdx = r.hdrIdx ?? '';
        const _cardNum = document.getElementById('card-'+tok.id)?.querySelector('.mon-num')?.textContent || '?';
        const routeLabel = dir === 'CTD' ? `${cexLabel}→${badgeHtml} ${dexName}` : `${badgeHtml} ${dexName}→${cexLabel}`;
        const assetLabel = dir === 'CTD' ? `${tok.ticker}→${pairTicker}` : `${pairTicker}→${tok.ticker}`;
        const pnlClass   = r.pnl >= 0 ? 'chip-pnl-pos' : 'chip-pnl-neg';
        chip.innerHTML = `
            <div class="chip-row-top">
                <span class="chip-num">#${_cardNum}</span>
                <img src="icons/chains/${tok.chain}.png" class="chip-icon" onerror="this.style.display='none'">
                <span class="chip-route">${routeLabel}</span>
            </div>
            <div class="chip-row-bottom">
                <span class="chip-asset">${assetLabel}</span>
                <span>|</span>
                <span class="chip-modal">${modalLbl}</span>
                <span>|</span>
                <span class="chip-pnl ${pnlClass}">${fmtPnl(r.pnl)}$</span>
            </div>`;
        chip.className = 'signal-chip chip-' + dir.toLowerCase() + (r.pnl < 0 ? ' loss' : '');
    });
    updateNoSignalNotice();
    const sc = document.getElementById('signalScroll');
    if (sc) _onSigScroll(sc);
}

// ─── Toast ─────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, duration = 2200) {
    const el = document.getElementById('toastMsg');
    if (!el) return;
    clearTimeout(_toastTimer);
    el.textContent = msg;
    el.classList.add('show');
    _toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ─── Orderbook Tooltip ─────────────────────────────────────
let _tooltipHideTimer = null;
let _tooltipEl = null;
function _getTooltip() { return _tooltipEl || (_tooltipEl = document.getElementById('obTooltip')); }
function showObTooltip(el) {
    clearTimeout(_tooltipHideTimer);
    const tokId      = el.dataset.tok;
    const dir        = el.dataset.dir;
    const ob         = _obCache[tokId];
    const tooltip    = _getTooltip();
    if (!tooltip) return;

    const dexName    = el.dataset.dexName || el.dataset.src || '—';
    const effPrice   = parseFloat(el.dataset.effprice)  || 0;
    const cexFee1    = parseFloat(el.dataset.cexFee1)   || 0;
    const cexFee2    = parseFloat(el.dataset.cexFee2)   || 0;
    const feeWd      = parseFloat(el.dataset.feeWd)     || 0;
    const feeSwap    = parseFloat(el.dataset.feeSwap)   || 0;
    const totalFee   = parseFloat(el.dataset.totalFee)  || (feeWd + feeSwap);
    const pnlKotor   = parseFloat(el.dataset.pnlKotor)  || 0;
    const pnlBersih  = parseFloat(el.dataset.pnlBersih) || 0;
    const minPnl     = parseFloat(el.dataset.minPnl)    || 0;
    const modalSet   = parseFloat(el.dataset.modalSet)  || 0;
    const modalActual= parseFloat(el.dataset.modalActual)|| 0;

    const isCtd      = dir === 'ctd';
    const dirLabel   = isCtd ? 'CEX → DEX' : 'DEX → CEX';
    const cexPrice   = ob ? (isCtd ? ob.dispAsk : ob.dispBid) : 0;
    const pnlCls     = pnlBersih >= 0 ? 'ob-tt-pnl-pos' : 'ob-tt-pnl-neg';
    const minMark    = pnlBersih >= minPnl ? ' ✅' : ' ⚠️';

    const r = (lbl, val) =>
        `<div class="ob-tt-row"><span class="ob-tt-lbl">${lbl}</span><span class="ob-tt-val">${val}</span></div>`;

    let html = `<div class="ob-tt-title">${dexName} · ${dirLabel}</div>`;

    // CEX & DEX price
    if (cexPrice) html += r(isCtd ? 'CEX Ask' : 'CEX Bid', `${fmtCompact(cexPrice)}$`);
    html += r('DEX Eff.', `${fmtCompact(effPrice)}$`);
    if (modalSet) html += r('Modal', `$${modalSet}` + (modalActual && modalActual < modalSet ? ` (ada $${modalActual})` : ''));

    html += '<hr class="ob-tt-sep">';

    // Fees
    html += r('CEX Fee 1', `${fmtCompact(cexFee1 * 100, 4)}%`);
    html += r('CEX Fee 2', `${fmtCompact(cexFee2 * 100, 4)}%`);
    html += r('WD Fee', `$${fmtCompact(feeWd)}`);
    html += r('Swap Fee', `$${fmtCompact(feeSwap)}`);
    html += `<div class="ob-tt-row ob-tt-fee-total"><span class="ob-tt-lbl">Total Fee</span><span class="ob-tt-val">$${fmtCompact(totalFee)}</span></div>`;

    html += '<hr class="ob-tt-sep">';

    // PNL
    html += r('PNL Kotor', `${fmtPnl(pnlKotor)}$`);
    html += `<div class="ob-tt-row"><span class="ob-tt-lbl">PNL Bersih</span><span class="ob-tt-val ${pnlCls}">${fmtPnl(pnlBersih)}$${minMark}</span></div>`;
    html += r('Min PNL', `$${minPnl.toFixed(2)}`);

    // Orderbook levels
    if (ob) {
        const obList     = isCtd ? (ob.asks || []) : (ob.bids || []);
        const levelCount = CFG.levelCount ?? APP_DEV_CONFIG.defaultLevelCount;
        const levels     = obList.slice(0, levelCount);
        if (levels.length) {
            html += '<hr class="ob-tt-sep">';
            html += `<div class="ob-tt-ob-lbl">Orderbook (${isCtd ? 'asks' : 'bids'})</div>`;
            levels.forEach(([price, vol], i) => {
                html += `<div class="ob-tt-ob-row"><span>L${i+1}: ${fmtCompact(price)}$</span><span>${(price*vol).toFixed(2)}$</span></div>`;
            });
        }
    }

    tooltip.innerHTML = html;

    const rect = el.getBoundingClientRect();
    const tipW = 240;
    let left = rect.left + window.scrollX;
    if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8;
    if (left < 8) left = 8;
    tooltip.style.left = left + 'px';
    tooltip.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
    tooltip.classList.add('visible');
}
function hideObTooltip() {
    clearTimeout(_tooltipHideTimer);
    _tooltipHideTimer = setTimeout(() => _getTooltip()?.classList.remove('visible'), 120);
}
document.addEventListener('touchstart', e => {
    if (!e.target.closest('[data-dir]') && !e.target.closest('#obTooltip'))
        _getTooltip()?.classList.remove('visible');
}, { passive: true });

// ─── Speed chips ───────────────────────────────────────────
$('#speedChips').on('click', '.sort-btn', function () {
    $('#speedChips .sort-btn').removeClass('active');
    $(this).addClass('active');
    CFG.interval = parseInt($(this).data('speed'));
    _persistCFG();
    showToast('✓ Kecepatan: ' + $(this).text());
});
$('#setSoundMuted').on('change', function () {
    _autoSaveFields();
    showToast(this.checked ? '🔔 Suara aktif' : '🔕 Suara mati');
});
$('#setUsername, #setWallet').on('blur', _saveUserInfo);

// ─── Sort / Search / Filter ────────────────────────────────
$('#monSortBar').on('click', '.sort-btn', function () {
    monitorSort = $(this).data('sort');
    _shuffledTokens = null;
    $('#monSortBar .sort-btn').removeClass('active');
    $(this).addClass('active');
    _clearAllSignalChips();
    updateNoSignalNotice();
    showToast(monitorSort === 'az' ? '🔤 Urutan A → Z' : '🔤 Urutan Z → A');
    buildMonitorRows();
});
$('#monFavFilter').on('click', function () {
    monitorFavOnly = !monitorFavOnly;
    $(this).toggleClass('active', monitorFavOnly);
    if (!scanning) buildMonitorRows();
    updateScanCount();
    showToast(monitorFavOnly ? '⭐ Filter Favorit ON' : '⭐ Filter Favorit OFF');
});
$('#tokSortAZ, #tokSortZA').on('click', function () {
    tokenSort = $(this).data('sort');
    $('#tokSortAZ, #tokSortZA').removeClass('active');
    $(this).addClass('active');
    tokenRenderLimit = 50;
    renderTokenList();
    showToast(tokenSort === 'az' ? '🔤 Urutan A → Z' : '🔤 Urutan Z → A');
});
$('#tokFavFilter').on('click', function () {
    tokenFavFilter = !tokenFavFilter;
    $(this).toggleClass('active', tokenFavFilter);
    tokenRenderLimit = 50;
    renderTokenList();
    showToast(tokenFavFilter ? '⭐ Filter Favorit ON' : '⭐ Filter Favorit OFF');
});
$('#tokenSearch').on('input', function () {
    tokenSearchQuery = $(this).val().trim();
    tokenRenderLimit = 50;
    clearTimeout(_renderDebounce);
    _renderDebounce = setTimeout(renderTokenList, 150);
});
$('#tokenList').on('click', '#btnLoadMore', function () {
    tokenRenderLimit += 50;
    renderTokenList();
});

// ─── Signal chip click — navigate to card/column ───────────
$('#signalBar').on('click', '.signal-chip', function () {
    const tokId  = this.dataset.tokId;
    const dir    = (this.dataset.dir || '').toLowerCase();
    const hdrIdx = this.dataset.hdrIdx;
    function _doScroll() {
        const card = document.getElementById('card-' + tokId);
        if (!card) return;
        const dexHdr = hdrIdx !== '' && hdrIdx != null
            ? card.querySelector(`.mon-dex-hdr[data-${dir}-hdr="${hdrIdx}"]`) : null;
        const target = dexHdr || card;
        const mc = document.querySelector('.main-content');
        if (mc) {
            const mcRect     = mc.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const scrollTo   = mc.scrollTop + (targetRect.top - mcRect.top)
                             - (mc.clientHeight / 2) + (target.offsetHeight / 2);
            mc.scrollTo({ top: Math.max(0, scrollTo), behavior: 'smooth' });
        } else {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        card.classList.add('card-flash');
        setTimeout(() => card.classList.remove('card-flash'), 1600);
    }
    const isMonitorActive = $('#tabMonitor').is(':visible');
    if (!isMonitorActive) {
        if (scanning) { switchTab('tabMonitor'); requestAnimationFrame(_doScroll); }
        else { _buildCompleteCallback = _doScroll; switchTab('tabMonitor'); }
    } else {
        requestAnimationFrame(_doScroll);
    }
});

// ─── Tooltip event delegation ──────────────────────────────
(function () {
    const ml = document.getElementById('monitorList');
    if (!ml) return;
    ml.addEventListener('mouseover', e => { const h = e.target.closest('.mon-dex-hdr[data-tok]'); if (h) showObTooltip(h); });
    ml.addEventListener('mouseout',  e => { if (e.target.closest('.mon-dex-hdr[data-tok]') && (!e.relatedTarget || !e.relatedTarget.closest('.mon-dex-hdr[data-tok]'))) hideObTooltip(); });
    ml.addEventListener('touchstart', e => { const h = e.target.closest('.mon-dex-hdr[data-tok]'); if (h) { showObTooltip(h); e.stopPropagation(); } }, { passive: false });
})();
$('#obTooltip').on('mouseenter', () => clearTimeout(_tooltipHideTimer)).on('mouseleave', hideObTooltip);

// ─── Scan button handlers ──────────────────────────────────
function lockTabs() { $('#navToken').addClass('disabled'); }
function unlockTabs() { $('#navToken').removeClass('disabled'); }

function _applyAutoReload() {
    $('#btnAutoReload').toggleClass('active', autoReload).attr('title', autoReload ? 'Mode: Auto Reload' : 'Mode: Sekali Scan');
}
$('#btnAutoReload').on('click', function () {
    autoReload = !autoReload;
    localStorage.setItem('scanAutoReload', autoReload ? '1' : '0');
    _applyAutoReload();
    showToast(autoReload ? '🔄 Auto Reload ON' : '⏹ Auto Reload OFF');
});

// ─── Init ──────────────────────────────────────────────────
$(async function () {
    // Inject CSS variables dari config
    injectCssVariables();

    // Migrasi localStorage → IndexedDB (sekali jalan)
    await dbMigrateFromLocalStorage();

    // Load settings
    await loadSettings();

    // Restore auto-reload
    autoReload = localStorage.getItem('scanAutoReload') === '1';
    _applyAutoReload();

    // Initial render
    renderDexConfig();
    renderCexChips('binance');
    renderChainChips('bsc');
    await renderTokenList();

    // Tab awal: Scanner
    switchTab('tabMonitor');

    // Check onboarding
    checkOnboarding();

    // Init USDT rate
    if (typeof fetchUsdtRate === 'function') fetchUsdtRate();

    if (sessionStorage.getItem('justReloaded')) {
        sessionStorage.removeItem('justReloaded');
        showToast('Reload berhasil!');
    }
});
