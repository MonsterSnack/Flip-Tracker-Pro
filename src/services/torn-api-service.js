const FlipTrackerProTornApiService = (() => {
  const baseUrl = 'https://api.torn.com';
  const maxQueueSize = 8;
  const minDelayMs = 750;
  const cacheTtls = Object.freeze({
    itemPrices: 5 * 60 * 1000,
    status: 30 * 1000,
    default: 60 * 1000
  });
  const cache = new Map();
  const queue = [];
  let activeRequest = false;
  let lastRequestAt = 0;

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
      storageService.update(storagePrefix, (data) => ({
        ...data,
        settings: {
          ...data.settings,
          ...patch
        }
      }));
    }
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

    if (!settings.apiEnabled) {
      return { enabled: false, label: 'Disabled', status: 'disabled' };
    }

    if (!settings.apiKey) {
      return { enabled: false, label: 'Missing API key', status: 'missing-key' };
    }

    return {
      enabled: true,
      label: settings.apiStatus === 'invalid' ? 'Invalid key' : 'Ready',
      maskedKey: maskKey(settings.apiKey),
      status: settings.apiStatus || 'ready'
    };
  }

  function buildUrl({ section = 'torn', id = '', selections = '' } = {}, apiKey) {
    const safeSection = String(section || 'torn').replace(/[^a-z_]/gi, '');
    const safeId = String(id || '').replace(/[^a-z0-9_-]/gi, '');
    const path = safeId ? `/${safeSection}/${safeId}` : `/${safeSection}`;
    const url = new URL(path, baseUrl);

    if (selections) {
      url.searchParams.set('selections', String(selections));
    }

    url.searchParams.set('key', apiKey);
    return url;
  }

  function isInvalidKeyError(errorPayload) {
    const error = errorPayload && errorPayload.error;
    const code = Number(error && error.code);
    const message = String((error && error.error) || (error && error.message) || '').toLowerCase();
    return code === 2 || message.includes('incorrect key') || message.includes('invalid key');
  }

  function getCacheKey(requestType, request) {
    return JSON.stringify({ requestType, section: request.section, id: request.id, selections: request.selections });
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

    if (!settings.apiEnabled || !settings.apiKey) {
      return { ok: false, error: 'API is disabled or no key is saved.' };
    }

    const cached = getCached(requestType, requestOptions);

    if (cached) {
      return { ok: true, cached: true, data: cached };
    }

    return enqueue(async () => {
      const url = buildUrl(requestOptions, settings.apiKey);

      if (url.origin !== baseUrl) {
        return { ok: false, error: 'Blocked non-Torn API request.' };
      }

      try {
        const response = await fetch(url.toString(), { method: 'GET', credentials: 'omit' });
        const payload = await response.json();

        if (!response.ok || payload.error) {
          if (isInvalidKeyError(payload)) {
            updateSettings(storagePrefix, {
              apiEnabled: false,
              apiStatus: 'invalid',
              apiLastError: 'Invalid API key. API disabled.'
            });
            notify('warning', 'Torn API disabled', 'Your API key was rejected by Torn, so API access was disabled.');
          }

          return {
            ok: false,
            error: payload.error ? (payload.error.error || payload.error.message || 'Torn API error') : `Torn API error ${response.status}`
          };
        }

        updateSettings(storagePrefix, { apiStatus: 'ready', apiLastError: '' });
        setCached(requestType, requestOptions, payload);
        return { ok: true, cached: false, data: payload };
      } catch (error) {
        updateSettings(storagePrefix, { apiStatus: 'error', apiLastError: error.message || 'Network error' });
        return { ok: false, error: error.message || 'Network error' };
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

  async function fetchItemPrices(storagePrefix) {
    const result = await request(storagePrefix, 'itemPrices', {
      section: 'torn',
      selections: 'items'
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

  function saveApiKey(storagePrefix, apiKey) {
    updateSettings(storagePrefix, {
      apiEnabled: true,
      apiKey: String(apiKey || '').trim(),
      apiStatus: String(apiKey || '').trim() ? 'saved' : 'missing-key',
      apiLastError: ''
    });
  }

  function clearApiKey(storagePrefix) {
    updateSettings(storagePrefix, {
      apiEnabled: false,
      apiKey: '',
      apiStatus: 'disabled',
      apiLastError: ''
    });
    cache.clear();
  }

  function setEnabled(storagePrefix, enabled) {
    updateSettings(storagePrefix, {
      apiEnabled: Boolean(enabled),
      apiStatus: enabled ? 'saved' : 'disabled'
    });
  }

  return {
    clearApiKey,
    fetchItemPrices,
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
