const FlipTrackerProLogImportDebugService = (() => {
  const blockedKeyPattern = /key|token|password|secret/i;

  function getConfig() {
    return window.FlipTrackerProConfig || {};
  }

  function getStorageService() {
    return window.FlipTrackerProStorageService;
  }

  function getTornApiService() {
    return window.FlipTrackerProTornApiService;
  }

  function getLogImportService() {
    return window.FlipTrackerProLogImportService;
  }

  function getBuyLogIds() {
    const config = getConfig();
    return Array.isArray(config.buyLogIds) ? config.buyLogIds.map(Number).filter(Boolean) : [1225, 1220, 4201, 1112, 1103, 4200, 5927, 5510];
  }

  function getSellLogIds() {
    const config = getConfig();
    return Array.isArray(config.sellLogIds) ? config.sellLogIds.map(Number).filter(Boolean) : [1226, 1221, 1113, 1104, 4210, 5928, 5511];
  }

  function sanitizeDebugValue(value, depth = 0) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.length > 300 ? `${value.slice(0, 300)}...` : value;
    if (depth >= 4) return Array.isArray(value) ? `[Array(${value.length})]` : '[Object]';
    if (Array.isArray(value)) {
      return value.slice(0, 20).map((entry) => sanitizeDebugValue(entry, depth + 1));
    }
    if (typeof value === 'object') {
      const output = {};
      Object.keys(value).slice(0, 40).forEach((key) => {
        if (blockedKeyPattern.test(key)) return;
        const sanitized = sanitizeDebugValue(value[key], depth + 1);
        if (sanitized !== undefined) output[key] = sanitized;
      });
      return output;
    }
    return String(value).slice(0, 300);
  }

  function toNumber(value, fallback = 0) {
    const numberValue = Number(String(value ?? '').replace(/[$,]/g, ''));
    return Number.isFinite(numberValue) ? numberValue : fallback;
  }

  function hasValue(value) {
    return value !== undefined && value !== null && value !== '';
  }

  function getRaw(log = {}) {
    return log.raw && typeof log.raw === 'object' ? log.raw : {};
  }

  function getRawData(log = {}) {
    const raw = getRaw(log);
    return raw.data && typeof raw.data === 'object' ? raw.data : log.data && typeof log.data === 'object' ? log.data : {};
  }

  function getLogTitle(log = {}) {
    const raw = getRaw(log);
    return String(log.title || raw.title || '');
  }

  function getLogCategory(log = {}) {
    const raw = getRaw(log);
    return String(log.category || raw.category || '');
  }

  function getLogText(log = {}) {
    return String(log.text || log.message || log.title || getRaw(log).title || '').replace(/\s+/g, ' ').trim();
  }

  function getEntryId(log = {}) {
    return String(log.entryId || log.originalLogId || log.id || `${log.timestamp || log.time || Date.now()}-${getLogText(log).slice(0, 80)}`);
  }

  function getLogTimestamp(log = {}) {
    return log.timestamp || log.time || log.created_at || log.createdAt || log.date || '';
  }

  function timestampToIso(value) {
    if (!value) return new Date().toISOString();
    if (/^\d+$/.test(String(value))) {
      const numberValue = Number(value);
      const seconds = String(value).length > 10 ? Math.floor(numberValue / 1000) : numberValue;
      return new Date(seconds * 1000).toISOString();
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
  }

  function scanItemNames(value, itemMap, depth = 0) {
    if (!value || depth > 5) return;
    if (Array.isArray(value)) {
      value.slice(0, 5000).forEach((entry) => scanItemNames(entry, itemMap, depth + 1));
      return;
    }
    if (typeof value !== 'object') return;
    Object.entries(value).slice(0, 5000).forEach(([key, entry]) => {
      if (blockedKeyPattern.test(key)) return;
      if (entry && typeof entry === 'object') {
        const itemId = entry.itemId || entry.item_id || entry.id || (/^\d+$/.test(key) ? key : '');
        const itemName = entry.itemName || entry.item_name || entry.name || entry.title || '';
        if (itemId && itemName) itemMap.set(String(itemId), String(itemName));
        scanItemNames(entry.items || entry.data || entry.children, itemMap, depth + 1);
        return;
      }
      if (/^\d+$/.test(key) && typeof entry === 'string') itemMap.set(String(key), entry);
    });
  }

  function createItemNameResolver(data = {}) {
    const itemMap = new Map();
    (Array.isArray(data.itemPriceSnapshots) ? data.itemPriceSnapshots : []).forEach((snapshot) => {
      if (snapshot && snapshot.itemId && snapshot.itemName) itemMap.set(String(snapshot.itemId), String(snapshot.itemName));
    });
    scanItemNames(data.itemMap, itemMap);
    scanItemNames(data.items, itemMap);
    scanItemNames(data.tornItems, itemMap);
    scanItemNames(data.settings && data.settings.itemMap, itemMap);
    scanItemNames(data.settings && data.settings.items, itemMap);
    scanItemNames(data.settings && data.settings.tornItems, itemMap);
    scanItemNames(data.settings && data.settings.itemPriceSnapshots, itemMap);
    return (itemId) => {
      const id = String(itemId || '');
      return id ? itemMap.get(id) || '' : '';
    };
  }

  function resolvePurchaseItem(itemId, resolveItemName) {
    const id = String(itemId || '');
    const resolvedName = resolveItemName ? resolveItemName(id) : '';
    return {
      itemId: id,
      itemName: resolvedName || `Item #${id}`,
      needsNameReview: !resolvedName
    };
  }

  function isItemMarketBuyLog(log = {}) {
    const logTypeId = Number(log.logTypeId || getRaw(log).log);
    const title = getLogTitle(log).toLowerCase();
    const category = getLogCategory(log).toLowerCase();
    return getBuyLogIds().includes(logTypeId) && (
      logTypeId === 1112
      || title.includes('item market buy')
      || (title.includes('item market') && title.includes('buy'))
      || (category.includes('item market') && title.includes('buy'))
    );
  }

  function parseStructuredItemMarketBuy(log = {}, resolveItemName = () => '') {
    const data = getRawData(log);
    const firstItem = Array.isArray(data.items) ? data.items[0] : null;
    if (!isItemMarketBuyLog(log) || !firstItem) return null;
    if (!hasValue(firstItem.id) || !hasValue(firstItem.qty) || !hasValue(data.cost_total) || !hasValue(data.cost_each)) return null;
    const quantity = toNumber(firstItem.qty);
    const unitBuyPrice = toNumber(data.cost_each);
    const totalBuyPrice = toNumber(data.cost_total);
    if (!firstItem.id || quantity <= 0 || unitBuyPrice <= 0 || totalBuyPrice <= 0) return null;
    const resolved = resolvePurchaseItem(firstItem.id, resolveItemName);
    return {
      ...resolved,
      quantity,
      unitBuyPrice,
      totalBuyPrice,
      remainingQuantity: quantity,
      source: 'api',
      originalLogId: getEntryId(log),
      logTypeId: Number(log.logTypeId || getRaw(log).log) || undefined,
      createdAt: timestampToIso(getLogTimestamp(log)),
      notes: hasValue(data.seller) && Number(data.seller) > 0
        ? `Seller ID: ${data.seller}${data.anonymous ? ' (anonymous)' : ''}`
        : data.anonymous ? 'Seller anonymous' : '',
      parserKind: 'structured-item-market-buy'
    };
  }

  function parseStructuredItemAbroadBuy(log = {}, resolveItemName = () => '') {
    const data = getRawData(log);
    const logTypeId = Number(log.logTypeId || getRaw(log).log);
    const title = getLogTitle(log).toLowerCase();
    const isAbroadBuy = logTypeId === 4201 || title.includes('item abroad buy');
    if (!isAbroadBuy) return null;
    if (!hasValue(data.item) || !hasValue(data.quantity) || !hasValue(data.cost_each) || !hasValue(data.cost_total)) return null;
    const quantity = toNumber(data.quantity);
    const unitBuyPrice = toNumber(data.cost_each);
    const totalBuyPrice = toNumber(data.cost_total);
    if (!data.item || quantity <= 0 || unitBuyPrice <= 0 || totalBuyPrice <= 0) return null;
    const resolved = resolvePurchaseItem(data.item, resolveItemName);
    return {
      ...resolved,
      quantity,
      unitBuyPrice,
      totalBuyPrice,
      remainingQuantity: quantity,
      source: 'api',
      originalLogId: getEntryId(log),
      logTypeId: logTypeId || undefined,
      createdAt: timestampToIso(getLogTimestamp(log)),
      notes: hasValue(data.area) ? `Abroad area: ${data.area}` : '',
      parserKind: 'structured-item-abroad-buy'
    };
  }

  function parseStructuredBuy(log = {}, resolveItemName = () => '') {
    return parseStructuredItemMarketBuy(log, resolveItemName) || parseStructuredItemAbroadBuy(log, resolveItemName);
  }

  function isRecognizedLog(log = {}) {
    const logTypeId = Number(log.logTypeId);
    const text = getLogText(log);
    return getBuyLogIds().includes(logTypeId)
      || getSellLogIds().includes(logTypeId)
      || /item\s+market\s+(buy|sell|sale)/i.test(text)
      || /\byou bought\b.+\bon the item market\b/i.test(text)
      || /\byou sold\b.+\bon the item market\b/i.test(text);
  }

  function createRecognizedLogDebugSample(log = {}) {
    const raw = getRaw(log);
    const rawKeys = Array.isArray(log.rawKeys)
      ? log.rawKeys
      : Array.isArray(log.rawSampleKeys) ? log.rawSampleKeys : Object.keys(raw);
    return {
      entryId: getEntryId(log),
      logTypeId: Number(log.logTypeId) || '',
      timestamp: getLogTimestamp(log) || '',
      title: getLogTitle(log),
      textPreview: getLogText(log).slice(0, 300),
      rawKeys: rawKeys.slice(0, 40),
      rawLog: sanitizeDebugValue(raw.log),
      rawTitle: sanitizeDebugValue(raw.title),
      rawCategory: sanitizeDebugValue(raw.category),
      rawDataPreview: sanitizeDebugValue(raw.data !== undefined ? raw.data : log.data),
      rawParamsPreview: sanitizeDebugValue(raw.params !== undefined ? raw.params : log.params)
    };
  }

  function summarizeRecognizedLogs(logs = []) {
    return (Array.isArray(logs) ? logs : [])
      .filter(isRecognizedLog)
      .slice(0, 10)
      .map(createRecognizedLogDebugSample);
  }

  function getStoredDebug(storagePrefix = '') {
    const storageService = getStorageService();
    const data = storageService && typeof storageService.load === 'function'
      ? storageService.load(storagePrefix)
      : { settings: {} };
    return data.settings && data.settings.logImportDebug || {};
  }

  function getStoredRecognizedLogs(storagePrefix = '') {
    const debug = getStoredDebug(storagePrefix);
    if (Array.isArray(debug.rawRecognizedLogs) && debug.rawRecognizedLogs.length) return debug.rawRecognizedLogs.slice(0, 10);
    if (Array.isArray(debug.firstRecognizedLogs) && debug.firstRecognizedLogs.length) return debug.firstRecognizedLogs.slice(0, 10);
    return [];
  }

  function createRawRecognizedLogsReport(storagePrefix = '') {
    const debug = getStoredDebug(storagePrefix);
    return {
      appVersion: getConfig().version || debug.appVersion || '',
      generatedAt: new Date().toISOString(),
      recognizedLogs: getStoredRecognizedLogs(storagePrefix).map((log) => ({
        entryId: log.entryId || '',
        logTypeId: log.logTypeId || '',
        timestamp: log.timestamp || '',
        title: log.title || '',
        textPreview: log.textPreview || '',
        rawKeys: Array.isArray(log.rawKeys) ? log.rawKeys : [],
        rawLog: log.rawLog,
        rawCategory: log.rawCategory,
        rawDataPreview: log.rawDataPreview,
        rawParamsPreview: log.rawParamsPreview
      }))
    };
  }

  function removeImportedReviewItems(reviewQueue, importedEntryIds) {
    return (Array.isArray(reviewQueue) ? reviewQueue : []).filter((item) => {
      const entryId = String(item.entryId || item.originalLogId || item.id || '');
      return !importedEntryIds.has(entryId);
    });
  }

  function getImportedIds(data) {
    const importedIds = new Set(Array.isArray(data.importedLogIds) ? data.importedLogIds.map(String) : []);
    (Array.isArray(data.purchaseLots) ? data.purchaseLots : []).forEach((lot) => {
      if (lot.originalLogId) importedIds.add(String(lot.originalLogId));
    });
    (Array.isArray(data.sales) ? data.sales : []).forEach((sale) => {
      if (sale.originalLogId) importedIds.add(String(sale.originalLogId));
    });
    return importedIds;
  }

  function importStructuredBuysFromLogs(storagePrefix, logs = [], summary = null, requestDebug = {}) {
    const storageService = getStorageService();
    if (!storageService || typeof storageService.update !== 'function') {
      return { saved: 0, duplicates: 0, marketMatches: 0, abroadMatches: 0, debug: requestDebug };
    }

    const samples = summarizeRecognizedLogs(logs);
    const parserStats = {
      saved: 0,
      duplicates: 0,
      marketMatches: 0,
      abroadMatches: 0,
      importedEntryIds: new Set()
    };
    let nextDebug = {};

    const savedData = storageService.update(storagePrefix, (data) => {
      const importedIds = getImportedIds(data);
      const resolveItemName = createItemNameResolver(data);
      let purchaseLots = Array.isArray(data.purchaseLots) ? [...data.purchaseLots] : [];
      const nextImportedIds = new Set(importedIds);

      (Array.isArray(logs) ? logs : []).forEach((log) => {
        const marketCandidate = parseStructuredItemMarketBuy(log, resolveItemName);
        const abroadCandidate = marketCandidate ? null : parseStructuredItemAbroadBuy(log, resolveItemName);
        const candidate = marketCandidate || abroadCandidate;
        if (marketCandidate) parserStats.marketMatches += 1;
        if (abroadCandidate) parserStats.abroadMatches += 1;
        if (!candidate) return;

        const entryId = String(candidate.originalLogId || getEntryId(log));
        if (nextImportedIds.has(entryId)) {
          parserStats.duplicates += 1;
          return;
        }

        purchaseLots = [storageService.normalizePurchaseLot(candidate), ...purchaseLots];
        nextImportedIds.add(entryId);
        parserStats.importedEntryIds.add(entryId);
        parserStats.saved += 1;
      });

      const reviewQueue = removeImportedReviewItems(data.importReviewQueue, parserStats.importedEntryIds);
      const previousDebug = data.settings && data.settings.logImportDebug || {};
      nextDebug = buildStructuredDebug(previousDebug, requestDebug, summary, parserStats, samples, reviewQueue.length);

      return {
        ...data,
        purchaseLots,
        importedLogIds: [...nextImportedIds],
        importReviewQueue: reviewQueue,
        settings: {
          ...data.settings,
          logImportDebug: nextDebug,
          logImportLastRunAt: parserStats.saved > 0 ? new Date().toISOString() : data.settings.logImportLastRunAt
        }
      };
    });

    if (summary) applyStructuredSummary(summary, parserStats, nextDebug, savedData);
    return { ...parserStats, debug: nextDebug };
  }

  function buildStructuredDebug(previousDebug, requestDebug, summary, parserStats, samples, activeReviewItems) {
    const debug = {
      ...previousDebug,
      ...requestDebug,
      appVersion: getConfig().version || previousDebug.appVersion || '',
      firstRecognizedLogs: samples.length ? samples : previousDebug.firstRecognizedLogs || [],
      rawRecognizedLogs: samples.length ? samples : previousDebug.rawRecognizedLogs || previousDebug.firstRecognizedLogs || [],
      structuredItemMarketBuyMatches: Number(previousDebug.structuredItemMarketBuyMatches || 0) + parserStats.marketMatches,
      structuredItemAbroadBuyMatches: Number(previousDebug.structuredItemAbroadBuyMatches || 0) + parserStats.abroadMatches,
      structuredBuyDuplicatesSkipped: Number(previousDebug.structuredBuyDuplicatesSkipped || 0) + parserStats.duplicates,
      structuredBuyPurchasesSaved: Number(previousDebug.structuredBuyPurchasesSaved || 0) + parserStats.saved,
      buyCandidatesCreated: Number(previousDebug.buyCandidatesCreated || 0) + parserStats.saved,
      structuredBuyCandidatesCreated: Number(previousDebug.structuredBuyCandidatesCreated || 0) + parserStats.saved,
      purchasesImported: Number(previousDebug.purchasesImported || 0) + parserStats.saved,
      purchasesSaved: Number(previousDebug.purchasesSaved || previousDebug.purchasesImported || 0) + parserStats.saved,
      duplicatesSkipped: Number(previousDebug.duplicatesSkipped || 0) + parserStats.duplicates,
      activeReviewItems,
      updatedAt: new Date().toISOString()
    };

    if (summary) {
      debug.rawLogsReturned = summary.rawLogsReturned || requestDebug.rawLogsReturned || previousDebug.rawLogsReturned || 0;
      debug.normalizedLogs = summary.normalizedLogs || requestDebug.normalizedLogs || previousDebug.normalizedLogs || 0;
      debug.buyIdMatches = summary.buyIdMatches || requestDebug.buyIdMatches || previousDebug.buyIdMatches || 0;
      debug.classifiedPurchases = Math.max(Number(summary.classifiedPurchases || 0), Number(previousDebug.classifiedPurchases || 0), parserStats.marketMatches + parserStats.abroadMatches);
    }

    if (parserStats.saved > 0) {
      debug.diagnosticMessage = `Structured buy parser saved ${parserStats.saved} purchase lot(s). Needs review: ${activeReviewItems}.`;
    }

    return debug;
  }

  function applyStructuredSummary(summary, parserStats, debug, data) {
    summary.debug = debug;
    summary.purchasesImported = Number(summary.purchasesImported || 0) + parserStats.saved;
    summary.purchasesSaved = Number(summary.purchasesSaved || 0) + parserStats.saved;
    summary.buyCandidatesCreated = Number(summary.buyCandidatesCreated || 0) + parserStats.saved;
    summary.structuredBuyCandidatesCreated = Number(summary.structuredBuyCandidatesCreated || 0) + parserStats.saved;
    summary.structuredItemMarketBuyMatches = Number(summary.structuredItemMarketBuyMatches || 0) + parserStats.marketMatches;
    summary.structuredItemAbroadBuyMatches = Number(summary.structuredItemAbroadBuyMatches || 0) + parserStats.abroadMatches;
    summary.duplicatesSkipped = Number(summary.duplicatesSkipped || 0) + parserStats.duplicates;
    summary.activeReviewItems = Array.isArray(data.importReviewQueue) ? data.importReviewQueue.filter((item) => !item.ignored).length : Number(summary.activeReviewItems || 0);
    if (parserStats.saved > 0) {
      summary.ok = true;
      summary.diagnosticMessage = `Structured buy parser saved ${parserStats.saved} purchase lot(s). Needs review: ${summary.activeReviewItems}.`;
      summary.errors = [];
    }
  }

  async function refreshRecognizedSamplesAndStructuredBuys(storagePrefix, summary, options = {}) {
    const tornApiService = getTornApiService();
    if (!tornApiService || typeof tornApiService.fetchUserLogs !== 'function') return summary;
    const from = summary && summary.from || options.from || '';
    const to = summary && summary.to || options.to || '';
    const result = await tornApiService.fetchUserLogs(storagePrefix, {
      from,
      to,
      bypassCache: true,
      rangeUsed: 'structured-buy-0.8.7-refresh'
    });
    if (!result.ok || !Array.isArray(result.data)) return summary;
    importStructuredBuysFromLogs(storagePrefix, result.data, summary, result.debug || {});
    return summary;
  }

  function patchLogImportService() {
    const service = getLogImportService();
    if (!service || service.__ftpStructuredBuyPatched) return false;
    const originalImportLogs = typeof service.importLogs === 'function' ? service.importLogs.bind(service) : null;
    service.sanitizeDebugValue = sanitizeDebugValue;
    service.summarizeRecognizedLogs = summarizeRecognizedLogs;
    service.createRawRecognizedLogsReport = createRawRecognizedLogsReport;
    service.parseStructuredItemMarketBuy = parseStructuredItemMarketBuy;
    service.parseStructuredItemAbroadBuy = parseStructuredItemAbroadBuy;
    service.parseStructuredBuy = parseStructuredBuy;
    if (originalImportLogs) {
      service.importLogs = async (storagePrefix, options = {}) => {
        const summary = await originalImportLogs(storagePrefix, options);
        try {
          return await refreshRecognizedSamplesAndStructuredBuys(storagePrefix, summary, options);
        } catch (error) {
          return summary;
        }
      };
    }
    service.__ftpStructuredBuyPatched = true;
    service.__ftpDebugSamplePatched = true;
    return true;
  }

  patchLogImportService();

  return {
    createRawRecognizedLogsReport,
    importStructuredBuysFromLogs,
    parseStructuredBuy,
    parseStructuredItemAbroadBuy,
    parseStructuredItemMarketBuy,
    patchLogImportService,
    sanitizeDebugValue,
    summarizeRecognizedLogs
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProLogImportDebugService = FlipTrackerProLogImportDebugService;
}