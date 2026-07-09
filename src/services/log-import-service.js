const FlipTrackerProLogImportService = (() => {
  const parserSamples = Object.freeze([
    'You bought a Credit Card on the item market from Max_Lexie at $400 each for a total of $400',
    'You bought an eCPU on the item market from TheAngryYeti at $350 each for a total of $350',
    'You bought a Box of Tissues on the item market from Shayari at $300 each for a total of $300',
    'You bought 2x CPU on the item market from K9E_Indigo at $312 each for a total of $624'
  ]);

  function getStorageService() {
    return window.FlipTrackerProStorageService;
  }

  function getTornApiService() {
    return window.FlipTrackerProTornApiService;
  }

  function getAccountingService() {
    return window.FlipTrackerProTradeAccountingService;
  }

  function getRequiredLogTypeIds(result) {
    if (result && Array.isArray(result.requiredLogTypeIds)) {
      return result.requiredLogTypeIds;
    }

    const config = window.FlipTrackerProConfig || {};
    return Array.isArray(config.requiredLogTypeIds) ? config.requiredLogTypeIds : [1225, 1220, 4201, 1112, 4200, 5927, 5510];
  }

  function toNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
  }

  function parseMoneyValue(value) {
    return toNumber(String(value || '').replace(/,/g, ''));
  }

  function toTimestamp(value, { endOfDay = false } = {}) {
    if (!value) {
      return '';
    }

    if (/^\d+$/.test(String(value))) {
      return String(value).length > 10 ? Math.floor(Number(value) / 1000) : Number(value);
    }

    const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const parsed = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0).getTime()
      : Date.parse(value);

    return Number.isNaN(parsed) ? '' : Math.floor(parsed / 1000);
  }

  function fromTimestamp(value) {
    const timestamp = toTimestamp(value);
    return timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();
  }

  function getLogText(log) {
    return String(log.message || log.text || log.title || log.event || log.log || log.data || '').replace(/\s+/g, ' ').trim();
  }

  function getLogId(log) {
    const candidate = String(log.id || log.log_id || log.logId || '');
    const requiredIds = getRequiredLogTypeIds().map(String);

    if (candidate && !requiredIds.includes(candidate)) {
      return candidate;
    }

    return String(`${log.timestamp || log.time || Date.now()}-${getLogText(log) || log.title || ''}`);
  }

  function getLogTimestamp(log) {
    return log.timestamp || log.time || log.created_at || log.date || '';
  }

  function createItemMap(itemPriceSnapshots = []) {
    return itemPriceSnapshots.reduce((items, item) => {
      const name = String(item.itemName || '').toLowerCase();

      if (name) {
        items[name] = item;
      }

      if (item.itemId) {
        items[`id:${item.itemId}`] = item;
      }

      return items;
    }, {});
  }

  function parseQuantity(text) {
    const explicitQuantity = String(text).match(/\b(\d{1,6})\s*x\s+/i) || String(text).match(/\b(?:qty\s*)?(\d{1,6})\s+([a-z0-9][a-z0-9 '\-()]+?)(?:\s+(?:on|for|at|from|to|via|in)\b|$)/i);
    return explicitQuantity ? Math.max(1, toNumber(explicitQuantity[1], 1)) : 1;
  }

  function parseMoney(text) {
    const matches = [...String(text).matchAll(/\$?([0-9][0-9,]*)(?:\s*dollars)?/gi)]
      .map((match) => parseMoneyValue(match[1]))
      .filter((value) => value > 0);

    return matches.length ? matches[matches.length - 1] : 0;
  }

  function calculateQuantity(quantityText, unitPrice, totalPrice) {
    const explicitQuantity = toNumber(quantityText, 0);

    if (explicitQuantity > 0) {
      return Math.max(1, Math.round(explicitQuantity));
    }

    if (unitPrice > 0 && totalPrice > 0) {
      return Math.max(1, Math.round(totalPrice / unitPrice));
    }

    return 1;
  }

  function parseItemMarketPurchase(text) {
    const itemMarket = String(text).match(/you bought\s+(?:(\d{1,6})\s*x\s+)?(?:an?\s+)?(.+?)\s+on the item market\s+from\s+(.+?)\s+at\s+\$?([0-9][0-9,]*)\s+each\s+for\s+a\s+total\s+of\s+\$?([0-9][0-9,]*)/i);

    if (!itemMarket) {
      return null;
    }

    const unitBuyPrice = parseMoneyValue(itemMarket[4]);
    const totalBuyPrice = parseMoneyValue(itemMarket[5]);

    return {
      itemName: itemMarket[2].trim(),
      quantity: calculateQuantity(itemMarket[1], unitBuyPrice, totalBuyPrice),
      sellerName: itemMarket[3].trim(),
      unitBuyPrice,
      totalBuyPrice
    };
  }

  function parseItemMarketSale(text) {
    const itemMarket = String(text).match(/(?:you sold|sold|buyer bought|was bought from your bazaar)\s+(?:(\d{1,6})\s*x\s+)?(?:an?\s+)?(.+?)\s+(?:on|via|from)\s+(?:the\s+)?(?:item market|bazaar).*?(?:at|for)\s+\$?([0-9][0-9,]*)(?:\s+each)?.*?(?:total\s+of\s+\$?([0-9][0-9,]*))?/i);

    if (!itemMarket) {
      return null;
    }

    const quantityText = itemMarket[1];
    const firstMoney = parseMoneyValue(itemMarket[3]);
    const totalMoney = itemMarket[4] ? parseMoneyValue(itemMarket[4]) : firstMoney;
    const quantity = calculateQuantity(quantityText, firstMoney, totalMoney);

    return {
      itemName: itemMarket[2].trim(),
      quantity,
      unitSellPrice: quantity > 0 && itemMarket[4] ? firstMoney : totalMoney / quantity,
      totalSellPrice: totalMoney
    };
  }

  function findItemFromText(text, itemMap) {
    const lowerText = String(text || '').toLowerCase();
    const matches = Object.values(itemMap)
      .filter((item) => item.itemName && lowerText.includes(String(item.itemName).toLowerCase()))
      .sort((left, right) => String(right.itemName).length - String(left.itemName).length);

    if (matches[0]) {
      return matches[0];
    }

    const marketPurchase = parseItemMarketPurchase(text);

    if (marketPurchase) {
      return { itemName: marketPurchase.itemName };
    }

    const marketSale = parseItemMarketSale(text);

    if (marketSale) {
      return { itemName: marketSale.itemName };
    }

    const quoted = String(text).match(/["']([^"']{2,80})["']/);

    if (quoted) {
      return { itemName: quoted[1] };
    }

    const fallback = String(text).match(/(?:bought|purchased|sold|received|sent)\s+(?:\d+\s*x\s+)?(?:an?\s+)?(.+?)(?:\s+(?:on|for|at|from|to|via|in)\b|$)/i);
    return { itemName: fallback ? fallback[1].trim() : 'Unknown item' };
  }

  function classifyLog(log) {
    const text = getLogText(log).toLowerCase();
    const category = String(log.category || log.cat || log.type || log.logId || '').toLowerCase();

    if (parseItemMarketPurchase(text)) {
      return 'buy';
    }

    if (parseItemMarketSale(text)) {
      return 'sell';
    }

    if (category.includes('item') || category.includes('bazaar') || category.includes('trade')) {
      if (/\b(bought|purchased|received)\b/.test(text)) {
        return 'buy';
      }

      if (/\b(sold|buyer bought|was bought from your bazaar|sent)\b/.test(text)) {
        return 'sell';
      }
    }

    if (/\b(bought|purchased)\b/.test(text) && /\b(item|bazaar|market|shop|for)\b/.test(text)) {
      return 'buy';
    }

    if (/\b(sold|buyer bought|was bought from your bazaar)\b/.test(text)) {
      return 'sell';
    }

    return '';
  }

  function normalizeBuyLog(log, itemMap) {
    const text = getLogText(log);
    const parsedMarketPurchase = parseItemMarketPurchase(text);
    const item = findItemFromText(text, itemMap);
    const quantity = toNumber(log.quantity, parsedMarketPurchase ? parsedMarketPurchase.quantity : parseQuantity(text));
    const totalBuyPrice = toNumber(log.total, toNumber(log.cost, parsedMarketPurchase ? parsedMarketPurchase.totalBuyPrice : parseMoney(text)));
    const unitBuyPrice = toNumber(log.price, parsedMarketPurchase ? parsedMarketPurchase.unitBuyPrice : (quantity > 0 ? totalBuyPrice / quantity : 0));
    const sellerNote = parsedMarketPurchase && parsedMarketPurchase.sellerName ? `Seller: ${parsedMarketPurchase.sellerName}` : '';

    return {
      itemId: log.item_id || log.itemId || item.itemId || undefined,
      itemName: log.item_name || log.itemName || item.itemName || 'Unknown item',
      quantity,
      unitBuyPrice,
      totalBuyPrice: totalBuyPrice || unitBuyPrice * quantity,
      remainingQuantity: quantity,
      createdAt: fromTimestamp(getLogTimestamp(log)),
      source: 'api',
      originalLogId: getLogId(log),
      notes: sellerNote || 'Imported from Torn log'
    };
  }

  function normalizeSellLog(log, itemMap) {
    const text = getLogText(log);
    const parsedMarketSale = parseItemMarketSale(text);
    const item = findItemFromText(text, itemMap);
    const quantity = toNumber(log.quantity, parsedMarketSale ? parsedMarketSale.quantity : parseQuantity(text));
    const totalSellPrice = toNumber(log.total, toNumber(log.revenue, parsedMarketSale ? parsedMarketSale.totalSellPrice : parseMoney(text)));
    const unitSellPrice = toNumber(log.price, parsedMarketSale ? parsedMarketSale.unitSellPrice : (quantity > 0 ? totalSellPrice / quantity : 0));

    return {
      itemId: log.item_id || log.itemId || item.itemId || undefined,
      itemName: log.item_name || log.itemName || item.itemName || 'Unknown item',
      quantity,
      unitSellPrice,
      totalSellPrice: totalSellPrice || unitSellPrice * quantity,
      soldAt: fromTimestamp(getLogTimestamp(log)),
      source: 'api',
      originalLogId: getLogId(log),
      notes: 'Imported from Torn log'
    };
  }

  function createEmptySummary(from, to) {
    return {
      ok: true,
      from: from || '',
      to: to || '',
      purchasesImported: 0,
      salesImported: 0,
      duplicatesSkipped: 0,
      unmatchedSales: 0,
      rawLogsReturned: 0,
      normalizedLogs: 0,
      logsReturned: 0,
      classifiedPurchases: 0,
      classifiedSales: 0,
      warnings: [],
      errors: [],
      diagnosticMessage: '',
      debug: {}
    };
  }

  function buildImportDebug(result, summary) {
    const request = result && result.request ? result.request : {};
    const serviceDebug = result && result.debug ? result.debug : {};

    return {
      appVersion: serviceDebug.appVersion || '',
      requiredLogTypeIds: getRequiredLogTypeIds(result),
      logIdFilteringAttempted: Boolean(serviceDebug.logIdFilteringAttempted),
      unfilteredRequestAttempted: Boolean(serviceDebug.unfilteredRequestAttempted),
      filteredRequestAttempted: Boolean(serviceDebug.filteredRequestAttempted),
      strategyUsed: serviceDebug.strategyUsed || result.strategyUsed || 'failed-other',
      rangeUsed: serviceDebug.rangeUsed || summary.rangeUsed || '',
      lastEndpoint: request.endpoint || serviceDebug.lastEndpoint || '',
      lastSelections: request.selections || serviceDebug.lastSelections || '',
      lastParams: request.params || serviceDebug.lastParams || {},
      responseTopLevelKeys: serviceDebug.responseTopLevelKeys || [],
      rawLogsReturned: summary.rawLogsReturned || serviceDebug.rawLogsReturned || 0,
      normalizedLogs: summary.normalizedLogs || serviceDebug.normalizedLogs || 0,
      logsReturned: summary.logsReturned || serviceDebug.logsReturned || 0,
      sampleRawKeys: serviceDebug.sampleRawKeys || [],
      normalizerFailed: Boolean(serviceDebug.normalizerFailed),
      diagnosticMessage: summary.diagnosticMessage || serviceDebug.diagnosticMessage || '',
      firstLogs: serviceDebug.firstLogs || [],
      firstLogTexts: serviceDebug.firstLogTexts || [],
      classifiedPurchases: summary.classifiedPurchases || 0,
      classifiedSales: summary.classifiedSales || 0,
      duplicatesSkipped: summary.duplicatesSkipped || 0,
      purchasesImported: summary.purchasesImported || 0,
      salesImported: summary.salesImported || 0,
      unmatchedSales: summary.unmatchedSales || 0,
      lastErrorCode: result && result.code ? result.code : serviceDebug.lastErrorCode || '',
      lastError: result && result.error ? result.error : serviceDebug.lastError || '',
      updatedAt: new Date().toISOString()
    };
  }

  function getDateRange(options = {}) {
    if (options.from || options.to) {
      return {
        from: toTimestamp(options.from),
        to: toTimestamp(options.to, { endOfDay: true }),
        rangeUsed: options.from && options.to && options.from === options.to ? 'selected-day-end-of-day' : 'selected-range'
      };
    }

    const now = Math.floor(Date.now() / 1000);
    return {
      from: now - (24 * 60 * 60),
      to: now,
      rangeUsed: 'latest-24-hours'
    };
  }

  function getFallbackSevenDayRange() {
    const now = Math.floor(Date.now() / 1000);
    return {
      from: now - (7 * 24 * 60 * 60),
      to: now,
      rangeUsed: 'fallback-7-days'
    };
  }

  function applyDiagnostic(summary, result) {
    if (!summary.ok && String(summary.errors.join(' ')).toLowerCase().includes('permission')) {
      summary.diagnosticMessage = 'Key lacks user -> log permission or the required log categories/types.';
      return summary;
    }

    if (summary.rawLogsReturned === 0) {
      summary.diagnosticMessage = summary.from || summary.to ? 'Date range returned no raw logs.' : 'API returned 0 raw logs.';
      return summary;
    }

    if (result && result.debug && result.debug.normalizerFailed) {
      summary.diagnosticMessage = 'Logs returned but normalizer failed.';
      return summary;
    }

    if (summary.classifiedPurchases === 0 && summary.classifiedSales === 0) {
      summary.diagnosticMessage = 'API returned logs, but none matched buy/sell patterns.';
      return summary;
    }

    if (summary.purchasesImported === 0 && summary.salesImported === 0) {
      summary.diagnosticMessage = 'No new purchases or sales were imported. They may already be imported as duplicates.';
    }

    return summary;
  }

  async function importLogs(storagePrefix, options = {}) {
    const storageService = getStorageService();
    const tornApiService = getTornApiService();
    const accountingService = getAccountingService();
    let range = getDateRange(options);
    const summary = createEmptySummary(range.from, range.to);
    summary.rangeUsed = range.rangeUsed;

    if (!storageService || !tornApiService || typeof tornApiService.fetchUserLogs !== 'function') {
      return { ...summary, ok: false, errors: ['Log import services are unavailable.'] };
    }

    let result = await tornApiService.fetchUserLogs(storagePrefix, {
      from: range.from,
      to: range.to,
      bypassCache: true,
      rangeUsed: range.rangeUsed
    });

    if (result.ok && Array.isArray(result.data) && result.data.length === 0 && !options.from && !options.to) {
      range = getFallbackSevenDayRange();
      summary.from = range.from;
      summary.to = range.to;
      summary.rangeUsed = range.rangeUsed;
      result = await tornApiService.fetchUserLogs(storagePrefix, {
        from: range.from,
        to: range.to,
        bypassCache: true,
        rangeUsed: range.rangeUsed
      });
    }

    if (!result.ok) {
      summary.ok = false;
      summary.errors = [result.error || 'Could not fetch Torn logs.'];
      summary.debug = buildImportDebug(result, summary);
      applyDiagnostic(summary, result);
      storageService.update(storagePrefix, (data) => ({ ...data, settings: { ...data.settings, logImportDebug: summary.debug } }));
      return summary;
    }

    const logs = Array.isArray(result.data) ? result.data : [];
    const now = new Date().toISOString();
    summary.rawLogsReturned = result.debug && result.debug.rawLogsReturned ? result.debug.rawLogsReturned : logs.length;
    summary.normalizedLogs = logs.length;
    summary.logsReturned = logs.length;

    storageService.update(storagePrefix, (data) => {
      const importedLogIds = new Set(Array.isArray(data.importedLogIds) ? data.importedLogIds.map(String) : []);
      const itemMap = createItemMap(data.itemPriceSnapshots || []);
      let purchaseLots = [...data.purchaseLots];
      let sales = [...data.sales];

      logs.forEach((log) => {
        const logId = getLogId(log);
        const type = classifyLog(log);

        if (type === 'buy') {
          summary.classifiedPurchases += 1;
        }

        if (type === 'sell') {
          summary.classifiedSales += 1;
        }

        if (importedLogIds.has(logId)) {
          summary.duplicatesSkipped += 1;
          return;
        }

        if (type === 'buy') {
          const lot = storageService.normalizePurchaseLot(normalizeBuyLog(log, itemMap));
          purchaseLots = [lot, ...purchaseLots];
          importedLogIds.add(logId);
          summary.purchasesImported += 1;
          return;
        }

        if (type === 'sell') {
          const saleDraft = normalizeSellLog(log, itemMap);
          const accountingResult = accountingService && typeof accountingService.recordSale === 'function'
            ? accountingService.recordSale({ purchaseLots, sale: saleDraft, settings: data.settings })
            : { purchaseLots, saleRecord: saleDraft };
          const unmatchedQuantity = Number(accountingResult.saleRecord.unmatchedQuantity) || 0;
          const matchedQuantity = Number(accountingResult.saleRecord.matchedQuantity) || 0;
          const fullyUnmatched = unmatchedQuantity > 0 && matchedQuantity === 0;
          const warning = unmatchedQuantity > 0
            ? `${saleDraft.itemName}: ${unmatchedQuantity} sold item(s) could not be matched to open purchases.`
            : '';
          const saleRecord = {
            ...accountingResult.saleRecord,
            originalLogId: logId,
            unmatchedSale: unmatchedQuantity > 0,
            importWarning: warning,
            notes: warning || accountingResult.saleRecord.notes || 'Imported from Torn log'
          };

          if (fullyUnmatched) {
            saleRecord.matchedBuyCost = 0;
            saleRecord.grossProfit = 0;
            saleRecord.netProfit = 0;
            saleRecord.roi = 0;
          }

          const sale = storageService.normalizeSale(saleRecord);
          purchaseLots = accountingResult.purchaseLots;
          sales = [sale, ...sales];
          importedLogIds.add(logId);
          summary.salesImported += 1;

          if (warning) {
            summary.unmatchedSales += 1;
            summary.warnings.push(warning);
          }
        }
      });

      applyDiagnostic(summary, result);
      summary.debug = buildImportDebug(result, summary);
      const historyEntry = storageService.normalizeImportHistoryEntry({ ...summary, createdAt: now });

      return {
        ...data,
        purchaseLots,
        sales,
        importedLogIds: [...importedLogIds],
        importHistory: [historyEntry, ...(data.importHistory || [])].slice(0, 30),
        settings: {
          ...data.settings,
          logImportDebug: summary.debug,
          logImportLastRunAt: now
        }
      };
    });

    return summary;
  }

  function runParserSelfTest() {
    return parserSamples.map((sample) => ({ sample, parsed: parseItemMarketPurchase(sample) }));
  }

  return {
    importLogs,
    runParserSelfTest
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProLogImportService = FlipTrackerProLogImportService;
}
