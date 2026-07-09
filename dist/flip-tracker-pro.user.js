// ==UserScript==
// @name         Flip Tracker Pro
// @namespace    https://www.torn.com/
// @version      0.8.5
// @description  Professional standalone flip tracking app for Torn
// @author       MonsterSnack
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @connect      api.torn.com
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

(function flipTrackerProStandalone() {
  'use strict';

  const VERSION = '0.8.5';
  const ROOT_ID = 'flip-tracker-pro-root';
  const STORAGE_KEY = 'flipTrackerPro:appData:v1';
  const BUY_LOG_IDS = Object.freeze([1225, 1220, 4201, 1112, 1103, 4200, 5927, 5510]);
  const SELL_LOG_IDS = Object.freeze([1226, 1221, 1113, 1104, 4210, 5928, 5511]);
  const KNOWN_LOG_IDS = BUY_LOG_IDS.concat(SELL_LOG_IDS);
  const ROUTES = Object.freeze([
    ['dashboard', 'Dashboard'],
    ['calculator', 'Record Sale'],
    ['portfolio', 'Portfolio'],
    ['purchases', 'Purchases'],
    ['history', 'History'],
    ['statistics', 'Statistics'],
    ['settings', 'Settings']
  ]);

  const css = `
    #${ROOT_ID}{position:fixed;top:96px;right:24px;z-index:100000;color:#f4f6fb;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    #${ROOT_ID} *{box-sizing:border-box}#${ROOT_ID} .ftp-window{position:relative;display:grid;grid-template-rows:auto minmax(0,1fr);width:760px;height:560px;min-width:320px;min-height:360px;overflow:hidden;border:1px solid #313744;border-radius:8px;background:#111318;box-shadow:0 18px 60px rgba(0,0,0,.35)}
    #${ROOT_ID} .ftp-window[data-mode="compact"]{width:52px!important;height:44px!important;min-width:52px;min-height:44px}#${ROOT_ID} .ftp-window[data-mode="compact"] .ftp-body,#${ROOT_ID} .ftp-window[data-mode="compact"] .ftp-actions,#${ROOT_ID} .ftp-window[data-mode="compact"] .ftp-version,#${ROOT_ID} .ftp-window[data-mode="compact"] .ftp-resize{display:none}#${ROOT_ID} .ftp-window[data-mode="compact"] .ftp-titlebar{justify-content:center;width:52px;height:44px;padding:0;border-bottom:0}
    #${ROOT_ID} .ftp-titlebar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;border-bottom:1px solid #313744;background:#181b22;cursor:grab;touch-action:none;user-select:none}#${ROOT_ID} .ftp-title{border:0;background:transparent;color:#f4f6fb;cursor:pointer;font:inherit;font-size:13px;font-weight:800}#${ROOT_ID} span,#${ROOT_ID} small,#${ROOT_ID} p,#${ROOT_ID} .ftp-version{color:#9aa3b2}
    #${ROOT_ID} .ftp-body{display:grid;grid-template-columns:150px minmax(0,1fr);min-height:0;overflow:hidden}#${ROOT_ID} .ftp-sidebar{display:grid;align-content:start;gap:6px;overflow-y:auto;border-right:1px solid #313744;background:#151820;padding:12px}#${ROOT_ID} .ftp-main{display:grid;align-content:start;gap:12px;min-width:0;overflow-y:auto;padding:14px}
    #${ROOT_ID} .ftp-nav{width:100%;border:1px solid transparent;border-radius:6px;background:transparent;color:#9aa3b2;cursor:pointer;font:inherit;font-size:12px;font-weight:700;padding:9px 10px;text-align:left}#${ROOT_ID} .ftp-nav:hover,#${ROOT_ID} .ftp-nav[data-active="true"]{border-color:#4f8cff;background:#263145;color:#f4f6fb}
    #${ROOT_ID} .ftp-card,#${ROOT_ID} .ftp-stat,#${ROOT_ID} .ftp-preview{border:1px solid #313744;border-radius:8px;background:#20242d;padding:12px}#${ROOT_ID} h2{margin:0 0 6px;font-size:13px}#${ROOT_ID} p{margin:0;font-size:12px;line-height:1.5}#${ROOT_ID} .ftp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}#${ROOT_ID} .ftp-field{display:grid;gap:5px;margin-top:8px}
    #${ROOT_ID} .ftp-input{width:100%;border:1px solid #313744;border-radius:6px;background:#181b22;color:#f4f6fb;font:inherit;font-size:12px;outline:none;padding:8px}#${ROOT_ID} .ftp-input:focus{border-color:#4f8cff}#${ROOT_ID} .ftp-button,#${ROOT_ID} .ftp-primary,#${ROOT_ID} .ftp-danger{border:0;border-radius:6px;color:#fff;cursor:pointer;font:inherit;font-size:12px;font-weight:700;padding:9px 10px}#${ROOT_ID} .ftp-primary{background:#4f8cff}#${ROOT_ID} .ftp-button{background:#313744;color:#f4f6fb}#${ROOT_ID} .ftp-danger{background:#3a2024;color:#ffb3b3}
    #${ROOT_ID} .ftp-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px}#${ROOT_ID} .ftp-list{display:grid;gap:6px;list-style:none;margin:8px 0 0;padding:0}#${ROOT_ID} .ftp-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;border:1px solid #313744;border-radius:6px;background:#181b22;font-size:12px;padding:8px}#${ROOT_ID} [data-profit="positive"]{color:#3ecf8e}#${ROOT_ID} [data-profit="negative"]{color:#ff6b6b}#${ROOT_ID} .ftp-status[data-status="error"]{color:#ff6b6b}#${ROOT_ID} .ftp-status[data-status="success"]{color:#3ecf8e}#${ROOT_ID} .ftp-status[data-status="warning"]{color:#ffd166}
    #${ROOT_ID} .ftp-resize{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;touch-action:none}#${ROOT_ID} .ftp-resize:after{position:absolute;right:4px;bottom:4px;width:7px;height:7px;border-right:2px solid #586173;border-bottom:2px solid #586173;content:''}#${ROOT_ID} .ftp-toasts{position:absolute;top:52px;right:12px;z-index:2;display:grid;gap:8px;width:min(280px,calc(100% - 24px));pointer-events:none}#${ROOT_ID} .ftp-toast{display:grid;gap:3px;padding:10px 12px;border:1px solid #313744;border-radius:8px;background:#181b22;box-shadow:0 12px 28px rgba(0,0,0,.28)}#${ROOT_ID} details summary{cursor:pointer;color:#f4f6fb;font-weight:700}
  `;

  const moneyFormatter = new Intl.NumberFormat('en-US', { currency: 'USD', maximumFractionDigits: 0, style: 'currency' });
  let lastApiRequestAt = 0;
  let lastSummary = null;

  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
  function money(value) { return moneyFormatter.format(Number(value) || 0); }
  function pct(value) { return `${(Number(value) || 0).toFixed(1)}%`; }
  function num(value, fallback = 0) { const parsed = Number(String(value ?? '').replace(/[$,]/g, '')); return Number.isFinite(parsed) ? parsed : fallback; }
  function makeId() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function nowMs() { return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }
  function elapsed(start) { return Math.round(nowMs() - start); }
  function toTimestamp(value, endOfDay) {
    if (!value) return '';
    if (/^\d+$/.test(String(value))) return String(value).length > 10 ? Math.floor(Number(value) / 1000) : Number(value);
    const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const parsed = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0).getTime()
      : Date.parse(value);
    return Number.isNaN(parsed) ? '' : Math.floor(parsed / 1000);
  }
  function toIso(value) { const timestamp = toTimestamp(value); return timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(); }
  function safeArray(value) { return Array.isArray(value) ? value : []; }

  function normalizeLot(raw = {}) {
    const quantity = Math.max(1, Math.floor(num(raw.quantity, 1)));
    const unitBuyPrice = num(raw.unitBuyPrice ?? raw.unitCost ?? raw.buyPrice);
    const totalBuyPrice = num(raw.totalBuyPrice ?? raw.totalCost, unitBuyPrice * quantity);
    const remainingQuantity = Math.min(quantity, Math.max(0, Math.floor(num(raw.remainingQuantity, quantity))));
    const itemName = String(raw.itemName || 'Unnamed item');
    const fallbackName = Boolean(raw.itemId && /^Item #\d+$/i.test(itemName));
    return {
      ...raw,
      id: raw.id || makeId(),
      itemId: raw.itemId === undefined || raw.itemId === '' ? undefined : String(raw.itemId),
      itemName,
      quantity,
      unitBuyPrice,
      unitCost: unitBuyPrice,
      buyPrice: unitBuyPrice,
      totalBuyPrice,
      totalCost: totalBuyPrice,
      remainingQuantity,
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
      notes: String(raw.notes || ''),
      source: raw.source || 'manual',
      originalLogId: raw.originalLogId ? String(raw.originalLogId) : undefined,
      logTypeId: raw.logTypeId === undefined || raw.logTypeId === '' ? undefined : Number(raw.logTypeId),
      needsNameReview: Boolean(raw.needsNameReview || fallbackName)
    };
  }

  function normalizeSale(raw = {}) {
    const quantity = Math.max(1, Math.floor(num(raw.quantity, 1)));
    const unitSellPrice = num(raw.unitSellPrice ?? raw.sellPrice);
    const totalSellPrice = num(raw.totalSellPrice ?? raw.totalSell, unitSellPrice * quantity);
    const matchedBuyCost = num(raw.matchedBuyCost ?? raw.totalBuy);
    const fees = num(raw.fees);
    const grossProfit = num(raw.grossProfit, totalSellPrice - matchedBuyCost);
    const netProfit = num(raw.netProfit ?? raw.profit, grossProfit - fees);
    const roi = num(raw.roi ?? raw.margin, matchedBuyCost > 0 ? (netProfit / matchedBuyCost) * 100 : 0);
    return {
      ...raw,
      id: raw.id || makeId(),
      itemId: raw.itemId === undefined || raw.itemId === '' ? undefined : String(raw.itemId),
      itemName: String(raw.itemName || 'Unnamed item'),
      quantity,
      unitSellPrice,
      sellPrice: unitSellPrice,
      totalSellPrice,
      totalSell: totalSellPrice,
      matchedBuyCost,
      totalBuy: matchedBuyCost,
      grossProfit,
      fees,
      netProfit,
      profit: netProfit,
      roi,
      margin: roi,
      soldAt: raw.soldAt || raw.createdAt || new Date().toISOString(),
      createdAt: raw.createdAt || raw.soldAt || new Date().toISOString(),
      source: raw.source || 'manual',
      notes: String(raw.notes || ''),
      originalLogId: raw.originalLogId ? String(raw.originalLogId) : undefined,
      logTypeId: raw.logTypeId === undefined || raw.logTypeId === '' ? undefined : Number(raw.logTypeId),
      unmatchedSale: Boolean(raw.unmatchedSale),
      importWarning: String(raw.importWarning || ''),
      unmatchedQuantity: Math.max(0, num(raw.unmatchedQuantity)),
      matchedQuantity: Math.max(0, num(raw.matchedQuantity, quantity - num(raw.unmatchedQuantity))),
      matchedLots: Array.isArray(raw.matchedLots) ? raw.matchedLots : []
    };
  }

  function normalizeReview(raw = {}) {
    const entryId = String(raw.entryId || raw.originalLogId || raw.id || makeId());
    return {
      ...raw,
      id: raw.id || `review-${entryId}`,
      entryId,
      originalLogId: entryId,
      logTypeId: raw.logTypeId === undefined || raw.logTypeId === '' ? undefined : Number(raw.logTypeId),
      timestamp: raw.timestamp || raw.createdAt || new Date().toISOString(),
      type: raw.type === 'sell' ? 'sell' : 'buy',
      itemId: raw.itemId === undefined || raw.itemId === '' ? undefined : String(raw.itemId),
      itemName: String(raw.itemName || ''),
      quantity: raw.quantity === undefined || raw.quantity === '' ? '' : num(raw.quantity),
      unitPrice: raw.unitPrice === undefined || raw.unitPrice === '' ? '' : num(raw.unitPrice),
      totalPrice: raw.totalPrice === undefined || raw.totalPrice === '' ? '' : num(raw.totalPrice),
      fees: raw.fees === undefined || raw.fees === '' ? '' : num(raw.fees),
      pipeParts: Array.isArray(raw.pipeParts) ? raw.pipeParts.map(String).slice(0, 20) : [],
      textPreview: String(raw.textPreview || raw.text || raw.message || '').slice(0, 320),
      rawKeys: Array.isArray(raw.rawKeys) ? raw.rawKeys.map(String).slice(0, 40) : [],
      rawSampleKeys: Array.isArray(raw.rawSampleKeys) ? raw.rawSampleKeys.map(String).slice(0, 40) : [],
      reason: String(raw.reason || 'Parser could not create a valid import candidate.'),
      source: 'api',
      ignored: Boolean(raw.ignored),
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString()
    };
  }

  function defaults() {
    return {
      schemaVersion: 1,
      settings: { activeRoute: 'dashboard', apiEnabled: false, apiKey: '', apiStatus: 'disabled', apiLastError: '', apiLastErrorCode: '', apiDiagnostics: {}, bazaarFeeRate: 0.03, targetRoi: 20, logImportDebug: {}, logImportLastRunAt: '' },
      windowState: { mode: 'compact', top: 96, left: null, right: 24, width: 760, height: 560 },
      purchaseLots: [],
      sales: [],
      itemPriceSnapshots: [],
      importedLogIds: [],
      importReviewQueue: [],
      importHistory: [],
      backups: []
    };
  }

  function normalizeData(raw = {}) {
    const base = defaults();
    const settings = { ...base.settings, ...(raw.settings || {}) };
    settings.apiEnabled = Boolean(settings.apiEnabled && settings.apiKey);
    settings.apiStatus = settings.apiEnabled ? settings.apiStatus || 'ready' : 'disabled';
    return {
      ...base,
      ...raw,
      schemaVersion: 1,
      settings,
      windowState: raw.windowState && typeof raw.windowState === 'object' ? { ...base.windowState, ...raw.windowState } : base.windowState,
      purchaseLots: safeArray(raw.purchaseLots).map(normalizeLot),
      sales: safeArray(raw.sales).map(normalizeSale),
      itemPriceSnapshots: safeArray(raw.itemPriceSnapshots),
      importedLogIds: [...new Set(safeArray(raw.importedLogIds).map(String))],
      importReviewQueue: safeArray(raw.importReviewQueue).map(normalizeReview).slice(0, 100),
      importHistory: safeArray(raw.importHistory).slice(0, 30),
      backups: safeArray(raw.backups)
    };
  }

  function readJson(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (error) { return fallback; } }
  function load() {
    const saved = readJson(STORAGE_KEY, null);
    const raw = saved || { sales: readJson('flipTrackerPro:flips', []), purchaseLots: readJson('flipTrackerPro:openPurchases', []), windowState: readJson('flipTrackerPro:windowState', readJson('flipTrackerPro:windowPosition', {})) };
    const data = normalizeData(raw);
    save(data);
    return data;
  }
  function save(data) { const next = normalizeData(data); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (error) {} return next; }
  function update(updater) { const current = load(); return save(typeof updater === 'function' ? updater(current) : updater || current); }

  function remaining(lot) { return Math.max(0, num(lot.remainingQuantity, lot.quantity)); }
  function saleKeyMatch(lot, sale) { return (sale.itemId && String(lot.itemId || '') === String(sale.itemId)) || String(lot.itemName || '').toLowerCase() === String(sale.itemName || '').toLowerCase(); }
  function matchingLots(lots, sale) { return lots.filter((lot) => remaining(lot) > 0 && saleKeyMatch(lot, sale)).sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))); }
  function matchSale(lots, sale, settings = {}) {
    const quantity = Math.max(1, Math.floor(num(sale.quantity, 1)));
    const totalSellPrice = sale.totalSellPrice !== undefined ? num(sale.totalSellPrice) : num(sale.unitSellPrice ?? sale.sellPrice) * quantity;
    const unitSellPrice = quantity ? totalSellPrice / quantity : num(sale.unitSellPrice ?? sale.sellPrice);
    let left = quantity;
    let matchedBuyCost = 0;
    let matchedQuantity = 0;
    const matchedLots = [];
    matchingLots(lots, sale).forEach((lot) => {
      if (left <= 0) return;
      const qty = Math.min(remaining(lot), left);
      const cost = qty * num(lot.unitBuyPrice ?? lot.buyPrice);
      matchedBuyCost += cost;
      matchedQuantity += qty;
      left -= qty;
      matchedLots.push({ lotId: lot.id, quantity: qty, unitBuyPrice: num(lot.unitBuyPrice ?? lot.buyPrice), totalBuyPrice: cost });
    });
    const unmatchedQuantity = Math.max(0, left);
    if (sale.manualBuyCostOverride) matchedBuyCost += num(sale.buyPrice) * unmatchedQuantity;
    const fees = sale.fees === undefined || sale.fees === '' ? totalSellPrice * num(settings.bazaarFeeRate, 0.03) : num(sale.fees);
    const cannotCost = unmatchedQuantity > 0 && matchedQuantity === 0 && !sale.manualBuyCostOverride;
    const grossProfit = cannotCost ? 0 : totalSellPrice - matchedBuyCost;
    const netProfit = cannotCost ? 0 : grossProfit - fees;
    const roi = matchedBuyCost > 0 ? (netProfit / matchedBuyCost) * 100 : 0;
    return normalizeSale({ ...sale, quantity, unitSellPrice, totalSellPrice, matchedQuantity, unmatchedQuantity, matchedBuyCost, grossProfit, fees, netProfit, roi, matchedLots, unmatchedSale: unmatchedQuantity > 0, soldAt: sale.soldAt || new Date().toISOString() });
  }
  function applySale(lots, saleRecord) { const used = {}; safeArray(saleRecord.matchedLots).forEach((match) => { used[match.lotId] = (used[match.lotId] || 0) + num(match.quantity); }); return lots.map((lot) => used[lot.id] ? { ...lot, remainingQuantity: Math.max(0, remaining(lot) - used[lot.id]), updatedAt: new Date().toISOString() } : lot); }

  function addItemName(map, itemId, itemName) { const idText = itemId === undefined || itemId === null || itemId === '' ? '' : String(itemId); const name = String(itemName || '').trim(); if (idText && name && !/^Item #\d+$/i.test(name)) map.set(idText, name); }
  function scanItems(value, map, depth = 0) {
    if (!value || depth > 5) return;
    if (Array.isArray(value)) { value.slice(0, 5000).forEach((entry) => scanItems(entry, map, depth + 1)); return; }
    if (typeof value !== 'object') return;
    Object.entries(value).slice(0, 5000).forEach(([key, entry]) => {
      if (entry && typeof entry === 'object') {
        addItemName(map, entry.itemId || entry.item_id || entry.id || (/^\d+$/.test(key) ? key : ''), entry.itemName || entry.item_name || entry.name || entry.title);
        scanItems(entry.items || entry.data || entry.children, map, depth + 1);
      } else if (/^\d+$/.test(key) && typeof entry === 'string') addItemName(map, key, entry);
    });
  }
  function createItemLookup(data = load()) {
    const map = new Map();
    safeArray(data.itemPriceSnapshots).forEach((snapshot) => addItemName(map, snapshot.itemId, snapshot.itemName));
    scanItems(data.itemMap, map);
    scanItems(data.items, map);
    scanItems(data.tornItems, map);
    scanItems(data.settings && data.settings.itemMap, map);
    scanItems(data.settings && data.settings.tornItems, map);
    scanItems(data.settings && data.settings.itemPriceSnapshots, map);
    return {
      resolve(itemId, fallbackName = '') {
        const idText = itemId === undefined || itemId === null || itemId === '' ? '' : String(itemId);
        const given = String(fallbackName || '').trim();
        const cached = idText ? map.get(idText) || '' : '';
        const itemName = given || cached || (idText ? `Item #${idText}` : '');
        return { itemId: idText || undefined, itemName, needsNameReview: Boolean(idText && !given && !cached) };
      }
    };
  }

  function calculateQuantity(quantityText, unitPrice, totalPrice) { const explicit = num(quantityText, 0); if (explicit > 0) return Math.max(1, Math.round(explicit)); if (unitPrice > 0 && totalPrice > 0) return Math.max(1, Math.round(totalPrice / unitPrice)); return 1; }
  function normalizePriceFields(candidate, unitField, totalField) { const quantity = calculateQuantity(candidate.quantity, candidate[unitField], candidate[totalField]); const unit = candidate[unitField] > 0 ? candidate[unitField] : candidate[totalField] > 0 ? candidate[totalField] / quantity : 0; const total = candidate[totalField] > 0 ? candidate[totalField] : unit * quantity; return { ...candidate, quantity, [unitField]: unit, [totalField]: total }; }
  function getLogText(log) { return String(log.text || log.message || log.title || '').replace(/\s+/g, ' ').trim(); }
  function getEntryId(log) { return String(log.entryId || log.originalLogId || log.id || `${log.timestamp || log.time || Date.now()}-${getLogText(log).slice(0, 80)}`); }
  function getLogTimestamp(log) { return log.timestamp || log.time || log.created_at || log.createdAt || log.date || ''; }
  function splitPipeLog(text) { const parts = String(text || '').split('|').map((part) => part.trim()).filter(Boolean); return parts.length >= 2 ? parts : null; }
  function isPipeTitle(value) { return /item\s+market\s+(buy|sell|sale)/i.test(String(value || '')) || /market\s+sell/i.test(String(value || '')); }
  function pipeTitleFromLog(log) {
    const candidates = [log && log.title, log && log.text, log && log.message, getLogText(log), log && log.raw && log.raw.title, log && log.raw && log.raw.log, log && log.raw && log.raw.event];
    for (const candidate of candidates) {
      const text = String(candidate || '').trim();
      if (/item\s+market\s+buy/i.test(text)) return 'Item market buy';
      if (/(item\s+market\s+(sell|sale)|market\s+sell)/i.test(text)) return 'Item market sell';
    }
    return '';
  }
  function sortObjectKeys(keys) { return keys.sort((left, right) => { const leftNumber = /^\d+$/.test(left); const rightNumber = /^\d+$/.test(right); if (leftNumber && rightNumber) return Number(left) - Number(right); if (leftNumber) return -1; if (rightNumber) return 1; return left.localeCompare(right); }); }
  function primitivePartsFromArray(array) { return array.filter((entry) => ['string', 'number', 'boolean'].includes(typeof entry)).map((entry) => String(entry).trim()).filter(Boolean); }
  function primitivePartsFromObject(object) { return sortObjectKeys(Object.keys(object || {})).map((key) => object[key]).filter((entry) => ['string', 'number', 'boolean'].includes(typeof entry)).map((entry) => String(entry).trim()).filter(Boolean); }
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
    if (typeof value === 'string') { if (value.includes('|')) { const parts = normalizePipeParts(splitPipeLog(value), titleHint); if (parts) output.push(parts); } return output; }
    if (typeof value === 'number' || typeof value === 'boolean') return output;
    if (Array.isArray(value)) {
      for (const entry of value.slice(0, 50)) {
        if (typeof entry === 'string' && entry.includes('|')) { const parts = normalizePipeParts(splitPipeLog(entry), titleHint); if (parts) { output.push(parts); return output; } }
      }
      const arrayParts = normalizePipeParts(primitivePartsFromArray(value), titleHint);
      if (arrayParts) { output.push(arrayParts); return output; }
      value.slice(0, 50).forEach((entry) => scanPipeParts(entry, titleHint, depth + 1, output));
      return output;
    }
    if (typeof value === 'object') {
      const objectTitle = pipeTitleFromLog(value) || titleHint;
      for (const key of sortObjectKeys(Object.keys(value)).slice(0, 80)) {
        if (/key|token|secret|password/i.test(key)) continue;
        const entry = value[key];
        if (typeof entry === 'string' && entry.includes('|')) { const parts = normalizePipeParts(splitPipeLog(entry), objectTitle); if (parts) { output.push(parts); return output; } }
      }
      const objectParts = normalizePipeParts(primitivePartsFromObject(value), objectTitle);
      if (objectParts) { output.push(objectParts); return output; }
      for (const key of sortObjectKeys(Object.keys(value)).slice(0, 80)) { if (!/key|token|secret|password/i.test(key)) scanPipeParts(value[key], objectTitle, depth + 1, output); if (output.length) return output; }
    }
    return output;
  }
  function extractPipePartsFromLog(log) {
    const titleHint = pipeTitleFromLog(log);
    const directStrings = [getLogText(log), log && log.text, log && log.message, log && log.title, log && log.raw && log.raw.title].filter(Boolean);
    for (const text of directStrings) { const direct = normalizePipeParts(splitPipeLog(text), titleHint); if (direct) return direct; }
    const raw = log && log.raw && typeof log.raw === 'object' ? log.raw : {};
    const roots = [log && log.data, log && log.params, log && log.details, raw.data, raw.params, raw.details, raw, log].filter((root, index, list) => root && typeof root === 'object' && list.indexOf(root) === index);
    for (const root of roots) { const matches = scanPipeParts(root, titleHint, 0, []); if (matches.length) return matches[0]; }
    return null;
  }

  function collectFieldValues(value, output = [], depth = 0) {
    if (!value || depth > 5 || output.length >= 220) return output;
    if (Array.isArray(value)) { value.slice(0, 40).forEach((entry) => collectFieldValues(entry, output, depth + 1)); return output; }
    if (typeof value === 'object') Object.entries(value).slice(0, 90).forEach(([key, entry]) => { if (!/key|token|secret|password/i.test(key)) { output.push({ key, value: entry }); collectFieldValues(entry, output, depth + 1); } });
    return output;
  }
  function getParseRoots(log) { const raw = log && log.raw && typeof log.raw === 'object' ? log.raw : {}; return [log.raw, log.data, log.params, log.details, raw.data, raw.params, raw.details, log].filter((value, index, list) => value && typeof value === 'object' && list.indexOf(value) === index); }
  function findField(log, names) { const wanted = new Set(names.map((name) => name.toLowerCase())); for (const root of getParseRoots(log)) { const fields = collectFieldValues(root, []); for (const field of fields) if (wanted.has(String(field.key).toLowerCase())) return field.value; } return undefined; }
  function extractItemName(value) { if (!value && value !== 0) return ''; if (typeof value === 'string') return value.trim(); if (typeof value === 'object') return String(value.name || value.itemName || value.item_name || value.title || value.label || '').trim(); return ''; }
  function extractActorName(value) { if (!value && value !== 0) return ''; if (typeof value === 'string') return value.trim(); if (typeof value === 'object') return String(value.name || value.username || value.player || value.user || value.title || '').trim(); return ''; }
  function extractItemId(value) { if (!value && value !== 0) return undefined; if (typeof value === 'number' || /^\d+$/.test(String(value))) return String(value); if (typeof value === 'object') return value.id || value.itemId || value.item_id || value.itemid || undefined; return undefined; }

  function parsePipeBuy(log, lookup) {
    const parts = extractPipePartsFromLog(log);
    if (!parts || !/item\s+market\s+buy/i.test(parts[0])) return null;
    const itemId = num(parts[3]);
    const quantity = num(parts[4]);
    const totalBuyPrice = num(parts[5]);
    const unitBuyPrice = num(parts[6]);
    if (!itemId && !quantity && !totalBuyPrice && !unitBuyPrice) return null;
    const resolved = lookup.resolve(itemId ? String(itemId) : '');
    return normalizePriceFields({ parserKind: 'pipe', pipeParts: parts, itemId: resolved.itemId, itemName: resolved.itemName, needsNameReview: resolved.needsNameReview, quantity, unitBuyPrice, totalBuyPrice }, 'unitBuyPrice', 'totalBuyPrice');
  }
  function parsePipeSell(log, lookup) {
    const parts = extractPipePartsFromLog(log);
    if (!parts || !/(item\s+market\s+(sell|sale)|market\s+sell)/i.test(parts[0])) return null;
    const itemId = num(parts[3]);
    const quantity = num(parts[4]);
    const totalSellPrice = num(parts[5]);
    const unitSellPrice = num(parts[6]);
    const possibleFee = num(parts[7]);
    if (!itemId && !quantity && !totalSellPrice && !unitSellPrice) return null;
    const resolved = lookup.resolve(itemId ? String(itemId) : '');
    return normalizePriceFields({ parserKind: 'pipe', pipeParts: parts, itemId: resolved.itemId, itemName: resolved.itemName, needsNameReview: resolved.needsNameReview, quantity, unitSellPrice, totalSellPrice, fees: possibleFee > 1 && possibleFee < totalSellPrice ? possibleFee : undefined }, 'unitSellPrice', 'totalSellPrice');
  }
  function parseBuyText(text) {
    const match = String(text || '').match(/(?:^|\b)(?:\d{1,2}:\d{2}:\d{2}\s+-\s+\d{2}\/\d{2}\/\d{2}\s+)?you bought\s+(?:(\d{1,8})\s*x\s+)?(?:an?\s+)?(.+?)\s+on the item market\s+from\s+([A-Za-z0-9_ -]+?)\s+at\s+\$?([0-9][0-9,]*)\s+each\s+for\s+a\s+total\s+of\s+\$?([0-9][0-9,]*)/i);
    if (!match) return null;
    const unitBuyPrice = num(match[4]);
    const totalBuyPrice = num(match[5]);
    return normalizePriceFields({ parserKind: 'text', itemName: match[2].trim(), quantity: calculateQuantity(match[1], unitBuyPrice, totalBuyPrice), sourceMarket: 'item market', sellerName: match[3].trim(), unitBuyPrice, totalBuyPrice }, 'unitBuyPrice', 'totalBuyPrice');
  }
  function parseSellText(text) {
    const match = String(text || '').match(/(?:^|\b)(?:\d{1,2}:\d{2}:\d{2}\s+-\s+\d{2}\/\d{2}\/\d{2}\s+)?you sold\s+(?:(\d{1,8})\s*x\s+)?(?:an?\s+)?(.+?)\s+on the item market\s+to\s+([A-Za-z0-9_ -]+?)\s+at\s+\$?([0-9][0-9,]*)\s+each\s+for\s+a\s+total\s+of\s+\$?([0-9][0-9,]*)(?:\s+after\s+\$?([0-9][0-9,]*)\s+in\s+fees?)?/i);
    if (!match) return null;
    const unitSellPrice = num(match[4]);
    const totalSellPrice = num(match[5]);
    return normalizePriceFields({ parserKind: 'text', itemName: match[2].trim(), quantity: calculateQuantity(match[1], unitSellPrice, totalSellPrice), sourceMarket: 'item market', buyerName: match[3].trim(), unitSellPrice, totalSellPrice, fees: match[6] ? num(match[6]) : undefined }, 'unitSellPrice', 'totalSellPrice');
  }
  function parseStructuredBuy(log, lookup) {
    const itemValue = findField(log, ['itemName', 'item_name', 'item', 'itemId', 'item_id', 'itemid']);
    const itemName = extractItemName(findField(log, ['itemName', 'item_name', 'item'])) || extractItemName(itemValue);
    const itemId = extractItemId(findField(log, ['itemId', 'item_id', 'itemid'])) || extractItemId(itemValue);
    const resolved = lookup.resolve(itemId, itemName);
    const quantity = num(findField(log, ['quantity', 'qty', 'amount', 'count']), 0);
    const unitBuyPrice = num(findField(log, ['price', 'unitPrice', 'unit_price', 'cost', 'unitCost', 'unit_cost', 'unitBuyPrice', 'unit_buy_price']), 0);
    const totalBuyPrice = num(findField(log, ['total', 'totalCost', 'total_cost', 'totalPrice', 'total_price', 'value', 'money', 'totalBuyPrice', 'total_buy_price']), 0);
    if ((!resolved.itemName && !resolved.itemId) || (!unitBuyPrice && !totalBuyPrice)) return null;
    return normalizePriceFields({ parserKind: 'structured', itemId: resolved.itemId, itemName: resolved.itemName, needsNameReview: resolved.needsNameReview, quantity, sellerName: extractActorName(findField(log, ['seller', 'from', 'user', 'player'])), unitBuyPrice, totalBuyPrice }, 'unitBuyPrice', 'totalBuyPrice');
  }
  function parseStructuredSell(log, lookup) {
    const itemValue = findField(log, ['itemName', 'item_name', 'item', 'itemId', 'item_id', 'itemid']);
    const itemName = extractItemName(findField(log, ['itemName', 'item_name', 'item'])) || extractItemName(itemValue);
    const itemId = extractItemId(findField(log, ['itemId', 'item_id', 'itemid'])) || extractItemId(itemValue);
    const resolved = lookup.resolve(itemId, itemName);
    const quantity = num(findField(log, ['quantity', 'qty', 'amount', 'count']), 0);
    const unitSellPrice = num(findField(log, ['price', 'unitPrice', 'unit_price', 'sellPrice', 'sell_price', 'unitSellPrice', 'unit_sell_price']), 0);
    const totalSellPrice = num(findField(log, ['total', 'totalRevenue', 'total_revenue', 'revenue', 'value', 'money', 'totalSellPrice', 'total_sell_price']), 0);
    const fees = num(findField(log, ['fee', 'fees', 'marketFee', 'market_fee']), 0);
    if ((!resolved.itemName && !resolved.itemId) || (!unitSellPrice && !totalSellPrice)) return null;
    return normalizePriceFields({ parserKind: 'structured', itemId: resolved.itemId, itemName: resolved.itemName, needsNameReview: resolved.needsNameReview, quantity, buyerName: extractActorName(findField(log, ['buyer', 'to', 'user', 'player'])), unitSellPrice, totalSellPrice, fees: fees || undefined }, 'unitSellPrice', 'totalSellPrice');
  }
  function buildPartialFromPipe(log, type, lookup) {
    const parts = extractPipePartsFromLog(log);
    if (!parts) return {};
    const itemId = num(parts[3]);
    const resolved = lookup.resolve(itemId ? String(itemId) : '');
    const partial = { itemId: resolved.itemId, itemName: resolved.itemName, needsNameReview: resolved.needsNameReview, quantity: num(parts[4]), pipeParts: parts };
    if (type === 'sell') { partial.unitSellPrice = num(parts[6]); partial.totalSellPrice = num(parts[5]); partial.fees = num(parts[7]) || ''; }
    else { partial.unitBuyPrice = num(parts[6]); partial.totalBuyPrice = num(parts[5]); }
    return partial;
  }
  function validateBuy(candidate) { if (!candidate) return 'Parser did not return a buy candidate.'; if (!candidate.originalLogId) return 'Missing entryId/originalLogId.'; if ((!candidate.itemId && !candidate.itemName) || candidate.itemName === 'Unknown item') return 'Missing itemId or item name.'; if (!candidate.quantity || candidate.quantity <= 0) return 'Missing quantity.'; if (!candidate.unitBuyPrice && !candidate.totalBuyPrice) return 'Missing buy price.'; return ''; }
  function validateSell(candidate) { if (!candidate) return 'Parser did not return a sell candidate.'; if (!candidate.originalLogId) return 'Missing entryId/originalLogId.'; if ((!candidate.itemId && !candidate.itemName) || candidate.itemName === 'Unknown item') return 'Missing itemId or item name.'; if (!candidate.quantity || candidate.quantity <= 0) return 'Missing quantity.'; if (!candidate.unitSellPrice && !candidate.totalSellPrice) return 'Missing sell price.'; return ''; }
  function normalizeBuyLog(log, lookup) {
    const parsed = parsePipeBuy(log, lookup) || parseStructuredBuy(log, lookup) || parseBuyText(getLogText(log));
    if (!parsed) return { candidate: null, reason: 'No pipe, structured, or text buy parser matched.', parserKind: '', partial: buildPartialFromPipe(log, 'buy', lookup) };
    const resolved = parsed.itemId && !parsed.needsNameReview ? lookup.resolve(parsed.itemId, parsed.itemName) : { itemId: parsed.itemId, itemName: parsed.itemName, needsNameReview: parsed.needsNameReview };
    const priced = normalizePriceFields({ ...parsed, ...resolved }, 'unitBuyPrice', 'totalBuyPrice');
    const candidate = { itemId: priced.itemId || undefined, itemName: priced.itemName || (priced.itemId ? `Item #${priced.itemId}` : 'Unknown item'), quantity: priced.quantity, unitBuyPrice: priced.unitBuyPrice, totalBuyPrice: priced.totalBuyPrice, remainingQuantity: priced.quantity, createdAt: toIso(getLogTimestamp(log)), source: 'api', sourceMarket: priced.sourceMarket || 'item market', originalLogId: getEntryId(log), logTypeId: Number(log.logTypeId) || undefined, notes: priced.sellerName ? `Seller: ${priced.sellerName}` : 'Imported from Torn log', needsNameReview: Boolean(priced.needsNameReview) };
    const reason = validateBuy(candidate);
    return reason ? { candidate: null, reason, parserKind: parsed.parserKind || 'unknown', partial: candidate } : { candidate, reason: '', parserKind: parsed.parserKind || 'unknown' };
  }
  function normalizeSellLog(log, lookup) {
    const parsed = parsePipeSell(log, lookup) || parseStructuredSell(log, lookup) || parseSellText(getLogText(log));
    if (!parsed) return { candidate: null, reason: 'No pipe, structured, or text sell parser matched.', parserKind: '', partial: buildPartialFromPipe(log, 'sell', lookup) };
    const resolved = parsed.itemId && !parsed.needsNameReview ? lookup.resolve(parsed.itemId, parsed.itemName) : { itemId: parsed.itemId, itemName: parsed.itemName, needsNameReview: parsed.needsNameReview };
    const priced = normalizePriceFields({ ...parsed, ...resolved }, 'unitSellPrice', 'totalSellPrice');
    const candidate = { itemId: priced.itemId || undefined, itemName: priced.itemName || (priced.itemId ? `Item #${priced.itemId}` : 'Unknown item'), quantity: priced.quantity, unitSellPrice: priced.unitSellPrice, totalSellPrice: priced.totalSellPrice, fees: priced.fees, soldAt: toIso(getLogTimestamp(log)), source: 'api', sourceMarket: priced.sourceMarket || 'item market', originalLogId: getEntryId(log), logTypeId: Number(log.logTypeId) || undefined, notes: priced.buyerName ? `Buyer: ${priced.buyerName}` : 'Imported from Torn log', needsNameReview: Boolean(priced.needsNameReview) };
    const reason = validateSell(candidate);
    return reason ? { candidate: null, reason, parserKind: parsed.parserKind || 'unknown', partial: candidate } : { candidate, reason: '', parserKind: parsed.parserKind || 'unknown' };
  }

  function compactValues(value, output = [], depth = 0) {
    if (value === null || value === undefined || depth > 5 || output.length > 60) return output;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') { const text = String(value).replace(/\s+/g, ' ').trim(); if (text && text.length <= 300) output.push(text); return output; }
    if (Array.isArray(value)) value.slice(0, 40).forEach((entry) => compactValues(entry, output, depth + 1));
    else if (typeof value === 'object') Object.entries(value).slice(0, 80).forEach(([key, entry]) => { if (!/key|token|secret|password/i.test(key)) compactValues(entry, output, depth + 1); });
    return output;
  }
  function rawLogText(raw) { const direct = [raw.text, raw.message, raw.title, raw.log, raw.event, raw.description].find((value) => typeof value === 'string' && value.trim()); return direct ? String(direct).replace(/\s+/g, ' ').trim() : compactValues(raw.raw || raw).join(' | ').replace(/\s+/g, ' ').trim(); }
  function findLogType(raw, objectKey) { const values = [raw.logTypeId, raw.log_type_id, raw.typeId, raw.type_id, raw.log_id, raw.logId, raw.categoryId, raw.category_id, raw.type, raw.log, raw.category, raw.eventType]; for (const value of values) { const parsed = Number(value); if (Number.isFinite(parsed) && parsed > 0) return parsed; } const keyNumber = Number(objectKey); return KNOWN_LOG_IDS.includes(keyNumber) ? keyNumber : undefined; }
  function looksLikeLog(value) { return typeof value === 'string' || Boolean(value && typeof value === 'object' && (value.timestamp !== undefined || value.time !== undefined || value.date !== undefined || value.created_at !== undefined || value.title !== undefined || value.message !== undefined || value.text !== undefined || value.log !== undefined || value.event !== undefined || value.data !== undefined || value.params !== undefined || value.details !== undefined)); }
  function logContainer(payload) { if (!payload || typeof payload !== 'object') return null; if (payload.log || payload.logs) return payload.log || payload.logs; if (payload.user && (payload.user.log || payload.user.logs)) return payload.user.log || payload.user.logs; return null; }
  function normalizeApiLog(rawLog, objectKey) {
    const raw = rawLog && typeof rawLog === 'object' ? rawLog : { message: String(rawLog || '') };
    const entryId = String(raw.entryId || raw.entry_id || raw.id || raw.ID || raw.logEntryId || raw.log_entry_id || objectKey || `${raw.timestamp || raw.time || raw.date || Date.now()}-${Math.random().toString(16).slice(2)}`);
    const text = rawLogText(raw);
    const rawKeys = Object.keys(raw).slice(0, 40);
    return { entryId, id: entryId, originalLogId: entryId, logTypeId: findLogType(raw, objectKey), timestamp: raw.timestamp || raw.time || raw.created_at || raw.createdAt || raw.date || '', title: String(raw.title || ''), message: text, text, data: raw.data && typeof raw.data === 'object' ? raw.data : {}, params: raw.params && typeof raw.params === 'object' ? raw.params : {}, details: raw.details && typeof raw.details === 'object' ? raw.details : raw.details || undefined, raw, rawKeys, rawSampleKeys: rawKeys };
  }
  function collectLogs(value, output = [], keyName = '') { if (!value) return output; if (Array.isArray(value)) { value.forEach((entry, index) => collectLogs(entry, output, index)); return output; } if (looksLikeLog(value)) { output.push(normalizeApiLog(value, keyName)); return output; } if (typeof value === 'object') Object.entries(value).forEach(([key, entry]) => collectLogs(entry, output, key)); return output; }
  function normalizeLogs(payload) { const start = nowMs(); const logs = collectLogs(logContainer(payload) || payload); return { logs, normalizeMs: elapsed(start) }; }
  function rawLogCount(payload) { const container = logContainer(payload); if (Array.isArray(container)) return container.length; if (container && typeof container === 'object') return Object.keys(container).length; return 0; }
  function isPipeBuyLog(log) { const parts = extractPipePartsFromLog(log); return Boolean(parts && /item\s+market\s+buy/i.test(parts[0])); }
  function isPipeSellLog(log) { const parts = extractPipePartsFromLog(log); return Boolean(parts && /(item\s+market\s+(sell|sale)|market\s+sell)/i.test(parts[0])); }
  function classifyLog(log, counters) { const typeId = Number(log.logTypeId); if (BUY_LOG_IDS.includes(typeId)) { counters.buyIdMatches += 1; return 'buy'; } if (SELL_LOG_IDS.includes(typeId)) { counters.sellIdMatches += 1; return 'sell'; } if (isPipeBuyLog(log)) return 'buy'; if (isPipeSellLog(log)) return 'sell'; const text = getLogText(log); if (parseBuyText(text)) { counters.textBuyMatches += 1; return 'buy'; } if (parseSellText(text)) { counters.textSellMatches += 1; return 'sell'; } return ''; }
  function summarizeRecognizedLogs(logs) { return safeArray(logs).filter((log) => BUY_LOG_IDS.includes(Number(log.logTypeId)) || SELL_LOG_IDS.includes(Number(log.logTypeId)) || isPipeBuyLog(log) || isPipeSellLog(log) || parseBuyText(getLogText(log)) || parseSellText(getLogText(log))).slice(0, 5).map((log) => ({ entryId: getEntryId(log), logTypeId: Number(log.logTypeId) || '', title: String(log.title || log.raw && log.raw.title || ''), timestamp: getLogTimestamp(log) || '', textPreview: getLogText(log).slice(0, 240), pipeParts: extractPipePartsFromLog(log) || [], rawKeys: Array.isArray(log.rawKeys) ? log.rawKeys.slice(0, 40) : [] })); }

  const parserTests = Object.freeze([
    { name: 'readable-buy-cpu', type: 'buy', logTypeId: 1112, text: '18:18:23 - 09/07/26 You bought 11x CPU on the item market from someone at $325 each for a total of $3,575', expected: { quantity: 11, itemName: 'CPU', sellerName: 'someone', unitBuyPrice: 325, totalBuyPrice: 3575 } },
    { name: 'pipe-buy-cpu', type: 'buy', logTypeId: 1112, text: 'Item market buy | 4378669 | 0 | 1301 | 5 | 1450 | 290 | 1 | green', expected: { itemId: '1301', quantity: 5, unitBuyPrice: 290, totalBuyPrice: 1450 } },
    { name: 'readable-sell-dahlia', type: 'sell', logTypeId: 1226, text: '20:37:53 - 24/07/25 You sold 54x Dahlia on the item market to Javster at $1,900 each for a total of $97,470 after $5,130 in fees', expected: { quantity: 54, itemName: 'Dahlia', buyerName: 'Javster', unitSellPrice: 1900, totalSellPrice: 97470, fees: 5130 } }
  ]);
  function pickSelfTestCandidate(result, type) { const parsed = result && (result.candidate || result.partial) || {}; return type === 'sell' ? { itemId: parsed.itemId || '', itemName: parsed.itemName || '', quantity: parsed.quantity || 0, buyerName: parsed.buyerName || '', unitSellPrice: parsed.unitSellPrice || 0, totalSellPrice: parsed.totalSellPrice || 0, fees: parsed.fees || 0 } : { itemId: parsed.itemId || '', itemName: parsed.itemName || '', quantity: parsed.quantity || 0, sellerName: parsed.sellerName || '', unitBuyPrice: parsed.unitBuyPrice || 0, totalBuyPrice: parsed.totalBuyPrice || 0 }; }
  function runParserSelfTest() {
    const lookup = createItemLookup({ itemPriceSnapshots: [{ itemId: '1301', itemName: 'CPU', marketPrice: 0, timestamp: new Date().toISOString(), source: 'api' }] });
    return parserTests.map((test) => {
      const log = { entryId: `sample-${test.name}`, id: `sample-${test.name}`, logTypeId: test.logTypeId, text: test.text, message: test.text, title: test.text.split('|')[0].trim(), timestamp: Date.now() / 1000, raw: { title: test.text.split('|')[0].trim(), details: test.text.includes('|') ? test.text.split('|').slice(1).map((part) => part.trim()) : [] }, rawKeys: ['title', 'details'] };
      const parsed = test.type === 'sell' ? normalizeSellLog(log, lookup) : normalizeBuyLog(log, lookup);
      const actual = pickSelfTestCandidate(parsed, test.type);
      const passed = Boolean(parsed.candidate && Object.entries(test.expected).every(([key, value]) => String(actual[key]) === String(value)));
      return { name: test.name, type: test.type, passed, expected: test.expected, actual, reason: parsed.reason || '' };
    });
  }

  function getApiState() { const settings = load().settings; const hasKey = Boolean(settings.apiKey); const masked = hasKey ? `${settings.apiKey.slice(0, 4)}${'*'.repeat(Math.max(4, settings.apiKey.length - 8))}${settings.apiKey.slice(-4)}` : ''; return { enabled: Boolean(settings.apiEnabled && hasKey), hasKey, connected: Boolean(settings.apiEnabled && hasKey && settings.apiStatus !== 'error'), maskedKey: masked, status: settings.apiStatus || 'disabled', lastError: settings.apiLastError || '', lastErrorCode: settings.apiLastErrorCode || '', diagnostics: settings.apiDiagnostics || {} }; }
  function saveApiKey(value) { const keyText = String(value || '').trim(); update((data) => ({ ...data, settings: { ...data.settings, apiKey: keyText, apiEnabled: Boolean(keyText), apiStatus: keyText ? 'saved' : 'missing-key', apiLastError: keyText ? '' : 'Enter an API key before enabling Torn API.' } })); return keyText ? { ok: true, message: 'API key saved locally.' } : { ok: false, message: 'Enter an API key before enabling Torn API.' }; }
  function clearApiKey() { update((data) => ({ ...data, settings: { ...data.settings, apiKey: '', apiEnabled: false, apiStatus: 'disabled', apiLastError: '', apiLastErrorCode: '', apiDiagnostics: {} } })); return { ok: true, message: 'API key cleared.' }; }
  function setApiEnabled(enabled) { const data = load(); if (enabled && !data.settings.apiKey) return { ok: false, message: 'Save an API key first.' }; update((current) => ({ ...current, settings: { ...current.settings, apiEnabled: Boolean(enabled && current.settings.apiKey), apiStatus: enabled ? 'enabled' : 'disabled' } })); return { ok: true, message: enabled ? 'Torn API enabled.' : 'Torn API disabled.' }; }
  async function waitForApi() { const waitMs = Math.max(0, 750 - (Date.now() - lastApiRequestAt)); if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs)); lastApiRequestAt = Date.now(); }
  function gmGet(url) { return new Promise((resolve, reject) => { if (typeof GM_xmlhttpRequest === 'function') { GM_xmlhttpRequest({ method: 'GET', url, onload: (response) => resolve({ status: response.status, text: response.responseText }), onerror: () => reject(new Error('Network request failed.')), ontimeout: () => reject(new Error('Network request timed out.')) }); return; } fetch(url).then((response) => response.text().then((text) => resolve({ status: response.status, text }))).catch(reject); }); }
  async function apiRequest(section, selections, params = {}) {
    const data = load();
    const settings = data.settings;
    if (!settings.apiKey || !settings.apiEnabled) return { ok: false, error: 'API is disabled or no key is saved.', code: '', data: null, request: { endpoint: `/${section}/`, selections, params: {} }, timing: { fetchMs: 0 } };
    await waitForApi();
    const start = nowMs();
    const query = new URLSearchParams({ selections, key: settings.apiKey });
    Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') query.set(key, value); });
    query.set('_', String(Date.now()));
    const endpoint = `https://api.torn.com/${section}/?${query.toString()}`;
    const safeParams = { ...params };
    try {
      const response = await gmGet(endpoint);
      const payload = JSON.parse(response.text || '{}');
      if (payload.error) {
        const code = payload.error.code || '';
        const message = payload.error.error || payload.error.message || 'Torn API error.';
        update((current) => ({ ...current, settings: { ...current.settings, apiLastError: message, apiLastErrorCode: String(code), apiStatus: code === 2 || code === 16 ? 'error' : current.settings.apiStatus } }));
        return { ok: false, error: message, code, data: payload, request: { endpoint: `/${section}/`, selections, params: safeParams }, timing: { fetchMs: elapsed(start) } };
      }
      update((current) => ({ ...current, settings: { ...current.settings, apiLastError: '', apiLastErrorCode: '', apiStatus: 'ready' } }));
      return { ok: true, data: payload, request: { endpoint: `/${section}/`, selections, params: safeParams }, timing: { fetchMs: elapsed(start) } };
    } catch (error) {
      update((current) => ({ ...current, settings: { ...current.settings, apiLastError: error.message || 'Could not reach Torn API.', apiLastErrorCode: 'network', apiStatus: 'error' } }));
      return { ok: false, error: error.message || 'Could not reach Torn API.', code: 'network', data: null, request: { endpoint: `/${section}/`, selections, params: safeParams }, timing: { fetchMs: elapsed(start) } };
    }
  }
  async function fetchKeyInfo() { const result = await apiRequest('key', 'info', {}); update((data) => ({ ...data, settings: { ...data.settings, apiDiagnostics: { ...(data.settings.apiDiagnostics || {}), keyInfoWorks: Boolean(result.ok), keyDiagnosticsStatus: result.ok ? 'Checked' : 'Failed', lastErrorCode: result.code || '', lastError: result.error || '', accessLevel: result.data && (result.data.access_level || result.data.accessLevel || result.data.type) || 'Unknown' } } })); return result; }
  async function fetchUserLogs(options = {}) {
    const params = {};
    if (options.from) params.from = options.from;
    if (options.to) params.to = options.to;
    const start = nowMs();
    const result = await apiRequest('user', 'log', params);
    if (!result.ok) return { ...result, debug: { appVersion: VERSION, strategyUsed: result.code === 16 ? 'failed-permission' : 'failed-other', lastEndpoint: result.request.endpoint, lastSelections: result.request.selections, lastParams: result.request.params, rawLogsReturned: 0, normalizedLogs: 0, lastErrorCode: result.code || '', lastError: result.error || '', timings: result.timing || {} } };
    const normalized = normalizeLogs(result.data);
    const counters = { buyIdMatches: 0, sellIdMatches: 0, textBuyMatches: 0, textSellMatches: 0 };
    normalized.logs.forEach((log) => classifyLog(log, counters));
    const debug = { appVersion: VERSION, buyLogIds: BUY_LOG_IDS, sellLogIds: SELL_LOG_IDS, strategyUsed: 'unfiltered', rangeUsed: options.rangeUsed || '', lastEndpoint: result.request.endpoint, lastSelections: result.request.selections, lastParams: result.request.params, rawLogsReturned: rawLogCount(result.data), normalizedLogs: normalized.logs.length, buyIdMatches: counters.buyIdMatches, sellIdMatches: counters.sellIdMatches, textBuyMatches: counters.textBuyMatches, textSellMatches: counters.textSellMatches, firstRecognizedLogs: summarizeRecognizedLogs(normalized.logs), sampleRawKeys: normalized.logs[0] ? normalized.logs[0].rawKeys : [], timings: { fetchMs: result.timing.fetchMs || 0, normalizeMs: normalized.normalizeMs, totalFetchMs: elapsed(start) }, updatedAt: new Date().toISOString() };
    return { ok: true, data: normalized.logs, debug, request: result.request };
  }
  async function testRawUserLogs() { return fetchUserLogs({ bypassCache: true, rangeUsed: 'raw-test' }); }

  function createSummary(from, to) { return { ok: true, from: from || '', to: to || '', rangeUsed: '', progress: { processed: 0, total: 0, purchasesFound: 0, salesFound: 0, duplicatesSkipped: 0 }, purchasesImported: 0, salesImported: 0, purchasesSaved: 0, salesSaved: 0, duplicatesSkipped: 0, ignoredItems: 0, unmatchedSales: 0, rawLogsReturned: 0, normalizedLogs: 0, logsReturned: 0, classifiedPurchases: 0, classifiedSales: 0, buyCandidatesCreated: 0, sellCandidatesCreated: 0, buyIdMatches: 0, sellIdMatches: 0, pipeBuyLogsFound: 0, pipeSellLogsFound: 0, pipeBuyMatches: 0, pipeSellMatches: 0, textBuyMatches: 0, textSellMatches: 0, structuredBuyMatches: 0, structuredSellMatches: 0, pipeBuyCandidatesCreated: 0, pipeSellCandidatesCreated: 0, textBuyCandidatesCreated: 0, textSellCandidatesCreated: 0, structuredBuyCandidatesCreated: 0, structuredSellCandidatesCreated: 0, parserFailures: 0, validationFailures: 0, parserFailureReasons: [], reviewCandidatesCreated: 0, activeReviewItems: 0, firstRecognizedLogs: [], parserSelfTest: runParserSelfTest(), warnings: [], errors: [], diagnosticMessage: '', debug: {} }; }
  function addFailure(summary, reason) { const value = String(reason || '').trim(); if (!value) return; if (!summary.parserFailureReasons.includes(value)) summary.parserFailureReasons.push(value); summary.parserFailureReasons = summary.parserFailureReasons.slice(0, 10); if (/parser|matched/i.test(value)) summary.parserFailures += 1; else summary.validationFailures += 1; }
  function noteParserKind(summary, type, kind) { if (type === 'buy' && kind === 'pipe') summary.pipeBuyMatches += 1; if (type === 'sell' && kind === 'pipe') summary.pipeSellMatches += 1; if (type === 'buy' && kind === 'structured') summary.structuredBuyMatches += 1; if (type === 'sell' && kind === 'structured') summary.structuredSellMatches += 1; if (type === 'buy' && kind === 'text') summary.textBuyMatches += 1; if (type === 'sell' && kind === 'text') summary.textSellMatches += 1; }
  function noteCandidateKind(summary, type, kind) { if (type === 'buy' && kind === 'pipe') summary.pipeBuyCandidatesCreated += 1; if (type === 'buy' && kind === 'structured') summary.structuredBuyCandidatesCreated += 1; if (type === 'buy' && kind === 'text') summary.textBuyCandidatesCreated += 1; if (type === 'sell' && kind === 'pipe') summary.pipeSellCandidatesCreated += 1; if (type === 'sell' && kind === 'structured') summary.structuredSellCandidatesCreated += 1; if (type === 'sell' && kind === 'text') summary.textSellCandidatesCreated += 1; }
  function reviewFromLog(log, type, reason, partial = {}) { const isSell = type === 'sell'; const pipeParts = partial.pipeParts || extractPipePartsFromLog(log) || []; return normalizeReview({ entryId: getEntryId(log), logTypeId: Number(log.logTypeId) || undefined, timestamp: toIso(getLogTimestamp(log)), type: isSell ? 'sell' : 'buy', itemId: partial.itemId, itemName: partial.itemName || '', quantity: partial.quantity || '', unitPrice: isSell ? partial.unitSellPrice || '' : partial.unitBuyPrice || '', totalPrice: isSell ? partial.totalSellPrice || '' : partial.totalBuyPrice || '', fees: partial.fees || '', pipeParts, textPreview: (getLogText(log) || pipeParts.join(' | ')).slice(0, 320), rawKeys: log.rawKeys || [], rawSampleKeys: log.rawSampleKeys || [], reason, source: 'api' }); }
  function removeReview(queue, entryId) { const key = String(entryId || ''); return queue.filter((item) => String(item.entryId || item.originalLogId || item.id) !== key); }
  function upsertReview(queue, item) { const normalized = normalizeReview(item); const key = String(normalized.entryId); let replaced = false; const next = queue.map((current) => { const currentId = String(current.entryId || current.originalLogId || current.id); if (currentId !== key) return current; replaced = true; return { ...current, ...normalized, id: current.id || normalized.id, createdAt: current.createdAt || normalized.createdAt, updatedAt: new Date().toISOString(), ignored: false }; }); return (replaced ? next : [normalized, ...next]).slice(0, 100); }
  function saveSaleCandidate(data, lots, sales, candidate) { const sale = matchSale(lots, candidate, data.settings); const warning = sale.unmatchedQuantity > 0 ? `${sale.itemName}: ${sale.unmatchedQuantity} sold item(s) could not be matched to open purchases.` : ''; const record = normalizeSale({ ...sale, originalLogId: candidate.originalLogId, logTypeId: candidate.logTypeId, unmatchedSale: sale.unmatchedQuantity > 0, importWarning: warning, notes: warning || sale.notes || candidate.notes || 'Imported from Torn log' }); return { lots: applySale(lots, record), sales: [record, ...sales], warning, unmatched: Boolean(warning) }; }
  function buildDebug(result, summary, timings) { const serviceDebug = result && result.debug ? result.debug : {}; return { appVersion: VERSION, buyLogIds: BUY_LOG_IDS, sellLogIds: SELL_LOG_IDS, strategyUsed: serviceDebug.strategyUsed || 'unfiltered', rangeUsed: summary.rangeUsed || serviceDebug.rangeUsed || '', lastEndpoint: serviceDebug.lastEndpoint || '', lastSelections: serviceDebug.lastSelections || '', lastParams: serviceDebug.lastParams || {}, rawLogsReturned: summary.rawLogsReturned || serviceDebug.rawLogsReturned || 0, normalizedLogs: summary.normalizedLogs || serviceDebug.normalizedLogs || 0, buyIdMatches: summary.buyIdMatches || serviceDebug.buyIdMatches || 0, sellIdMatches: summary.sellIdMatches || serviceDebug.sellIdMatches || 0, pipeBuyLogsFound: summary.pipeBuyLogsFound || 0, pipeSellLogsFound: summary.pipeSellLogsFound || 0, pipeBuyMatches: summary.pipeBuyMatches || 0, pipeSellMatches: summary.pipeSellMatches || 0, textBuyMatches: summary.textBuyMatches || serviceDebug.textBuyMatches || 0, textSellMatches: summary.textSellMatches || serviceDebug.textSellMatches || 0, structuredBuyMatches: summary.structuredBuyMatches || 0, structuredSellMatches: summary.structuredSellMatches || 0, classifiedPurchases: summary.classifiedPurchases || 0, classifiedSales: summary.classifiedSales || 0, buyCandidatesCreated: summary.buyCandidatesCreated || 0, sellCandidatesCreated: summary.sellCandidatesCreated || 0, pipeBuyCandidatesCreated: summary.pipeBuyCandidatesCreated || 0, pipeSellCandidatesCreated: summary.pipeSellCandidatesCreated || 0, textBuyCandidatesCreated: summary.textBuyCandidatesCreated || 0, textSellCandidatesCreated: summary.textSellCandidatesCreated || 0, structuredBuyCandidatesCreated: summary.structuredBuyCandidatesCreated || 0, structuredSellCandidatesCreated: summary.structuredSellCandidatesCreated || 0, purchasesImported: summary.purchasesImported || 0, salesImported: summary.salesImported || 0, purchasesSaved: summary.purchasesSaved || 0, salesSaved: summary.salesSaved || 0, duplicatesSkipped: summary.duplicatesSkipped || 0, ignoredItems: summary.ignoredItems || 0, unmatchedSales: summary.unmatchedSales || 0, reviewCandidatesCreated: summary.reviewCandidatesCreated || 0, activeReviewItems: summary.activeReviewItems || 0, parserFailures: summary.parserFailures || 0, validationFailures: summary.validationFailures || 0, parserFailureReasons: summary.parserFailureReasons || [], parserSelfTest: summary.parserSelfTest || [], firstLogs: safeArray(serviceDebug.firstLogs).slice(0, 5), firstRecognizedLogs: (summary.firstRecognizedLogs && summary.firstRecognizedLogs.length ? summary.firstRecognizedLogs : serviceDebug.firstRecognizedLogs || []).slice(0, 5), sampleRawKeys: serviceDebug.sampleRawKeys || [], lastErrorCode: result && result.code ? result.code : serviceDebug.lastErrorCode || '', lastError: result && result.error ? result.error : serviceDebug.lastError || '', diagnosticMessage: summary.diagnosticMessage || serviceDebug.diagnosticMessage || '', timings: { ...(serviceDebug.timings || {}), ...(timings || {}) }, updatedAt: new Date().toISOString() }; }
  function applyDiagnostic(summary, result) { if (!summary.ok && String(summary.errors.join(' ')).toLowerCase().includes('access')) summary.diagnosticMessage = 'API key lacks user -> log access. Use a Torn Full Access API key.'; else if (summary.rawLogsReturned === 0) summary.diagnosticMessage = summary.rangeUsed === 'fallback-7-days' ? 'API returned 0 raw logs for the last 7 days.' : 'Date range returned no raw logs.'; else if (summary.buyIdMatches > 0 && summary.purchasesSaved === 0) summary.diagnosticMessage = `Buy logs were detected but could not be converted into purchases because: ${summary.parserFailureReasons.length ? summary.parserFailureReasons.join(' | ') : 'the parser did not find item, quantity, and price fields in the normalized/raw log data.'}`; else if (summary.classifiedPurchases === 0 && summary.classifiedSales === 0) summary.diagnosticMessage = 'API returned logs, but parser/classifier did not match any buy or sell logs.'; else if (summary.purchasesImported === 0 && summary.salesImported === 0 && summary.reviewCandidatesCreated > 0) summary.diagnosticMessage = `Recognized ${summary.reviewCandidatesCreated} buy/sell log(s), but they need review because parsing or validation failed.`; else if (summary.purchasesImported === 0 && summary.salesImported === 0 && summary.duplicatesSkipped > 0) summary.diagnosticMessage = 'No new purchases or sales were imported because matching logs were already imported.'; else summary.diagnosticMessage = `Imported ${summary.purchasesImported} purchases and ${summary.salesImported} sales. Needs review: ${summary.activeReviewItems || 0}.`; return summary; }

  async function importLogs(options = {}) {
    const totalStart = nowMs();
    let from = options.from || '';
    let to = options.to || '';
    let rangeUsed = from || to ? (from && to && from === to ? 'selected-day-end-of-day' : 'selected-range') : 'latest-24-hours';
    let fromTs = toTimestamp(from) || (!from && !to ? Math.floor(Date.now() / 1000) - 86400 : '');
    let toTs = toTimestamp(to, true) || (!from && !to ? Math.floor(Date.now() / 1000) : '');
    const summary = createSummary(fromTs, toTs);
    summary.rangeUsed = rangeUsed;
    let result = await fetchUserLogs({ from: fromTs, to: toTs, rangeUsed });
    if (result.ok && result.debug && result.debug.rawLogsReturned === 0 && !from && !to) { rangeUsed = 'fallback-7-days'; fromTs = Math.floor(Date.now() / 1000) - (7 * 86400); toTs = Math.floor(Date.now() / 1000); summary.from = fromTs; summary.to = toTs; summary.rangeUsed = rangeUsed; result = await fetchUserLogs({ from: fromTs, to: toTs, rangeUsed }); }
    if (!result.ok) { summary.ok = false; summary.errors = [result.error || 'Could not fetch Torn logs.']; summary.rawLogsReturned = result.debug && result.debug.rawLogsReturned || 0; summary.normalizedLogs = result.debug && result.debug.normalizedLogs || 0; applyDiagnostic(summary, result); summary.debug = buildDebug(result, summary, { totalImportMs: elapsed(totalStart) }); update((data) => ({ ...data, settings: { ...data.settings, logImportDebug: summary.debug } })); return summary; }
    const logs = safeArray(result.data);
    summary.rawLogsReturned = result.debug && result.debug.rawLogsReturned ? result.debug.rawLogsReturned : logs.length;
    summary.normalizedLogs = logs.length;
    summary.logsReturned = logs.length;
    summary.progress.total = logs.length;
    summary.firstRecognizedLogs = summarizeRecognizedLogs(logs);
    const data = load();
    const lookup = createItemLookup(data);
    const importedIds = new Set(safeArray(data.importedLogIds).map(String));
    data.purchaseLots.forEach((lot) => { if (lot.originalLogId) importedIds.add(String(lot.originalLogId)); });
    data.sales.forEach((sale) => { if (sale.originalLogId) importedIds.add(String(sale.originalLogId)); });
    let lots = [...data.purchaseLots];
    let sales = [...data.sales];
    let reviews = safeArray(data.importReviewQueue).map(normalizeReview).filter((item) => !item.ignored);
    const counters = { buyIdMatches: 0, sellIdMatches: 0, textBuyMatches: 0, textSellMatches: 0 };
    const classifyStart = nowMs();
    let parseMs = 0;
    for (const log of logs) {
      const entryId = getEntryId(log);
      const pipeParts = extractPipePartsFromLog(log);
      if (pipeParts && /item\s+market\s+buy/i.test(pipeParts[0])) summary.pipeBuyLogsFound += 1;
      if (pipeParts && /(item\s+market\s+(sell|sale)|market\s+sell)/i.test(pipeParts[0])) summary.pipeSellLogsFound += 1;
      const type = classifyLog(log, counters);
      summary.progress.processed += 1;
      if (type === 'buy') { summary.classifiedPurchases += 1; summary.progress.purchasesFound += 1; }
      if (type === 'sell') { summary.classifiedSales += 1; summary.progress.salesFound += 1; }
      if (!type) continue;
      if (importedIds.has(entryId)) { summary.duplicatesSkipped += 1; summary.progress.duplicatesSkipped += 1; continue; }
      const parseStart = nowMs();
      const parsed = type === 'buy' ? normalizeBuyLog(log, lookup) : normalizeSellLog(log, lookup);
      parseMs += elapsed(parseStart);
      noteParserKind(summary, type, parsed.parserKind);
      if (parsed.candidate) {
        noteCandidateKind(summary, type, parsed.parserKind);
        if (type === 'buy') { summary.buyCandidatesCreated += 1; lots = [normalizeLot(parsed.candidate), ...lots]; summary.purchasesImported += 1; summary.purchasesSaved += 1; }
        else { summary.sellCandidatesCreated += 1; const saleResult = saveSaleCandidate(data, lots, sales, parsed.candidate); lots = saleResult.lots; sales = saleResult.sales; summary.salesImported += 1; summary.salesSaved += 1; if (saleResult.warning) { summary.unmatchedSales += 1; summary.warnings.push(saleResult.warning); } }
        importedIds.add(entryId);
        reviews = removeReview(reviews, entryId);
      } else { addFailure(summary, parsed.reason); reviews = upsertReview(reviews, reviewFromLog(log, type, parsed.reason, parsed.partial)); summary.reviewCandidatesCreated += 1; }
    }
    summary.buyIdMatches = counters.buyIdMatches;
    summary.sellIdMatches = counters.sellIdMatches;
    summary.activeReviewItems = reviews.filter((item) => !item.ignored).length;
    applyDiagnostic(summary, result);
    summary.debug = buildDebug(result, summary, { classifyMs: elapsed(classifyStart), parseMs, totalImportMs: elapsed(totalStart) });
    update((current) => ({ ...current, purchaseLots: lots, sales, importedLogIds: [...importedIds], importReviewQueue: reviews, importHistory: [{ id: makeId(), createdAt: new Date().toISOString(), ...summary }, ...safeArray(current.importHistory)].slice(0, 30), settings: { ...current.settings, logImportDebug: summary.debug, logImportLastRunAt: new Date().toISOString() } }));
    return summary;
  }

  function buildReviewLog(item) { return { entryId: item.entryId || item.originalLogId || item.id, originalLogId: item.entryId || item.originalLogId || item.id, logTypeId: item.logTypeId, timestamp: item.timestamp, text: item.textPreview || (Array.isArray(item.pipeParts) ? item.pipeParts.join(' | ') : ''), message: item.textPreview || (Array.isArray(item.pipeParts) ? item.pipeParts.join(' | ') : ''), title: item.textPreview || '', details: Array.isArray(item.pipeParts) ? item.pipeParts.slice(1) : [], rawKeys: item.rawKeys || [], rawSampleKeys: item.rawSampleKeys || [] }; }
  async function retryReviewQueue() {
    const summary = createSummary('', '');
    summary.rangeUsed = 'review-retry';
    const data = load();
    const lookup = createItemLookup(data);
    const importedIds = new Set(safeArray(data.importedLogIds).map(String));
    let lots = [...data.purchaseLots];
    let sales = [...data.sales];
    const nextReviews = [];
    for (const item of safeArray(data.importReviewQueue).map(normalizeReview).filter((entry) => !entry.ignored)) {
      const entryId = String(item.entryId || item.originalLogId || item.id);
      if (importedIds.has(entryId)) { summary.duplicatesSkipped += 1; continue; }
      const log = buildReviewLog(item);
      const type = item.type === 'sell' ? 'sell' : 'buy';
      const parsed = type === 'buy' ? normalizeBuyLog(log, lookup) : normalizeSellLog(log, lookup);
      noteParserKind(summary, type, parsed.parserKind);
      if (parsed.candidate) {
        noteCandidateKind(summary, type, parsed.parserKind);
        if (type === 'buy') { lots = [normalizeLot(parsed.candidate), ...lots]; summary.purchasesImported += 1; summary.purchasesSaved += 1; summary.buyCandidatesCreated += 1; }
        else { const saleResult = saveSaleCandidate(data, lots, sales, parsed.candidate); lots = saleResult.lots; sales = saleResult.sales; summary.salesImported += 1; summary.salesSaved += 1; summary.sellCandidatesCreated += 1; if (saleResult.warning) { summary.unmatchedSales += 1; summary.warnings.push(saleResult.warning); } }
        importedIds.add(entryId);
      } else { addFailure(summary, parsed.reason); nextReviews.push(normalizeReview({ ...item, ...reviewFromLog(log, type, parsed.reason, parsed.partial), reason: parsed.reason, updatedAt: new Date().toISOString() })); }
    }
    summary.activeReviewItems = nextReviews.length;
    summary.reviewCandidatesCreated = nextReviews.length;
    summary.diagnosticMessage = `Retry imported ${summary.purchasesImported} purchases and ${summary.salesImported} sales. Still needs review: ${nextReviews.length}.`;
    summary.debug = buildDebug({ debug: data.settings.logImportDebug || {} }, summary, { totalImportMs: 0 });
    save({ ...data, purchaseLots: lots, sales, importedLogIds: [...importedIds], importReviewQueue: nextReviews, settings: { ...data.settings, logImportDebug: summary.debug, logImportLastRunAt: new Date().toISOString() } });
    return summary;
  }
  function findReview(data, reviewId) { return safeArray(data.importReviewQueue).find((item) => String(item.id) === String(reviewId) || String(item.entryId) === String(reviewId) || String(item.originalLogId) === String(reviewId)); }
  function reviewPurchaseCandidate(item, values, lookup) { const itemId = values.itemId || item.itemId || undefined; const resolved = lookup.resolve(itemId, values.itemName || item.itemName || ''); const quantity = calculateQuantity(values.quantity || item.quantity, num(values.unitPrice || item.unitPrice), num(values.totalPrice || item.totalPrice)); const priced = normalizePriceFields({ itemId: resolved.itemId, itemName: resolved.itemName, needsNameReview: resolved.needsNameReview, quantity, unitBuyPrice: num(values.unitPrice || item.unitPrice), totalBuyPrice: num(values.totalPrice || item.totalPrice) }, 'unitBuyPrice', 'totalBuyPrice'); return { itemId: priced.itemId, itemName: priced.itemName || (priced.itemId ? `Item #${priced.itemId}` : ''), quantity: priced.quantity, unitBuyPrice: priced.unitBuyPrice, totalBuyPrice: priced.totalBuyPrice, remainingQuantity: priced.quantity, createdAt: item.timestamp || new Date().toISOString(), source: 'api', originalLogId: item.entryId || item.originalLogId, logTypeId: item.logTypeId, notes: 'Saved from import review', needsNameReview: Boolean(priced.needsNameReview) }; }
  function reviewSaleCandidate(item, values, lookup) { const itemId = values.itemId || item.itemId || undefined; const resolved = lookup.resolve(itemId, values.itemName || item.itemName || ''); const quantity = calculateQuantity(values.quantity || item.quantity, num(values.unitPrice || item.unitPrice), num(values.totalPrice || item.totalPrice)); const priced = normalizePriceFields({ itemId: resolved.itemId, itemName: resolved.itemName, needsNameReview: resolved.needsNameReview, quantity, unitSellPrice: num(values.unitPrice || item.unitPrice), totalSellPrice: num(values.totalPrice || item.totalPrice), fees: num(values.fees || item.fees) }, 'unitSellPrice', 'totalSellPrice'); return { itemId: priced.itemId, itemName: priced.itemName || (priced.itemId ? `Item #${priced.itemId}` : ''), quantity: priced.quantity, unitSellPrice: priced.unitSellPrice, totalSellPrice: priced.totalSellPrice, fees: priced.fees, soldAt: item.timestamp || new Date().toISOString(), source: 'api', originalLogId: item.entryId || item.originalLogId, logTypeId: item.logTypeId, notes: 'Saved from import review', needsNameReview: Boolean(priced.needsNameReview) }; }
  function saveReviewItem(reviewId, values, forceType) { let response = { ok: false, message: 'Review item was not found.' }; update((data) => { const item = findReview(data, reviewId); if (!item) return data; const lookup = createItemLookup(data); const imported = new Set(safeArray(data.importedLogIds).map(String)); const entryId = String(item.entryId || item.originalLogId || item.id); const type = forceType || item.type; if (type === 'sell') { const candidate = reviewSaleCandidate(item, values, lookup); const reason = validateSell(candidate); if (reason) { response = { ok: false, message: reason }; return data; } const saleResult = saveSaleCandidate(data, data.purchaseLots, data.sales, candidate); imported.add(entryId); response = { ok: true, message: saleResult.warning || 'Review item saved as a sale.' }; return { ...data, purchaseLots: saleResult.lots, sales: saleResult.sales, importedLogIds: [...imported], importReviewQueue: removeReview(data.importReviewQueue, entryId) }; } const candidate = reviewPurchaseCandidate(item, values, lookup); const reason = validateBuy(candidate); if (reason) { response = { ok: false, message: reason }; return data; } imported.add(entryId); response = { ok: true, message: 'Review item saved as a purchase.' }; return { ...data, purchaseLots: [normalizeLot(candidate), ...data.purchaseLots], importedLogIds: [...imported], importReviewQueue: removeReview(data.importReviewQueue, entryId) }; }); return response; }
  function ignoreReviewItem(reviewId) { let response = { ok: false, message: 'Review item was not found.' }; update((data) => { const item = findReview(data, reviewId); if (!item) return data; const entryId = String(item.entryId || item.originalLogId || item.id); const imported = new Set(safeArray(data.importedLogIds).map(String)); imported.add(entryId); response = { ok: true, message: 'Review item ignored.' }; return { ...data, importedLogIds: [...imported], importReviewQueue: removeReview(data.importReviewQueue, entryId), settings: { ...data.settings, logImportDebug: { ...(data.settings.logImportDebug || {}), ignoredItems: num(data.settings.logImportDebug && data.settings.logImportDebug.ignoredItems) + 1, updatedAt: new Date().toISOString() } } }; }); return response; }
  function deleteReviewItem(reviewId) { let response = { ok: false, message: 'Review item was not found.' }; update((data) => { const item = findReview(data, reviewId); if (!item) return data; response = { ok: true, message: 'Review item deleted. It can be imported again later.' }; return { ...data, importReviewQueue: removeReview(data.importReviewQueue, item.entryId || item.originalLogId || item.id) }; }); return response; }

  function portfolio(data = load()) { const groups = {}; safeArray(data.purchaseLots).forEach((lot) => { const qty = remaining(lot); if (qty <= 0) return; const key = lot.itemId ? `id:${lot.itemId}` : `name:${String(lot.itemName).toLowerCase()}`; groups[key] = groups[key] || { itemId: lot.itemId || '', itemName: lot.itemName, quantity: 0, totalInvestment: 0 }; groups[key].quantity += qty; groups[key].totalInvestment += qty * num(lot.unitBuyPrice ?? lot.buyPrice); }); return Object.values(groups).map((item) => { const avg = item.quantity ? item.totalInvestment / item.quantity : 0; const fee = Math.max(0.0001, 1 - num(data.settings.bazaarFeeRate, 0.03)); const target = (avg * (1 + num(data.settings.targetRoi, 20) / 100)) / fee; const profit = target * item.quantity * fee - item.totalInvestment; return { ...item, averageCost: avg, breakEvenSellPrice: avg / fee, targetSellPrice: target, estimatedProfit: profit, estimatedROI: item.totalInvestment ? profit / item.totalInvestment * 100 : 0 }; }); }
  function stats(data = load()) { const sales = data.sales || []; const lots = data.purchaseLots || []; const current = new Date(); const day = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime(); const week = new Date(current.getFullYear(), current.getMonth(), current.getDate() - ((current.getDay() || 7) - 1)).getTime(); const month = new Date(current.getFullYear(), current.getMonth(), 1).getTime(); const profitSince = (time) => sales.reduce((sum, sale) => Date.parse(sale.soldAt || sale.createdAt || '') >= time ? sum + num(sale.netProfit ?? sale.profit) : sum, 0); const lifetimeProfit = sales.reduce((sum, sale) => sum + num(sale.netProfit ?? sale.profit), 0); const totalBuy = sales.reduce((sum, sale) => sum + num(sale.matchedBuyCost ?? sale.totalBuy), 0); return { totalTrades: sales.length, totalInvestment: lots.reduce((sum, lot) => sum + remaining(lot) * num(lot.unitBuyPrice ?? lot.buyPrice), 0), lifetimeProfit, todayProfit: profitSince(day), weeklyProfit: profitSince(week), monthlyProfit: profitSince(month), averageROI: totalBuy ? lifetimeProfit / totalBuy * 100 : 0, bestFlip: [...sales].sort((left, right) => num(right.netProfit) - num(left.netProfit))[0] || null, worstFlip: [...sales].sort((left, right) => num(left.netProfit) - num(right.netProfit))[0] || null }; }

  function card(title, body) { return `<section class="ftp-card"><h2>${esc(title)}</h2>${body}</section>`; }
  function stat(label, value) { return `<section class="ftp-stat"><span>${esc(label)}</span><h2>${esc(value)}</h2></section>`; }
  function row(main, aside = '') { return `<li class="ftp-row"><div>${main}</div><div>${aside}</div></li>`; }
  function dashboard(data) { const summary = stats(data); const reviewCount = safeArray(data.importReviewQueue).filter((item) => !item.ignored).length; const apiHint = data.settings.apiEnabled && !data.settings.logImportLastRunAt ? card('API connected', '<p>API connected. Run log import to automatically add purchases and sales.</p>') : ''; return `<section class="ftp-grid">${stat('Open investment', money(summary.totalInvestment))}${stat('Lifetime profit', money(summary.lifetimeProfit))}${stat('Trades', summary.totalTrades)}${stat('Needs review', reviewCount)}</section>${apiHint}${card('Recent activity', `<p>${data.sales.length ? `Last sale: ${esc(data.sales[0].itemName)} for ${money(data.sales[0].totalSellPrice)}` : 'No sales recorded yet.'}</p>`)}`; }
  function calculator() { return card('Record Sale', `<form data-sale-form><label class="ftp-field"><span>Item name</span><input class="ftp-input" name="itemName" required></label><div class="ftp-grid"><label class="ftp-field"><span>Quantity</span><input class="ftp-input" name="quantity" type="number" min="1" value="1" required></label><label class="ftp-field"><span>Sell price each</span><input class="ftp-input" name="sellPrice" type="number" min="0" step="1" required></label></div><div class="ftp-grid"><label class="ftp-field"><span>Fees optional</span><input class="ftp-input" name="fees" type="number" min="0" step="1"></label><label class="ftp-field"><span>Manual buy price for unmatched quantity</span><input class="ftp-input" name="buyPrice" type="number" min="0" step="1"></label></div><label class="ftp-field"><span><input type="checkbox" name="manualBuyCostOverride"> Use manual buy cost for unmatched quantity</span></label><label class="ftp-field"><span>Notes</span><input class="ftp-input" name="notes"></label><div class="ftp-preview" data-sale-preview></div><div class="ftp-actions"><button class="ftp-primary" type="submit">Save sale</button></div></form>`); }
  function purchases(data) { const items = data.purchaseLots.filter((lot) => remaining(lot) > 0); return `${card('Add Purchase', `<form data-purchase-form><label class="ftp-field"><span>Item name</span><input class="ftp-input" name="itemName" required></label><div class="ftp-grid"><label class="ftp-field"><span>Quantity</span><input class="ftp-input" name="quantity" type="number" min="1" value="1" required></label><label class="ftp-field"><span>Buy price each</span><input class="ftp-input" name="buyPrice" type="number" min="0" step="1" required></label></div><label class="ftp-field"><span>Notes</span><input class="ftp-input" name="notes"></label><div class="ftp-actions"><button class="ftp-primary" type="submit">Add purchase</button></div></form>`)}${card('Open Purchases', items.length ? `<ul class="ftp-list">${items.map((lot) => row(`<strong>${esc(lot.itemName)}</strong><br><small>${remaining(lot)} left of ${lot.quantity} at ${money(lot.unitBuyPrice)} / Source ${esc(lot.source || 'manual')}${lot.originalLogId ? ` / Log ${esc(lot.originalLogId)}` : ''}${lot.logTypeId ? ` / Type ${esc(lot.logTypeId)}` : ''}${lot.needsNameReview ? ' / name review' : ''}</small>${lot.notes ? `<br><small>${esc(lot.notes)}</small>` : ''}`, `<button class="ftp-button" data-sell-lot="${esc(lot.id)}">Sell</button><button class="ftp-danger" data-delete-lot="${esc(lot.id)}">Delete</button>`)).join('')}</ul>` : '<p>No open purchases yet.</p>')}`; }
  function portfolioView(data) { const items = portfolio(data); return card('Portfolio', items.length ? `<ul class="ftp-list">${items.map((item) => row(`<strong>${esc(item.itemName)}</strong><br><small>${item.quantity} held / avg ${money(item.averageCost)} / break-even ${money(item.breakEvenSellPrice)}</small>`, `<strong data-profit="${item.estimatedProfit >= 0 ? 'positive' : 'negative'}">${money(item.estimatedProfit)}</strong>`)).join('')}</ul>` : '<p>No open holdings yet.</p>'); }
  function history(data) { return card('Sales History', data.sales.length ? `<ul class="ftp-list">${data.sales.map((sale) => row(`<strong>${esc(sale.itemName)}</strong><br><small>${sale.quantity} sold / buy cost ${money(sale.matchedBuyCost)} / sell total ${money(sale.totalSellPrice)} / ROI ${pct(sale.roi)}${sale.unmatchedSale ? ' / unmatched' : ''}</small>`, `<strong data-profit="${sale.netProfit >= 0 ? 'positive' : 'negative'}">${money(sale.netProfit)}</strong><button class="ftp-danger" data-delete-sale="${esc(sale.id)}">Delete</button>`)).join('')}</ul>` : '<p>No sales saved yet.</p>'); }
  function statisticsView(data) { const summary = stats(data); return `<section class="ftp-grid">${stat('Total trades', summary.totalTrades)}${stat('Total investment', money(summary.totalInvestment))}${stat('Lifetime profit', money(summary.lifetimeProfit))}${stat('Today profit', money(summary.todayProfit))}${stat('Weekly profit', money(summary.weeklyProfit))}${stat('Monthly profit', money(summary.monthlyProfit))}${stat('Average ROI', pct(summary.averageROI))}${stat('Needs review', safeArray(data.importReviewQueue).filter((item) => !item.ignored).length)}</section>`; }
  function summaryHtml(summary) { if (!summary) return ''; const reviewCount = load().importReviewQueue.filter((item) => !item.ignored).length || summary.activeReviewItems || summary.reviewCandidatesCreated || 0; return `<div class="ftp-preview" data-import-summary><span>Import summary</span><br><small>Purchases ${summary.purchasesImported || 0} / Sales ${summary.salesImported || 0} / Duplicates ${summary.duplicatesSkipped || 0} / Unmatched ${summary.unmatchedSales || 0}</small><br><small>Needs review ${reviewCount} / Parser failures ${summary.parserFailures || 0} / Validation failures ${summary.validationFailures || 0}</small><br><small>Buy IDs ${summary.buyIdMatches || 0} / Sell IDs ${summary.sellIdMatches || 0} / Classified buys ${summary.classifiedPurchases || 0} / Classified sells ${summary.classifiedSales || 0}</small><br><small>Pipe buy logs found ${summary.pipeBuyLogsFound || 0} / Pipe buy candidates ${summary.pipeBuyCandidatesCreated || 0} / Text buy candidates ${summary.textBuyCandidatesCreated || 0}</small><br><small>${esc(summary.diagnosticMessage || '')}</small>${reviewCount ? '<div class="ftp-actions"><button class="ftp-button" type="button" data-scroll-review>Review import items</button></div>' : ''}</div>`; }
  function parserTestHtml(debug = {}) { const tests = safeArray(debug.parserSelfTest); if (!tests.length) return '<small>Parser self-test: not run yet.</small>'; const passed = tests.filter((test) => test.passed).length; return `<small>Parser self-test: ${passed}/${tests.length} passing</small><br>${tests.map((test) => `<small>${esc(test.passed ? 'PASS' : 'FAIL')} ${esc(test.name || '')}: ${esc(test.reason || 'ok')}</small>`).join('<br>')}`; }
  function debugHtml(debug = {}) { const params = debug.lastParams && typeof debug.lastParams === 'object' ? JSON.stringify(debug.lastParams) : '{}'; const reasons = safeArray(debug.parserFailureReasons).length ? debug.parserFailureReasons.join(' | ') : 'None'; const samples = safeArray(debug.firstRecognizedLogs).slice(0, 5); const zeroWarning = Number(debug.buyIdMatches || 0) > 0 && Number(debug.purchasesSaved || debug.purchasesImported || 0) === 0 ? `<br><small>Buy logs were detected but could not be converted into purchases because: ${esc(reasons === 'None' ? debug.diagnosticMessage || 'no parser created a complete buy candidate.' : reasons)}</small>` : ''; return `<details class="ftp-preview" data-import-debug><summary>Import debug</summary><small>Version: ${VERSION}</small><br><small>Required buy IDs: ${BUY_LOG_IDS.join(', ')}</small><br><small>Required sell IDs: ${SELL_LOG_IDS.join(', ')}</small><br><small>Endpoint: ${esc(debug.lastEndpoint || 'Not requested yet')} / Params: ${esc(params)}</small><br><small>Raw ${esc(debug.rawLogsReturned || 0)} / Normalized ${esc(debug.normalizedLogs || 0)} / Buy IDs ${esc(debug.buyIdMatches || 0)} / Sell IDs ${esc(debug.sellIdMatches || 0)}</small><br><small>Classified buys ${esc(debug.classifiedPurchases || 0)} / Classified sells ${esc(debug.classifiedSales || 0)} / Pipe buy logs found ${esc(debug.pipeBuyLogsFound || 0)} / Pipe sell logs found ${esc(debug.pipeSellLogsFound || 0)}</small><br><small>Pipe buy candidates ${esc(debug.pipeBuyCandidatesCreated || 0)} / Text buy candidates ${esc(debug.textBuyCandidatesCreated || 0)} / Structured buy candidates ${esc(debug.structuredBuyCandidatesCreated || 0)}</small><br><small>Purchases saved ${esc(debug.purchasesSaved || 0)} / Sales saved ${esc(debug.salesSaved || 0)} / Review ${esc(debug.activeReviewItems || debug.reviewCandidatesCreated || 0)}</small><br><small>Failures: ${esc(reasons)}</small>${zeroWarning}<br>${parserTestHtml(debug)}<br><small>First recognized logs:</small>${samples.length ? samples.map((log) => `<br><small>${esc(`${log.entryId || ''} / ${log.logTypeId || ''} / ${log.title || ''}`)}</small><br><small>Preview: ${esc(log.textPreview || '')}</small><br><small>Pipe parts: ${esc(safeArray(log.pipeParts).join(' | ') || 'None')}</small><br><small>Raw keys: ${esc(safeArray(log.rawKeys).join(', ') || 'None')}</small>`).join('') : '<br><small>No sanitized sample logs yet.</small>'}<br><small>${esc(debug.diagnosticMessage || '')}</small></details>`; }
  function reviewItemHtml(item) { const rid = esc(item.id || item.entryId || item.originalLogId); return `<article class="ftp-preview" data-review-item="${rid}"><span>${esc(item.type)} / entry ${esc(item.entryId || '')} / log ${esc(item.logTypeId || '')}</span><br><small>${esc(item.timestamp || '')}</small><br><small>${esc(item.reason || '')}</small><br><small>${esc(item.textPreview || '')}</small><br><small>Raw keys: ${esc(safeArray(item.rawKeys).join(', ') || 'None')}</small><br><small>Pipe parts: ${esc(safeArray(item.pipeParts).join(' | ') || 'None')}</small><div class="ftp-grid"><label class="ftp-field"><span>Item name</span><input class="ftp-input" data-review-field="itemName" value="${esc(item.itemName || '')}"></label><label class="ftp-field"><span>Item ID</span><input class="ftp-input" data-review-field="itemId" value="${esc(item.itemId || '')}"></label><label class="ftp-field"><span>Quantity</span><input class="ftp-input" data-review-field="quantity" type="number" min="1" value="${esc(item.quantity || '')}"></label><label class="ftp-field"><span>Unit price</span><input class="ftp-input" data-review-field="unitPrice" type="number" min="0" value="${esc(item.unitPrice || '')}"></label><label class="ftp-field"><span>Total price</span><input class="ftp-input" data-review-field="totalPrice" type="number" min="0" value="${esc(item.totalPrice || '')}"></label><label class="ftp-field"><span>Fees for sales</span><input class="ftp-input" data-review-field="fees" type="number" min="0" value="${esc(item.fees || '')}"></label></div><div class="ftp-actions"><button class="ftp-primary" type="button" data-save-review-purchase>Save as Purchase</button><button class="ftp-button" type="button" data-save-review-sale>Save as Sale</button><button class="ftp-button" type="button" data-ignore-review>Ignore</button><button class="ftp-danger" type="button" data-delete-review>Delete from review</button></div></article>`; }
  function reviewHtml(data) { const items = safeArray(data.importReviewQueue).filter((item) => !item.ignored); return `<div class="ftp-preview" data-review-section><span>Needs Review</span><br><small>${items.length ? `${items.length} item(s) can be fixed or saved here. Items in review are not imported duplicates.` : 'No import items need review.'}</small>${items.map(reviewItemHtml).join('')}</div>`; }
  function settings(data) { const state = getApiState(); const status = state.lastError || (state.connected ? 'API connected' : state.hasKey ? 'API key saved, currently disabled or unchecked' : 'No API key saved'); return `${card('Torn API', `<p>Use a Torn Full Access API key. Flip Tracker Pro stores it locally in your browser only and only sends it to Torn API endpoints. No Torn password is ever required.</p><div class="ftp-preview"><span>Log import IDs</span><br><small>Buy IDs: ${BUY_LOG_IDS.join(', ')}</small><br><small>Sell IDs: ${SELL_LOG_IDS.join(', ')}</small></div><label class="ftp-field"><span>API enabled</span><select class="ftp-input" data-api-enabled><option value="false" ${state.enabled ? '' : 'selected'}>Off</option><option value="true" ${state.enabled ? 'selected' : ''}>On</option></select></label><div class="ftp-grid"><label class="ftp-field"><span>API key</span><input class="ftp-input" data-api-key type="password" autocomplete="off" placeholder="${esc(state.maskedKey || 'Paste Full Access API key')}"></label><label class="ftp-field"><span>Status</span><input class="ftp-input" value="${esc(status)}" readonly></label></div><div class="ftp-actions"><button class="ftp-primary" data-save-api>Save API key</button><button class="ftp-button" data-check-api>Check API</button><button class="ftp-button" data-refresh-items>Refresh item prices</button><button class="ftp-danger" data-clear-api>Clear API key</button></div><p class="ftp-status" data-api-status data-status="${state.lastError ? 'error' : state.connected ? 'success' : 'info'}">${esc(status)}</p>`)}${card('Import Logs', `<p>Import latest logs checks the last 24 hours first, then the last 7 days if no raw logs are returned.</p><div class="ftp-grid"><label class="ftp-field"><span>Import from</span><input class="ftp-input" type="date" data-import-from></label><label class="ftp-field"><span>Import to</span><input class="ftp-input" type="date" data-import-to></label></div><div class="ftp-actions"><button class="ftp-primary" data-import-latest>Import latest logs</button><button class="ftp-button" data-import-range>Import date range</button><button class="ftp-button" data-raw-test>Raw Log Test</button><button class="ftp-button" data-copy-debug>Copy debug report</button></div><div class="ftp-actions"><button class="ftp-button" data-retry-review>Retry Needs Review Parsing</button><button class="ftp-button" data-clear-review>Clear Needs Review</button><button class="ftp-danger" data-reset-import>Reset import state</button></div><p class="ftp-status" data-import-status>${esc(data.settings.logImportLastRunAt ? `Last import ${new Date(data.settings.logImportLastRunAt).toLocaleString()}.` : 'Log import has not run yet.')}</p>${summaryHtml(lastSummary)}${debugHtml(data.settings.logImportDebug || {})}${reviewHtml(data)}`)}${card('Backup', `<p>Export or import your full app data.</p><div class="ftp-actions"><button class="ftp-button" data-export-backup>Export</button><button class="ftp-button" data-import-backup>Import</button><input type="file" accept="application/json,.json" data-import-file hidden></div>`)}`; }
  function routeHtml(data) { const route = data.settings.activeRoute || 'dashboard'; if (route === 'calculator') return calculator(data); if (route === 'portfolio') return portfolioView(data); if (route === 'purchases') return purchases(data); if (route === 'history') return history(data); if (route === 'statistics') return statisticsView(data); if (route === 'settings') return settings(data); return dashboard(data); }

  function injectCss() { if (typeof GM_addStyle === 'function') GM_addStyle(css); else { const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style); } }
  function getRoot() { let root = document.getElementById(ROOT_ID); if (!root) { root = document.createElement('section'); root.id = ROOT_ID; document.body.appendChild(root); } return root; }
  function saveWindowState(patch) { update((data) => ({ ...data, windowState: { ...data.windowState, ...patch } })); }
  function render() { const data = load(); const root = getRoot(); const route = data.settings.activeRoute || 'dashboard'; const state = data.windowState || {}; const mode = state.mode || 'compact'; root.style.top = `${num(state.top, 96)}px`; if (state.left !== null && state.left !== undefined) { root.style.left = `${num(state.left)}px`; root.style.right = 'auto'; } else { root.style.right = `${num(state.right, 24)}px`; root.style.left = 'auto'; } root.innerHTML = `<div class="ftp-window" data-mode="${esc(mode)}" style="width:${num(state.width, 760)}px;height:${num(state.height, 560)}px"><header class="ftp-titlebar"><button class="ftp-title" type="button" data-toggle-window>${mode === 'compact' ? 'FT' : 'Flip Tracker Pro'}</button><span class="ftp-version">v${VERSION}</span><div class="ftp-actions"><button class="ftp-button" type="button" data-toggle-window>_</button></div></header><section class="ftp-body"><nav class="ftp-sidebar">${ROUTES.map(([idText, label]) => `<button class="ftp-nav" type="button" data-route="${idText}" data-active="${String(route === idText)}">${label}</button>`).join('')}</nav><main class="ftp-main">${routeHtml(data)}</main></section><div class="ftp-resize" data-resize></div><div class="ftp-toasts" data-toasts></div></div>`; bind(root); }
  function notify(type, title, message) { const root = getRoot(); const toasts = root.querySelector('[data-toasts]'); if (!toasts) return; const toast = document.createElement('div'); toast.className = 'ftp-toast'; toast.innerHTML = `<strong>${esc(title)}</strong><span>${esc(message)}</span>`; toasts.appendChild(toast); setTimeout(() => toast.remove(), 3200); }
  function bind(root) { const win = root.querySelector('.ftp-window'); root.querySelectorAll('[data-toggle-window]').forEach((button) => button.addEventListener('click', () => { const mode = win.dataset.mode === 'compact' ? 'open' : 'compact'; saveWindowState({ mode }); render(); })); root.querySelectorAll('[data-route]').forEach((button) => button.addEventListener('click', () => { update((data) => ({ ...data, settings: { ...data.settings, activeRoute: button.dataset.route } })); render(); })); bindWindow(root, win); bindForms(root); bindSettings(root); }
  function bindWindow(root, win) {
    const bar = root.querySelector('.ftp-titlebar');
    const resize = root.querySelector('[data-resize]');
    if (bar) bar.addEventListener('pointerdown', (event) => { if (event.target.closest('button')) return; const startX = event.clientX; const startY = event.clientY; const rect = root.getBoundingClientRect(); function move(moveEvent) { root.style.left = `${rect.left + moveEvent.clientX - startX}px`; root.style.top = `${rect.top + moveEvent.clientY - startY}px`; root.style.right = 'auto'; } function up() { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); saveWindowState({ left: parseFloat(root.style.left), top: parseFloat(root.style.top), right: null }); } document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); });
    if (resize) resize.addEventListener('pointerdown', (event) => { event.preventDefault(); const startX = event.clientX; const startY = event.clientY; const startW = win.offsetWidth; const startH = win.offsetHeight; function move(moveEvent) { win.style.width = `${Math.max(320, startW + moveEvent.clientX - startX)}px`; win.style.height = `${Math.max(360, startH + moveEvent.clientY - startY)}px`; } function up() { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); saveWindowState({ width: win.offsetWidth, height: win.offsetHeight }); } document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); });
  }
  function readFormNumber(form, name, fallback = 0) { return num(form.elements[name] && form.elements[name].value, fallback); }
  function bindForms(root) {
    const purchaseForm = root.querySelector('[data-purchase-form]');
    if (purchaseForm) purchaseForm.addEventListener('submit', (event) => { event.preventDefault(); const quantity = readFormNumber(purchaseForm, 'quantity', 1); const unitBuyPrice = readFormNumber(purchaseForm, 'buyPrice'); update((data) => ({ ...data, purchaseLots: [normalizeLot({ itemName: purchaseForm.elements.itemName.value.trim(), quantity, remainingQuantity: quantity, unitBuyPrice, totalBuyPrice: unitBuyPrice * quantity, notes: purchaseForm.elements.notes.value.trim(), source: 'manual' }), ...data.purchaseLots] })); notify('success', 'Purchase added', 'Open purchase saved.'); render(); });
    const saleForm = root.querySelector('[data-sale-form]');
    if (saleForm) {
      const preview = saleForm.querySelector('[data-sale-preview]');
      function updatePreview() { const data = load(); const quantity = readFormNumber(saleForm, 'quantity', 1); const sellPrice = readFormNumber(saleForm, 'sellPrice'); const draft = { itemName: saleForm.elements.itemName.value.trim(), quantity, unitSellPrice: sellPrice, totalSellPrice: sellPrice * quantity, fees: saleForm.elements.fees.value === '' ? undefined : readFormNumber(saleForm, 'fees'), buyPrice: readFormNumber(saleForm, 'buyPrice'), manualBuyCostOverride: saleForm.elements.manualBuyCostOverride.checked }; const sale = matchSale(data.purchaseLots, draft, data.settings); if (preview) preview.innerHTML = `<span>Matched ${sale.matchedQuantity} / Unmatched ${sale.unmatchedQuantity}</span><br><small>Buy cost ${money(sale.matchedBuyCost)} / Gross ${money(sale.grossProfit)} / Fees ${money(sale.fees)}</small><br><strong data-profit="${sale.netProfit >= 0 ? 'positive' : 'negative'}">${money(sale.netProfit)} (${pct(sale.roi)})</strong>`; return sale; }
      saleForm.addEventListener('input', updatePreview);
      saleForm.addEventListener('submit', (event) => { event.preventDefault(); const sale = updatePreview(); if (sale.unmatchedQuantity > 0 && !saleForm.elements.manualBuyCostOverride.checked && !window.confirm('This sale has unmatched quantity. Save it as unmatched without assuming zero cost?')) return; update((data) => ({ ...data, purchaseLots: applySale(data.purchaseLots, sale), sales: [normalizeSale({ ...sale, notes: saleForm.elements.notes.value.trim(), source: 'manual' }), ...data.sales] })); notify('success', 'Sale recorded', 'Completed sale saved.'); render(); });
      updatePreview();
    }
    root.querySelectorAll('[data-delete-lot]').forEach((button) => button.addEventListener('click', () => { if (!window.confirm('Delete this open purchase?')) return; update((data) => ({ ...data, purchaseLots: data.purchaseLots.filter((lot) => lot.id !== button.dataset.deleteLot) })); render(); }));
    root.querySelectorAll('[data-delete-sale]').forEach((button) => button.addEventListener('click', () => { if (!window.confirm('Delete this sale?')) return; update((data) => ({ ...data, sales: data.sales.filter((sale) => sale.id !== button.dataset.deleteSale) })); render(); }));
    root.querySelectorAll('[data-sell-lot]').forEach((button) => button.addEventListener('click', () => { const data = load(); const lot = data.purchaseLots.find((entry) => entry.id === button.dataset.sellLot); update((current) => ({ ...current, settings: { ...current.settings, activeRoute: 'calculator' } })); render(); const form = getRoot().querySelector('[data-sale-form]'); if (form && lot) { form.elements.itemName.value = lot.itemName; form.elements.quantity.value = remaining(lot); form.elements.sellPrice.focus(); form.dispatchEvent(new Event('input')); } }));
  }
  function setImportStatus(root, status, message) { const statusElement = root.querySelector('[data-import-status]'); if (statusElement) { statusElement.dataset.status = status; statusElement.textContent = message; } }
  function importMessage(summary) { return summary.diagnosticMessage || `Imported ${summary.purchasesImported || 0} purchases and ${summary.salesImported || 0} sales.`; }
  function debugReport() { const data = load(); const debug = data.settings.logImportDebug || {}; return JSON.stringify({ appVersion: VERSION, requiredBuyLogIds: BUY_LOG_IDS, requiredSellLogIds: SELL_LOG_IDS, ...debug, reviewQueue: data.importReviewQueue.slice(0, 10) }, null, 2); }
  function copyText(text, label) { if (typeof GM_setClipboard === 'function') { GM_setClipboard(String(text || '')); notify('success', 'Copied', `${label} copied.`); return; } if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(String(text || '')).then(() => notify('success', 'Copied', `${label} copied.`)); }
  function collectReviewValues(button) { const reviewItem = button.closest('[data-review-item]'); const values = {}; if (!reviewItem) return { reviewId: '', values }; reviewItem.querySelectorAll('[data-review-field]').forEach((input) => { values[input.dataset.reviewField] = input.value; }); return { reviewId: reviewItem.dataset.reviewItem || '', values }; }
  function bindSettings(root) {
    const apiKeyInput = root.querySelector('[data-api-key]');
    const enabledSelect = root.querySelector('[data-api-enabled]');
    const importFrom = root.querySelector('[data-import-from]');
    const importTo = root.querySelector('[data-import-to]');
    const saveApi = root.querySelector('[data-save-api]');
    const clearApi = root.querySelector('[data-clear-api]');
    const checkApi = root.querySelector('[data-check-api]');
    const refreshItems = root.querySelector('[data-refresh-items]');
    if (enabledSelect) enabledSelect.addEventListener('change', () => { const result = setApiEnabled(enabledSelect.value === 'true'); notify(result.ok ? 'success' : 'warning', 'API settings', result.message); render(); });
    if (saveApi && apiKeyInput) saveApi.addEventListener('click', () => { const result = saveApiKey(apiKeyInput.value); notify(result.ok ? 'success' : 'error', 'API key', result.message); render(); });
    if (clearApi) clearApi.addEventListener('click', () => { const result = clearApiKey(); notify('info', 'API key cleared', result.message); render(); });
    if (checkApi) checkApi.addEventListener('click', async () => { notify('info', 'API diagnostics', 'Checking API...'); const result = await fetchKeyInfo(); notify(result.ok ? 'success' : 'warning', 'API diagnostics', result.ok ? 'API checked.' : result.error || 'API check failed.'); render(); });
    if (refreshItems) refreshItems.addEventListener('click', async () => { notify('info', 'Prices', 'Refreshing item data...'); const result = await apiRequest('torn', 'items', {}); if (!result.ok) { notify('warning', 'Prices', result.error || 'Item refresh failed.'); render(); return; } const items = result.data && (result.data.items || result.data); const snapshots = []; if (items && typeof items === 'object') Object.entries(items).forEach(([itemId, item]) => { if (item && typeof item === 'object') snapshots.push({ itemId, itemName: item.name || item.itemName || `Item #${itemId}`, marketPrice: num(item.market_value || item.marketPrice || item.value), timestamp: new Date().toISOString(), source: 'api' }); }); update((data) => ({ ...data, itemPriceSnapshots: snapshots.length ? snapshots : data.itemPriceSnapshots, settings: { ...data.settings, tornItems: items || data.settings.tornItems } })); notify('success', 'Prices', `Updated ${snapshots.length} item records.`); render(); });
    const runImport = async (options) => { setImportStatus(root, 'info', 'Importing Torn logs in batches...'); lastSummary = await importLogs(options); setImportStatus(root, lastSummary.ok ? 'success' : 'error', importMessage(lastSummary)); notify(lastSummary.ok ? 'success' : 'warning', 'Log import finished', importMessage(lastSummary)); render(); };
    const latest = root.querySelector('[data-import-latest]');
    const range = root.querySelector('[data-import-range]');
    const rawTest = root.querySelector('[data-raw-test]');
    if (latest) latest.addEventListener('click', () => runImport({}));
    if (range) range.addEventListener('click', () => runImport({ from: importFrom ? importFrom.value : '', to: importTo ? importTo.value : '' }));
    if (rawTest) rawTest.addEventListener('click', async () => { setImportStatus(root, 'info', 'Testing raw unfiltered user -> log...'); const result = await testRawUserLogs(); const parserSelfTest = runParserSelfTest(); const recognized = summarizeRecognizedLogs(result.data || []); const debug = { ...(result.debug || {}), appVersion: VERSION, buyLogIds: BUY_LOG_IDS, sellLogIds: SELL_LOG_IDS, parserSelfTest, firstRecognizedLogs: recognized.length ? recognized : result.debug && result.debug.firstRecognizedLogs || [] }; update((data) => ({ ...data, settings: { ...data.settings, logImportDebug: debug } })); const failed = parserSelfTest.filter((test) => !test.passed).length; const message = result.ok ? `Raw test ok. Raw logs ${debug.rawLogsReturned || 0}, normalized ${debug.normalizedLogs || 0}. Buy IDs ${debug.buyIdMatches || 0}, sell IDs ${debug.sellIdMatches || 0}. Parser self-test ${parserSelfTest.length - failed}/${parserSelfTest.length} passing.` : result.error || 'Raw log test failed.'; setImportStatus(root, result.ok ? 'success' : 'error', message); notify(result.ok ? 'success' : 'warning', 'Raw Log Test', message); render(); });
    const copyDebug = root.querySelector('[data-copy-debug]');
    if (copyDebug) copyDebug.addEventListener('click', () => copyText(debugReport(), 'Debug report'));
    const retry = root.querySelector('[data-retry-review]');
    if (retry) retry.addEventListener('click', async () => { setImportStatus(root, 'info', 'Retrying Needs Review parsing...'); lastSummary = await retryReviewQueue(); setImportStatus(root, lastSummary.ok ? 'success' : 'error', importMessage(lastSummary)); notify(lastSummary.ok ? 'success' : 'warning', 'Review retry finished', importMessage(lastSummary)); render(); });
    const clearReview = root.querySelector('[data-clear-review]');
    if (clearReview) clearReview.addEventListener('click', () => { if (!window.confirm('Clear all Needs Review items? This does not delete purchases or sales.')) return; update((data) => ({ ...data, importReviewQueue: [] })); notify('success', 'Needs Review', 'Needs review queue cleared.'); render(); });
    const resetImport = root.querySelector('[data-reset-import]');
    if (resetImport) resetImport.addEventListener('click', () => { if (!window.confirm('Reset import state only? Purchases, sales, settings, API key, and window position will stay.')) return; update((data) => ({ ...data, importedLogIds: [], importReviewQueue: [], importHistory: [], settings: { ...data.settings, logImportDebug: {}, logImportLastRunAt: '' } })); notify('success', 'Import state', 'Import state reset.'); render(); });
    const exportButton = root.querySelector('[data-export-backup]');
    if (exportButton) exportButton.addEventListener('click', () => { const blob = new Blob([JSON.stringify(load(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `flip-tracker-pro-backup-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); notify('success', 'Backup', 'Exported full app backup.'); });
    const importButton = root.querySelector('[data-import-backup]');
    const importFile = root.querySelector('[data-import-file]');
    if (importButton && importFile) { importButton.addEventListener('click', () => importFile.click()); importFile.addEventListener('change', () => { const file = importFile.files && importFile.files[0]; if (!file) return; const reader = new FileReader(); reader.addEventListener('load', () => { try { save(JSON.parse(String(reader.result || '{}'))); notify('success', 'Backup', 'Imported full app backup.'); render(); } catch (error) { notify('error', 'Backup', 'Could not import that JSON backup.'); } }); reader.readAsText(file); }); }
    root.addEventListener('click', (event) => { const button = event.target.closest('button'); if (!button) return; if (button.matches('[data-scroll-review]')) { const reviewSection = root.querySelector('[data-review-section]'); if (reviewSection) reviewSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; } if (!button.closest('[data-review-item]')) return; const { reviewId, values } = collectReviewValues(button); let result = null; if (button.matches('[data-save-review-purchase]')) result = saveReviewItem(reviewId, values, 'buy'); else if (button.matches('[data-save-review-sale]')) result = saveReviewItem(reviewId, values, 'sell'); else if (button.matches('[data-ignore-review]')) result = ignoreReviewItem(reviewId); else if (button.matches('[data-delete-review]')) result = deleteReviewItem(reviewId); if (result) { notify(result.ok ? 'success' : 'error', 'Import review', result.message); render(); } });
  }

  function boot() { injectCss(); load(); render(); if (typeof window !== 'undefined') window.FlipTrackerPro = Object.freeze({ version: VERSION, buyLogIds: BUY_LOG_IDS, sellLogIds: SELL_LOG_IDS, runParserSelfTest, extractPipePartsFromLog, services: Object.freeze({ load, save, importLogs, retryReviewQueue, testRawUserLogs }) }); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
}());
