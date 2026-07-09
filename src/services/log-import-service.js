const FlipTrackerProLogImportService = (() => {
  const batchSize = 75;

  const parserSelfTestCases = Object.freeze([
    {
      name: 'readable-buy-cpu',
      type: 'buy',
      logTypeId: 1112,
      text: '18:18:23 - 09/07/26 You bought 11x CPU on the item market from someone at $325 each for a total of $3,575',
      expected: { quantity: 11, itemName: 'CPU', sellerName: 'someone', unitBuyPrice: 325, totalBuyPrice: 3575 }
    },
    {
      name: 'pipe-buy-cpu',
      type: 'buy',
      logTypeId: 1112,
      text: 'Item market buy | 4378669 | 0 | 1301 | 5 | 1450 | 290 | 1 | green',
      expected: { itemId: '1301', quantity: 5, unitBuyPrice: 290, totalBuyPrice: 1450 }
    },
    {
      name: 'buried-pipe-buy-cpu',
      type: 'buy',
      logTypeId: 1112,
      text: 'Item market buy',
      raw: { title: 'Item market buy', details: ['4378669', '0', '1301', '5', '1450', '290', '1', 'green'] },
      expected: { itemId: '1301', quantity: 5, unitBuyPrice: 290, totalBuyPrice: 1450 }
    },
    {
      name: 'readable-sell-dahlia',
      type: 'sell',
      logTypeId: 1226,
      text: '20:37:53 - 24/07/25 You sold 54x Dahlia on the item market to Javster at $1,900 each for a total of $97,470 after $5,130 in fees',
      expected: { quantity: 54, itemName: 'Dahlia', buyerName: 'Javster', unitSellPrice: 1900, totalSellPrice: 97470, fees: 5130 }
    }
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
    if (!value || depth > 5 || output.length >= 220) return output;
    if (Array.isArray(value)) {
      value.slice(0, 40).forEach((entry) => collectFieldValues(entry, output, depth + 1));
      return output;
    }
    if (typeof value === 'object') {
      Object.entries(value).slice(0, 90).forEach(([key, entry]) => {
        if (/key|token|secret|password/i.test(key)) return;
        output.push({ key, value: entry });
        collectFieldValues(entry, output, depth + 1);
      });
    }
    return output;
  }

  function getParseRoots(log) {
    const raw = log && log.raw && typeof log.raw === 'object' ? log.raw : {};
    return [log.raw, log.data, log.params, log.details, raw.data, raw.params, raw.details, log].filter((value, index, values) => value && typeof value === 'object' && values.indexOf(value) === index);
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
    if (!value || depth > 5) return;
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
    scanItems(data.settings && data.settings.itemPriceSnapshots, itemMap);

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
    return parts.length >= 2 ? parts : null;
  }

  function isPipeTitle(value) {
    return /item\s+market\s+(buy|sell|sale)/i.test(String(value || '')) || /market\s+sell/i.test(String(value || ''));
  }

  function pipeTitleFromLog(log) {
    const candidates = [log && log.title, log && log.text, log && log.message, getLogText(log), log && log.raw && log.raw.title, log && log.raw && log.raw.log, log && log.raw && log.raw.event];
    for (const candidate of candidates) {
      const text = String(candidate || '').trim();
      if (/item\s+market\s+buy/i.test(text)) return 'Item market buy';
      if (/(item\s+market\s+(sell|sale)|market\s+sell)/i.test(text)) return 'Item market sell';
    }
    return '';
  }

  function sortObjectKeys(keys) {
    return keys.sort((left, right) => {
      const leftNumeric = /^\d+$/.test(left);
      const rightNumeric = /^\d+$/.test(right);
      if (leftNumeric && rightNumeric) return Number(left) - Number(right);
      if (leftNumeric) return -1;
      if (rightNumeric) return 1;
      return left.localeCompare(right);
    });
  }

  function primitivePartsFromArray(array) {
    return array
      .filter((entry) => ['string', 'number', 'boolean'].includes(typeof entry))
      .map((entry) => String(entry).trim())
      .filter(Boolean);
  }

  function primitivePartsFromObject(object) {
    return sortObjectKeys(Object.keys(object || {}))
      .map((key) => object[key])
      .filter((entry) => ['string', 'number', 'boolean'].includes(typeof entry))
      .map((entry) => String(entry).trim())
      .filter(Boolean);
  }

  function normalizePipeParts(parts, titleHint = '') {
    if (!Array.isArray(parts)) return null;
    const cleaned = parts.map((part) => String(part || '').trim()).filter(Boolean);
    if (!cleaned.length) return null;
    const titleIndex = cleaned.findIndex(isPipeTitle);
    const titledParts = titleIndex >= 0 ? cleaned.slice(titleIndex) : titleHint ? [titleHint, ...cleaned] : cleaned;
    if (!isPipeTitle(titledParts[0]) || titledParts.length < 7) return null;
    return titledParts.slice(0, 12);
  }

  function scanPipeParts(value, titleHint = '', depth = 0, output = []) {
    if (output.length || value === null || value === undefined || depth > 5) return output;

    if (typeof value === 'string') {
      if (value.includes('|')) {
        const parts = normalizePipeParts(splitPipeLog(value), titleHint);
        if (parts) output.push(parts);
      }
      return output;
    }

    if (typeof value === 'number' || typeof value === 'boolean') return output;

    if (Array.isArray(value)) {
      for (const entry of value.slice(0, 50)) {
        if (typeof entry === 'string' && entry.includes('|')) {
          const parts = normalizePipeParts(splitPipeLog(entry), titleHint);
          if (parts) {
            output.push(parts);
            return output;
          }
        }
      }
      const primitiveParts = primitivePartsFromArray(value);
      const arrayParts = normalizePipeParts(primitiveParts, titleHint);
      if (arrayParts) {
        output.push(arrayParts);
        return output;
      }
      value.slice(0, 50).forEach((entry) => scanPipeParts(entry, titleHint, depth + 1, output));
      return output;
    }

    if (typeof value === 'object') {
      const objectTitle = pipeTitleFromLog(value) || titleHint;
      for (const key of sortObjectKeys(Object.keys(value)).slice(0, 80)) {
        if (/key|token|secret|password/i.test(key)) continue;
        const entry = value[key];
        if (typeof entry === 'string' && entry.includes('|')) {
          const parts = normalizePipeParts(splitPipeLog(entry), objectTitle);
          if (parts) {
            output.push(parts);
            return output;
          }
        }
      }
      const primitiveParts = primitivePartsFromObject(value);
      const objectParts = normalizePipeParts(primitiveParts, objectTitle);
      if (objectParts) {
        output.push(objectParts);
        return output;
      }
      for (const key of sortObjectKeys(Object.keys(value)).slice(0, 80)) {
        if (/key|token|secret|password/i.test(key)) continue;
        scanPipeParts(value[key], objectTitle, depth + 1, output);
        if (output.length) return output;
      }
    }

    return output;
  }

  function extractPipePartsFromLog(log) {
    const titleHint = pipeTitleFromLog(log);
    const directStrings = [getLogText(log), log && log.text, log && log.message, log && log.title, log && log.raw && log.raw.title].filter(Boolean);

    for (const text of directStrings) {
      const direct = normalizePipeParts(splitPipeLog(text), titleHint);
      if (direct) return direct;
    }

    const raw = log && log.raw && typeof log.raw === 'object' ? log.raw : {};
    const roots = [log && log.data, log && log.params, log && log.details, raw.data, raw.params, raw.details, raw, log].filter((root, index, rootsList) => root && typeof root === 'object' && rootsList.indexOf(root) === index);

    for (const root of roots) {
      const matches = scanPipeParts(root, titleHint, 0, []);
      if (matches.length) return matches[0];
    }

    return null;
  }

  function isPipeBuyLog(log) {
    const parts = extractPipePartsFromLog(log);
    return Boolean(parts && /item\s+market\s+buy/i.test(parts[0]));
  }

  function isPipeSellLog(log) {
    const parts = extractPipePartsFromLog(log);
    return Boolean(parts && /(item\s+market\s+(sell|sale)|market\s+sell)/i.test(parts[0]));
  }

  function parsePipeBuy(log, itemLookup) {
    const parts = extractPipePartsFromLog(log);
    if (!parts || !/item\s+market\s+buy/i.test(parts[0])) return null;
    const itemId = toNumber(parts[3], 0);
    const quantity = toNumber(parts[4], 0);
    const totalBuyPrice = toNumber(parts[5], 0);
    const unitBuyPrice = toNumber(parts[6], 0);
    if (!itemId && !quantity && !totalBuyPrice && !unitBuyPrice) return null;
    const resolved = itemLookup.resolve(itemId ? String(itemId) : '');
    return normalizePriceFields({
      parserKind: 'pipe',
      pipeParts: parts,
      itemId: resolved.itemId,
      itemName: resolved.itemName,
      needsNameReview: resolved.needsNameReview,
      quantity,
      unitBuyPrice,
      totalBuyPrice
    }, 'unitBuyPrice', 'totalBuyPrice');
  }

  function parsePipeSell(log, itemLookup) {
    const parts = extractPipePartsFromLog(log);
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
      pipeParts: parts,
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
    // Torn readable buy log: time/date + quantity + item + market + seller + unit price + total buy price.
    const match = String(text).match(/(?:^|\b)(?:\d{1,2}:\d{2}:\d{2}\s+-\s+\d{2}\/\d{2}\/\d{2}\s+)?you bought\s+(?:(\d{1,8})\s*x\s+)?(?:an?\s+)?(.+?)\s+on the item market\s+from\s+([A-Za-z0-9_ -]+?)\s+at\s+\$?([0-9][0-9,]*)\s+each\s+for\s+a\s+total\s+of\s+\$?([0-9][0-9,]*)/i);
    if (!match) return null;
    const unitBuyPrice = parseMoneyValue(match[4]);
    const totalBuyPrice = parseMoneyValue(match[5]);
    return normalizePriceFields({
      parserKind: 'text',
      itemName: match[2].trim(),
      quantity: calculateQuantity(match[1], unitBuyPrice, totalBuyPrice),
      sourceMarket: 'item market',
      sellerName: match[3].trim(),
      unitBuyPrice,
      totalBuyPrice
    }, 'unitBuyPrice', 'totalBuyPrice');
  }

  function parseItemMarketSale(text) {
    // Torn readable sell log: time/date + quantity + item + market + buyer + unit price + sale total + optional fees.
    const match = String(text).match(/(?:^|\b)(?:\d{1,2}:\d{2}:\d{2}\s+-\s+\d{2}\/\d{2}\/\d{2}\s+)?you sold\s+(?:(\d{1,8})\s*x\s+)?(?:an?\s+)?(.+?)\s+on the item market\s+to\s+([A-Za-z0-9_ -]+?)\s+at\s+\$?([0-9][0-9,]*)\s+each\s+for\s+a\s+total\s+of\s+\$?([0-9][0-9,]*)(?:\s+after\s+\$?([0-9][0-9,]*)\s+in\s+fees?)?/i);
    if (!match) return null;
    const unitSellPrice = parseMoneyValue(match[4]);
    const totalSellPrice = parseMoneyValue(match[5]);
    return normalizePriceFields({
      parserKind: 'text',
      itemName: match[2].trim(),
      quantity: calculateQuantity(match[1], unitSellPrice, totalSellPrice),
      sourceMarket: 'item market',
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
    const unitBuyPrice = toNumber(findField(log, ['price', 'unitPrice', 'unit_price', 'cost', 'unitCost', 'unit_cost', 'unitBuyPrice', 'unit_buy_price']), 0);
    const totalBuyPrice = toNumber(findField(log, ['total', 'totalCost', 'total_cost', 'totalPrice', 'total_price', 'value', 'money', 'totalBuyPrice', 'total_buy_price']), 0);
    const seller = findField(log, ['seller', 'from', 'user', 'player']);
    if ((!resolved.itemName && !resolved.itemId) || (!unitBuyPrice && !totalBuyPrice)) return null;
    return normalizePriceFields({
      parserKind: 'structured',
      itemId: resolved.itemId,
      itemName: resolved.itemName,
      needsNameReview: resolved.needsNameReview,
      quantity,
      sourceMarket: 'item market',
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
    const unitSellPrice = toNumber(findField(log, ['price', 'unitPrice', 'unit_price', 'sellPrice', 'sell_price', 'unitSellPrice', 'unit_sell_price']), 0);
    const totalSellPrice = toNumber(findField(log, ['total', 'totalRevenue', 'total_revenue', 'revenue', 'value', 'money', 'totalSellPrice', 'total_sell_price']), 0);
    const fees = toNumber(findField(log, ['fee', 'fees', 'marketFee', 'market_fee']), 0);
    const buyer = findField(log, ['buyer', 'to', 'user', 'player']);
    if ((!resolved.itemName && !resolved.itemId) || (!unitSellPrice && !totalSellPrice)) return null;
    return normalizePriceFields({
      parserKind: 'structured',
      itemId: resolved.itemId,
      itemName: resolved.itemName,
      needsNameReview: resolved.needsNameReview,
      quantity,
      sourceMarket: 'item market',
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
    if (isPipeBuyLog(log)) return 'buy';
    if (isPipeSellLog(log)) return 'sell';
    const text = getLogText(log);
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
    if (!parsed) return { candidate: null, reason: 'No pipe, structured, or text buy parser matched.', parserKind: '', partial: buildPartialFromPipe(log, 'buy', itemLookup) };
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
      sourceMarket: priced.sourceMarket || 'item market',
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
    if (!parsed) return { candidate: null, reason: 'No pipe, structured, or text sell parser matched.', parserKind: '', partial: buildPartialFromPipe(log, 'sell', itemLookup) };
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
      sourceMarket: priced.sourceMarket || 'item market',
      originalLogId: getEntryId(log),
      logTypeId: Number(log.logTypeId) || undefined,
      notes: buyerNote || 'Imported from Torn log',
      needsNameReview: Boolean(priced.needsNameReview)
    };
    const validation = validateSellCandidate(candidate);
    return validation.ok ? { candidate, reason: '', parserKind: parsed.parserKind || 'unknown' } : { candidate: null, reason: validation.reason, parserKind: parsed.parserKind || 'unknown', partial: candidate };
  }

  function buildPartialFromPipe(log, type, itemLookup) {
    const parts = extractPipePartsFromLog(log);
    if (!parts) return {};
    const itemId = toNumber(parts[3], 0);
    const resolved = itemLookup.resolve(itemId ? String(itemId) : '');
    const partial = {
      itemId: resolved.itemId,
      itemName: resolved.itemName,
      needsNameReview: resolved.needsNameReview,
      quantity: toNumber(parts[4], 0),
      pipeParts: parts
    };
    if (type === 'sell') {
      partial.unitSellPrice = toNumber(parts[6], 0);
      partial.totalSellPrice = toNumber(parts[5], 0);
      partial.fees = toNumber(parts[7], 0) || '';
    } else {
      partial.unitBuyPrice = toNumber(parts[6], 0);
      partial.totalBuyPrice = toNumber(parts[5], 0);
    }
    return partial;
  }

  function createReviewCandidate(log, type, reason, partial = {}) {
    const isSell = type === 'sell';
    const pipeParts = partial.pipeParts || extractPipePartsFromLog(log) || [];
    const textPreview = getLogText(log) || (pipeParts.length ? pipeParts.join(' | ') : '');
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
      pipeParts,
      textPreview: textPreview.slice(0, 320),
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

  function noteCandidateKind(summary, type, parserKind) {
    if (type === 'buy' && parserKind === 'pipe') summary.pipeBuyCandidatesCreated += 1;
    if (type === 'buy' && parserKind === 'structured') summary.structuredBuyCandidatesCreated += 1;
    if (type === 'buy' && parserKind === 'text') summary.textBuyCandidatesCreated += 1;
    if (type === 'sell' && parserKind === 'pipe') summary.pipeSellCandidatesCreated += 1;
    if (type === 'sell' && parserKind === 'structured') summary.structuredSellCandidatesCreated += 1;
    if (type === 'sell' && parserKind === 'text') summary.textSellCandidatesCreated += 1;
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
      pipeBuyLogsFound: 0,
      pipeSellLogsFound: 0,
      pipeBuyMatches: 0,
      pipeSellMatches: 0,
      textBuyMatches: 0,
      textSellMatches: 0,
      structuredBuyMatches: 0,
      structuredSellMatches: 0,
      pipeBuyCandidatesCreated: 0,
      pipeSellCandidatesCreated: 0,
      textBuyCandidatesCreated: 0,
      textSellCandidatesCreated: 0,
      structuredBuyCandidatesCreated: 0,
      structuredSellCandidatesCreated: 0,
      parserFailures: 0,
      validationFailures: 0,
      parserFailureReasons: [],
      reviewCandidatesCreated: 0,
      activeReviewItems: 0,
      firstRecognizedLogs: [],
      parserSelfTest: [],
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

  function summarizeRecognizedLogs(logs = []) {
    const buyIds = new Set(getBuyLogIds());
    const sellIds = new Set(getSellLogIds());
    return (Array.isArray(logs) ? logs : [])
      .filter((log) => buyIds.has(Number(log.logTypeId)) || sellIds.has(Number(log.logTypeId)) || isPipeBuyLog(log) || isPipeSellLog(log) || parseItemMarketPurchase(getLogText(log)) || parseItemMarketSale(getLogText(log)))
      .slice(0, 5)
      .map((log) => ({
        entryId: getEntryId(log),
        logTypeId: Number(log.logTypeId) || '',
        title: String(log.title || log.raw && log.raw.title || ''),
        timestamp: getLogTimestamp(log) || '',
        textPreview: getLogText(log).slice(0, 240),
        pipeParts: extractPipePartsFromLog(log) || [],
        rawKeys: Array.isArray(log.rawKeys) ? log.rawKeys.slice(0, 40) : Array.isArray(log.rawSampleKeys) ? log.rawSampleKeys.slice(0, 40) : []
      }));
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
      pipeBuyLogsFound: summary.pipeBuyLogsFound || 0,
      pipeSellLogsFound: summary.pipeSellLogsFound || 0,
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
      pipeBuyCandidatesCreated: summary.pipeBuyCandidatesCreated || 0,
      pipeSellCandidatesCreated: summary.pipeSellCandidatesCreated || 0,
      textBuyCandidatesCreated: summary.textBuyCandidatesCreated || 0,
      textSellCandidatesCreated: summary.textSellCandidatesCreated || 0,
      structuredBuyCandidatesCreated: summary.structuredBuyCandidatesCreated || 0,
      structuredSellCandidatesCreated: summary.structuredSellCandidatesCreated || 0,
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
      parserSelfTest: summary.parserSelfTest || [],
      progress: summary.progress,
      firstLogs: (serviceDebug.firstLogs || []).slice(0, 5),
      firstRecognizedLogs: (summary.firstRecognizedLogs && summary.firstRecognizedLogs.length ? summary.firstRecognizedLogs : serviceDebug.firstRecognizedLogs || serviceDebug.firstLogs || []).slice(0, 5),
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
    if (summary.buyIdMatches > 0 && summary.purchasesSaved === 0) {
      const reason = summary.parserFailureReasons.length ? summary.parserFailureReasons.join(' | ') : 'the parser did not find item, quantity, and price fields in the normalized/raw log data.';
      summary.diagnosticMessage = `Buy logs were detected but could not be converted into purchases because: ${reason}`;
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
    summary.parserSelfTest = runParserSelfTest();

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
    summary.firstRecognizedLogs = summarizeRecognizedLogs(logs);

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
      const pipeParts = extractPipePartsFromLog(log);
      if (pipeParts && /item\s+market\s+buy/i.test(pipeParts[0])) summary.pipeBuyLogsFound += 1;
      if (pipeParts && /(item\s+market\s+(sell|sale)|market\s+sell)/i.test(pipeParts[0])) summary.pipeSellLogsFound += 1;

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
        noteCandidateKind(summary, type, parsed.parserKind);
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
      text: item.textPreview || (Array.isArray(item.pipeParts) ? item.pipeParts.join(' | ') : ''),
      message: item.textPreview || (Array.isArray(item.pipeParts) ? item.pipeParts.join(' | ') : ''),
      title: item.textPreview || '',
      details: Array.isArray(item.pipeParts) ? item.pipeParts.slice(1) : [],
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
    summary.parserSelfTest = runParserSelfTest();
    if (!storageService) return { ...summary, ok: false, errors: ['Storage service is unavailable.'] };
    const totalStart = now();
    const data = storageService.load(storagePrefix);
    const itemLookup = createItemLookup(data);
    const importedLogIds = new Set(Array.isArray(data.importedLogIds) ? data.importedLogIds.map(String) : []);
    let purchaseLots = [...data.purchaseLots];
    let sales = [...data.sales];
    const reviewQueue = Array.isArray(data.importReviewQueue) ? data.importReviewQueue.map(storageService.normalizeImportReviewItem).filter((item) => !item.ignored) : [];
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
        noteCandidateKind(summary, type, parsed.parserKind);
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
        nextReviewQueue.push(storageService.normalizeImportReviewItem({ ...item, ...createReviewCandidate(log, type, parsed.reason, parsed.partial), reason: parsed.reason, updatedAt: new Date().toISOString() }));
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

  function pickCandidateForSelfTest(result, type) {
    const parsed = result && (result.candidate || result.partial) || {};
    if (type === 'sell') {
      return {
        itemId: parsed.itemId || '',
        itemName: parsed.itemName || '',
        quantity: parsed.quantity || 0,
        buyerName: parsed.buyerName || '',
        unitSellPrice: parsed.unitSellPrice || 0,
        totalSellPrice: parsed.totalSellPrice || 0,
        fees: parsed.fees || 0
      };
    }
    return {
      itemId: parsed.itemId || '',
      itemName: parsed.itemName || '',
      quantity: parsed.quantity || 0,
      sellerName: parsed.sellerName || '',
      unitBuyPrice: parsed.unitBuyPrice || 0,
      totalBuyPrice: parsed.totalBuyPrice || 0
    };
  }

  function matchesExpected(candidate, expected) {
    return Object.entries(expected).every(([key, value]) => String(candidate[key]) === String(value));
  }

  function runParserSelfTest() {
    const itemLookup = createItemLookup({ itemPriceSnapshots: [{ itemId: '1301', itemName: 'CPU', marketPrice: 0, timestamp: new Date().toISOString(), source: 'api' }] });
    return parserSelfTestCases.map((test) => {
      const log = {
        entryId: `sample-${test.name}`,
        id: `sample-${test.name}`,
        logTypeId: test.logTypeId,
        text: test.text,
        message: test.text,
        title: test.text.split('|')[0].trim(),
        timestamp: Date.now() / 1000,
        raw: test.raw || { title: test.text.split('|')[0].trim(), details: test.text.includes('|') ? test.text.split('|').slice(1).map((part) => part.trim()) : [] },
        rawKeys: test.raw ? Object.keys(test.raw) : ['title', 'details']
      };
      const parsed = test.type === 'sell' ? normalizeSellLog(log, itemLookup) : normalizeBuyLog(log, itemLookup);
      const candidate = pickCandidateForSelfTest(parsed, test.type);
      return {
        name: test.name,
        type: test.type,
        passed: Boolean(parsed.candidate && matchesExpected(candidate, test.expected)),
        expected: test.expected,
        actual: candidate,
        reason: parsed.reason || ''
      };
    });
  }

  return {
    clearReviewQueue,
    deleteReviewItem,
    extractPipePartsFromLog,
    ignoreReviewItem,
    importLogs,
    resetImportState,
    retryReviewQueue,
    runParserSelfTest,
    saveReviewItem,
    summarizeRecognizedLogs
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProLogImportService = FlipTrackerProLogImportService;
}
