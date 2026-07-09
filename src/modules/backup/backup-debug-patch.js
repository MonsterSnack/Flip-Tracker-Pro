const FlipTrackerProBackupDebugPatch = (() => {
  function escapeHtml(value) {
    return window.FlipTrackerProHtml && typeof window.FlipTrackerProHtml.escapeHtml === 'function'
      ? window.FlipTrackerProHtml.escapeHtml(value)
      : String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function getConfig() {
    return window.FlipTrackerProConfig || {};
  }

  function getStorageService() {
    return window.FlipTrackerProStorageService;
  }

  function getDebugService() {
    return window.FlipTrackerProLogImportDebugService;
  }

  function getStoredData(storagePrefix) {
    const storageService = getStorageService();
    return storageService && typeof storageService.load === 'function'
      ? storageService.load(storagePrefix)
      : { settings: {} };
  }

  function getDebug(storagePrefix) {
    const data = getStoredData(storagePrefix);
    return data.settings && data.settings.logImportDebug || {};
  }

  function getSamples(storagePrefix) {
    const debug = getDebug(storagePrefix);
    if (Array.isArray(debug.rawRecognizedLogs) && debug.rawRecognizedLogs.length) return debug.rawRecognizedLogs.slice(0, 10);
    if (Array.isArray(debug.firstRecognizedLogs) && debug.firstRecognizedLogs.length) return debug.firstRecognizedLogs.slice(0, 10);
    return [];
  }

  function stringifyCompact(value, maxLength = 420) {
    let text = '';
    try {
      text = JSON.stringify(value === undefined ? null : value);
    } catch (error) {
      text = '[unserializable]';
    }
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  }

  function renderRawPreview(storagePrefix) {
    const samples = getSamples(storagePrefix).slice(0, 3);
    if (!samples.length) {
      return '<div class="ftp-profit-preview" data-raw-recognized-preview><small>No raw recognized log previews yet. Run Raw Log Test or Import latest logs.</small></div>';
    }
    return `
      <div class="ftp-profit-preview" data-raw-recognized-preview>
        <span>Raw recognized log preview</span>
        ${samples.map((log) => `
          <small>${escapeHtml(`${log.entryId || ''} / ${log.logTypeId || ''} / ${log.title || ''}`)}</small>
          <small>Data preview: ${escapeHtml(stringifyCompact(log.rawDataPreview || {}))}</small>
          <small>Params preview: ${escapeHtml(stringifyCompact(log.rawParamsPreview || {}))}</small>
        `).join('')}
      </div>
    `;
  }

  function createRawRecognizedLogsReport(storagePrefix) {
    const debugService = getDebugService();
    if (debugService && typeof debugService.createRawRecognizedLogsReport === 'function') {
      return JSON.stringify(debugService.createRawRecognizedLogsReport(storagePrefix), null, 2);
    }
    const debug = getDebug(storagePrefix);
    return JSON.stringify({
      appVersion: getConfig().version || debug.appVersion || '',
      generatedAt: new Date().toISOString(),
      recognizedLogs: getSamples(storagePrefix).map((log) => ({
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
    }, null, 2);
  }

  function copyText(text, label, eventBus) {
    const value = String(text || '');
    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(value);
      if (eventBus && typeof eventBus.emit === 'function') eventBus.emit('notify', { type: 'success', title: 'Copied', message: `${label} copied.` });
      return;
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(value)
        .then(() => {
          if (eventBus && typeof eventBus.emit === 'function') eventBus.emit('notify', { type: 'success', title: 'Copied', message: `${label} copied.` });
        })
        .catch(() => {
          if (eventBus && typeof eventBus.emit === 'function') eventBus.emit('notify', { type: 'warning', title: 'Copy failed', message: 'Select and copy the text manually.' });
        });
    }
  }

  function ensureRawButton(html) {
    if (html.includes('data-copy-raw-recognized-logs')) return html;
    return html.replace(
      '<button class="ftp-secondary-button" type="button" data-copy-debug-report>Copy debug report</button>',
      '<button class="ftp-secondary-button" type="button" data-copy-debug-report>Copy debug report</button><button class="ftp-secondary-button" type="button" data-copy-raw-recognized-logs>Copy raw recognized logs</button>'
    );
  }

  function ensurePreview(logImportSection, storagePrefix) {
    if (!logImportSection) return;
    const details = logImportSection.querySelector('[data-log-import-debug]');
    if (!details || details.querySelector('[data-raw-recognized-preview]')) return;
    details.insertAdjacentHTML('beforeend', renderRawPreview(storagePrefix));
  }

  function patchBackup() {
    const backup = window.FlipTrackerProBackup;
    if (!backup || backup.__ftpDebugPatchApplied) return false;
    const originalRender = typeof backup.render === 'function' ? backup.render.bind(backup) : null;
    const originalBind = typeof backup.bind === 'function' ? backup.bind.bind(backup) : null;
    if (originalRender) {
      backup.render = (args = {}) => {
        const storagePrefix = args.storagePrefix || '';
        return ensureRawButton(originalRender(args)).replace('</details>', `${renderRawPreview(storagePrefix)}</details>`);
      };
    }
    if (originalBind) {
      backup.bind = (root, options = {}) => {
        originalBind(root, options);
        const storagePrefix = options.storagePrefix || '';
        const logImportSection = root.querySelector('[data-log-import-section]');
        ensurePreview(logImportSection, storagePrefix);
        const copyRawButton = root.querySelector('[data-copy-raw-recognized-logs]');
        if (copyRawButton && !copyRawButton.dataset.ftpRawCopyBound) {
          copyRawButton.dataset.ftpRawCopyBound = 'true';
          copyRawButton.addEventListener('click', () => copyText(createRawRecognizedLogsReport(storagePrefix), 'Raw recognized logs', options.eventBus));
        }
        if (logImportSection && typeof MutationObserver !== 'undefined') {
          const observer = new MutationObserver(() => ensurePreview(logImportSection, storagePrefix));
          observer.observe(logImportSection, { childList: true, subtree: true });
        }
      };
    }
    backup.__ftpDebugPatchApplied = true;
    return true;
  }

  patchBackup();

  return {
    createRawRecognizedLogsReport,
    patchBackup,
    renderRawPreview
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProBackupDebugPatch = FlipTrackerProBackupDebugPatch;
}