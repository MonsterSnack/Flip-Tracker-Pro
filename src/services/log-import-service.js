const FlipTrackerProLogImportService = (() => {
  function getStorageService() {
    return window.FlipTrackerProStorageService;
  }

  function getTornApiService() {
    return window.FlipTrackerProTornApiService;
  }

  function getAccountingService() {
    return window.FlipTrackerProTradeAccountingService;
  }

  function toNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
  }

  function toTimestamp(value) {
    if (!value) {
      return '';
    }

    if (/^\d+$/.test(String(value))) {
      return String(value).length > 10 ? Math.floor(Number(value) / 1000) : Number(value);
    }

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? '' : Math.floor(parsed / 1000);
  }

  function fromTimestamp(value) {
    const timestamp = toTimestamp(value);
    return timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();
  }

  function getLogId(log) {
    return String(log.id || log.log_id || log.logId || `${log.timestamp || log.time || Date.now()}-${log.message || log.title || ''}`);
  }

  function getLogText(log) {
    return String(log.message || log.text || log.title || log.event || log.log || log.data || '').replace(/\s+/g, ' ').trim();
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
    const explicitQuantity = String(text).match(/\b(?:x|qty\s*)?(\d{1,6})\s+(?:x\s+)?([a-z0-9][a-z0-9 '\-()]+?)(?:\s+(?:on|for|at|from|to|via|in)\b|$)/i);
    return explicitQuantity ? Math.max(1, toNumber(explicitQuantity[1], 1)) : 1;
  }

  function parseMoney(text) {
    const matches = [...String(text).matchAll(/\$?([0-9][0-9,]*)(?:\s*dollars)?/gi)]
      .map((match) => toNumber(String(match[1]).replace(/,/g, '')))
      .filter((value) => value > 0);

    return matches.length ? matches[matches.length - 1] : 0;
  }

  function parseItemMarketPurchase(text) {
    const itemMarket = String(text).match(/you bought\s+(?:(\d{1,6})\s+)?(?:an?\s+)?(.+?)\s+on the item market(?:\s+from\s+([^\s]+))?\s+at\s+\$?([0-9][0-9,]*)\s+each\s+for\s+a\s+total\s+of\s+\$?([0-9][0-9,]*)/i);

    if (!itemMarket) {
      return null;
    }

    return {
      itemName: itemMarket[2].trim(),
      quantity: Math.max(1, toNumber(itemMarket[1], 1)),
      sellerName: itemMarket[3] || '',
      unitBuyPrice: toNumber(String(itemMarket[4]).replace(/,/g, '')),
      totalBuyPrice: toNumber(String(itemMarket[5]).replace(/,/g, ''))
    };
  }

  function parseItemMarketSale(text) {
    const itemMarket = String(text).match(/(?:you sold|sold)\s+(?:(\d{1,6})\s+)?(?:an?\s+)?(.+?)\s+(?:on|via)\s+(?:the\s+)?(?:item market|bazaar).*?(?:at|for)\s+\$?([0-9][0-9,]*)/i);

    if (!itemMarket) {
      return null;
    }

    const quantity = Math.max(1, toNumber(itemMarket[1], 1));
    const totalSellPrice = toNumber(String(itemMarket[3]).replace(/,/g, ''));

    return {
      itemName: itemMarket[2].trim(),
      quantity,
      unitSellPrice: quantity > 0 ? totalSellPrice / quantity : totalSellPrice,
      totalSellPrice
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

    const quoted = String(text).match(/["']([^"']{2,80})["']/);

    if (quoted) {
      return { itemName: quoted[1] };
    }

    const fallback = String(text).match(/(?:bought|purchased|sold|received|sent)\s+(?:\d+\s+)?(?:an?\s+)?(.+?)(?:\s+(?:on|for|at|from|to|via|in)\b|$)/i);
    return { itemName: fallback ? fallback[1].trim() : 'Unknown item' };
  }

  function classifyLog(log) {
    const text = getLogText(log).toLowerCase();
    const category = String(log.category || log.cat || log.type || '').toLowerCase();

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
      logsReturned: 0,
      classifiedPurchases: 0,
      classifiedSales: 0,
      warnings: [],
      errors: [],
      debug: {}
    };
  }

  function buildImportDebug(result, summary) {
    const request = result && result.request ? result.request : {};

    return {
      lastEndpoint: request.endpoint || '',
      lastSelections: request.selections || '',
      lastParams: request.params || {},
      lastErrorCode: result && result.code ? result.code : '',
      lastError: result && result.error ? result.error : '',
      logsReturned: summary.logsReturned || 0,
      classifiedPurchases: summary.classifiedPurchases || 0,
      classifiedSales: summary.classifiedSales || 0,
      duplicatesSkipped: summary.duplicatesSkipped || 0,
      unmatchedSales: summary.unmatchedSales || 0,
      updatedAt: new Date().toISOString()
    };
  }

  async function importLogs(storagePrefix, { from = '', to = '' } = {}) {
    const storageService = getStorageService();
    const tornApiService = getTornApiService();
    const accountingService = getAccountingService();
    const summary = createEmptySummary(from, to);

    if (!storageService || !tornApiService || typeof tornApiService.fetchUserLogs !== 'function') {
      return { ...summary, ok: false, errors: ['Log import services are unavailable.'] };
    }

    const result = await tornApiService.fetchUserLogs(storagePrefix, {
      from: toTimestamp(from),
      to: toTimestamp(to),
      bypassCache: true
    });

    if (!result.ok) {
      summary.ok = false;
      summary.errors = [result.error || 'Could not fetch Torn logs.'];
      summary.debug = buildImportDebug(result, summary);
      storageService.update(storagePrefix, (data) => ({
        ...data,
        settings: {
          ...data.settings,
          logImportDebug: summary.debug
        }
      }));
      return summary;
    }

    const logs = Array.isArray(result.data) ? result.data : [];
    const now = new Date().toISOString();
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

      summary.debug = buildImportDebug(result, summary);
      const historyEntry = storageService.normalizeImportHistoryEntry({
        ...summary,
        createdAt: now
      });

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

  return {
    importLogs
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProLogImportService = FlipTrackerProLogImportService;
}
