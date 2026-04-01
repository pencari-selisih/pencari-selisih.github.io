// =================================================================================
// RPC DATABASE MIGRATOR - Auto-migrate RPC to Database
// =================================================================================
// Purpose: Automatically migrate default RPC suggestions to database
//
// Architecture:
// - Check if RPC already exists in database
// - If not, initialize with default values from CONFIG_CHAINS.DEFAULT_RPC
// - Provide UI for user to update RPC endpoints
// - All RPC stored centrally in SETTING_SCANNER.userRPCs
//
// SINGLE SOURCE OF TRUTH: RPC default diambil dari CONFIG_CHAINS.DEFAULT_RPC (config.js)
// Tidak ada hardcode URL di file ini.
// =================================================================================

(function() {
    'use strict';

    // ── Ambil default RPC dari config.js (CONFIG_CHAINS.DEFAULT_RPC) ─────────────
    // Sumber kebenaran tunggal: edit DEFAULT_RPC di config.js untuk mengubah default.
    // Fungsi ini dipanggil lazy (saat runtime) agar CONFIG_CHAINS pasti sudah loaded.
    function getInitialRPCValues() {
        try {
            const chains = (typeof window !== 'undefined' && window.CONFIG_CHAINS)
                ? window.CONFIG_CHAINS : {};
            const result = {};
            Object.entries(chains).forEach(([key, cfg]) => {
                if (cfg && typeof cfg.DEFAULT_RPC === 'string' && cfg.DEFAULT_RPC.trim()) {
                    result[key.toLowerCase()] = cfg.DEFAULT_RPC.trim();
                }
            });
            return result;
        } catch (_) { return {}; }
    }

    /**
     * Initialize RPC in database if not exists.
     * Runs once on app startup. Does NOT auto-save; user must click SIMPAN PENGATURAN.
     */
    async function initializeRPCDatabase() {
        try {
            console.log('[RPC Migrator] 🔄 Checking RPC database...');

            const settings = (typeof getFromLocalStorage === 'function')
                ? getFromLocalStorage('SETTING_SCANNER', {})
                : {};

            if (settings.userRPCs && typeof settings.userRPCs === 'object') {
                const existingChains = Object.keys(settings.userRPCs);
                console.log(`[RPC Migrator] ✅ RPC database already initialized with ${existingChains.length} chains:`, existingChains);
                return true;
            }

            // No userRPCs exists — DO NOT auto-save, just inform user
            console.log('[RPC Migrator] ℹ️ No RPC found in database. Default values (from CONFIG_CHAINS.DEFAULT_RPC) will be shown in UI.');
            console.log('[RPC Migrator] ⚠️ User must click SIMPAN PENGATURAN to save RPC settings.');

            return true;

        } catch (error) {
            console.error('[RPC Migrator] ❌ Error initializing RPC database:', error);
            return false;
        }
    }

    /**
     * Get RPC for a specific chain from database.
     * Fallback order: userRPCs (db) → CONFIG_CHAINS.DEFAULT_RPC (config.js) → null
     * @param {string} chainKey
     * @returns {string|null}
     */
    function getRPCFromDatabase(chainKey) {
        try {
            const chainLower = String(chainKey || '').toLowerCase();
            if (!chainLower) {
                console.error('[RPC Migrator] Chain key is required');
                return null;
            }

            const settings = (typeof getFromLocalStorage === 'function')
                ? getFromLocalStorage('SETTING_SCANNER', {})
                : {};

            // 1️⃣ Prioritas: RPC yang disimpan user di database
            if (settings.userRPCs && settings.userRPCs[chainLower]) {
                return settings.userRPCs[chainLower];
            }

            // 2️⃣ Fallback: DEFAULT_RPC dari CONFIG_CHAINS (config.js)
            const defaults = getInitialRPCValues();
            if (defaults[chainLower]) {
                console.warn(`[RPC Migrator] RPC not in database for "${chainKey}", using CONFIG_CHAINS.DEFAULT_RPC`);
                return defaults[chainLower];
            }

            console.error(`[RPC Migrator] No RPC available for chain: ${chainKey}`);
            return null;

        } catch (error) {
            console.error('[RPC Migrator] Error getting RPC from database:', error);
            return null;
        }
    }

    /**
     * Update RPC for a specific chain in the database.
     * @param {string} chainKey
     * @param {string} rpcUrl
     * @returns {boolean}
     */
    function updateRPCInDatabase(chainKey, rpcUrl) {
        try {
            const chainLower = String(chainKey || '').toLowerCase();
            const url = String(rpcUrl || '').trim();

            if (!chainLower) { console.error('[RPC Migrator] Chain key is required'); return false; }
            if (!url)        { console.error('[RPC Migrator] RPC URL is required');   return false; }

            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                console.error('[RPC Migrator] Invalid RPC URL format (must start with http:// or https://)');
                return false;
            }

            const settings = (typeof getFromLocalStorage === 'function')
                ? getFromLocalStorage('SETTING_SCANNER', {})
                : {};

            if (!settings.userRPCs) settings.userRPCs = {};
            settings.userRPCs[chainLower] = url;

            if (typeof saveToLocalStorage === 'function') {
                saveToLocalStorage('SETTING_SCANNER', settings);
                console.log(`[RPC Migrator] ✅ RPC updated for ${chainKey}: ${url}`);
                return true;
            }

            console.error('[RPC Migrator] saveToLocalStorage not available');
            return false;

        } catch (error) {
            console.error('[RPC Migrator] Error updating RPC:', error);
            return false;
        }
    }

    /**
     * Get all RPCs from database.
     * @returns {Object} Map of chainKey -> RPC URL
     */
    function getAllRPCsFromDatabase() {
        try {
            const settings = (typeof getFromLocalStorage === 'function')
                ? getFromLocalStorage('SETTING_SCANNER', {})
                : {};
            return settings.userRPCs || {};
        } catch (error) {
            console.error('[RPC Migrator] Error getting all RPCs:', error);
            return {};
        }
    }

    /**
     * Reset RPC for a chain back to its DEFAULT_RPC value from config.js.
     * @param {string} chainKey
     * @returns {boolean}
     */
    function resetRPCToDefault(chainKey) {
        const chainLower = String(chainKey || '').toLowerCase();
        const defaults = getInitialRPCValues();

        if (!defaults[chainLower]) {
            console.error(`[RPC Migrator] No DEFAULT_RPC in CONFIG_CHAINS for chain: ${chainKey}`);
            return false;
        }

        return updateRPCInDatabase(chainLower, defaults[chainLower]);
    }

    // ====================
    // EXPORT PUBLIC API
    // ====================

    const RPCDatabaseMigrator = {
        initializeRPCDatabase,
        getRPCFromDatabase,
        updateRPCInDatabase,
        getAllRPCsFromDatabase,
        resetRPCToDefault,
        // Getter dinamis — selalu fresh dari CONFIG_CHAINS.DEFAULT_RPC
        get INITIAL_RPC_VALUES() { return getInitialRPCValues(); }
    };

    if (typeof window !== 'undefined') {
        window.RPCDatabaseMigrator = RPCDatabaseMigrator;
    }

    // Auto-initialize dengan delay agar storage.js & config.js sudah loaded
    if (typeof window !== 'undefined') {
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => { initializeRPCDatabase(); }, 500);
        });
    }

    console.log('[RPC Database Migrator] ✅ Module initialized (DEFAULT_RPC from CONFIG_CHAINS)');

})();
