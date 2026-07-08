const FlipTrackerProStorageService = (() => {
  const schemaVersion = 1;
  const defaultSettings = Object.freeze({
    activeRoute: 'dashboard',
    bazaarFeeRate: 0.03,
    targetRoi: 20
  });

  function getStorageKey(storagePrefix) {
    return `${storagePrefix || 'flipTrackerPro'}:appData:v${schemaVersion}`;
  }

  function getLegacyKey(storagePrefix, suffix) {
    return `${storagePrefix || 'flipTrackerPro'}:${suffix}`;
  }

  function createId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function readJson(key, fallback) {
    try {
      const rawValue = window.localStorage.getItem(key);
      return rawValue ? JSON.parse(rawValue) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function toNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
  }

  function normalizeSale(rawSale) {
    const sale = rawSale && typeof rawSale === 'object' ? rawSale : {};
    const quantity = Math.max(1, toNumber(sale.quantity, 1));
    const buyPrice = toNumber(sale.buyPrice, toNumber(sale.unitCost));
    const sellPrice = toNumber(sale.sellPrice);
    const fees = toNumber(sale.fees);
    const totalBuy = toNumber(sale.totalBuy, buyPrice * quantity);
    const totalSell = toNumber(sale.totalSell, sellPrice * quantity);
    const profit = toNumber(sale.profit, totalSell - totalBuy - fees);
    const margin = toNumber(sale.margin, totalBuy > 0 ? (profit / totalBuy) * 100 : 0);
    const now = new Date().toISOString();

    return {
      ...sale,
      id: sale.id || createId(),
      itemName: String(sale.itemName || 'Unnamed item'),
      buyPrice,
      sellPrice,
      quantity,
      fees,
      totalBuy,
      totalSell,
      profit,
      margin,
      notes: String(sale.notes || ''),
      createdAt: sale.createdAt || now,
      updatedAt: sale.updatedAt || now
    };
  }

  function normalizePurchaseLot(rawLot) {
    const lot = rawLot && typeof rawLot === 'object' ? rawLot : {};
    const quantity = Math.max(1, toNumber(lot.quantity, 1));
    const unitCost = toNumber(lot.unitCost, toNumber(lot.buyPrice));
    const totalCost = toNumber(lot.totalCost, unitCost * quantity);
    const now = new Date().toISOString();

    return {
      id: lot.id || createId(),
      itemName: String(lot.itemName || 'Unnamed item'),
      quantity,
      unitCost,
      totalCost,
      createdAt: lot.createdAt || now,
      updatedAt: lot.updatedAt || now,
      notes: String(lot.notes || ''),
      source: String(lot.source || 'manual')
    };
  }

  function normalizeSettings(settings) {
    const nextSettings = settings && typeof settings === 'object' ? settings : {};

    return {
      ...defaultSettings,
      ...nextSettings,
      activeRoute: String(nextSettings.activeRoute || defaultSettings.activeRoute),
      bazaarFeeRate: toNumber(nextSettings.bazaarFeeRate, defaultSettings.bazaarFeeRate),
      targetRoi: toNumber(nextSettings.targetRoi, defaultSettings.targetRoi)
    };
  }

  function getDefaultData() {
    return {
      schemaVersion,
      settings: normalizeSettings(),
      windowState: {},
      purchaseLots: [],
      sales: [],
      backups: []
    };
  }

  function normalizeData(data) {
    const baseData = getDefaultData();
    const nextData = data && typeof data === 'object' ? data : {};

    return {
      ...baseData,
      ...nextData,
      schemaVersion,
      settings: normalizeSettings(nextData.settings),
      windowState: nextData.windowState && typeof nextData.windowState === 'object' ? nextData.windowState : {},
      purchaseLots: Array.isArray(nextData.purchaseLots) ? nextData.purchaseLots.map(normalizePurchaseLot) : [],
      sales: Array.isArray(nextData.sales) ? nextData.sales.map(normalizeSale) : [],
      backups: Array.isArray(nextData.backups) ? nextData.backups : []
    };
  }

  function readLegacyData(storagePrefix) {
    const flips = readJson(getLegacyKey(storagePrefix, 'flips'), []);
    const openPurchases = readJson(getLegacyKey(storagePrefix, 'openPurchases'), []);
    const windowState = readJson(getLegacyKey(storagePrefix, 'windowState'), readJson(getLegacyKey(storagePrefix, 'windowPosition'), {}));

    return normalizeData({
      windowState: windowState && typeof windowState === 'object' ? windowState : {},
      purchaseLots: Array.isArray(openPurchases) ? openPurchases.map(normalizePurchaseLot) : [],
      sales: Array.isArray(flips) ? flips.map(normalizeSale) : []
    });
  }

  function load(storagePrefix) {
    const storageKey = getStorageKey(storagePrefix);
    const savedData = readJson(storageKey, null);
    const data = savedData ? normalizeData(savedData) : readLegacyData(storagePrefix);

    save(storagePrefix, data);
    return data;
  }

  function save(storagePrefix, data) {
    const normalizedData = normalizeData(data);

    try {
      window.localStorage.setItem(getStorageKey(storagePrefix), JSON.stringify(normalizedData));
      return normalizedData;
    } catch (error) {
      return normalizedData;
    }
  }

  function update(storagePrefix, updater) {
    const currentData = load(storagePrefix);
    const nextData = typeof updater === 'function' ? updater(currentData) : updater;
    return save(storagePrefix, nextData || currentData);
  }

  function exportJson(storagePrefix) {
    return JSON.stringify(load(storagePrefix), null, 2);
  }

  function validateImportData(data) {
    if (!data || typeof data !== 'object') {
      return { ok: false, message: 'Backup data must be an object.' };
    }

    const fields = ['settings', 'windowState', 'purchaseLots', 'sales', 'backups'];
    const hasKnownField = fields.some((field) => Object.prototype.hasOwnProperty.call(data, field));

    if (!hasKnownField && !Array.isArray(data.flips)) {
      return { ok: false, message: 'Backup data does not look like Flip Tracker Pro data.' };
    }

    if (data.purchaseLots && !Array.isArray(data.purchaseLots)) {
      return { ok: false, message: 'Purchase lots must be a list.' };
    }

    if (data.sales && !Array.isArray(data.sales)) {
      return { ok: false, message: 'Sales must be a list.' };
    }

    return { ok: true, message: '' };
  }

  function importJson(storagePrefix, jsonText) {
    let parsedData;

    try {
      parsedData = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
    } catch (error) {
      return { ok: false, message: 'Could not read that JSON file.' };
    }

    const validation = validateImportData(parsedData);

    if (!validation.ok) {
      return validation;
    }

    const importedData = Array.isArray(parsedData.flips)
      ? normalizeData({
        purchaseLots: Array.isArray(parsedData.openPurchases) ? parsedData.openPurchases : [],
        sales: parsedData.flips
      })
      : normalizeData(parsedData);

    save(storagePrefix, importedData);
    return { ok: true, data: importedData, message: 'Backup imported.' };
  }

  return {
    exportJson,
    getDefaultData,
    getStorageKey,
    importJson,
    load,
    normalizePurchaseLot,
    normalizeSale,
    save,
    update,
    validateImportData
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProStorageService = FlipTrackerProStorageService;
}
