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

  function getLogText(log = {}) {
    return String(log.text || log.message || log.title || '').replace(/\s+/g, ' ').trim();
  }

  function getEntryId(log = {}) {
    return String(log.entryId || log.originalLogId || log.id || `${log.timestamp || log.time || Date.now()}-${getLogText(log).slice(0, 80)}`);
  }

  function getLogTimestamp(log = {}) {
    return log.timestamp || log.time || log.created_at || log.createdAt || log.date || '';
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
    const raw = log.raw && typeof log.raw === 'object' ? log.raw : {};
    const rawKeys = Array.isArray(log.rawKeys)
      ? log.rawKeys
      : Array.isArray(log.rawSampleKeys) ? log.rawSampleKeys : Object.keys(raw);
    return {
      entryId: getEntryId(log),
      logTypeId: Number(log.logTypeId) || '',
      timestamp: getLogTimestamp(log) || '',
      title: String(log.title || raw.title || ''),
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

  function mergeRecognizedSamples(storagePrefix, summary, samples) {
    if (!samples.length) return summary;
    const storageService = getStorageService();
    const currentDebug = summary && summary.debug || getStoredDebug(storagePrefix);
    const nextDebug = {
      ...currentDebug,
      appVersion: getConfig().version || currentDebug.appVersion || '',
      firstRecognizedLogs: samples,
      rawRecognizedLogs: samples,
      updatedAt: new Date().toISOString()
    };
    if (storageService && typeof storageService.update === 'function') {
      storageService.update(storagePrefix, (data) => ({
        ...data,
        settings: { ...data.settings, logImportDebug: nextDebug }
      }));
    }
    if (summary) summary.debug = nextDebug;
    return summary;
  }

  async function refreshRecognizedSamples(storagePrefix, summary, options = {}) {
    const tornApiService = getTornApiService();
    if (!tornApiService || typeof tornApiService.fetchUserLogs !== 'function') return summary;
    const hasRichSamples = summary && summary.debug && Array.isArray(summary.debug.rawRecognizedLogs)
      && summary.debug.rawRecognizedLogs.some((log) => log.rawDataPreview !== undefined || log.rawParamsPreview !== undefined);
    if (hasRichSamples) return summary;
    const from = summary && summary.from || options.from || '';
    const to = summary && summary.to || options.to || '';
    const result = await tornApiService.fetchUserLogs(storagePrefix, {
      from,
      to,
      bypassCache: true,
      rangeUsed: 'debug-recognized-sample-refresh'
    });
    if (!result.ok || !Array.isArray(result.data)) return summary;
    return mergeRecognizedSamples(storagePrefix, summary, summarizeRecognizedLogs(result.data));
  }

  function patchLogImportService() {
    const service = getLogImportService();
    if (!service || service.__ftpDebugSamplePatched) return false;
    const originalImportLogs = typeof service.importLogs === 'function' ? service.importLogs.bind(service) : null;
    service.sanitizeDebugValue = sanitizeDebugValue;
    service.summarizeRecognizedLogs = summarizeRecognizedLogs;
    service.createRawRecognizedLogsReport = createRawRecognizedLogsReport;
    if (originalImportLogs) {
      service.importLogs = async (storagePrefix, options = {}) => {
        const summary = await originalImportLogs(storagePrefix, options);
        try {
          return await refreshRecognizedSamples(storagePrefix, summary, options);
        } catch (error) {
          return summary;
        }
      };
    }
    service.__ftpDebugSamplePatched = true;
    return true;
  }

  patchLogImportService();

  return {
    createRawRecognizedLogsReport,
    patchLogImportService,
    sanitizeDebugValue,
    summarizeRecognizedLogs
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProLogImportDebugService = FlipTrackerProLogImportDebugService;
}