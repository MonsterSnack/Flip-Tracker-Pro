const FlipTrackerProLogImportService = (() => {
  const batchSize = 75;
  const parserSamples = Object.freeze([
    '12:20:00 - 09/07/26 You bought 5x CPU on the item market from t_bombadil at $290 each for a total of $1,450',
    'You bought a Credit Card on the item market from Max_Lexie at $400 each for a total of $400',
    'You bought an eCPU on the item market from TheAngryYeti at $350 each for a total of $350',
    'You bought a Box of Tissues on the item market from Shayari at $300 each for a total of $300',
    '20:37:53 - 24/07/25 You sold 54x Dahlia on the item market to Javster at $1,900 each for a total of $97,470 after $5,130 in fees'
  ]);

  function now() {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  function elapsed(start) {
    return Math.round(now() - start);
  }

  function yieldToBrowser() {
    return new Promise((resolve) => {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(resolve, { timeout: 100 });
        return;
      }
      window.setTimeout(resolve, 0);
    });
  }

  function getStorageService() {
    return window.FlipTrackerProStorageService;
  }

  function getTornApiService() {
    return window.FlipTrackerProTornApiService;
  }

  function getAccountingService() {
    return window.FlipTrackerProTradeAccountingService;
  }

  function getConfig() {
    return window.FlipTrackerProConfig || {};
  }

  function getBuyLogIds() {
    const config = getConfig();
    return Array.isArray(config.buyLogIds) ? config.buyLogIds.map(Number).filter(Boolean) : [1225, 1220, 4201, 1112, 1103, 4200, 5927, 5510];
  }

  function getSellLogIds() {
    const config = getConfig();
    return Array.isArray(config.sellLogIds) ? config.sellLogIds.map(Number).filter(Boolean) : [1226, 1221, 1113, 1104, 4210, 5928, 5511];
  }

  function toNumber(value, fallback = 0) {
    const numberValue = Number(String(value ?? '').replace(/[$,]/g, ''));
    return Number.isFinite(numberValue) ? numberValue : fallback;
  }

  function parseMoneyValue(value) {
    return toNumber(value, 0);
  }

  function toTimestamp(value, { endOfDay = false } = {}) {
    if (!value) return '';
    if (/^\d+$/.test(String(value))) return String(value).length > 10 ? Math.floor(Number(value) / 1000) : Number(value);
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
    return String(log.text || log.message || log.title || '').replace(/\s+/g, ' ').trim();
  }

  function getEntryId(log) {
    return String(log.entryId || log.originalLogId || log.id || `${log.timestamp || log.time || Date.now()}-${getLogText(log)}`);
  }

  function getLogTimestamp(log) {
    return log.timestamp || log.time || log.created_at || log.date || '';
  }

  function collectFieldValues(value, output = [], depth = 0) {
    if (!value || depth > 3 || output.length >= 80) return output;
    if (Array.isArray(value)) {
      value.slice(0, 15).forEach((entry) => collectFieldValues(entry, output, depth + 1));
      return output;
    }
    if (typeof value === 'object') {
      Object.entries(value).slice(0, 40).forEach(([key, entry]) => {
        if (/key|token|secret|password/i.test(key)) return;
        output.push({ key, value: entry });
        collectFieldValues(entry, output, depth + 1);
      });
    }
    return output;
  }

  function findField(log, names) {
    const wanted = new Set(names.map((name) => name.toLowerCase()));
    const roots = [log, log.data, log.params].filter(Boolean);
    for (const root of roots) {
      const fields = collectFieldValues(root, []);
      for (const field of fields) {
        if (wanted.has(String(field.key).toLowerCase())) return field.value;
      }
    }
    return undefined;
  }

  function extractItemName(value) {
    if (!value && value !== 0) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return '';
    if (typeof value === 'object') return String(value.name || value.itemName || value.item_name || value.title || '').trim();
    return '';
  }

  function extractItemId(value) {
    if (!value && value !== 0) return undefined;
    if (typeof value === 'number' || /^\d+$/.test(String(value))) return String(value);
    if (typeof value === 'object') return value.id || value.itemId || value.item_id || undefined;
    return undefined;
  }

  function calculateQuantity(quantityText, unitPrice, totalPrice) {
    const explicitQuantity = toNumber(quantityText, 0);
    if (explicitQuantity > 0) return Math.max(1, Math.round(explicitQuantity));
    if (unitPrice > 0 && totalPrice > 0) return Math.max(1, Math.round(totalPrice / unitPrice));
    return 1;
  }

  function parseItemMarketPurchase(text) {
    const match = String(text).match(/(?:^|\b)you bought\s+(?:(\d{1,6})\s*x\s+)?(?:an?\s+)?(.+?)\s+on the item market\s+from\s+(.+?)\s+at\s+\$?([0-9][0-9,]*)\s+each\s+for\s+a\s+total\s+of\s+\$?([0-9][0-9,]*)/i);
    if (!match) return null;
    const unitBuyPrice = parseMoneyValue(match[4]);
    const totalBuyPrice = parseMoneyValue(match[5]);
    return {
      itemName: match[2].trim(),
      quantity: calculateQuantity(match[1], unitBuyPrice, totalBuyPrice),
      sellerName: match[3].trim(),
      unitBuyPrice,
      totalBuyPrice
    };
  }

  function parseItemMarketSale(text) {
    const match = String(text).match(/(?:^|\b)you sold\s+(?:(\d{1,6})\s*x\s+)?(?:an?\s+)?(.+?)\s+on the item market(?:\s+to\s+(.+?))?\s+at\s+\$?([0-9][0-9,]*)\s+each\s+for\s+a\s+total\s+of\s+\$?([0-9][0-9,]*)(?:\s+after\s+\$?([0-9][0-9,]*)\s+in\s+fees?)?/i);
    if (!match) return null;
    const unitSellPrice = parseMoneyValue(match[4]);
    const totalSellPrice = parseMoneyValue(match[5]);
    return {
      itemName: match[2].trim(),
      quantity: calculateQuantity(match[1], unitSellPrice, totalSellPrice),
      buyerName: match[3] ? match[3].trim() : '',
      unitSellPrice,
      totalSellPrice,
      fees: match[6] ? parseMoneyValue(match[6]) : undefined
    };
  }

  function parseStructuredBuy(log) {
    const itemValue = findField(log, ['itemName', 'item_name', 'item', 'itemId', 'item_id']);
    const itemName = extractItemName(findField(log, ['itemName', 'item_name', 'item'])) || extractItemName(itemValue);
    const itemId = extractItemId(findField(log, ['itemId', 'item_id'])) || extractItemId(itemValue);
    const quantity = toNumber(findField(log, ['quantity', 'qty', 'amount']), 0);
    const unitBuyPrice = toNumber(findField(log, ['price', 'unit_price', 'unitPrice', 'cost']), 0);
    const totalBuyPrice = toNumber(findField(log, ['total', 'total_cost', 'totalCost', 'value', 'money']), 0);
    const seller = findField(log, ['seller', 'from', 'user', 'player']);
    if (!itemName || (!unitBuyPrice && !totalBuyPrice)) return null;
    const resolvedQuantity = calculateQuantity(quantity, unitBuyPrice, totalBuyPrice);
    return {
      itemId,
      itemName,
      quantity: resolvedQuantity,
      sellerName: extractItemName(seller) || String(seller || '').trim(),
      unitBuyPrice: unitBuyPrice || (resolvedQuantity > 0 ? totalBuyPrice / resolvedQuantity : 0),
      totalBuyPrice: totalBuyPrice || unitBuyPrice * resolvedQuantity
    };
  }

  function parseStructuredSale(log) {
    const itemValue = findField(log, ['itemName', 'item_name', 'item', 'itemId', 'item_id']);
    const itemName = extractItemName(findField(log, ['itemName', 'item_name', 'item'])) || extractItemName(itemValue);
    const itemId = extractItemId(findField(log, ['itemId', 'item_id'])) || extractItemId(itemValue);
    const quantity = toNumber(findField(log, ['quantity', 'qty', 'amount']), 0);
    const unitSellPrice = toNumber(findField(log, ['price', 'unit_price', 'unitPrice']), 0);
    const totalSellPrice = toNumber(findField(log, ['revenue', 'total', 'total_revenue', 'totalRevenue', 'value', 'money']), 0);
    const fees = toNumber(findField(log, ['fees', 'fee']), 0);
    const buyer = findField(log, ['buyer', 'to', 'user', 'player']);
    if (!itemName || (!unitSellPrice && !totalSellPrice)) return null;
    const resolvedQuantity = calculateQuantity(quantity, unitSellPrice, totalSellPrice);
    return {
      itemId,
      itemName,
      quantity: resolvedQuantity,
      buyerName: extractItemName(buyer) || String(buyer || '').trim(),
      unitSellPrice: unitSellPrice || (resolvedQuantity > 0 ? totalSellPrice / resolvedQuantity : 0),
      totalSellPrice: totalSellPrice || unitSellPrice * resolvedQuantity,
      fees: fees || undefined
    };
  }

  function classifyLog(log, counters) {
    const buyIds = new Set(getBuyLogIds());
    const sellIds = new Set(getSellLogIds());
    const logTypeId = Number(log.logTypeId);
    if (buyIds.has(logTypeId)) {
      counters.buyIdMatches += 1;
      return 'buy';
    }
    if (sellIds.has(logTypeId)) {
      counters.sellIdMatches += 1;
      return 'sell';
    }
    const text = getLogText(log).toLowerCase();
    if (parseItemMarketPurchase(text)) {
      counters.textBuyMatches += 1;
      return 'buy';
    }
    if (parseItemMarketSale(text)) {
      counters.textSellMatches += 1;
      return 'sell';
    }
    return '';
  }

  function normalizeBuyLog(log) {
    const parsed = parseStructuredBuy(log) || parseItemMarketPurchase(getLogText(log));
    if (!parsed) return null;
    const sellerNote = parsed.sellerName ? `Seller: ${parsed.sellerName}` : '';
    return {
      itemId: parsed.itemId || undefined,
      itemName: parsed.itemName || 'Unknown item',
      quantity: parsed.quantity,
      unitBuyPrice: parsed.unitBuyPrice,
      totalBuyPrice: parsed.totalBuyPrice || parsed.unitBuyPrice * parsed.quantity,
      remainingQuantity: parsed.quantity,
      createdAt: fromTimestamp(getLogTimestamp(log)),
      source: 'api',
      originalLogId: getEntryId(log),
      logTypeId: Number(log.logTypeId) || undefined,
      notes: sellerNote || 'Imported from Torn log'
    };
  }

  function normalizeSellLog(log) {
    const parsed = parseStructuredSale(log) || parseItemMarketSale(getLogText(log));
    if (!parsed) return null;
    const buyerNote = parsed.buyerName ? `Buyer: ${parsed.buyerName}` : '';
    return {
      itemId: parsed.itemId || undefined,
      itemName: parsed.itemName || 'Unknown item',
      quantity: parsed.quantity,
      unitSellPrice: parsed.unitSellPrice,
      totalSellPrice: parsed.totalSellPrice || parsed.unitSellPrice * parsed.quantity,
      fees: parsed.fees,
      soldAt: fromTimestamp(getLogTimestamp(log)),
      source: 'api',
      originalLogId: getEntryId(log),
      logTypeId: Number(log.logTypeId) || undefined,
      notes: buyerNote || 'Imported from Torn log'
    };
  }

  function createEmptySummary(from, to) {
    return {
      ok: true,
      from: from || '',
      to: to || '',
      rangeUsed: '',
      progress: { processed: 0, total: 0, purchasesFound: 0, salesFound: 0, duplicatesSkipped: 0 },
      purchasesImported: 0,
      salesImported: 0,
      duplicatesSkipped: 0,
      unmatchedSales: 0,
      rawLogsReturned: 0,
      normalizedLogs: 0,
      logsReturned: 0,
      classifiedPurchases: 0,
      classifiedSales: 0,
      buyIdMatches: 0,
      sellIdMatches: 0,
      textBuyMatches: 0,
      textSellMatches: 0,
      warnings: [],
      errors: [],
      diagnosticMessage: '',
      debug: {}
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
    const current = Math.floor(Date.now() / 1000);
    return { from: current - 86400, to: current, rangeUsed: 'latest-24-hours' };
  }

  function getFallbackSevenDayRange() {
    const current = Math.floor(Date.now() / 1000);
    return { from: current - (7 * 86400), to: current, rangeUsed: 'fallback-7-days' };
  }

  function buildDebug(result, summary, timings) {
    const serviceDebug = result && result.debug ? result.debug : {};
    return {
      appVersion: serviceDebug.appVersion || (getConfig().version || ''),
      buyLogIds: getBuyLogIds(),
      sellLogIds: getSellLogIds(),
      strategyUsed: serviceDebug.strategyUsed || result.strategyUsed || 'unfiltered',
      rangeUsed: serviceDebug.rangeUsed || summary.rangeUsed || '',
      lastEndpoint: serviceDebug.lastEndpoint || result.request && result.request.endpoint || '',
      lastSelections: serviceDebug.lastSelections || result.request && result.request.selections || '',
      lastParams: serviceDebug.lastParams || result.request && result.request.params || {},
      responseTopLevelKeys: serviceDebug.responseTopLevelKeys || [],
      rawLogsReturned: summary.rawLogsReturned || serviceDebug.rawLogsReturned || 0,
      normalizedLogs: summary.normalizedLogs || serviceDebug.normalizedLogs || 0,
      buyIdMatches: summary.buyIdMatches || serviceDebug.buyIdMatches || 0,
      sellIdMatches: summary.sellIdMatches || serviceDebug.sellIdMatches || 0,
      textBuyMatches: summary.textBuyMatches || 0,
      textSellMatches: summary.textSellMatches || 0,
      classifiedPurchases: summary.classifiedPurchases || 0,
      classifiedSales: summary.classifiedSales || 0,
      duplicatesSkipped: summary.duplicatesSkipped || 0,
      purchasesImported: summary.purchasesImported || 0,
      salesImported: summary.salesImported || 0,
      unmatchedSales: summary.unmatchedSales || 0,
      progress: summary.progress,
      firstLogs: (serviceDebug.firstLogs || []).slice(0, 5),
      firstLogTexts: (serviceDebug.firstLogTexts || []).slice(0, 5),
      sampleRawKeys: serviceDebug.sampleRawKeys || [],
      lastErrorCode: result && result.code ? result.code : serviceDebug.lastErrorCode || '',
      lastError: result && result.error ? result.error : serviceDebug.lastError || '',
      diagnosticMessage: summary.diagnosticMessage || serviceDebug.diagnosticMessage || '',
      timings: { ...(serviceDebug.timings || {}), ...(timings || {}) },
      updatedAt: new Date().toISOString()
    };
  }

  function applyDiagnostic(summary, result) {
    if (!summary.ok && String(summary.errors.join(' ')).toLowerCase().includes('access')) {
      summary.diagnosticMessage = 'API key lacks user -> log access. Use a Torn Full Access API key for now.';
      return summary;
    }
    if (summary.rawLogsReturned === 0) {
      summary.diagnosticMessage = summary.rangeUsed === 'fallback-7-days' ? 'API returned 0 raw logs for the last 7 days.' : 'Date range returned no raw logs.';
      return summary;
    }
    if (result && result.debug && result.debug.normalizerFailed) {
      summary.diagnosticMessage = 'Logs returned but normalizer failed.';
      return summary;
    }
    if (summary.classifiedPurchases === 0 && summary.classifiedSales === 0) {
      summary.diagnosticMessage = 'API returned logs, but parser/classifier did not match any buy or sell logs.';
      return summary;
    }
    if (summary.purchasesImported === 0 && summary.salesImported === 0) {
      summary.diagnosticMessage = 'No new purchases or sales were imported. They may already be duplicates or unmatched parser candidates.';
    }
    return summary;
  }

  async function importLogs(storagePrefix, options = {}) {
    const totalStart = now();
    const storageService = getStorageService();
    const tornApiService = getTornApiService();
    const accountingService = getAccountingService();
    let range = getDateRange(options);
    const summary = createEmptySummary(range.from, range.to);
    summary.rangeUsed = range.rangeUsed;

    if (!storageService || !tornApiService || typeof tornApiService.fetchUserLogs !== 'function') {
      return { ...summary, ok: false, errors: ['Log import services are unavailable.'] };
    }

    let result = await tornApiService.fetchUserLogs(storagePrefix, { from: range.from, to: range.to, bypassCache: true, rangeUsed: range.rangeUsed });
    if (result.ok && result.debug && result.debug.rawLogsReturned === 0 && !options.from && !options.to) {
      range = getFallbackSevenDayRange();
      summary.from = range.from;
      summary.to = range.to;
      summary.rangeUsed = range.rangeUsed;
      result = await tornApiService.fetchUserLogs(storagePrefix, { from: range.from, to: range.to, bypassCache: true, rangeUsed: range.rangeUsed });
    }

    if (!result.ok) {
      summary.ok = false;
      summary.errors = [result.error || 'Could not fetch Torn logs.'];
      summary.rawLogsReturned = result.debug && result.debug.rawLogsReturned || 0;
      summary.normalizedLogs = result.debug && result.debug.normalizedLogs || 0;
      applyDiagnostic(summary, result);
      summary.debug = buildDebug(result, summary, { totalImportMs: elapsed(totalStart) });
      storageService.update(storagePrefix, (data) => ({ ...data, settings: { ...data.settings, logImportDebug: summary.debug } }));
      return summary;
    }

    const logs = Array.isArray(result.data) ? result.data : [];
    summary.rawLogsReturned = result.debug && result.debug.rawLogsReturned ? result.debug.rawLogsReturned : logs.length;
    summary.normalizedLogs = logs.length;
    summary.logsReturned = logs.length;
    summary.buyIdMatches = result.debug && result.debug.buyIdMatches || 0;
    summary.sellIdMatches = result.debug && result.debug.sellIdMatches || 0;
    summary.progress.total = logs.length;

    const data = storageService.load(storagePrefix);
    const importedLogIds = new Set(Array.isArray(data.importedLogIds) ? data.importedLogIds.map(String) : []);
    let purchaseLots = [...data.purchaseLots];
    let sales = [...data.sales];
    const classifyStart = now();
    const counters = { buyIdMatches: 0, sellIdMatches: 0, textBuyMatches: 0, textSellMatches: 0 };
    let classifyMs = 0;
    let parseMs = 0;

    for (let index = 0; index < logs.length; index += 1) {
      const log = logs[index];
      const entryId = getEntryId(log);
      const classifyItemStart = now();
      const type = classifyLog(log, counters);
      classifyMs += elapsed(classifyItemStart);
      summary.progress.processed += 1;

      if (type === 'buy') {
        summary.classifiedPurchases += 1;
        summary.progress.purchasesFound += 1;
      }
      if (type === 'sell') {
        summary.classifiedSales += 1;
        summary.progress.salesFound += 1;
      }

      if (importedLogIds.has(entryId)) {
        summary.duplicatesSkipped += 1;
        summary.progress.duplicatesSkipped += 1;
      } else if (type === 'buy') {
        const parseStart = now();
        const draft = normalizeBuyLog(log);
        parseMs += elapsed(parseStart);
        if (draft) {
          const lot = storageService.normalizePurchaseLot(draft);
          purchaseLots = [lot, ...purchaseLots];
          importedLogIds.add(entryId);
          summary.purchasesImported += 1;
        }
      } else if (type === 'sell') {
        const parseStart = now();
        const saleDraft = normalizeSellLog(log);
        parseMs += elapsed(parseStart);
        if (saleDraft) {
          const accountingResult = accountingService && typeof accountingService.recordSale === 'function'
            ? accountingService.recordSale({ purchaseLots, sale: saleDraft, settings: data.settings })
            : { purchaseLots, saleRecord: saleDraft };
          const unmatchedQuantity = Number(accountingResult.saleRecord.unmatchedQuantity) || 0;
          const matchedQuantity = Number(accountingResult.saleRecord.matchedQuantity) || 0;
          const warning = unmatchedQuantity > 0 ? `${saleDraft.itemName}: ${unmatchedQuantity} sold item(s) could not be matched to open purchases.` : '';
          const saleRecord = { ...accountingResult.saleRecord, originalLogId: entryId, logTypeId: saleDraft.logTypeId, unmatchedSale: unmatchedQuantity > 0, importWarning: warning, notes: warning || accountingResult.saleRecord.notes || saleDraft.notes || 'Imported from Torn log' };
          if (unmatchedQuantity > 0 && matchedQuantity === 0) {
            saleRecord.matchedBuyCost = 0;
            saleRecord.grossProfit = 0;
            saleRecord.netProfit = 0;
            saleRecord.roi = 0;
          }
          purchaseLots = accountingResult.purchaseLots;
          sales = [storageService.normalizeSale(saleRecord), ...sales];
          importedLogIds.add(entryId);
          summary.salesImported += 1;
          if (warning) {
            summary.unmatchedSales += 1;
            summary.warnings.push(warning);
          }
        }
      }

      if ((index + 1) % batchSize === 0) await yieldToBrowser();
    }

    summary.buyIdMatches = counters.buyIdMatches;
    summary.sellIdMatches = counters.sellIdMatches;
    summary.textBuyMatches = counters.textBuyMatches;
    summary.textSellMatches = counters.textSellMatches;
    applyDiagnostic(summary, result);

    const storageStart = now();
    let finalDebug;
    const saved = storageService.update(storagePrefix, (currentData) => {
      finalDebug = buildDebug(result, summary, { classifyMs: Math.max(classifyMs, elapsed(classifyStart)), parseMs, storageSaveMs: 0, totalImportMs: elapsed(totalStart) });
      const historyEntry = storageService.normalizeImportHistoryEntry({ ...summary, createdAt: new Date().toISOString() });
      return {
        ...currentData,
        purchaseLots,
        sales,
        importedLogIds: [...importedLogIds],
        importHistory: [historyEntry, ...(currentData.importHistory || [])].slice(0, 30),
        settings: { ...currentData.settings, logImportDebug: finalDebug, logImportLastRunAt: new Date().toISOString() }
      };
    });
    const storageSaveMs = elapsed(storageStart);
    summary.debug = { ...finalDebug, timings: { ...(finalDebug.timings || {}), storageSaveMs, totalImportMs: elapsed(totalStart) } };
    storageService.save(storagePrefix, { ...saved, settings: { ...saved.settings, logImportDebug: summary.debug } });
    return summary;
  }

  function runParserSelfTest() {
    return parserSamples.map((sample) => ({ sample, buy: parseItemMarketPurchase(sample), sell: parseItemMarketSale(sample) }));
  }

  return { importLogs, runParserSelfTest };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProLogImportService = FlipTrackerProLogImportService;
}
