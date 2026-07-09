const FlipTrackerProLogImportService = (() => {
  const batchSize = 75;
  const parserSamples = Object.freeze([
    'Item market buy | 4378669 | 0 | 1301 | 5 | 1450 | 290 | 1 | green',
    'Item market sell | 4378670 | 0 | 1301 | 5 | 1750 | 350 | 1 | green',
    '12:20:00 - 09/07/26 You bought 5x CPU on the item market from t_bombadil at $290 each for a total of $1,450',
    'You bought 5x CPU on the item market from t_bombadil at $290 each for a total of $1,450',
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
    return String(log.entryId || log.originalLogId || log.id || `${log.timestamp || log.time || Date.now()}-${getLogText(log).slice(0, 80)}`);
  }

  function getLogTimestamp(log) {
    return log.timestamp || log.time || log.created_at || log.createdAt || log.date || '';
  }

  function collectFieldValues(value, output = [], depth = 0) {
    if (!value || depth > 5 || output.length >= 180) return output;
    if (Array.isArray(value)) {
      value.slice(0, 25).forEach((entry) => collectFieldValues(entry, output, depth + 1));
      return output;
    }
    if (typeof value === 'object') {
      Object.entries(value).slice(0, 70).forEach(([key, entry]) => {
        if (/key|token|secret|password/i.test(key)) return;
        output.push({ key, value: entry });
        collectFieldValues(entry, output, depth + 1);
      });
    }
    return output;
  }

  function getParseRoots(log) {
    return [log.raw, log.data, log.params, log].filter((value, index, values) => value && typeof value === 'object' && values.indexOf(value) === index);
  }

  function findField(log, names) {
    const wanted = new Set(names.map((name) => name.toLowerCase()));
    for (const root of getParseRoots(log)) {
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
    if (typeof value === 'object') return String(value.name || value.itemName || value.item_name || value.title || value.label || '').trim();
    return '';
  }

  function extractActorName(value) {
    if (!value && value !== 0) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return '';
    if (typeof value === 'object') return String(value.name || value.username || value.player || value.user || value.title || '').trim();
    return '';
  }

  function extractItemId(value) {
    if (!value && value !== 0) return undefined;
    if (typeof value === 'number' || /^\d+$/.test(String(value))) return String(value);
    if (typeof value === 'object') return value.id || value.itemId || value.item_id || value.itemid || undefined;
    return undefined;
  }

  function calculateQuantity(quantityText, unitPrice, totalPrice) {
    const explicitQuantity = toNumber(quantityText, 0);
    if (explicitQuantity > 0) return Math.max(1, Math.round(explicitQuantity));
    if (unitPrice > 0 && totalPrice > 0) return Math.max(1, Math.round(totalPrice / unitPrice));
    return 1;
  }

  function normalizePriceFields(candidate, unitField, totalField) {
    const quantity = calculateQuantity(candidate.quantity, candidate[unitField], candidate[totalField]);
    const unit = candidate[unitField] > 0 ? candidate[unitField] : candidate[totalField] > 0 && quantity > 0 ? candidate[totalField] / quantity : 0;
    const total = candidate[totalField] > 0 ? candidate[totalField] : unit * quantity;
    return { ...candidate, quantity, [unitField]: unit, [totalField]: total };
  }

  function addItemName(itemMap, itemId, itemName) {
    const id = itemId === undefined || itemId === null || itemId === '' ? '' : String(itemId);
    const name = String(itemName || '').trim();
    if (id && name && !/^Item #\d+$/i.test(name)) itemMap.set(id, name);
  }

  function scanItems(value, itemMap, depth = 0) {
    if (!value || depth > 4) return;
    if (Array.isArray(value)) {
      value.slice(0, 5000).forEach((entry) => scanItems(entry, itemMap, depth + 1));
      return;
    }
    if (typeof value !== 'object') return;
    Object.entries(value).slice(0, 5000).forEach(([key, entry]) => {
      if (entry && typeof entry === 'object') {
        addItemName(itemMap, entry.itemId || entry.item_id || entry.id || (/^\d+$/.test(key) ? key : ''), entry.itemName || entry.item_name || entry.name || entry.title);
        scanItems(entry.items || entry.data || entry.children, itemMap, depth + 1);
        return;
      }
      if (/^\d+$/.test(key) && typeof entry === 'string') addItemName(itemMap, key, entry);
    });
  }

  function createItemLookup(data = {}) {
    const itemMap = new Map();
    (Array.isArray(data.itemPriceSnapshots) ? data.itemPriceSnapshots : []).forEach((snapshot) => addItemName(itemMap, snapshot.itemId, snapshot.itemName));
    scanItems(data.itemMap, itemMap);
    scanItems(data.items, itemMap);
    scanItems(data.tornItems, itemMap);
    scanItems(data.settings && data.settings.itemMap, itemMap);
    scanItems(data.settings && data.settings.tornItems, itemMap);

    return {
      resolve(itemId, fallbackName = '') {
        const id = itemId === undefined || itemId === null || itemId === '' ? '' : String(itemId);
        const givenName = String(fallbackName || '').trim();
        const cachedName = id ? itemMap.get(id) || '' : '';
        const itemName = givenName || cachedName || (id ? `Item #${id}` : '');
        return {
          itemId: id || undefined,
          itemName,
          needsNameReview: Boolean(id && !givenName && !cachedName)
        };
      }
    };
  }

  function splitPipeLog(text) {
    const parts = String(text || '').split('|').map((part) => part.trim()).filter((part) => part !== '');
    return parts.length >= 7 ? parts : null;
  }

  function isPipeBuyText(text) {
    const parts = splitPipeLog(text);
    return Boolean(parts && /item\s+market\s+buy/i.test(parts[0]));
  }

  function isPipeSellText(text) {
    const parts = splitPipeLog(text);
    return Boolean(parts && /(item\s+market\s+(sell|sale)|market\s+sell)/i.test(parts[0]));
  }

  function parsePipeBuy(log, itemLookup) {
    const parts = splitPipeLog(getLogText(log));
    if (!parts || !/item\s+market\s+buy/i.test(parts[0])) return null;
    const itemId = toNumber(parts[3], 0);
    const quantity = toNumber(parts[4], 0);
    const totalBuyPrice = toNumber(parts[5], 0);
    const unitBuyPrice = toNumber(parts[6], 0);
    if (!itemId && !quantity && !totalBuyPrice && !unitBuyPrice) return null;
    const resolved = itemLookup.resolve(itemId ? String(itemId) : '');
    return normalizePriceFields({
      parserKind: 'pipe',
      itemId: resolved.itemId,
      itemName: resolved.itemName,
      needsNameReview: resolved.needsNameReview,
      quantity,
      unitBuyPrice,
      totalBuyPrice
    }, 'unitBuyPrice', 'totalBuyPrice');
  }

  function parsePipeSell(log, itemLookup) {
    const parts = splitPipeLog(getLogText(log));
    if (!parts || !/(item\s+market\s+(sell|sale)|market\s+sell)/i.test(parts[0])) return null;
    const itemId = toNumber(parts[3], 0);
    const quantity = toNumber(parts[4], 0);
    const totalSellPrice = toNumber(parts[5], 0);
    const unitSellPrice = toNumber(parts[6], 0);
    const possibleFee = toNumber(parts[7], 0);
    if (!itemId && !quantity && !totalSellPrice && !unitSellPrice) return null;
    const resolved = itemLookup.resolve(itemId ? String(itemId) : '');
    return normalizePriceFields({
      parserKind: 'pipe',
      itemId: resolved.itemId,
      itemName: resolved.itemName,
      needsNameReview: resolved.needsNameReview,
      quantity,
      unitSellPrice,
      totalSellPrice,
      fees: possibleFee > 1 && possibleFee < totalSellPrice ? possibleFee : undefined
    }, 'unitSellPrice', 'totalSellPrice');
  }

  function parseItemMarketPurchase(text) {
    const match = String(text).match(/(?:^|\b)(?:\d{1,2}:\d{2}:\d{2}\s+-\s+\d{2}\/\d{2}\/\d{2}\s+)?you bought\s+(?:(\d{1,8})\s*x\s+)?(?:an?\s+)?(.+?)\s+on the item market\s+from\s+(.+?)\s+at\s+\$?([0-9][0-9,]*)\s+each\s+for\s+a\s+total\s+of\s+\$?([0-9][0-9,]*)/i);
    if (!match) return null;
    const unitBuyPrice = parseMoneyValue(match[4]);
    const totalBuyPrice = parseMoneyValue(match[5]);
    return normalizePriceFields({
      parserKind: 'text',
      itemName: match[2].trim(),
      quantity: calculateQuantity(match[1], unitBuyPrice, totalBuyPrice),
      sellerName: match[3].trim(),
      unitBuyPrice,
      totalBuyPrice
    }, 'unitBuyPrice', 'totalBuyPrice');
  }

  function parseItemMarketSale(text) {
    const match = String(text).match(/(?:^|\b)(?:\d{1,2}:\d{2}:\d{2}\s+-\s+\d{2}\/\d{2}\/\d{2}\s+)?you sold\s+(?:(\d{1,8})\s*x\s+)?(?:an?\s+)?(.+?)\s+on the item market\s+to\s+(.+?)\s+at\s+\$?([0-9][0-9,]*)\s+each\s+for\s+a\s+total\s+of\s+\$?([0-9][0-9,]*)(?:\s+after\s+\$?([0-9][0-9,]*)\s+in\s+fees?)?/i);
    if (!match) return null;
    const unitSellPrice = parseMoneyValue(match[4]);
    const totalSellPrice = parseMoneyValue(match[5]);
    return normalizePriceFields({
      parserKind: 'text',
      itemName: match[2].trim(),
      quantity: calculateQuantity(match[1], unitSellPrice, totalSellPrice),
      buyerName: match[3] ? match[3].trim() : '',
      unitSellPrice,
      totalSellPrice,
      fees: match[6] ? parseMoneyValue(match[6]) : undefined
    }, 'unitSellPrice', 'totalSellPrice');
  }

  function parseStructuredBuy(log, itemLookup) {
    const itemValue = findField(log, ['itemName', 'item_name', 'item', 'itemId', 'item_id', 'itemid']);
    const itemName = extractItemName(findField(log, ['itemName', 'item_name', 'item'])) || extractItemName(itemValue);
    const itemId = extractItemId(findField(log, ['itemId', 'item_id', 'itemid'])) || extractItemId(itemValue);
    const resolved = itemLookup.resolve(itemId, itemName);
    const quantity = toNumber(findField(log, ['quantity', 'qty', 'amount', 'count']), 0);
    const unitBuyPrice = toNumber(findField(log, ['price', 'unitPrice', 'unit_price', 'cost', 'unitCost', 'unit_cost']), 0);
    const totalBuyPrice = toNumber(findField(log, ['total', 'totalCost', 'total_cost', 'totalPrice', 'total_price', 'value', 'money']), 0);
    const seller = findField(log, ['seller', 'from', 'user', 'player']);
    if ((!resolved.itemName && !resolved.itemId) || (!unitBuyPrice && !totalBuyPrice)) return null;
    return normalizePriceFields({
      parserKind: 'structured',
      itemId: resolved.itemId,
      itemName: resolved.itemName,
      needsNameReview: resolved.needsNameReview,
      quantity,
      sellerName: extractActorName(seller),
      unitBuyPrice,
      totalBuyPrice
    }, 'unitBuyPrice', 'totalBuyPrice');
  }

  function parseStructuredSale(log, itemLookup) {
    const itemValue = findField(log, ['itemName', 'item_name', 'item', 'itemId', 'item_id', 'itemid']);
    const itemName = extractItemName(findField(log, ['itemName', 'item_name', 'item'])) || extractItemName(itemValue);
    const itemId = extractItemId(findField(log, ['itemId', 'item_id', 'itemid'])) || extractItemId(itemValue);
    const resolved = itemLookup.resolve(itemId, itemName);
    const quantity = toNumber(findField(log, ['quantity', 'qty', 'amount', 'count']), 0);
    const unitSellPrice = toNumber(findField(log, ['price', 'unitPrice', 'unit_price', 'sellPrice', 'sell_price']), 0);
    const totalSellPrice = toNumber(findField(log, ['total', 'totalRevenue', 'total_revenue', 'revenue', 'value', 'money']), 0);
    const fees = toNumber(findField(log, ['fee', 'fees', 'marketFee', 'market_fee']), 0);
    const buyer = findField(log, ['buyer', 'to', 'user', 'player']);
    if ((!resolved.itemName && !resolved.itemId) || (!unitSellPrice && !totalSellPrice)) return null;
    return normalizePriceFields({
      parserKind: 'structured',
      itemId: resolved.itemId,
      itemName: resolved.itemName,
      needsNameReview: resolved.needsNameReview,
      quantity,
      buyerName: extractActorName(buyer),
      unitSellPrice,
      totalSellPrice,
      fees: fees || undefined
    }, 'unitSellPrice', 'totalSellPrice');
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
    const text = getLogText(log);
    if (isPipeBuyText(text)) return 'buy';
    if (isPipeSellText(text)) return 'sell';
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

  function validateBuyCandidate(candidate) {
    if (!candidate) return { ok: false, reason: 'Parser did not return a buy candidate.' };
    if (!candidate.originalLogId) return { ok: false, reason: 'Missing entryId/originalLogId.' };
    if ((!candidate.itemId && !candidate.itemName) || candidate.itemName === 'Unknown item') return { ok: false, reason: 'Missing itemId or item name.' };
    if (!candidate.quantity || candidate.quantity <= 0) return { ok: false, reason: 'Missing quantity.' };
    if (!candidate.unitBuyPrice && !candidate.totalBuyPrice) return { ok: false, reason: 'Missing buy price.' };
    return { ok: true, reason: '' };
  }

  function validateSellCandidate(candidate) {
    if (!candidate) return { ok: false, reason: 'Parser did not return a sell candidate.' };
    if (!candidate.originalLogId) return { ok: false, reason: 'Missing entryId/originalLogId.' };
    if ((!candidate.itemId && !candidate.itemName) || candidate.itemName === 'Unknown item') return { ok: false, reason: 'Missing itemId or item name.' };
    if (!candidate.quantity || candidate.quantity <= 0) return { ok: false, reason: 'Missing quantity.' };
    if (!candidate.unitSellPrice && !candidate.totalSellPrice) return { ok: false, reason: 'Missing sell price.' };
    return { ok: true, reason: '' };
  }

  function normalizeBuyLog(log, itemLookup) {
    const parsed = parsePipeBuy(log, itemLookup) || parseStructuredBuy(log, itemLookup) || parseItemMarketPurchase(getLogText(log));
    if (!parsed) return { candidate: null, reason: 'No pipe, structured, or text buy parser matched.', parserKind: '' };
    const resolved = parsed.itemId || parsed.needsNameReview ? itemLookup.resolve(parsed.itemId, parsed.itemName) : { itemId: parsed.itemId, itemName: parsed.itemName, needsNameReview: false };
    const priced = normalizePriceFields({ ...parsed, ...resolved }, 'unitBuyPrice', 'totalBuyPrice');
    const sellerNote = priced.sellerName ? `Seller: ${priced.sellerName}` : '';
    const candidate = {
      itemId: priced.itemId || undefined,
      itemName: priced.itemName || (priced.itemId ? `Item #${priced.itemId}` : 'Unknown item'),
      quantity: priced.quantity,
      unitBuyPrice: priced.unitBuyPrice,
      totalBuyPrice: priced.totalBuyPrice,
      remainingQuantity: priced.quantity,
      createdAt: fromTimestamp(getLogTimestamp(log)),
      source: 'api',
      originalLogId: getEntryId(log),
      logTypeId: Number(log.logTypeId) || undefined,
      notes: sellerNote || 'Imported from Torn log',
      needsNameReview: Boolean(priced.needsNameReview)
    };
    const validation = validateBuyCandidate(candidate);
    return validation.ok ? { candidate, reason: '', parserKind: parsed.parserKind || 'unknown' } : { candidate: null, reason: validation.reason, parserKind: parsed.parserKind || 'unknown', partial: candidate };
  }

  function normalizeSellLog(log, itemLookup) {
    const parsed = parsePipeSell(log, itemLookup) || parseStructuredSale(log, itemLookup) || parseItemMarketSale(getLogText(log));
    if (!parsed) return { candidate: null, reason: 'No pipe, structured, or text sell parser matched.', parserKind: '' };
    const resolved = parsed.itemId || parsed.needsNameReview ? itemLookup.resolve(parsed.itemId, parsed.itemName) : { itemId: parsed.itemId, itemName: parsed.itemName, needsNameReview: false };
    const priced = normalizePriceFields({ ...parsed, ...resolved }, 'unitSellPrice', 'totalSellPrice');
    const buyerNote = priced.buyerName ? `Buyer: ${priced.buyerName}` : '';
    const candidate = {
      itemId: priced.itemId || undefined,
      itemName: priced.itemName || (priced.itemId ? `Item #${priced.itemId}` : 'Unknown item'),
      quantity: priced.quantity,
      unitSellPrice: priced.unitSellPrice,
      totalSellPrice: priced.totalSellPrice,
      fees: priced.fees,
      soldAt: fromTimestamp(getLogTimestamp(log)),
      source: 'api',
      originalLogId: getEntryId(log),
      logTypeId: Number(log.logTypeId) || undefined,
      notes: buyerNote || 'Imported from Torn log',
      needsNameReview: Boolean(priced.needsNameReview)
    };
    const validation = validateSellCandidate(candidate);
    return validation.ok ? { candidate, reason: '', parserKind: parsed.parserKind || 'unknown' } : { candidate: null, reason: validation.reason, parserKind: parsed.parserKind || 'unknown', partial: candidate };
  }

  function createReviewCandidate(log, type, reason, partial = {}) {
    const isSell = type === 'sell';
    return {
      entryId: getEntryId(log),
      logTypeId: Number(log.logTypeId) || undefined,
      timestamp: fromTimestamp(getLogTimestamp(log)),
      type: isSell ? 'sell' : 'buy',
      itemId: partial.itemId || undefined,
      itemName: partial.itemName || '',
      quantity: partial.quantity || '',
      unitPrice: isSell ? partial.unitSellPrice || '' : partial.unitBuyPrice || '',
      totalPrice: isSell ? partial.totalSellPrice || '' : partial.totalBuyPrice || '',
      fees: partial.fees || '',
      textPreview: getLogText(log).slice(0, 320),
      rawKeys: Array.isArray(log.rawKeys) ? log.rawKeys.slice(0, 40) : [],
      rawSampleKeys: Array.isArray(log.rawSampleKeys) ? log.rawSampleKeys.slice(0, 40) : [],
      reason: reason || 'Parser could not create a valid import candidate.',
      source: 'api',
      ignored: false
    };
  }

  function upsertReviewItem(reviewQueue, item, storageService) {
    const normalized = storageService.normalizeImportReviewItem(item);
    const entryId = String(normalized.entryId || normalized.originalLogId || normalized.id);
    let replaced = false;
    const nextQueue = reviewQueue.map((current) => {
      const currentId = String(current.entryId || current.originalLogId || current.id);
      if (currentId !== entryId) return current;
      replaced = true;
      return { ...current, ...normalized, id: current.id || normalized.id, createdAt: current.createdAt || normalized.createdAt, updatedAt: new Date().toISOString(), ignored: false };
    });
    return (replaced ? nextQueue : [normalized, ...nextQueue]).slice(0, 100);
  }

  function removeReviewItem(reviewQueue, entryId) {
    const id = String(entryId || '');
    return reviewQueue.filter((item) => String(item.entryId || item.originalLogId || item.id) !== id);
  }

  function addFailureReason(summary, reason) {
    const value = String(reason || '').trim();
    if (!value) return;
    if (!summary.parserFailureReasons.includes(value)) summary.parserFailureReasons.push(value);
    summary.parserFailureReasons = summary.parserFailureReasons.slice(0, 10);
    if (/parser|matched/i.test(value)) summary.parserFailures += 1;
    else summary.validationFailures += 1;
  }

  function noteParserKind(summary, type, parserKind) {
    if (type === 'buy' && parserKind === 'pipe') summary.pipeBuyMatches += 1;
    if (type === 'sell' && parserKind === 'pipe') summary.pipeSellMatches += 1;
    if (type === 'buy' && parserKind === 'structured') summary.structuredBuyMatches += 1;
    if (type === 'sell' && parserKind === 'structured') summary.structuredSellMatches += 1;
    if (type === 'buy' && parserKind === 'text') summary.textBuyMatches += 1;
    if (type === 'sell' && parserKind === 'text') summary.textSellMatches += 1;
  }

  function saveSaleCandidate({ candidate, data, purchaseLots, sales, storageService, accountingService }) {
    const accountingResult = accountingService && typeof accountingService.recordSale === 'function'
      ? accountingService.recordSale({ purchaseLots, sale: candidate, settings: data.settings })
      : { purchaseLots, saleRecord: candidate };
    const unmatchedQuantity = Number(accountingResult.saleRecord.unmatchedQuantity) || 0;
    const matchedQuantity = Number(accountingResult.saleRecord.matchedQuantity) || 0;
    const warning = unmatchedQuantity > 0 ? `${candidate.itemName}: ${unmatchedQuantity} sold item(s) could not be matched to open purchases.` : '';
    const saleRecord = {
      ...accountingResult.saleRecord,
      originalLogId: candidate.originalLogId,
      logTypeId: candidate.logTypeId,
      unmatchedSale: unmatchedQuantity > 0,
      importWarning: warning,
      notes: warning || accountingResult.saleRecord.notes || candidate.notes || 'Imported from Torn log'
    };
    if (unmatchedQuantity > 0 && matchedQuantity === 0) {
      saleRecord.matchedBuyCost = 0;
      saleRecord.grossProfit = 0;
      saleRecord.netProfit = 0;
      saleRecord.roi = 0;
    }
    return {
      purchaseLots: accountingResult.purchaseLots,
      sales: [storageService.normalizeSale(saleRecord), ...sales],
      warning,
      unmatched: Boolean(warning)
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
      purchasesSaved: 0,
      salesSaved: 0,
      duplicatesSkipped: 0,
      ignoredItems: 0,
      unmatchedSales: 0,
      rawLogsReturned: 0,
      normalizedLogs: 0,
      logsReturned: 0,
      classifiedPurchases: 0,
      classifiedSales: 0,
      buyCandidatesCreated: 0,
      sellCandidatesCreated: 0,
      buyIdMatches: 0,
      sellIdMatches: 0,
      pipeBuyMatches: 0,
      pipeSellMatches: 0,
      textBuyMatches: 0,
      textSellMatches: 0,
      structuredBuyMatches: 0,
      structuredSellMatches: 0,
      parserFailures: 0,
      validationFailures: 0,
      parserFailureReasons: [],
      reviewCandidatesCreated: 0,
      activeReviewItems: 0,
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
      pipeBuyMatches: summary.pipeBuyMatches || 0,
      pipeSellMatches: summary.pipeSellMatches || 0,
      textBuyMatches: summary.textBuyMatches || 0,
      textSellMatches: summary.textSellMatches || 0,
      structuredBuyMatches: summary.structuredBuyMatches || 0,
      structuredSellMatches: summary.structuredSellMatches || 0,
      classifiedPurchases: summary.classifiedPurchases || 0,
      classifiedSales: summary.classifiedSales || 0,
      buyCandidatesCreated: summary.buyCandidatesCreated || 0,
      sellCandidatesCreated: summary.sellCandidatesCreated || 0,
      purchasesImported: summary.purchasesImported || 0,
      salesImported: summary.salesImported || 0,
      purchasesSaved: summary.purchasesSaved || 0,
      salesSaved: summary.salesSaved || 0,
      duplicatesSkipped: summary.duplicatesSkipped || 0,
      ignoredItems: summary.ignoredItems || 0,
      unmatchedSales: summary.unmatchedSales || 0,
      reviewCandidatesCreated: summary.reviewCandidatesCreated || 0,
      activeReviewItems: summary.activeReviewItems || 0,
      parserFailures: summary.parserFailures || 0,
      validationFailures: summary.validationFailures || 0,
      parserFailureReasons: summary.parserFailureReasons || [],
      progress: summary.progress,
      firstLogs: (serviceDebug.firstLogs || []).slice(0, 5),
      firstRecognizedLogs: (serviceDebug.firstRecognizedLogs || serviceDebug.firstLogs || []).slice(0, 5),
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
    if (summary.purchasesImported === 0 && summary.salesImported === 0 && summary.reviewCandidatesCreated > 0) {
      summary.diagnosticMessage = `Recognized ${summary.reviewCandidatesCreated} buy/sell log(s), but they need review because parsing or validation failed.`;
      return summary;
    }
    if (summary.purchasesImported === 0 && summary.salesImported === 0 && summary.duplicatesSkipped > 0) {
      summary.diagnosticMessage = 'No new purchases or sales were imported because matching logs were already imported.';
      return summary;
    }
    if (summary.purchasesImported === 0 && summary.salesImported === 0) {
      summary.diagnosticMessage = 'No new purchases or sales were imported. Check Needs review, parser failures, validation failures, and duplicates.';
      return summary;
    }
    summary.diagnosticMessage = `Imported ${summary.purchasesImported} purchases and ${summary.salesImported} sales. Needs review: ${summary.activeReviewItems || 0}.`;
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
    summary.progress.total = logs.length;

    const data = storageService.load(storagePrefix);
    const itemLookup = createItemLookup(data);
    const importedLogIds = new Set(Array.isArray(data.importedLogIds) ? data.importedLogIds.map(String) : []);
    data.purchaseLots.forEach((lot) => { if (lot.originalLogId) importedLogIds.add(String(lot.originalLogId)); });
    data.sales.forEach((sale) => { if (sale.originalLogId) importedLogIds.add(String(sale.originalLogId)); });
    let purchaseLots = [...data.purchaseLots];
    let sales = [...data.sales];
    let reviewQueue = Array.isArray(data.importReviewQueue) ? data.importReviewQueue.map(storageService.normalizeImportReviewItem).filter((item) => !item.ignored) : [];
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

      if (!type) {
        if ((index + 1) % batchSize === 0) await yieldToBrowser();
        continue;
      }

      if (importedLogIds.has(entryId)) {
        summary.duplicatesSkipped += 1;
        summary.progress.duplicatesSkipped += 1;
        if ((index + 1) % batchSize === 0) await yieldToBrowser();
        continue;
      }

      const parseStart = now();
      const parsed = type === 'buy' ? normalizeBuyLog(log, itemLookup) : normalizeSellLog(log, itemLookup);
      parseMs += elapsed(parseStart);
      noteParserKind(summary, type, parsed.parserKind);

      if (parsed.candidate) {
        if (type === 'buy') {
          summary.buyCandidatesCreated += 1;
          const lot = storageService.normalizePurchaseLot(parsed.candidate);
          purchaseLots = [lot, ...purchaseLots];
          summary.purchasesImported += 1;
          summary.purchasesSaved += 1;
        } else {
          summary.sellCandidatesCreated += 1;
          const saleResult = saveSaleCandidate({ candidate: parsed.candidate, data, purchaseLots, sales, storageService, accountingService });
          purchaseLots = saleResult.purchaseLots;
          sales = saleResult.sales;
          summary.salesImported += 1;
          summary.salesSaved += 1;
          if (saleResult.warning) {
            summary.unmatchedSales += 1;
            summary.warnings.push(saleResult.warning);
          }
        }
        importedLogIds.add(entryId);
        reviewQueue = removeReviewItem(reviewQueue, entryId);
      } else {
        addFailureReason(summary, parsed.reason);
        reviewQueue = upsertReviewItem(reviewQueue, createReviewCandidate(log, type, parsed.reason, parsed.partial), storageService);
        summary.reviewCandidatesCreated += 1;
      }

      if ((index + 1) % batchSize === 0) await yieldToBrowser();
    }

    summary.buyIdMatches = counters.buyIdMatches;
    summary.sellIdMatches = counters.sellIdMatches;
    summary.activeReviewItems = reviewQueue.filter((item) => !item.ignored).length;
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
        importReviewQueue: reviewQueue,
        importHistory: [historyEntry, ...(currentData.importHistory || [])].slice(0, 30),
        settings: { ...currentData.settings, logImportDebug: finalDebug, logImportLastRunAt: new Date().toISOString() }
      };
    });
    const storageSaveMs = elapsed(storageStart);
    summary.debug = { ...finalDebug, timings: { ...(finalDebug.timings || {}), storageSaveMs, totalImportMs: elapsed(totalStart) } };
    storageService.save(storagePrefix, { ...saved, settings: { ...saved.settings, logImportDebug: summary.debug } });
    return summary;
  }

  function buildLogFromReviewItem(item) {
    return {
      entryId: item.entryId || item.originalLogId || item.id,
      originalLogId: item.entryId || item.originalLogId || item.id,
      logTypeId: item.logTypeId,
      timestamp: item.timestamp,
      text: item.textPreview,
      message: item.textPreview,
      title: item.textPreview,
      rawKeys: item.rawKeys || [],
      rawSampleKeys: item.rawSampleKeys || []
    };
  }

  function getReviewItem(reviewQueue, reviewId) {
    const id = String(reviewId || '');
    return reviewQueue.find((item) => String(item.id) === id || String(item.entryId) === id || String(item.originalLogId) === id) || null;
  }

  function buildReviewPurchaseCandidate(item, values = {}, itemLookup) {
    const itemId = values.itemId || item.itemId || undefined;
    const resolved = itemLookup.resolve(itemId, values.itemName || item.itemName || '');
    const quantity = calculateQuantity(values.quantity || item.quantity, toNumber(values.unitPrice || item.unitPrice), toNumber(values.totalPrice || item.totalPrice));
    const priced = normalizePriceFields({
      itemId: resolved.itemId,
      itemName: resolved.itemName,
      needsNameReview: resolved.needsNameReview,
      quantity,
      unitBuyPrice: toNumber(values.unitPrice || item.unitPrice),
      totalBuyPrice: toNumber(values.totalPrice || item.totalPrice)
    }, 'unitBuyPrice', 'totalBuyPrice');
    return {
      itemId: priced.itemId,
      itemName: priced.itemName || (priced.itemId ? `Item #${priced.itemId}` : ''),
      quantity: priced.quantity,
      unitBuyPrice: priced.unitBuyPrice,
      totalBuyPrice: priced.totalBuyPrice,
      remainingQuantity: priced.quantity,
      createdAt: item.timestamp || new Date().toISOString(),
      source: 'api',
      originalLogId: item.entryId || item.originalLogId,
      logTypeId: item.logTypeId,
      notes: 'Saved from import review',
      needsNameReview: Boolean(priced.needsNameReview)
    };
  }

  function buildReviewSaleCandidate(item, values = {}, itemLookup) {
    const itemId = values.itemId || item.itemId || undefined;
    const resolved = itemLookup.resolve(itemId, values.itemName || item.itemName || '');
    const quantity = calculateQuantity(values.quantity || item.quantity, toNumber(values.unitPrice || item.unitPrice), toNumber(values.totalPrice || item.totalPrice));
    const priced = normalizePriceFields({
      itemId: resolved.itemId,
      itemName: resolved.itemName,
      needsNameReview: resolved.needsNameReview,
      quantity,
      unitSellPrice: toNumber(values.unitPrice || item.unitPrice),
      totalSellPrice: toNumber(values.totalPrice || item.totalPrice),
      fees: toNumber(values.fees || item.fees)
    }, 'unitSellPrice', 'totalSellPrice');
    return {
      itemId: priced.itemId,
      itemName: priced.itemName || (priced.itemId ? `Item #${priced.itemId}` : ''),
      quantity: priced.quantity,
      unitSellPrice: priced.unitSellPrice,
      totalSellPrice: priced.totalSellPrice,
      fees: priced.fees,
      soldAt: item.timestamp || new Date().toISOString(),
      source: 'api',
      originalLogId: item.entryId || item.originalLogId,
      logTypeId: item.logTypeId,
      notes: 'Saved from import review',
      needsNameReview: Boolean(priced.needsNameReview)
    };
  }

  function saveReviewItem(storagePrefix, reviewId, values = {}, forceType = '') {
    const storageService = getStorageService();
    const accountingService = getAccountingService();
    if (!storageService) return { ok: false, message: 'Storage service is unavailable.' };
    let response = { ok: false, message: 'Review item was not found.' };
    storageService.update(storagePrefix, (data) => {
      const reviewQueue = Array.isArray(data.importReviewQueue) ? data.importReviewQueue.map(storageService.normalizeImportReviewItem) : [];
      const item = getReviewItem(reviewQueue, reviewId);
      if (!item) return data;
      const importedLogIds = new Set(Array.isArray(data.importedLogIds) ? data.importedLogIds.map(String) : []);
      const type = forceType || item.type;
      if (type === 'sell') {
        const candidate = buildReviewSaleCandidate(item, values, createItemLookup(data));
        const validation = validateSellCandidate(candidate);
        if (!validation.ok) {
          response = { ok: false, message: validation.reason };
          return data;
        }
        const saleResult = saveSaleCandidate({ candidate, data, purchaseLots: data.purchaseLots, sales: data.sales, storageService, accountingService });
        importedLogIds.add(String(item.entryId || item.originalLogId));
        response = { ok: true, message: saleResult.warning || 'Review item saved as a sale.' };
        return {
          ...data,
          purchaseLots: saleResult.purchaseLots,
          sales: saleResult.sales,
          importedLogIds: [...importedLogIds],
          importReviewQueue: removeReviewItem(reviewQueue, item.entryId),
          settings: { ...data.settings, logImportDebug: { ...(data.settings.logImportDebug || {}), updatedAt: new Date().toISOString() } }
        };
      }
      const candidate = buildReviewPurchaseCandidate(item, values, createItemLookup(data));
      const validation = validateBuyCandidate(candidate);
      if (!validation.ok) {
        response = { ok: false, message: validation.reason };
        return data;
      }
      importedLogIds.add(String(item.entryId || item.originalLogId));
      response = { ok: true, message: 'Review item saved as a purchase.' };
      return {
        ...data,
        purchaseLots: [storageService.normalizePurchaseLot(candidate), ...data.purchaseLots],
        importedLogIds: [...importedLogIds],
        importReviewQueue: removeReviewItem(reviewQueue, item.entryId),
        settings: { ...data.settings, logImportDebug: { ...(data.settings.logImportDebug || {}), updatedAt: new Date().toISOString() } }
      };
    });
    return response;
  }

  function ignoreReviewItem(storagePrefix, reviewId) {
    const storageService = getStorageService();
    if (!storageService) return { ok: false, message: 'Storage service is unavailable.' };
    let response = { ok: false, message: 'Review item was not found.' };
    storageService.update(storagePrefix, (data) => {
      const reviewQueue = Array.isArray(data.importReviewQueue) ? data.importReviewQueue.map(storageService.normalizeImportReviewItem) : [];
      const item = getReviewItem(reviewQueue, reviewId);
      if (!item) return data;
      const importedLogIds = new Set(Array.isArray(data.importedLogIds) ? data.importedLogIds.map(String) : []);
      importedLogIds.add(String(item.entryId || item.originalLogId));
      response = { ok: true, message: 'Review item ignored.' };
      return {
        ...data,
        importedLogIds: [...importedLogIds],
        importReviewQueue: removeReviewItem(reviewQueue, item.entryId),
        settings: { ...data.settings, logImportDebug: { ...(data.settings.logImportDebug || {}), ignoredItems: Number(data.settings.logImportDebug && data.settings.logImportDebug.ignoredItems || 0) + 1, updatedAt: new Date().toISOString() } }
      };
    });
    return response;
  }

  function deleteReviewItem(storagePrefix, reviewId) {
    const storageService = getStorageService();
    if (!storageService) return { ok: false, message: 'Storage service is unavailable.' };
    let response = { ok: false, message: 'Review item was not found.' };
    storageService.update(storagePrefix, (data) => {
      const reviewQueue = Array.isArray(data.importReviewQueue) ? data.importReviewQueue.map(storageService.normalizeImportReviewItem) : [];
      const item = getReviewItem(reviewQueue, reviewId);
      if (!item) return data;
      response = { ok: true, message: 'Review item deleted. It can be imported again later.' };
      return { ...data, importReviewQueue: removeReviewItem(reviewQueue, item.entryId) };
    });
    return response;
  }

  function clearReviewQueue(storagePrefix) {
    const storageService = getStorageService();
    if (!storageService) return { ok: false, message: 'Storage service is unavailable.' };
    storageService.update(storagePrefix, (data) => ({ ...data, importReviewQueue: [] }));
    return { ok: true, message: 'Needs review queue cleared.' };
  }

  function resetImportState(storagePrefix) {
    const storageService = getStorageService();
    if (!storageService) return { ok: false, message: 'Storage service is unavailable.' };
    storageService.update(storagePrefix, (data) => ({
      ...data,
      importedLogIds: [],
      importReviewQueue: [],
      importHistory: [],
      settings: { ...data.settings, logImportDebug: {}, logImportLastRunAt: '' }
    }));
    return { ok: true, message: 'Import state reset. Purchases, sales, settings, API key, and window state were preserved.' };
  }

  async function retryReviewQueue(storagePrefix) {
    const storageService = getStorageService();
    const accountingService = getAccountingService();
    const summary = createEmptySummary('', '');
    summary.rangeUsed = 'review-retry';
    if (!storageService) return { ...summary, ok: false, errors: ['Storage service is unavailable.'] };
    const totalStart = now();
    const data = storageService.load(storagePrefix);
    const itemLookup = createItemLookup(data);
    const importedLogIds = new Set(Array.isArray(data.importedLogIds) ? data.importedLogIds.map(String) : []);
    let purchaseLots = [...data.purchaseLots];
    let sales = [...data.sales];
    let reviewQueue = Array.isArray(data.importReviewQueue) ? data.importReviewQueue.map(storageService.normalizeImportReviewItem).filter((item) => !item.ignored) : [];
    const nextReviewQueue = [];

    for (let index = 0; index < reviewQueue.length; index += 1) {
      const item = reviewQueue[index];
      const entryId = String(item.entryId || item.originalLogId || item.id);
      if (importedLogIds.has(entryId)) {
        summary.duplicatesSkipped += 1;
        continue;
      }
      const log = buildLogFromReviewItem(item);
      const type = item.type === 'sell' ? 'sell' : 'buy';
      const parsed = type === 'buy' ? normalizeBuyLog(log, itemLookup) : normalizeSellLog(log, itemLookup);
      noteParserKind(summary, type, parsed.parserKind);
      if (parsed.candidate) {
        if (type === 'buy') {
          purchaseLots = [storageService.normalizePurchaseLot(parsed.candidate), ...purchaseLots];
          summary.purchasesImported += 1;
          summary.purchasesSaved += 1;
          summary.buyCandidatesCreated += 1;
        } else {
          const saleResult = saveSaleCandidate({ candidate: parsed.candidate, data, purchaseLots, sales, storageService, accountingService });
          purchaseLots = saleResult.purchaseLots;
          sales = saleResult.sales;
          summary.salesImported += 1;
          summary.salesSaved += 1;
          summary.sellCandidatesCreated += 1;
          if (saleResult.warning) {
            summary.unmatchedSales += 1;
            summary.warnings.push(saleResult.warning);
          }
        }
        importedLogIds.add(entryId);
      } else {
        addFailureReason(summary, parsed.reason);
        nextReviewQueue.push(storageService.normalizeImportReviewItem({ ...item, reason: parsed.reason, updatedAt: new Date().toISOString() }));
      }
      if ((index + 1) % batchSize === 0) await yieldToBrowser();
    }

    summary.activeReviewItems = nextReviewQueue.length;
    summary.reviewCandidatesCreated = nextReviewQueue.length;
    summary.diagnosticMessage = `Retry imported ${summary.purchasesImported} purchases and ${summary.salesImported} sales. Still needs review: ${nextReviewQueue.length}.`;
    const debug = buildDebug({ debug: data.settings.logImportDebug || {} }, summary, { totalImportMs: elapsed(totalStart) });
    storageService.save(storagePrefix, {
      ...data,
      purchaseLots,
      sales,
      importedLogIds: [...importedLogIds],
      importReviewQueue: nextReviewQueue,
      settings: { ...data.settings, logImportDebug: debug, logImportLastRunAt: new Date().toISOString() }
    });
    summary.debug = debug;
    return summary;
  }

  function runParserSelfTest() {
    const itemLookup = createItemLookup({});
    return parserSamples.map((sample) => {
      const log = { entryId: `sample-${sample.slice(0, 20)}`, logTypeId: isPipeSellText(sample) ? 1226 : 1112, text: sample, message: sample, timestamp: Date.now() / 1000 };
      return {
        sample,
        buy: normalizeBuyLog(log, itemLookup),
        sell: normalizeSellLog(log, itemLookup)
      };
    });
  }

  return {
    clearReviewQueue,
    deleteReviewItem,
    ignoreReviewItem,
    importLogs,
    resetImportState,
    retryReviewQueue,
    runParserSelfTest,
    saveReviewItem
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProLogImportService = FlipTrackerProLogImportService;
}
