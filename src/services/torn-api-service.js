const FlipTrackerProTornApiService = (() => {
  const baseUrl = 'https://api.torn.com';
  const maxQueueSize = 8;
  const minDelayMs = 750;
  const cacheTtls = Object.freeze({ itemPrices: 5 * 60 * 1000, keyInfo: 60 * 1000, logs: 30 * 1000, default: 60 * 1000 });
  const cache = new Map();
  const queue = [];
  let activeRequest = false;
  let lastRequestAt = 0;

  function now() {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  function elapsed(start) {
    return Math.round(now() - start);
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

  function getKnownLogTypeIds() {
    return [...new Set([...getBuyLogIds(), ...getSellLogIds()])];
  }

  function getStorageService() {
    return window.FlipTrackerProStorageService;
  }

  function getEventBus() {
    return window.FlipTrackerProEventBus;
  }

  function getSettings(storagePrefix) {
    const storageService = getStorageService();
    const data = storageService && typeof storageService.load === 'function' ? storageService.load(storagePrefix) : { settings: {} };
    return data.settings || {};
  }

  function updateSettings(storagePrefix, patch) {
    const storageService = getStorageService();
    if (!storageService || typeof storageService.update !== 'function') return { settings: getSettings(storagePrefix) };
    return storageService.update(storagePrefix, (data) => ({ ...data, settings: { ...data.settings, ...patch } }));
  }

  function notify(type, title, message) {
    const eventBus = getEventBus();
    if (eventBus && typeof eventBus.emit === 'function') eventBus.emit('notify', { type, title, message });
  }

  function maskKey(apiKey) {
    if (!apiKey) return '';
    return `${apiKey.slice(0, 4)}${'*'.repeat(Math.max(4, apiKey.length - 8))}${apiKey.slice(-4)}`;
  }

  function getStatus(storagePrefix) {
    const settings = getSettings(storagePrefix);
    const hasKey = Boolean(settings.apiKey);
    const enabled = Boolean(settings.apiEnabled && hasKey);
    return {
      connected: enabled && settings.apiStatus !== 'invalid' && settings.apiStatus !== 'error',
      diagnostics: settings.apiDiagnostics || {},
      enabled,
      hasKey,
      label: enabled ? 'Ready' : hasKey ? 'Saved, disabled' : 'No API key saved',
      lastError: settings.apiLastError || '',
      lastErrorCode: settings.apiLastErrorCode || '',
      lastRequest: settings.apiLastRequest || {},
      maskedKey: hasKey ? maskKey(settings.apiKey) : '',
      buyLogIds: getBuyLogIds(),
      sellLogIds: getSellLogIds(),
      requiredLogTypeIds: getKnownLogTypeIds(),
      status: settings.apiStatus || (enabled ? 'ready' : 'disabled')
    };
  }

  function buildUrl({ section = 'torn', id = '', selections = '', params = {} } = {}, apiKey) {
    const safeSection = String(section || 'torn').replace(/[^a-z_]/gi, '');
    const safeId = String(id || '').replace(/[^a-z0-9_-]/gi, '');
    const url = new URL(safeId ? `/${safeSection}/${safeId}` : `/${safeSection}/`, baseUrl);
    if (selections) url.searchParams.set('selections', String(selections));
    Object.entries(params || {}).forEach(([key, value]) => {
      const safeKey = String(key || '').replace(/[^a-z_]/gi, '');
      if (safeKey && value !== undefined && value !== null && value !== '') url.searchParams.set(safeKey, String(value));
    });
    url.searchParams.set('key', apiKey);
    return url;
  }

  function sanitizeRequest(requestOptions) {
    return {
      endpoint: `/${String(requestOptions.section || 'torn').replace(/[^a-z_]/gi, '')}/`,
      id: requestOptions.id ? String(requestOptions.id).replace(/[^a-z0-9_-]/gi, '') : '',
      selections: String(requestOptions.selections || ''),
      params: { ...(requestOptions.params || {}) }
    };
  }

  function getApiError(payload, response) {
    const error = payload && payload.error;
    const code = error && error.code !== undefined ? Number(error.code) : '';
    const rawMessage = String((error && (error.error || error.message)) || (response ? `Torn API error ${response.status}` : 'Torn API error'));
    const message = code === 16 || rawMessage.toLowerCase().includes('access level of this key is not high enough') ? 'This API key does not have enough access for user -> log. Use a Torn Full Access API key for now.' : rawMessage;
    return { code, message, rawMessage };
  }

  function isInvalidKeyError(errorPayload) {
    const error = errorPayload && errorPayload.error;
    const code = Number(error && error.code);
    const message = String((error && (error.error || error.message)) || '').toLowerCase();
    return code === 2 || message.includes('incorrect key') || message.includes('invalid key');
  }

  function getCacheKey(requestType, request) {
    return JSON.stringify({ requestType, section: request.section, id: request.id, selections: request.selections, params: request.params || {} });
  }

  function getCached(requestType, request) {
    const cached = cache.get(getCacheKey(requestType, request));
    const ttl = cacheTtls[requestType] || cacheTtls.default;
    return cached && Date.now() - cached.timestamp <= ttl ? cached.data : null;
  }

  function setCached(requestType, request, data) {
    cache.set(getCacheKey(requestType, request), { data, timestamp: Date.now() });
  }

  function runQueue() {
    if (activeRequest || queue.length === 0) return;
    activeRequest = true;
    const next = queue.shift();
    const waitMs = Math.max(0, minDelayMs - (Date.now() - lastRequestAt));
    window.setTimeout(() => {
      lastRequestAt = Date.now();
      next.run().finally(() => {
        activeRequest = false;
        runQueue();
      });
    }, waitMs);
  }

  function enqueue(run) {
    if (queue.length >= maxQueueSize) return Promise.reject(new Error('Request queue is full. Try again in a moment.'));
    return new Promise((resolve, reject) => {
      queue.push({ run: () => run().then(resolve).catch(reject) });
      runQueue();
    });
  }

  async function request(storagePrefix, requestType, requestOptions) {
    const settings = getSettings(storagePrefix);
    const sanitizedRequest = sanitizeRequest(requestOptions || {});
    const fetchStart = now();
    if (!settings.apiEnabled || !settings.apiKey) return { ok: false, code: '', error: 'API is disabled or no key is saved.', request: sanitizedRequest, timing: { fetchMs: 0 } };
    const bypassCache = Boolean(requestOptions && requestOptions.bypassCache);
    const cached = bypassCache ? null : getCached(requestType, requestOptions);
    if (cached) return { ok: true, cached: true, data: cached, request: sanitizedRequest, timing: { fetchMs: 0 } };
    return enqueue(async () => {
      const url = buildUrl(requestOptions, settings.apiKey);
      if (url.origin !== baseUrl) return { ok: false, code: '', error: 'Blocked non-Torn API request.', request: sanitizedRequest, timing: { fetchMs: elapsed(fetchStart) } };
      try {
        const response = await fetch(url.toString(), { method: 'GET', credentials: 'omit' });
        const payload = await response.json();
        const fetchMs = elapsed(fetchStart);
        if (!response.ok || payload.error) {
          const apiError = getApiError(payload, response);
          if (isInvalidKeyError(payload)) {
            updateSettings(storagePrefix, { apiEnabled: false, apiStatus: 'invalid', apiLastError: 'Invalid API key. API disabled.', apiLastErrorCode: apiError.code, apiLastRequest: sanitizedRequest });
            notify('warning', 'Torn API disabled', 'Your API key was rejected by Torn, so API access was disabled.');
          } else {
            updateSettings(storagePrefix, { apiStatus: 'error', apiLastError: apiError.message, apiLastErrorCode: apiError.code, apiLastRequest: sanitizedRequest });
          }
          return { ok: false, code: apiError.code, error: apiError.message, rawError: apiError.rawMessage, request: sanitizedRequest, timing: { fetchMs } };
        }
        updateSettings(storagePrefix, { apiStatus: 'ready', apiLastError: '', apiLastErrorCode: '', apiLastRequest: sanitizedRequest });
        setCached(requestType, requestOptions, payload);
        return { ok: true, cached: false, data: payload, request: sanitizedRequest, timing: { fetchMs } };
      } catch (error) {
        const fetchMs = elapsed(fetchStart);
        updateSettings(storagePrefix, { apiStatus: 'error', apiLastError: error.message || 'Network error', apiLastErrorCode: '', apiLastRequest: sanitizedRequest });
        return { ok: false, code: '', error: error.message || 'Network error', request: sanitizedRequest, timing: { fetchMs } };
      }
    });
  }

  function normalizeItemSnapshots(payload) {
    const items = payload && (payload.items || payload.torn && payload.torn.items || payload);
    if (!items || typeof items !== 'object') return [];
    return Object.entries(items).map(([itemId, item]) => ({ itemId: String(itemId), itemName: String(item.name || item.itemName || `Item ${itemId}`), marketPrice: Number(item.market_value || item.marketPrice || item.value || 0), bazaarPrice: item.bazaarPrice ? Number(item.bazaarPrice) : undefined, timestamp: new Date().toISOString(), source: 'api' }));
  }

  function getRawLogContainer(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.log || payload.logs) return payload.log || payload.logs;
    if (payload.user && (payload.user.log || payload.user.logs)) return payload.user.log || payload.user.logs;
    return null;
  }

  function getRawLogCount(payload) {
    const container = getRawLogContainer(payload);
    if (Array.isArray(container)) return container.length;
    if (container && typeof container === 'object') return Object.keys(container).length;
    return 0;
  }

  function topLevelKeys(payload) {
    return payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 20) : [];
  }

  function valueToNumber(value) {
    const parsed = Number(String(value ?? '').replace(/[$,]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function findKnownLogTypeId(raw) {
    const known = new Set(getKnownLogTypeIds().map(Number));
    const fieldNames = ['logTypeId', 'log_type_id', 'log_id', 'logId', 'type', 'type_id', 'category', 'category_id', 'event', 'event_id'];
    const queue = [raw];
    let inspected = 0;
    while (queue.length && inspected < 60) {
      const value = queue.shift();
      inspected += 1;
      if (!value || typeof value !== 'object') continue;
      for (const field of fieldNames) {
        if (Object.prototype.hasOwnProperty.call(value, field)) {
          const id = valueToNumber(value[field]);
          if (known.has(id)) return id;
        }
      }
      ['data', 'params', 'details'].forEach((field) => {
        const next = value[field];
        if (next && typeof next === 'object') queue.push(next);
      });
    }
    return 0;
  }

  function collectUsefulStrings(value, output = [], depth = 0) {
    if (output.length >= 32 || depth > 3 || value === null || value === undefined) return output;
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).replace(/\s+/g, ' ').trim();
      if (text && text.length <= 220) output.push(text);
      return output;
    }
    if (Array.isArray(value)) {
      value.slice(0, 12).forEach((entry) => collectUsefulStrings(entry, output, depth + 1));
      return output;
    }
    if (typeof value === 'object') {
      Object.entries(value).slice(0, 24).forEach(([key, entry]) => {
        if (/key|token|secret|password/i.test(key)) return;
        collectUsefulStrings(entry, output, depth + 1);
      });
    }
    return output;
  }

  function buildLogText(raw) {
    const direct = [raw.message, raw.text, raw.title, raw.log, raw.event, raw.description].find((value) => typeof value === 'string' && value.trim());
    const pieces = [];
    if (direct) pieces.push(direct);
    collectUsefulStrings(raw.data, pieces);
    collectUsefulStrings(raw.params, pieces);
    collectUsefulStrings(raw.details, pieces);
    if (!direct) collectUsefulStrings(raw, pieces);
    return [...new Set(pieces)].join(' | ').replace(/\s+/g, ' ').trim().slice(0, 1200);
  }

  function looksLikeLog(value) {
    return value && typeof value === 'object' && (
      value.timestamp !== undefined || value.time !== undefined || value.date !== undefined || value.created_at !== undefined || value.title !== undefined || value.message !== undefined || value.text !== undefined || value.log !== undefined || value.event !== undefined || value.data !== undefined || value.params !== undefined
    );
  }

  function normalizeLog(rawLog, objectKey) {
    const raw = rawLog && typeof rawLog === 'object' ? rawLog : { message: String(rawLog || '') };
    const entryId = String(raw.entryId || raw.entry_id || raw.id || raw.ID || objectKey || `${raw.timestamp || raw.time || raw.date || Date.now()}-${Math.random().toString(16).slice(2)}`);
    const logTypeId = findKnownLogTypeId(raw);
    const text = buildLogText(raw);
    return {
      entryId,
      id: entryId,
      originalLogId: entryId,
      logTypeId,
      timestamp: raw.timestamp || raw.time || raw.created_at || raw.date || '',
      title: String(raw.title || ''),
      message: text,
      text,
      data: raw.data && typeof raw.data === 'object' ? raw.data : {},
      params: raw.params && typeof raw.params === 'object' ? raw.params : {},
      rawSampleKeys: Object.keys(raw).slice(0, 24),
      rawKeys: Object.keys(raw).slice(0, 24)
    };
  }

  function collectLogs(value, logs = [], key = '') {
    if (!value) return logs;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => collectLogs(entry, logs, index));
      return logs;
    }
    if (looksLikeLog(value)) {
      logs.push(normalizeLog(value, key));
      return logs;
    }
    if (typeof value === 'object') Object.entries(value).forEach(([entryKey, entryValue]) => collectLogs(entryValue, logs, entryKey));
    return logs;
  }

  function normalizeLogs(payload) {
    const normalizeStart = now();
    const container = getRawLogContainer(payload);
    const logs = collectLogs(container || payload);
    return { logs, normalizeMs: elapsed(normalizeStart) };
  }

  function sanitizeLog(log) {
    return { entryId: log.entryId, logTypeId: log.logTypeId || '', timestamp: log.timestamp || '', textPreview: String(log.text || log.message || '').slice(0, 220), rawKeys: log.rawSampleKeys || log.rawKeys || [] };
  }

  function getIdCounts(logs) {
    const buySet = new Set(getBuyLogIds());
    const sellSet = new Set(getSellLogIds());
    return logs.reduce((counts, log) => {
      const id = Number(log.logTypeId);
      if (buySet.has(id)) counts.buyIdMatches += 1;
      if (sellSet.has(id)) counts.sellIdMatches += 1;
      return counts;
    }, { buyIdMatches: 0, sellIdMatches: 0 });
  }

  function buildLogDebug({ result, payload, logs, normalizeMs = 0, strategyUsed, rangeUsed = '' }) {
    const rawLogCount = getRawLogCount(payload);
    const idCounts = getIdCounts(logs);
    return {
      appVersion: getConfig().version || '',
      buyLogIds: getBuyLogIds(),
      sellLogIds: getSellLogIds(),
      requiredLogTypeIds: getKnownLogTypeIds(),
      unfilteredRequestAttempted: true,
      filteredRequestAttempted: false,
      strategyUsed,
      rangeUsed,
      lastEndpoint: result.request && result.request.endpoint,
      lastSelections: result.request && result.request.selections,
      lastParams: result.request && result.request.params,
      responseTopLevelKeys: topLevelKeys(payload),
      rawLogsReturned: rawLogCount,
      normalizedLogs: logs.length,
      logsReturned: logs.length,
      buyIdMatches: idCounts.buyIdMatches,
      sellIdMatches: idCounts.sellIdMatches,
      firstLogs: logs.slice(0, 5).map(sanitizeLog),
      firstLogTexts: logs.slice(0, 5).map((log) => log.text || log.message).filter(Boolean),
      sampleRawKeys: logs[0] ? (logs[0].rawSampleKeys || []) : [],
      normalizerFailed: rawLogCount > 0 && logs.length === 0,
      diagnosticMessage: rawLogCount > 0 && logs.length === 0 ? 'Logs returned but normalizer failed.' : '',
      lastErrorCode: result.code || '',
      lastError: result.error || '',
      classifiedPurchases: 0,
      classifiedSales: 0,
      textBuyMatches: 0,
      textSellMatches: 0,
      duplicatesSkipped: 0,
      purchasesImported: 0,
      salesImported: 0,
      unmatchedSales: 0,
      timings: { fetchMs: result.timing && result.timing.fetchMs || 0, normalizeMs, classifyMs: 0, parseMs: 0, storageSaveMs: 0, totalImportMs: 0 },
      updatedAt: new Date().toISOString()
    };
  }

  async function fetchItemPrices(storagePrefix, { bypassCache = false } = {}) {
    const result = await request(storagePrefix, 'itemPrices', { section: 'torn', selections: 'items', bypassCache });
    if (!result.ok) return result;
    const snapshots = normalizeItemSnapshots(result.data);
    const storageService = getStorageService();
    if (storageService && snapshots.length > 0) storageService.update(storagePrefix, (data) => ({ ...data, itemPriceSnapshots: snapshots }));
    return { ...result, data: snapshots };
  }

  async function fetchUserLogs(storagePrefix, { from = '', to = '', bypassCache = true, rangeUsed = '' } = {}) {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (bypassCache) params._ = Date.now();
    const result = await request(storagePrefix, 'logs', { section: 'user', selections: 'log', params, bypassCache: true });
    if (!result.ok) {
      const debug = buildLogDebug({ result, payload: {}, logs: [], normalizeMs: 0, strategyUsed: Number(result.code) === 16 ? 'failed-permission' : 'failed-other', rangeUsed });
      updateSettings(storagePrefix, { logImportDebug: debug });
      return { ...result, debug, buyLogIds: getBuyLogIds(), sellLogIds: getSellLogIds(), strategyUsed: debug.strategyUsed };
    }
    const normalized = normalizeLogs(result.data);
    const debug = buildLogDebug({ result, payload: result.data, logs: normalized.logs, normalizeMs: normalized.normalizeMs, strategyUsed: 'unfiltered', rangeUsed });
    updateSettings(storagePrefix, { logImportDebug: debug });
    return { ...result, data: normalized.logs, debug, buyLogIds: getBuyLogIds(), sellLogIds: getSellLogIds(), strategyUsed: 'unfiltered' };
  }

  async function testRawUserLogs(storagePrefix) {
    const result = await request(storagePrefix, 'logs', { section: 'user', selections: 'log', params: { _: Date.now() }, bypassCache: true });
    if (!result.ok) {
      const debug = buildLogDebug({ result, payload: {}, logs: [], normalizeMs: 0, strategyUsed: Number(result.code) === 16 ? 'failed-permission' : 'failed-other', rangeUsed: 'raw-unfiltered-no-date' });
      updateSettings(storagePrefix, { logImportDebug: debug });
      return { ...result, debug };
    }
    const normalized = normalizeLogs(result.data);
    const debug = buildLogDebug({ result, payload: result.data, logs: normalized.logs, normalizeMs: normalized.normalizeMs, strategyUsed: 'raw-unfiltered-test', rangeUsed: 'raw-unfiltered-no-date' });
    updateSettings(storagePrefix, { logImportDebug: debug });
    return { ...result, data: normalized.logs, debug };
  }

  async function fetchKeyInfo(storagePrefix, { bypassCache = true } = {}) {
    const result = await request(storagePrefix, 'keyInfo', { section: 'key', selections: 'info', bypassCache });
    const diagnostics = result.ok ? { checkedAt: new Date().toISOString(), keyInfoWorks: true, accessLevel: String(result.data && result.data.access_level || result.data && result.data.key && (result.data.key.access_level || result.data.key.type) || 'Unknown'), userLog: 'unknown', itemPrices: 'unknown', lastErrorCode: '', lastError: '' } : { checkedAt: new Date().toISOString(), keyInfoWorks: false, accessLevel: 'Unknown', userLog: false, itemPrices: false, lastErrorCode: result.code || '', lastError: result.error || 'Could not check key permissions.' };
    updateSettings(storagePrefix, { apiDiagnostics: diagnostics });
    return { ...result, diagnostics };
  }

  function saveApiKey(storagePrefix, apiKey) {
    const key = String(apiKey || '').trim();
    if (!key) {
      updateSettings(storagePrefix, { apiEnabled: false, apiKey: '', apiStatus: 'missing-key', apiLastError: 'Enter an API key before enabling Torn API.', apiLastErrorCode: '' });
      return { ok: false, enabled: false, hasKey: false, maskedKey: '', message: 'Enter an API key before enabling Torn API.' };
    }
    updateSettings(storagePrefix, { apiEnabled: true, apiKey: key, apiStatus: 'saved', apiLastError: '', apiLastErrorCode: '', apiDiagnostics: {} });
    return { ok: true, enabled: true, hasKey: true, maskedKey: maskKey(key), message: 'API key saved locally.' };
  }

  function clearApiKey(storagePrefix) {
    updateSettings(storagePrefix, { apiEnabled: false, apiKey: '', apiStatus: 'disabled', apiLastError: '', apiLastErrorCode: '', apiDiagnostics: {} });
    cache.clear();
    return { ok: true, enabled: false, hasKey: false, maskedKey: '', message: 'API key cleared.' };
  }

  function setEnabled(storagePrefix, enabled) {
    const settings = getSettings(storagePrefix);
    const hasKey = Boolean(settings.apiKey);
    if (enabled && !hasKey) {
      updateSettings(storagePrefix, { apiEnabled: false, apiStatus: 'missing-key', apiLastError: 'Save an API key before enabling Torn API.', apiLastErrorCode: '' });
      return { ok: false, enabled: false, hasKey: false, message: 'Save an API key before enabling Torn API.' };
    }
    updateSettings(storagePrefix, { apiEnabled: Boolean(enabled), apiStatus: enabled ? 'ready' : 'disabled', apiLastError: '', apiLastErrorCode: '' });
    return { ok: true, enabled: Boolean(enabled), hasKey, message: enabled ? 'Torn API enabled.' : 'Torn API disabled.' };
  }

  return {
    clearApiKey,
    fetchItemPrices,
    fetchKeyInfo,
    fetchUserLogs,
    getBuyLogIds,
    getKnownLogTypeIds,
    getSellLogIds,
    getStatus,
    maskKey,
    normalizeLogs,
    request,
    saveApiKey,
    setEnabled,
    testRawUserLogs
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProTornApiService = FlipTrackerProTornApiService;
}
