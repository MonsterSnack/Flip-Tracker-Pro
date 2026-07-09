const FlipTrackerProTornApiService = (() => {
  const baseUrl = 'https://api.torn.com';
  const customKeyBuilderFallbackUrl = 'https://www.torn.com/preferences.php#tab=api';
  const maxQueueSize = 8;
  const minDelayMs = 750;
  const cacheTtls = Object.freeze({
    itemPrices: 5 * 60 * 1000,
    keyInfo: 60 * 1000,
    logs: 30 * 1000,
    status: 30 * 1000,
    default: 60 * 1000
  });
  const cache = new Map();
  const queue = [];
  let activeRequest = false;
  let lastRequestAt = 0;

  function getConfig() {
    return window.FlipTrackerProConfig || {};
  }

  function getRequiredLogTypeIds() {
    const config = getConfig();
    return Array.isArray(config.requiredLogTypeIds) ? config.requiredLogTypeIds.map(Number).filter(Boolean) : [1225, 1220, 4201, 1112, 4200, 5927, 5510];
  }

  function getStorageService() {
    return window.FlipTrackerProStorageService;
  }

  function getEventBus() {
    return window.FlipTrackerProEventBus;
  }

  function getSettings(storagePrefix) {
    const storageService = getStorageService();
    const data = storageService && typeof storageService.load === 'function'
      ? storageService.load(storagePrefix)
      : { settings: {} };
    return data.settings || {};
  }

  function updateSettings(storagePrefix, patch) {
    const storageService = getStorageService();

    if (storageService && typeof storageService.update === 'function') {
      return storageService.update(storagePrefix, (data) => ({
        ...data,
        settings: {
          ...data.settings,
          ...patch
        }
      }));
    }

    return { settings: getSettings(storagePrefix) };
  }

  function notify(type, title, message) {
    const eventBus = getEventBus();

    if (eventBus && typeof eventBus.emit === 'function') {
      eventBus.emit('notify', { type, title, message });
    }
  }

  function maskKey(apiKey) {
    if (!apiKey) {
      return '';
    }

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
      requiredLogTypeIds: getRequiredLogTypeIds(),
      status: settings.apiStatus || (enabled ? 'ready' : 'disabled')
    };
  }

  function getCustomKeyBuilderUrl() {
    return customKeyBuilderFallbackUrl;
  }

  function buildUrl({ section = 'torn', id = '', selections = '', params = {} } = {}, apiKey) {
    const safeSection = String(section || 'torn').replace(/[^a-z_]/gi, '');
    const safeId = String(id || '').replace(/[^a-z0-9_-]/gi, '');
    const path = safeId ? `/${safeSection}/${safeId}` : `/${safeSection}`;
    const url = new URL(path, baseUrl);

    if (selections) {
      url.searchParams.set('selections', String(selections));
    }

    Object.entries(params || {}).forEach(([key, value]) => {
      const safeKey = String(key || '').replace(/[^a-z_]/gi, '');

      if (!safeKey || value === undefined || value === null || value === '') {
        return;
      }

      url.searchParams.set(safeKey, String(value));
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
    const message = code === 16 || rawMessage.toLowerCase().includes('access level of this key is not high enough')
      ? 'This key does not have permission for user -> log, or the selected log categories/types do not include item market/bazaar/trade logs.'
      : rawMessage;

    return { code, message, rawMessage };
  }

  function isInvalidKeyError(errorPayload) {
    const error = errorPayload && errorPayload.error;
    const code = Number(error && error.code);
    const message = String((error && error.error) || (error && error.message) || '').toLowerCase();
    return code === 2 || message.includes('incorrect key') || message.includes('invalid key');
  }

  function getCacheKey(requestType, request) {
    return JSON.stringify({ requestType, section: request.section, id: request.id, selections: request.selections, params: request.params || {} });
  }

  function getCached(requestType, request) {
    const cached = cache.get(getCacheKey(requestType, request));
    const ttl = cacheTtls[requestType] || cacheTtls.default;

    if (!cached || Date.now() - cached.timestamp > ttl) {
      return null;
    }

    return cached.data;
  }

  function setCached(requestType, request, data) {
    cache.set(getCacheKey(requestType, request), {
      data,
      timestamp: Date.now()
    });
  }

  function runQueue() {
    if (activeRequest || queue.length === 0) {
      return;
    }

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
    if (queue.length >= maxQueueSize) {
      return Promise.reject(new Error('Request queue is full. Try again in a moment.'));
    }

    return new Promise((resolve, reject) => {
      queue.push({
        run: () => run().then(resolve).catch(reject)
      });
      runQueue();
    });
  }

  async function request(storagePrefix, requestType, requestOptions) {
    const settings = getSettings(storagePrefix);
    const sanitizedRequest = sanitizeRequest(requestOptions || {});

    if (!settings.apiEnabled || !settings.apiKey) {
      return { ok: false, code: '', error: 'API is disabled or no key is saved.', request: sanitizedRequest };
    }

    const bypassCache = Boolean(requestOptions && requestOptions.bypassCache);
    const cached = bypassCache ? null : getCached(requestType, requestOptions);

    if (cached) {
      return { ok: true, cached: true, data: cached, request: sanitizedRequest };
    }

    return enqueue(async () => {
      const url = buildUrl(requestOptions, settings.apiKey);

      if (url.origin !== baseUrl) {
        return { ok: false, code: '', error: 'Blocked non-Torn API request.', request: sanitizedRequest };
      }

      try {
        const response = await fetch(url.toString(), { method: 'GET', credentials: 'omit' });
        const payload = await response.json();

        if (!response.ok || payload.error) {
          const apiError = getApiError(payload, response);

          if (isInvalidKeyError(payload)) {
            updateSettings(storagePrefix, {
              apiEnabled: false,
              apiStatus: 'invalid',
              apiLastError: 'Invalid API key. API disabled.',
              apiLastErrorCode: apiError.code,
              apiLastRequest: sanitizedRequest
            });
            notify('warning', 'Torn API disabled', 'Your API key was rejected by Torn, so API access was disabled.');
          } else {
            updateSettings(storagePrefix, {
              apiStatus: 'error',
              apiLastError: apiError.message,
              apiLastErrorCode: apiError.code,
              apiLastRequest: sanitizedRequest
            });
          }

          return {
            ok: false,
            code: apiError.code,
            error: apiError.message,
            rawError: apiError.rawMessage,
            request: sanitizedRequest
          };
        }

        updateSettings(storagePrefix, {
          apiStatus: 'ready',
          apiLastError: '',
          apiLastErrorCode: '',
          apiLastRequest: sanitizedRequest
        });
        setCached(requestType, requestOptions, payload);
        return { ok: true, cached: false, data: payload, request: sanitizedRequest };
      } catch (error) {
        updateSettings(storagePrefix, {
          apiStatus: 'error',
          apiLastError: error.message || 'Network error',
          apiLastErrorCode: '',
          apiLastRequest: sanitizedRequest
        });
        return { ok: false, code: '', error: error.message || 'Network error', request: sanitizedRequest };
      }
    });
  }

  function normalizeItemSnapshots(payload) {
    const items = payload && (payload.items || payload.torn && payload.torn.items || payload);

    if (!items || typeof items !== 'object') {
      return [];
    }

    return Object.entries(items).map(([itemId, item]) => ({
      itemId: String(itemId),
      itemName: String(item.name || item.itemName || `Item ${itemId}`),
      marketPrice: Number(item.market_value || item.marketPrice || item.value || 0),
      bazaarPrice: item.bazaarPrice ? Number(item.bazaarPrice) : undefined,
      timestamp: new Date().toISOString(),
      source: 'api'
    }));
  }

  function looksLikeLog(value) {
    return value && typeof value === 'object' && (
      value.timestamp !== undefined || value.time !== undefined || value.title !== undefined || value.message !== undefined || value.text !== undefined || value.log !== undefined
    );
  }

  function getLogMessage(log) {
    return String(log.message || log.text || log.title || log.event || log.log || log.data || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeLog(log, id) {
    const raw = log && typeof log === 'object' ? log : { message: String(log || '') };
    const message = getLogMessage(raw);

    return {
      id: String(raw.id || raw.log_id || raw.logId || id || `${raw.timestamp || raw.time || Date.now()}-${message}`),
      timestamp: raw.timestamp || raw.time || raw.created_at || raw.date || '',
      type: raw.type || raw.category || raw.cat || raw.logType || raw.log_id || raw.logId || '',
      category: raw.category || raw.cat || raw.type || '',
      logId: raw.logId || raw.log_id || raw.type || raw.category || '',
      title: String(raw.title || ''),
      message,
      raw
    };
  }

  function collectLogs(value, logs = [], key = '') {
    if (!value) {
      return logs;
    }

    if (Array.isArray(value)) {
      value.forEach((entry, index) => collectLogs(entry, logs, index));
      return logs;
    }

    if (looksLikeLog(value)) {
      logs.push(normalizeLog(value, key));
      return logs;
    }

    if (typeof value === 'object') {
      Object.entries(value).forEach(([entryKey, entryValue]) => collectLogs(entryValue, logs, entryKey));
    }

    return logs;
  }

  function normalizeLogs(payload) {
    if (!payload || typeof payload !== 'object') {
      return [];
    }

    if (payload.log || payload.logs) {
      return collectLogs(payload.log || payload.logs);
    }

    if (payload.user && (payload.user.log || payload.user.logs)) {
      return collectLogs(payload.user.log || payload.user.logs);
    }

    return collectLogs(payload);
  }

  function getSelectionStrings(payload) {
    const source = payload && (payload.selections || payload.access || payload.permissions || payload.key && (payload.key.selections || payload.key.access));
    const values = [];

    function collect(value, prefix = '') {
      if (!value) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((entry) => collect(entry, prefix));
        return;
      }

      if (typeof value === 'object') {
        Object.entries(value).forEach(([key, entry]) => collect(entry, prefix ? `${prefix}.${key}` : key));
        return;
      }

      values.push(prefix ? `${prefix}.${String(value)}` : String(value));
    }

    collect(source);
    return values.map((value) => value.toLowerCase());
  }

  function hasSelection(selections, section, selection) {
    const sectionValue = String(section).toLowerCase();
    const selectionValue = String(selection).toLowerCase();
    return selections.some((value) => value.includes(`${sectionValue}.${selectionValue}`) || value.includes(`${sectionValue}:${selectionValue}`) || value === selectionValue || value.endsWith(`.${selectionValue}`));
  }

  function normalizeKeyInfo(payload) {
    const keyInfo = payload && (payload.key || payload.info || payload);
    const selections = getSelectionStrings(payload);
    const accessLevel = String(
      keyInfo && (keyInfo.access_level || keyInfo.accessLevel || keyInfo.type || keyInfo.level || keyInfo.access)
      || payload && (payload.access_level || payload.accessLevel)
      || 'Unknown'
    );

    return {
      checkedAt: new Date().toISOString(),
      keyInfoWorks: true,
      accessLevel,
      selections: selections.slice(0, 60),
      userLog: selections.length ? hasSelection(selections, 'user', 'log') : 'unknown',
      itemPrices: selections.length ? (hasSelection(selections, 'torn', 'items') || hasSelection(selections, 'market', 'itemmarket')) : 'unknown',
      marketItem: selections.length ? hasSelection(selections, 'market', 'itemmarket') : 'unknown',
      lastErrorCode: '',
      lastError: ''
    };
  }

  function getLogStrategy(result, attemptedFiltering) {
    if (result.ok) {
      return attemptedFiltering ? 'filtered-by-log-ids' : 'fallback-unfiltered';
    }

    if (Number(result.code) === 16) {
      return 'failed-permission';
    }

    if (Number(result.code) === 28) {
      return 'failed-invalid-log-id';
    }

    return 'failed-other';
  }

  function buildLogDebug(result, logs, attemptedFiltering, requiredLogIds) {
    return {
      requiredLogTypeIds: requiredLogIds,
      logIdFilteringAttempted: Boolean(attemptedFiltering),
      strategyUsed: getLogStrategy(result, attemptedFiltering),
      lastEndpoint: result.request && result.request.endpoint,
      lastSelections: result.request && result.request.selections,
      lastParams: result.request && result.request.params,
      lastErrorCode: result.code || '',
      lastError: result.error || '',
      rawLogsReturned: Array.isArray(logs) ? logs.length : 0,
      normalizedLogs: Array.isArray(logs) ? logs.length : 0,
      logsReturned: Array.isArray(logs) ? logs.length : 0,
      classifiedPurchases: 0,
      classifiedSales: 0,
      duplicatesSkipped: 0,
      purchasesImported: 0,
      salesImported: 0,
      unmatchedSales: 0,
      updatedAt: new Date().toISOString()
    };
  }

  async function fetchItemPrices(storagePrefix, { bypassCache = false } = {}) {
    const result = await request(storagePrefix, 'itemPrices', {
      section: 'torn',
      selections: 'items',
      bypassCache
    });

    if (!result.ok) {
      return result;
    }

    const snapshots = normalizeItemSnapshots(result.data);
    const storageService = getStorageService();

    if (storageService && snapshots.length > 0) {
      storageService.update(storagePrefix, (data) => ({
        ...data,
        itemPriceSnapshots: snapshots
      }));
    }

    return { ...result, data: snapshots };
  }

  async function fetchUserLogs(storagePrefix, { from = '', to = '', bypassCache = true } = {}) {
    const requiredLogIds = getRequiredLogTypeIds();
    const baseParams = {};

    if (from) {
      baseParams.from = from;
    }

    if (to) {
      baseParams.to = to;
    }

    if (bypassCache) {
      baseParams._ = Date.now();
    }

    const filteredResult = await request(storagePrefix, 'logs', {
      section: 'user',
      selections: 'log',
      params: {
        ...baseParams,
        log: requiredLogIds.join(',')
      },
      bypassCache
    });

    let result = filteredResult;
    let attemptedFiltering = true;

    if (!filteredResult.ok && Number(filteredResult.code) === 28) {
      result = await request(storagePrefix, 'logs', {
        section: 'user',
        selections: 'log',
        params: baseParams,
        bypassCache: true
      });
      attemptedFiltering = false;
    }

    if (!result.ok) {
      const debug = buildLogDebug(result, [], attemptedFiltering, requiredLogIds);
      updateSettings(storagePrefix, { logImportDebug: debug });
      return { ...result, debug, requiredLogTypeIds: requiredLogIds, strategyUsed: debug.strategyUsed };
    }

    const logs = normalizeLogs(result.data);
    const debug = buildLogDebug(result, logs, attemptedFiltering, requiredLogIds);
    updateSettings(storagePrefix, { logImportDebug: debug });

    return { ...result, data: logs, debug, requiredLogTypeIds: requiredLogIds, strategyUsed: debug.strategyUsed };
  }

  async function fetchKeyInfo(storagePrefix, { bypassCache = true } = {}) {
    const result = await request(storagePrefix, 'keyInfo', {
      section: 'key',
      selections: 'info',
      bypassCache
    });

    if (!result.ok) {
      const diagnostics = {
        checkedAt: new Date().toISOString(),
        keyInfoWorks: false,
        accessLevel: 'Unknown',
        selections: [],
        userLog: false,
        itemPrices: false,
        marketItem: false,
        lastErrorCode: result.code || '',
        lastError: result.error || 'Could not check key permissions.'
      };
      updateSettings(storagePrefix, { apiDiagnostics: diagnostics });
      return { ...result, diagnostics };
    }

    const diagnostics = normalizeKeyInfo(result.data);
    updateSettings(storagePrefix, { apiDiagnostics: diagnostics });
    return { ...result, diagnostics };
  }

  function saveApiKey(storagePrefix, apiKey) {
    const key = String(apiKey || '').trim();

    if (!key) {
      updateSettings(storagePrefix, {
        apiEnabled: false,
        apiKey: '',
        apiStatus: 'missing-key',
        apiLastError: 'Enter an API key before enabling Torn API.',
        apiLastErrorCode: ''
      });
      return {
        ok: false,
        enabled: false,
        hasKey: false,
        maskedKey: '',
        message: 'Enter an API key before enabling Torn API.'
      };
    }

    updateSettings(storagePrefix, {
      apiEnabled: true,
      apiKey: key,
      apiStatus: 'saved',
      apiLastError: '',
      apiLastErrorCode: '',
      apiDiagnostics: {}
    });

    return {
      ok: true,
      enabled: true,
      hasKey: true,
      maskedKey: maskKey(key),
      message: 'API key saved locally.'
    };
  }

  function clearApiKey(storagePrefix) {
    updateSettings(storagePrefix, {
      apiEnabled: false,
      apiKey: '',
      apiStatus: 'disabled',
      apiLastError: '',
      apiLastErrorCode: '',
      apiDiagnostics: {}
    });
    cache.clear();

    return {
      ok: true,
      enabled: false,
      hasKey: false,
      maskedKey: '',
      message: 'API key cleared.'
    };
  }

  function setEnabled(storagePrefix, enabled) {
    const settings = getSettings(storagePrefix);
    const hasKey = Boolean(settings.apiKey);

    if (enabled && !hasKey) {
      updateSettings(storagePrefix, {
        apiEnabled: false,
        apiStatus: 'missing-key',
        apiLastError: 'Save an API key before enabling Torn API.',
        apiLastErrorCode: ''
      });
      return {
        ok: false,
        enabled: false,
        hasKey: false,
        message: 'Save an API key before enabling Torn API.'
      };
    }

    updateSettings(storagePrefix, {
      apiEnabled: Boolean(enabled),
      apiStatus: enabled ? 'ready' : 'disabled',
      apiLastError: '',
      apiLastErrorCode: ''
    });

    return {
      ok: true,
      enabled: Boolean(enabled),
      hasKey,
      message: enabled ? 'Torn API enabled.' : 'Torn API disabled.'
    };
  }

  return {
    clearApiKey,
    fetchItemPrices,
    fetchKeyInfo,
    fetchUserLogs,
    getCustomKeyBuilderUrl,
    getRequiredLogTypeIds,
    getStatus,
    maskKey,
    request,
    saveApiKey,
    setEnabled
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProTornApiService = FlipTrackerProTornApiService;
}
