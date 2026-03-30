// ============================================================
// CEXDEX-COMPARE — config.js
// Dev-only config. Diisi oleh developer, TIDAK diubah user.
// ============================================================


// ============================================================
// APP_DEV_CONFIG — Metadata aplikasi & API keys global
// TIDAK memuat timing/interval — lihat CONFIG_MONITORING
// ============================================================
const APP_DEV_CONFIG = {
  appName:    "MOBILE SCANNER",
  appVersion: "03.30",

  telegramBotToken:  "8053447166:AAH7YYbyZ4eBoPX31D8h3bCYdzEeIaiG4JU",
  telegramGroupId:   "-5271018516",
  telegramCooldown:  5,   // menit

  corsProxy: "https://vercel-proxycors.vercel.app/?url=",

  // Biaya trading per CEX (0.001 = 0.1%)
  fees: {
    binance: 0.001,
    gate:    0.0015,
    mexc:    0.0015,
    indodax: 0.002,
  },

  bungeeApiKey:    "71XdjSawshaeie5DeH5b9avPjaoVtoOc2g5ZZx1d",
  bungeeAffiliate: "609913096e183b62cecd0dfdc13382f618baedceb5fef75aad43e6cbff367039708902197e0b2b78b1d76cb0837ad0b318baedceb5fef75aad43e6cb",
};


// ============================================================
// CONFIG_MONITORING — Konsep monitoring harga CEX & DEX
//
// Menggantikan: defaultInterval, defaultSseTimeout,
//               scanBatchSize, maxDexDisplay, defaultMinPnl,
//               defaultLevelCount, defaultAutoLevel,
//               offDexResultScan (semua dipindah ke sini).
//
// Dua mode kerja:
//   'once' → scan semua token sekali lalu berhenti
//   'loop' → scan terus-menerus dengan jeda loopJeda ms
//            antar iterasi (cocok untuk pantau harga live)
//
// Alur per iterasi:
//   Token dibagi per batchSize
//   ├─ Dalam batch: tiap token di-stagger jedaAntarToken ms
//   │              lalu CEX & DEX di-fetch paralel
//   └─ Antar batch: tunggu jedaAntarBatch ms
// ============================================================
const CONFIG_MONITORING = {

  // ── Mode & Loop ───────────────────────────────────────────
  mode:          'once',   // 'once' | 'loop'
  loopJeda:      1800,      // ms antara iterasi (hanya jika mode = 'loop')

  // ── Batch Control ─────────────────────────────────────────
  batchSize:      5,     // token diproses bersamaan per batch
  jedaAntarBatch: 300,   // ms jeda sebelum batch berikutnya
  jedaAntarToken: 0,     // ms stagger antar token dalam batch (0 = paralel penuh)
  jedaCtD:        200,   // ms — default jeda arah CEX→DEX (override di timing DEX jika perlu)
  jedaDtC:        280,   // ms — default jeda arah DEX→CEX (override di timing DEX jika perlu)

  // ── Tampilan & Filter ─────────────────────────────────────
  maxDexDisplay:    5,     // maks kolom DEX yang tampil per baris hasil
  minPnl:           1,     // maks PnL (USD) minimum untuk tampil & alert Telegram
  levelCount:       4,     // jumlah level orderbook default
  autoLevel:        true,  // hitung level otomatis dari depth orderbook

  // ── DEX dikecualikan dari hasil scan ──────────────────────
  offDexResultScan: ['OPENOCEAN', 'MAYAN', 'UNISWAP'],
};


// ============================================================
// CONFIG_DEX — Source of truth semua DEX & metaDEX aggregator
//
// timing per DEX:
//   timeout : ms — AbortSignal.timeout untuk fetch quote
//   jeda    : ms — override jeda per-DEX (opsional, jika tidak
//             diset pakai CONFIG_MONITORING.jedaCtD / jedaDtC)
// ============================================================
const CONFIG_DEX = {

  // ── METADEX (multi-route aggregator) ─────────────────────
  metax: {
    label:    'METAX',
    badge:    'MT',
    color:    '#e87122',
    icon:     'icons/dex/metax.png',
    hasCount: true,
    count:    4,       // jumlah route (1–5)
    enabled:  true,
    timing: {
      timeout: 5000,   // ms
      jeda: 300,    // ms
    },
  },

  onekey: {
    label:    'ONEKEY',
    badge:    'KY',
    color:    '#00b812',
    icon:     'icons/dex/onekey.png',
    hasCount: true,
    count:    3,       // jumlah provider (OKX, 1INCH, MATCHA, dll)
    enabled:  true,
    timing: {
      timeout: 5000,
      jeda: 300,
    },
  },

  // ── DEX LANGSUNG ─────────────────────────────────────────
  kyber: {
    label:    'KYBER',
    badge:    'KB',
    color:    '#087808ff',
    icon:     'icons/dex/kyber.png',
    hasCount: false,
    count:    1,       // sumber: Kyber direct + Krystal[filter Kyber]
    enabled:  true,
    timing: {
      timeout: 3000,
      jeda: 300,
    },
  },

  okx: {
    label:    'OKX',
    badge:    'OK',
    color:    '#333333',
    icon:     'icons/dex/okx.png',
    hasCount: false,
    count:    1,       // sumber: C98[OKX] + Krystal[filter OKX]
    enabled:  true,
    timing: {
      timeout: 2000,
      jeda: 300,
    },
  },

  lifidex: {
    label:    'LIFIDEX',
    badge:    'LF',
    color:    '#f15ba1ff',
    icon:     'icons/dex/lifi.png',
    hasCount: false,
    count:    1,       // sumber: Temple API + C98[LiFi]
    enabled:  true,
    timing: {
      timeout: 2000,   // LiFi cross-chain butuh lebih lama
      jeda: 300,
    },
  },

  matcha: {
    label:    'MATCHA',
    badge:    'MA',
    color:    '#00d395',
    icon:     'icons/dex/matcha.png',
    hasCount: false,
    count:    1,       // sumber: 1Delta proxy + Rainbow proxy
    enabled:  true,
    timing: {
      timeout: 3500,
      jeda: 300,
    },
  },
};


// ============================================================
// CONFIG_CEX — 4 Exchange (orderbook + symbol + timing + apiKeys)
//
// apiKeys   : digunakan oleh services/cex-wallet.js untuk fetch fee WD
// timing    :
//   timeout    : ms — max tunggu response orderbook
//   retryDelay : ms — jeda antar percobaan ulang
//   maxRetry   : maks percobaan ulang jika gagal / harga invalid
//   cacheMs    : ms — durasi cache orderbook
// ============================================================
const CONFIG_CEX = {

  binance: {
    label: "Binance",
    ICON:  "icons/cex/binance.png",
    WARNA: "#e0a50c",
    ORDERBOOK: {
      urlTpl: (sym) => `https://data-api.binance.vision/api/v3/depth?limit=5&symbol=${sym.toUpperCase()}`,
      parser: "standard",
      proxy:  false,
    },
    symbolFmt: (ticker) => ticker.toUpperCase() + "USDT",
    timing: {
      timeout:    1000,   // ms
      jeda:    150,   // ms
    },
    apiKeys: {
      ApiKey:    "PoMTZjrgq2rUNQHpqvoOW0Ajq1iKytG3OZueMyvYwJmMaH175kuVi2QyB98Zocnb",
      ApiSecret: "bBq5FCpuCghA0hJuil7gCObTqDzYaLaVdsZVsdfSzv4MZ2rDBK6cpN590eXAwfod",
    },
  },

  gate: {
    label: "Gate",
    ICON:  "icons/cex/gate.png",
    WARNA: "#D5006D",
    ORDERBOOK: {
      urlTpl: (sym) => `https://api.gateio.ws/api/v4/spot/order_book?limit=5&currency_pair=${sym.toUpperCase()}`,
      parser: "standard",
      proxy:  true,
    },
    symbolFmt: (ticker) => ticker.toUpperCase() + "_USDT",
       timing: {
      timeout:    3000,   // ms
      jeda:    300,   // ms
    },

    apiKeys: {
      ApiKey:    "1dbe3d4c92a42de270692e65952574d0",
      ApiSecret: "9436bfec02a8ed462bda4bd1a516ba82b4f322dd09e120a2bf7ea6b5f0930ef8",
    },
  },

  mexc: {
    label: "MEXC",
    ICON:  "icons/cex/mexc.png",
    WARNA: "#1448ce",
    ORDERBOOK: {
      urlTpl: (sym) => `https://api.mexc.com/api/v3/depth?symbol=${sym.toUpperCase()}&limit=5`,
      parser: "standard",
      proxy:  true,
    },
    symbolFmt: (ticker) => ticker.toUpperCase() + "USDT",
    timing: {
      timeout:    4000,   // ms
      jeda:    400,   // ms
    },

    apiKeys: {
      ApiKey:    "mx0vglNkKpxcAAEbtk",
      ApiSecret: "54a488c04cdf4afabf44dd07915731c6",
    },
  },

  indodax: {
    label: "Indodax",
    ICON:  "icons/cex/indodax.png",
    WARNA: "#2eb5f2",
    ORDERBOOK: {
      urlTpl: (sym) => `https://indodax.com/api/depth/${sym.toLowerCase()}`,
      parser: "indodax",
      proxy:  true,
    },
    symbolFmt: (ticker) => ticker.toLowerCase() + "idr",
    timing: {
      timeout:    3500,   // Indodax endpoint kadang lebih lambat
      jeda: 350,
    },
    apiKeys: {
      ApiKey:    "HRKOX8GL-KD9ANNF5-T7OKENAH-LHL5PBYQ-NW8GQICL",
      ApiSecret: "2ff67f7546f9b1af3344f4012fbb5561969de9440f1d1432c89473d1fe007deb3f3d0bac7400622b",
    },
  },
};


// ============================================================
// CONFIG_CHAINS — 5 Chain (tidak berubah)
// ============================================================
const CONFIG_CHAINS = {
  bsc: {
    Kode_Chain: 56,
    RPC:        'https://rpc.llama-rpc.com/bsc?source=llamaswap',
    GAS_UNITS:  200_000,
    USDT_SC:    '0x55d398326f99059fF775485246999027B3197955',
    USDT_DEC:   18,
    label:       "BSC",
    Nama_Pendek: "bsc",
    WARNA:       "#f0af18",
    ICON:        "icons/chains/bsc.png",
    URL_Chain:   "https://bscscan.com",
    DATAJSON:    "https://watchmarket.github.io/JSON/SNAPSHOT_koin_BSC.json",
    LINKS: {
      token: (addr) => `https://bscscan.com/token/${addr}`,
    },
    WALLET_CEX: {
      GATE:    { address: '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe' },
      BINANCE: { address: '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3', address2: '0xe2fc31F816A9b94326492132018C3aEcC4a93aE1' },
      MEXC:    { address: '0x4982085C9e2F89F2eCb8131Eca71aFAD896e89CB' },
      INDODAX: { address: '0xaBa3002AB1597433bA79aBc48eeAd54DC10A45F2', address2: '0x3C02290922a3618A4646E3BbCa65853eA45FE7C6' },
    },
  },

  ethereum: {
    Kode_Chain: 1,
    RPC:        'https://rpc.llama-rpc.com/ethereum?source=llamaswap',
    GAS_UNITS:  300_000,
    USDT_SC:    '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    USDT_DEC:   6,
    label:       "Ethereum",
    Nama_Pendek: "erc",
    WARNA:       "#8098ee",
    ICON:        "icons/chains/ethereum.png",
    URL_Chain:   "https://etherscan.io",
    DATAJSON:    "https://watchmarket.github.io/JSON/SNAPSHOT_koin_ETHEREUM.json",
    LINKS: {
      token: (addr) => `https://etherscan.io/token/${addr}`,
    },
    WALLET_CEX: {
      GATE:    { address: '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe' },
      BINANCE: { address: '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d', address2: '0x28C6c06298d514Db089934071355E5743bf21d60', address3: '0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549' },
      INDODAX: { address: '0x3C02290922a3618A4646E3BbCa65853eA45FE7C6', address2: '0x91Dca37856240E5e1906222ec79278b16420Dc92' },
      MEXC:    { address: '0x75e89d5979E4f6Fba9F97c104c2F0AFB3F1dcB88', address2: '0x9642b23Ed1E01Df1092B92641051881a322F5D4E' },
    },
  },

  polygon: {
    Kode_Chain: 137,
    RPC:        'https://rpc.llama-rpc.com/polygon?source=llamaswap',
    GAS_UNITS:  200_000,
    USDT_SC:    '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    USDT_DEC:   6,
    label:       "Polygon",
    Nama_Pendek: "poly",
    WARNA:       "#cd72f4",
    ICON:        "icons/chains/polygon.png",
    URL_Chain:   "https://polygonscan.com",
    DATAJSON:    "https://watchmarket.github.io/JSON/SNAPSHOT_koin_POLYGON.json",
    LINKS: {
      token: (addr) => `https://polygonscan.com/token/${addr}`,
    },
    WALLET_CEX: {
      GATE:    { address: '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe' },
      BINANCE: { address: '0x290275e3db66394C52272398959845170E4DCb88', address2: '0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245' },
      MEXC:    { address: '0x51E3D44172868Acc60D68ca99591Ce4230bc75E0' },
      INDODAX: { address: '0x3C02290922a3618A4646E3BbCa65853eA45FE7C6', address2: '0x91Dca37856240E5e1906222ec79278b16420Dc92' },
    },
  },

  arbitrum: {
    Kode_Chain: 42161,
    RPC:        'https://rpc.llama-rpc.com/arbitrum?source=llamaswap',
    GAS_UNITS:  700_000,
    USDT_SC:    '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    USDT_DEC:   6,
    label:       "Arbitrum",
    Nama_Pendek: "arb",
    WARNA:       "#a6b0c3",
    ICON:        "icons/chains/arbitrum.png",
    URL_Chain:   "https://arbiscan.io",
    DATAJSON:    "https://watchmarket.github.io/JSON/SNAPSHOT_koin_ARBITRUM.json",
    LINKS: {
      token: (addr) => `https://arbiscan.io/token/${addr}`,
    },
    WALLET_CEX: {
      GATE:    { address: '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe' },
      BINANCE: { address: '0x290275e3db66394C52272398959845170E4DCb88', address2: '0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245' },
      MEXC:    { address: '0x4982085C9e2F89F2eCb8131Eca71aFAD896e89CB' },
      INDODAX: { address: '0x3C02290922a3618A4646E3BbCa65853eA45FE7C6' },
    },
  },

  base: {
    Kode_Chain: 8453,
    RPC:        'https://rpc.llama-rpc.com/base?source=llamaswap',
    GAS_UNITS:  300_000,
    USDT_SC:    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    USDT_DEC:   6,
    label:       "Base",
    Nama_Pendek: "base",
    WARNA:       "#1e46f9",
    ICON:        "icons/chains/base.png",
    URL_Chain:   "https://basescan.org",
    DATAJSON:    "https://watchmarket.github.io/JSON/SNAPSHOT_koin_BASE.json",
    LINKS: {
      token: (addr) => `https://basescan.org/token/${addr}`,
    },
    WALLET_CEX: {
      GATE:    { address: '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe' },
      BINANCE: { address: '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d', address2: '0x28C6c06298d514Db089934071355E5743bf21d60' },
      MEXC:    { address: '0x4e3ae00E8323558fA5Cac04b152238924AA31B60' },
      INDODAX: { address: '0x3C02290922a3618A4646E3BbCa65853eA45FE7C6', address2: '0x91Dca37856240E5e1906222ec79278b16420Dc92' },
    },
  },
};
