// ============================================================
// MOBILE SCANNER — ui/ui-extra.js
// Adaptasi dari MINI/ui/ui-extra.js:
// - Kalkulator sederhana (UIkit modal #modalCalc)
// - Multi-row calc dihapus (tidak ada di index.html MOBILE)
// - openCalcModal/closeBulkModal ditangani UIkit / ui.js
// ============================================================

// ─── Rate Display ─────────────────────────────────────────
function _updateCalcRateDisplay() {
    const el = document.getElementById('calcRateVal');
    if (el) el.textContent = 'Rp ' + (usdtRate || 0).toLocaleString('id-ID');
}

// ─── Konverter Kalkulator Sederhana ───────────────────────
function onCalcField(source) {
    const usdt        = parseFloat($('#cfUsdt').val())       || 0;
    const idr         = parseFloat($('#cfIdr').val())        || 0;
    const customAmt   = parseFloat($('#cfCustomAmt').val())  || 0;
    const customPrice = parseFloat($('#cfCustomPrice').val())|| 0;

    let usdtVal = 0;
    switch (source) {
        case 'usdt':   usdtVal = usdt; break;
        case 'idr':    usdtVal = usdtRate > 0 ? idr / usdtRate : 0; break;
        case 'custom': usdtVal = customAmt * customPrice; break;
    }

    if (source !== 'usdt') {
        $('#cfUsdt').val(usdtVal ? usdtVal.toFixed(usdtVal < 1 ? 6 : 2) : '');
    }
    if (source !== 'idr') {
        const idrVal = usdtVal && usdtRate ? usdtVal * usdtRate : 0;
        $('#cfIdr').val(idrVal ? (idrVal < 1 ? idrVal.toFixed(4) : Math.round(idrVal)) : '');
    }
    if (source !== 'custom' && customPrice > 0) {
        $('#cfCustomAmt').val(usdtVal ? (usdtVal / customPrice).toFixed(6) : '');
    }
}

// ─── Update Rate IDR ──────────────────────────────────────
async function calcUpdatePrice() {
    showToast('⏳ Mengambil rate IDR...');
    try {
        await fetchUsdtRate();
        _updateCalcRateDisplay();
        showToast('✅ Rate IDR berhasil diupdate!');
        // Re-hitung field yang sudah ada isi
        const active = ['usdt','idr'].find(f =>
            parseFloat($('#cf' + f.charAt(0).toUpperCase() + f.slice(1)).val()) > 0
        );
        if (active) onCalcField(active);
    } catch (e) {
        showToast('🗑️ Gagal mengambil rate: ' + e.message);
    }
}

// ─── Cek Harga Token (CoinGecko) ─────────────────────────
async function calcCekToken() {
    const sym = ($('#cfCustomSym').val() || '').trim().toLowerCase();
    if (!sym) {
        showAlert('Isi symbol token terlebih dahulu (contoh: SOL)', 'Cek Token', 'warn');
        return;
    }
    showToast('🔍 Mencari ' + sym.toUpperCase() + '...');
    try {
        const resp = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${sym}&vs_currencies=usd`);
        const data = await resp.json();
        let price = data[sym]?.usd;
        if (!price) {
            const search = await fetch(`https://api.coingecko.com/api/v3/search?query=${sym}`);
            const sData  = await search.json();
            const coin   = sData.coins?.[0];
            if (coin) {
                const resp2 = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=usd`);
                const data2 = await resp2.json();
                price = data2[coin.id]?.usd;
                if (price) $('#cfCustomSym').val(coin.symbol.toUpperCase());
            }
        }
        if (price) {
            $('#cfCustomPrice').val(price);
            $('#cfCustomLbl').text(sym.toUpperCase());
            showToast(`✅ ${sym.toUpperCase()} = $${price}`);
            onCalcField('custom');
        } else {
            showToast('🗑️ Token tidak ditemukan');
        }
    } catch (e) {
        showToast('🗑️ Error: ' + e.message);
    }
}

// ─── Sync rate saat kalkulator dibuka ────────────────────
UIkit.util.on('#modalCalc', 'show', function () {
    _updateCalcRateDisplay();
});

window.__uiExtraLoaded = true;
