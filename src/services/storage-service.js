const FlipTrackerProStorageService = (() => {
  const schemaVersion = 1;
  const validSources = new Set(['manual', 'api', 'future-detected']);
  const defaultSettings = Object.freeze({
    activeRoute: 'dashboard',
    apiDiagnostics: {},
    apiEnabled: false,
    apiKey: '',
    apiLastError: '',
    apiLastErrorCode: '',
    apiLastRequest: {},
    apiStatus: 'disabled',
    bazaarFeeRate: 0.03,
    logImportDebug: {},
    logImportLastRunAt: '',
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
    const numberValue = Number(String(value ?? '').replace(/[$,]/g, ''));
    return Number.isFinite(numberValue) ? numberValue : fallback;
  }

  function toPositiveQuantity(value, fallback = 1) {
    return Math.max(1, Math.floor(toNumber(value, fallback)));
  }

  function toRemainingQuantity(value, quantity) {
    const remaining = Math.floor(toNumber(value, quantity));
    return Math.min(quantity, Math.max(0, remaining));
  }

  function normalizeSource(source) {
    const value = String(source || 'manual');
    return validSources.has(value) ? value : 'manual';
  }

  function normalizeSale(rawSale) {
    const sale = rawSale && typeof rawSale === 'object' ? rawSale : {};
    const quantity = toPositiveQuantity(sale.quantity, 1);
    const unitSellPrice = toNumber(sale.unitSellPrice, toNumber(sale.sellPrice));
    const totalSellPrice = toNumber(sale.totalSellPrice, toNumber(sale.totalSell, unitSellPrice * quantity));
    const matchedBuyCost = toNumber(sale.matchedBuyCost, toNumber(sale.totalBuy, toNumber(sale.buyPrice) * quantity));
    const fees = toNumber(sale.fees);
    const grossProfit = toNumber(sale.grossProfit, totalSellPrice - matchedBuyCost);
    const netProfit = toNumber(sale.netProfit, toNumber(sale.profit, grossProfit - fees));
    const roi = toNumber(sale.roi, toNumber(sale.margin, matchedBuyCost > 0 ? (netProfit / matchedBuyCost) * 100 : 0));
    const soldAt = sale.soldAt || sale.updatedAt || sale.createdAt || new Date().toISOString();
    const updatedAt = sale.updatedAt || soldAt;

    return {
      ...sale,
      id: sale.id || createId(),
      itemId: sale.itemId || undefined,
      itemName: String(sale.itemName || 'Unnamed item'),
      quantity,
      unitSellPrice,
      totalSellPrice,
      matchedBuyCost,
      grossProfit,
      netProfit,
      roi,
      soldAt,
      source: normalizeSource(sale.source),
      notes: String(sale.notes || ''),
      originalLogId: sale.originalLogId ? String(sale.originalLogId) : undefined,
      logTypeId: sale.logTypeId === undefined || sale.logTypeId === '' ? undefined : Number(sale.logTypeId),
      unmatchedSale: Boolean(sale.unmatchedSale),
      importWarning: sale.importWarning ? String(sale.importWarning) : '',
      matchedQuantity: Math.max(0, toNumber(sale.matchedQuantity, quantity - toNumber(sale.unmatchedQuantity))),
      unmatchedQuantity: Math.max(0, toNumber(sale.unmatchedQuantity)),
      matchedLots: Array.isArray(sale.matchedLots) ? sale.matchedLots : [],
      fees,
      buyPrice: quantity > 0 ? matchedBuyCost / quantity : 0,
      sellPrice: unitSellPrice,
      totalBuy: matchedBuyCost,
      totalSell: totalSellPrice,
      profit: netProfit,
      margin: roi,
      createdAt: sale.createdAt || soldAt,
      updatedAt
    };
  }

  function normalizePurchaseLot(rawLot) {
    const lot = rawLot && typeof rawLot === 'object' ? rawLot : {};
    const quantity = toPositiveQuantity(lot.quantity, 1);
    const unitBuyPrice = toNumber(lot.unitBuyPrice, toNumber(lot.unitCost, toNumber(lot.buyPrice)));
    const totalBuyPrice = toNumber(lot.totalBuyPrice, toNumber(lot.totalCost, unitBuyPrice * quantity));
    const now = new Date().toISOString();
    const remainingQuantity = toRemainingQuantity(lot.remainingQuantity, quantity);

    return {
      ...lot,
      id: lot.id || createId(),
      itemId: lot.itemId || undefined,
      itemName: String(lot.itemName || 'Unnamed item'),
      quantity,
      unitBuyPrice,
      totalBuyPrice,
      remainingQuantity,
      createdAt: lot.createdAt || now,
      updatedAt: lot.updatedAt || now,
      notes: String(lot.notes || ''),
      source: normalizeSource(lot.source),
      originalLogId: lot.originalLogId ? String(lot.originalLogId) : undefined,
      logTypeId: lot.logTypeId === undefined || lot.logTypeId === '' ? undefined : Number(lot.logTypeId),
      buyPrice: unitBuyPrice,
      unitCost: unitBuyPrice,
      totalCost: totalBuyPrice
    };
  }

  function normalizeImportReviewItem(rawItem) {
    const item = rawItem && typeof rawItem === 'object' ? rawItem : {};
    const entryId = String(item.entryId || item.originalLogId || item.id || createId());

    return {
      id: item.id || `review-${entryId}`,
      entryId,
      originalLogId: entryId,
      logTypeId: item.logTypeId === undefined || item.logTypeId === '' ? undefined : Number(item.logTypeId),
      timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
      type: item.type === 'sell' ? 'sell' : 'buy',
      textPreview: String(item.textPreview || item.message || item.text || '').slice(0, 320),
      rawKeys: Array.isArray(item.rawKeys) ? item.rawKeys.map(String).slice(0, 40) : [],
      rawSampleKeys: Array.isArray(item.rawSampleKeys) ? item.rawSampleKeys.map(String).slice(0, 40) : [],
      reason: String(item.reason || 'Parser could not create a valid import candidate.'),
      source: 'api',
      createdAt: item.createdAt || new Date().toISOString()
    };
  }

  function normalizeItemPriceSnapshot(rawSnapshot) {
    const snapshot = rawSnapshot && typeof rawSnapshot === 'object' ? rawSnapshot : {};

    return {
      itemId: snapshot.itemId ? String(snapshot.itemId) : '',
      itemName: String(snapshot.itemName || 'Unnamed item'),
      marketPrice: toNumber(snapshot.marketPrice),
      bazaarPrice: snapshot.bazaarPrice === undefined ? undefined : toNumber(snapshot.bazaarPrice),
      timestamp: snapshot.timestamp || new Date().toISOString(),
      source: normalizeSource(snapshot.source || 'api')
    };
  }

  function normalizeImportHistoryEntry(rawEntry) {
    const entry = rawEntry && typeof rawEntry === 'object' ? rawEntry : {};

    return {
      id: entry.id || createId(),
      createdAt: entry.createdAt || new Date().toISOString(),
      from: entry.from || '',
      to: entry.to || '',
      purchasesImported: Math.max(0, toNumber(entry.purchasesImported)),
      salesImported: Math.max(0, toNumber(entry.salesImported)),
      duplicatesSkipped: Math.max(0, toNumber(entry.duplicatesSkipped)),
      unmatchedSales: Math.max(0, toNumber(entry.unmatchedSales)),
      logsReturned: Math.max(0, toNumber(entry.logsReturned)),
      classifiedPurchases: Math.max(0, toNumber(entry.classifiedPurchases)),
      classifiedSales: Math.max(0, toNumber(entry.classifiedSales)),
      reviewCandidatesCreated: Math.max(0, toNumber(entry.reviewCandidatesCreated)),
      parserFailures: Math.max(0, toNumber(entry.parserFailures)),
      validationFailures: Math.max(0, toNumber(entry.validationFailures)),
      warnings: Array.isArray(entry.warnings) ? entry.warnings.map(String).slice(0, 20) : [],
      errors: Array.isArray(entry.errors) ? entry.errors.map(String).slice(0, 20) : []
    };
  }

  function normalizeSettings(settings) {
    const nextSettings = settings && typeof settings === 'object' ? settings : {};
    const apiKey = String(nextSettings.apiKey || '');
    const apiEnabled = Boolean(nextSettings.apiEnabled && apiKey);

    return {
      ...defaultSettings,
      ...nextSettings,
      activeRoute: String(nextSettings.activeRoute || defaultSettings.activeRoute),
      apiDiagnostics: nextSettings.apiDiagnostics && typeof nextSettings.apiDiagnostics === 'object' ? nextSettings.apiDiagnostics : {},
      apiEnabled,
      apiKey,
      apiLastError: String(nextSettings.apiLastError || ''),
      apiLastErrorCode: nextSettings.apiLastErrorCode === undefined ? '' : String(nextSettings.apiLastErrorCode),
      apiLastRequest: nextSettings.apiLastRequest && typeof nextSettings.apiLastRequest === 'object' ? nextSettings.apiLastRequest : {},
      apiStatus: apiEnabled ? String(nextSettings.apiStatus || 'ready') : 'disabled',
      bazaarFeeRate: toNumber(nextSettings.bazaarFeeRate, defaultSettings.bazaarFeeRate),
      logImportDebug: nextSettings.logImportDebug && typeof nextSettings.logImportDebug === 'object' ? nextSettings.logImportDebug : {},
      logImportLastRunAt: String(nextSettings.logImportLastRunAt || ''),
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
      itemPriceSnapshots: [],
      importedLogIds: [],
      importReviewQueue: [],
      importHistory: [],
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
      itemPriceSnapshots: Array.isArray(nextData.itemPriceSnapshots) ? nextData.itemPriceSnapshots.map(normalizeItemPriceSnapshot) : [],
      importedLogIds: Array.isArray(nextData.importedLogIds) ? [...new Set(nextData.importedLogIds.map(String))] : [],
      importReviewQueue: Array.isArray(nextData.importReviewQueue) ? nextData.importReviewQueue.map(normalizeImportReviewItem).slice(0, 100) : [],
      importHistory: Array.isArray(nextData.importHistory) ? nextData.importHistory.map(normalizeImportHistoryEntry).slice(0, 30) : [],
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
      sales: Array.isArray(flips) ? flips.map(normalizeSale) : [],
      importReviewQueue: []
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

    const fields = ['settings', 'windowState', 'purchaseLots', 'sales', 'itemPriceSnapshots', 'importedLogIds', 'importReviewQueue', 'importHistory', 'backups'];
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

    if (data.itemPriceSnapshots && !Array.isArray(data.itemPriceSnapshots)) {
      return { ok: false, message: 'Item price snapshots must be a list.' };
    }

    if (data.importedLogIds && !Array.isArray(data.importedLogIds)) {
      return { ok: false, message: 'Imported log IDs must be a list.' };
    }

    if (data.importReviewQueue && !Array.isArray(data.importReviewQueue)) {
      return { ok: false, message: 'Import review queue must be a list.' };
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
        sales: parsedData.flips,
        importReviewQueue: Array.isArray(parsedData.importReviewQueue) ? parsedData.importReviewQueue : []
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
    normalizeImportHistoryEntry,
    normalizeImportReviewItem,
    normalizeItemPriceSnapshot,
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
