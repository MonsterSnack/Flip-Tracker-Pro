const FlipTrackerProBackup = (() => {
  function escapeHtml(value) {
    return window.FlipTrackerProHtml && typeof window.FlipTrackerProHtml.escapeHtml === 'function'
      ? window.FlipTrackerProHtml.escapeHtml(value)
      : String(value ?? '');
  }

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
    return Array.isArray(config.buyLogIds) ? config.buyLogIds : [1225, 1220, 4201, 1112, 1103, 4200, 5927, 5510];
  }

  function getSellLogIds() {
    const config = getConfig();
    return Array.isArray(config.sellLogIds) ? config.sellLogIds : [1226, 1221, 1113, 1104, 4210, 5928, 5511];
  }

  function getStoredData(storagePrefix) {
    const storageService = getStorageService();
    return storageService && typeof storageService.load === 'function' ? storageService.load(storagePrefix) : { settings: {}, importReviewQueue: [] };
  }

  function getStoredSettings(storagePrefix) {
    return getStoredData(storagePrefix).settings || {};
  }

  function getApiState(storagePrefix) {
    const tornApiService = getTornApiService();
    if (tornApiService && typeof tornApiService.getStatus === 'function') return tornApiService.getStatus(storagePrefix);
    const settings = getStoredSettings(storagePrefix);
    const hasKey = Boolean(settings.apiKey);
    return { connected: Boolean(settings.apiEnabled && hasKey), diagnostics: settings.apiDiagnostics || {}, enabled: Boolean(settings.apiEnabled && hasKey), hasKey, lastError: settings.apiLastError || '', lastErrorCode: settings.apiLastErrorCode || '', maskedKey: hasKey ? 'Saved' : '', status: hasKey && settings.apiEnabled ? 'ready' : 'disabled' };
  }

  function getLogImportDebug(storagePrefix) {
    return getStoredSettings(storagePrefix).logImportDebug || {};
  }

  function getReviewQueue(storagePrefix) {
    const data = getStoredData(storagePrefix);
    return Array.isArray(data.importReviewQueue) ? data.importReviewQueue : [];
  }

  function getLastImportText(storagePrefix) {
    const value = getStoredSettings(storagePrefix).logImportLastRunAt;
    if (!value) return 'Log import has not run yet.';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Last import date is unknown.' : `Last import ${date.toLocaleString()}.`;
  }

  function getBackupFileName() {
    return `flip-tracker-pro-backup-${new Date().toISOString().slice(0, 10)}.json`;
  }

  function getStatus(status, message) {
    return message ? `<p class="ftp-status" data-status="${escapeHtml(status)}">${escapeHtml(message)}</p>` : '';
  }

  function renderApiDiagnostics(apiState) {
    const diagnostics = apiState.diagnostics || {};
    return `
      <div class="ftp-profit-preview" data-api-diagnostics>
        <span>API diagnostics</span>
        <small>Overall API: ${escapeHtml(apiState.connected ? 'API connected' : apiState.hasKey ? 'Key saved, API not connected' : 'Not connected')}</small>
        <small>Log API: ${escapeHtml(diagnostics.logApiStatus || 'Test with Raw Log Test')}</small>
        <small>Item price API: ${escapeHtml(diagnostics.itemPriceApiStatus || 'Not checked')}</small>
        <small>Key diagnostics: ${escapeHtml(diagnostics.keyDiagnosticsStatus || diagnostics.keyInfoWorks ? 'Checked' : 'Not checked yet')}</small>
        <small>Key access level: ${escapeHtml(diagnostics.accessLevel || 'Unknown')}</small>
        <small>Last API error: ${escapeHtml(String(apiState.lastErrorCode || diagnostics.lastErrorCode || 'None'))} ${escapeHtml(apiState.lastError || diagnostics.lastError || 'None')}</small>
      </div>
    `;
  }

  function renderImportSummary(summary) {
    if (!summary) return '';
    const diagnostic = summary.diagnosticMessage ? `<small>${escapeHtml(summary.diagnosticMessage)}</small>` : '';
    const warnings = Array.isArray(summary.warnings) && summary.warnings.length ? `<small>${summary.warnings.map(escapeHtml).join(' | ')}</small>` : '';
    const errors = Array.isArray(summary.errors) && summary.errors.length ? `<small>${summary.errors.map(escapeHtml).join(' | ')}</small>` : '';
    const progress = summary.progress ? `<small>Processed ${summary.progress.processed || 0}/${summary.progress.total || 0} logs.</small>` : '';
    return `
      <div class="ftp-profit-preview" data-log-import-summary>
        <span>Import summary</span>
        <small>Purchases ${summary.purchasesImported || 0} / Sales ${summary.salesImported || 0} / Duplicates ${summary.duplicatesSkipped || 0} / Unmatched sales ${summary.unmatchedSales || 0}</small>
        <small>Needs review ${summary.reviewCandidatesCreated || 0} / Parser failures ${summary.parserFailures || 0} / Validation failures ${summary.validationFailures || 0}</small>
        ${progress}${diagnostic}${warnings}${errors}
      </div>
    `;
  }

  function renderReviewQueue(storagePrefix) {
    const items = getReviewQueue(storagePrefix).slice(0, 5);
    if (!items.length) return '<small>Needs review: 0</small>';
    return `<small>Needs review: ${escapeHtml(getReviewQueue(storagePrefix).length)}</small>${items.map((item) => `<small>${escapeHtml(`${item.type || ''} / ${item.entryId || ''} / ${item.logTypeId || ''} / ${item.reason || ''} / ${item.textPreview || ''}`)}</small>`).join('')}`;
  }

  function renderLogImportDebug(debug = {}, storagePrefix = '') {
    const params = debug.lastParams && typeof debug.lastParams === 'object' ? JSON.stringify(debug.lastParams) : '{}';
    const samples = Array.isArray(debug.firstRecognizedLogs) && debug.firstRecognizedLogs.length ? debug.firstRecognizedLogs.slice(0, 5) : Array.isArray(debug.firstLogs) ? debug.firstLogs.slice(0, 5) : [];
    const sampleHtml = samples.map((log) => `<small>${escapeHtml(`${log.entryId || ''} / ${log.logTypeId || ''} / ${log.timestamp || ''} / ${log.textPreview || ''} / keys: ${(log.rawKeys || []).join(', ')}`)}</small>`).join('');
    const timings = debug.timings || {};
    return `
      <details class="ftp-profit-preview" data-log-import-debug>
        <summary>Import debug</summary>
        <small>Strategy: ${escapeHtml(debug.strategyUsed || 'Not requested yet')} / Range: ${escapeHtml(debug.rangeUsed || 'Not requested yet')}</small>
        <small>Endpoint: ${escapeHtml(debug.lastEndpoint || 'Not requested yet')} / Params: ${escapeHtml(params)}</small>
        <small>Raw logs: ${escapeHtml(debug.rawLogsReturned || 0)} / Normalized: ${escapeHtml(debug.normalizedLogs || 0)}</small>
        <small>Recognized buy IDs: ${escapeHtml(debug.buyIdMatches || 0)} / Recognized sell IDs: ${escapeHtml(debug.sellIdMatches || 0)}</small>
        <small>Text buy matches: ${escapeHtml(debug.textBuyMatches || 0)} / Text sell matches: ${escapeHtml(debug.textSellMatches || 0)}</small>
        <small>Classified buys: ${escapeHtml(debug.classifiedPurchases || 0)} / Classified sells: ${escapeHtml(debug.classifiedSales || 0)}</small>
        <small>Buy candidates: ${escapeHtml(debug.buyCandidatesCreated || 0)} / Sell candidates: ${escapeHtml(debug.sellCandidatesCreated || 0)}</small>
        <small>Purchases imported: ${escapeHtml(debug.purchasesImported || 0)} / Sales imported: ${escapeHtml(debug.salesImported || 0)}</small>
        <small>Purchases saved: ${escapeHtml(debug.purchasesSaved || 0)} / Sales saved: ${escapeHtml(debug.salesSaved || 0)}</small>
        <small>Duplicates: ${escapeHtml(debug.duplicatesSkipped || 0)} / Unmatched: ${escapeHtml(debug.unmatchedSales || 0)}</small>
        <small>Needs review: ${escapeHtml(debug.reviewCandidatesCreated || 0)} / Parser failures: ${escapeHtml(debug.parserFailures || 0)} / Validation failures: ${escapeHtml(debug.validationFailures || 0)}</small>
        <small>Timings ms: fetch ${escapeHtml(timings.fetchMs || 0)} / normalize ${escapeHtml(timings.normalizeMs || 0)} / classify ${escapeHtml(timings.classifyMs || 0)} / parse ${escapeHtml(timings.parseMs || 0)} / save ${escapeHtml(timings.storageSaveMs || 0)} / total ${escapeHtml(timings.totalImportMs || 0)}</small>
        <small>Sample raw keys: ${escapeHtml((debug.sampleRawKeys || []).join(', ') || 'None')}</small>
        ${sampleHtml || '<small>No sanitized sample logs yet.</small>'}
        ${storagePrefix ? renderReviewQueue(storagePrefix) : ''}
        <small>${escapeHtml(debug.diagnosticMessage || '')}</small>
      </details>
    `;
  }

  function renderApiSettings(storagePrefix) {
    const apiState = getApiState(storagePrefix);
    const statusText = apiState.lastError || (apiState.connected ? 'API connected' : apiState.hasKey ? 'API key saved, currently disabled or unchecked' : 'No API key saved');
    const statusKind = apiState.status === 'error' || apiState.lastError ? 'error' : apiState.connected ? 'success' : 'info';
    return `
      <section class="ftp-card" data-api-settings-section>
        <h2>Torn API</h2>
        <p>Use a Torn Full Access API key. Flip Tracker Pro stores it locally in your browser only and only sends it to Torn API endpoints. No Torn password is ever required.</p>
        <div class="ftp-profit-preview">
          <span>Log import IDs</span>
          <small>Buy IDs: ${escapeHtml(getBuyLogIds().join(', '))}</small>
          <small>Sell IDs: ${escapeHtml(getSellLogIds().join(', '))}</small>
        </div>
        <label class="ftp-field"><span>API enabled</span><select class="ftp-input" data-api-enabled><option value="false" ${apiState.enabled ? '' : 'selected'}>Off</option><option value="true" ${apiState.enabled ? 'selected' : ''}>On</option></select></label>
        <div class="ftp-form-grid">
          <label class="ftp-field"><span>API key</span><input class="ftp-input" data-api-key-input type="password" autocomplete="off" placeholder="${escapeHtml(apiState.maskedKey || 'Paste Full Access API key')}"></label>
          <label class="ftp-field"><span>Status</span><input class="ftp-input" type="text" value="${escapeHtml(statusText)}" readonly data-api-status></label>
        </div>
        <div class="ftp-form-actions ftp-backup-actions">
          <button class="ftp-primary-button" type="button" data-save-api-key>Save API key</button>
          <button class="ftp-secondary-button" type="button" data-check-api-key>Check API</button>
          <button class="ftp-secondary-button" type="button" data-refresh-api-prices>Refresh item prices</button>
          <button class="ftp-danger-button" type="button" data-clear-api-key>Clear API key</button>
        </div>
        <p class="ftp-status" data-status="${statusKind}" data-api-status-message>${escapeHtml(statusText)}</p>
        ${renderApiDiagnostics(apiState)}
      </section>
    `;
  }

  function renderLogImport(storagePrefix, importSummary) {
    const debug = importSummary && importSummary.debug ? importSummary.debug : getLogImportDebug(storagePrefix);
    return `
      <section class="ftp-card" data-log-import-section>
        <h2>Import Logs</h2>
        <p>Import latest logs checks the last 24 hours first, then tries the last 7 days if no raw logs are returned.</p>
        <div class="ftp-form-grid">
          <label class="ftp-field"><span>Import from</span><input class="ftp-input" type="date" data-log-import-from></label>
          <label class="ftp-field"><span>Import to</span><input class="ftp-input" type="date" data-log-import-to></label>
        </div>
        <div class="ftp-form-actions ftp-backup-actions">
          <button class="ftp-primary-button" type="button" data-import-latest-logs>Import latest logs</button>
          <button class="ftp-secondary-button" type="button" data-import-range-logs>Import date range</button>
          <button class="ftp-secondary-button" type="button" data-test-raw-log-api>Raw Log Test</button>
          <button class="ftp-secondary-button" type="button" data-copy-debug-report>Copy debug report</button>
        </div>
        <p class="ftp-status" data-status="info" data-log-import-status>${escapeHtml(getLastImportText(storagePrefix))}</p>
        ${renderImportSummary(importSummary)}
        ${renderLogImportDebug(debug, storagePrefix)}
      </section>
    `;
  }

  function render({ status = '', message = '', storagePrefix = '', importSummary = null } = {}) {
    return `${renderApiSettings(storagePrefix)}${renderLogImport(storagePrefix, importSummary)}<section class="ftp-card" data-backup-section><h2>Backup</h2><p>Export or import your full app data.</p><div class="ftp-form-actions ftp-backup-actions"><button class="ftp-secondary-button" type="button" data-export-backup>Export</button><button class="ftp-secondary-button" type="button" data-import-backup>Import</button></div><input type="file" accept="application/json,.json" data-import-backup-file hidden>${getStatus(status, message)}</section>`;
  }

  function createDebugReport(storagePrefix) {
    const debug = getLogImportDebug(storagePrefix);
    return JSON.stringify({
      appVersion: getConfig().version || debug.appVersion || '',
      endpoint: debug.lastEndpoint || '',
      selections: debug.lastSelections || '',
      params: debug.lastParams || {},
      rawLogCount: debug.rawLogsReturned || 0,
      normalizedLogCount: debug.normalizedLogs || 0,
      buyIdsDetected: debug.buyIdMatches || 0,
      sellIdsDetected: debug.sellIdMatches || 0,
      textBuyMatches: debug.textBuyMatches || 0,
      textSellMatches: debug.textSellMatches || 0,
      buyCandidatesCreated: debug.buyCandidatesCreated || 0,
      sellCandidatesCreated: debug.sellCandidatesCreated || 0,
      purchasesSaved: debug.purchasesSaved || debug.purchasesImported || 0,
      salesSaved: debug.salesSaved || debug.salesImported || 0,
      duplicatesSkipped: debug.duplicatesSkipped || 0,
      unmatchedSales: debug.unmatchedSales || 0,
      reviewCandidates: debug.reviewCandidatesCreated || 0,
      parserFailures: debug.parserFailures || 0,
      validationFailures: debug.validationFailures || 0,
      timings: debug.timings || {},
      lastErrorCode: debug.lastErrorCode || '',
      lastError: debug.lastError || '',
      samples: Array.isArray(debug.firstRecognizedLogs) && debug.firstRecognizedLogs.length ? debug.firstRecognizedLogs.slice(0, 10) : Array.isArray(debug.firstLogs) ? debug.firstLogs.slice(0, 10) : [],
      reviewQueue: getReviewQueue(storagePrefix).slice(0, 10),
      diagnosticMessage: debug.diagnosticMessage || ''
    }, null, 2);
  }

  function bind(root, { eventBus, onImport, storagePrefix } = {}) {
    const section = root.querySelector('[data-backup-section]');
    const apiSection = root.querySelector('[data-api-settings-section]');
    const logImportSection = root.querySelector('[data-log-import-section]');
    const exportButton = root.querySelector('[data-export-backup]');
    const importButton = root.querySelector('[data-import-backup]');
    const fileInput = root.querySelector('[data-import-backup-file]');
    const storageService = getStorageService();
    const tornApiService = getTornApiService();
    const logImportService = getLogImportService();

    function emitNotice(type, title, message) {
      if (eventBus && typeof eventBus.emit === 'function') eventBus.emit('notify', { message, title, type });
    }

    function copyText(text, label) {
      const value = String(text || '');
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(value);
        emitNotice('success', 'Copied', `${label} copied.`);
        return;
      }
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(value).then(() => emitNotice('success', 'Copied', `${label} copied.`)).catch(() => emitNotice('warning', 'Copy failed', 'Select and copy the text manually.'));
      }
    }

    function setStatus(status, message) {
      if (!section) return;
      const existingStatus = section.querySelector('.ftp-status');
      if (existingStatus) existingStatus.remove();
      section.insertAdjacentHTML('beforeend', getStatus(status, message));
      emitNotice(status === 'error' ? 'error' : 'success', status === 'error' ? 'Backup error' : 'Backup ready', message);
    }

    function updateApiStatus(status, message) {
      if (!apiSection) return;
      const statusInput = apiSection.querySelector('[data-api-status]');
      const statusMessage = apiSection.querySelector('[data-api-status-message]');
      if (statusInput) statusInput.value = message;
      if (statusMessage) {
        statusMessage.dataset.status = status;
        statusMessage.textContent = message;
      }
    }

    function updateApiDiagnostics() {
      if (!apiSection) return;
      const existingDiagnostics = apiSection.querySelector('[data-api-diagnostics]');
      if (existingDiagnostics) existingDiagnostics.outerHTML = renderApiDiagnostics(getApiState(storagePrefix));
    }

    function updateLogImportDebug(debug) {
      if (!logImportSection) return;
      const existingDebug = logImportSection.querySelector('[data-log-import-debug]');
      if (existingDebug) existingDebug.outerHTML = renderLogImportDebug(debug || getLogImportDebug(storagePrefix), storagePrefix);
    }

    function updateLogImportStatus(status, message, summary) {
      if (!logImportSection) return;
      const statusMessage = logImportSection.querySelector('[data-log-import-status]');
      const existingSummary = logImportSection.querySelector('[data-log-import-summary]');
      if (statusMessage) {
        statusMessage.dataset.status = status;
        statusMessage.textContent = message;
      }
      if (existingSummary) existingSummary.remove();
      if (summary) {
        logImportSection.insertAdjacentHTML('beforeend', renderImportSummary(summary));
        updateLogImportDebug(summary.debug);
      }
    }

    function getImportMessage(summary) {
      if (!summary.ok) return (summary.errors || ['Import failed.']).join(' ');
      return summary.diagnosticMessage || `Imported ${summary.purchasesImported || 0} purchases and ${summary.salesImported || 0} sales. Skipped ${summary.duplicatesSkipped || 0} duplicates. ${summary.unmatchedSales || 0} unmatched sales. Needs review ${summary.reviewCandidatesCreated || 0}.`;
    }

    async function runLogImport(options = {}) {
      if (!logImportService || typeof logImportService.importLogs !== 'function') {
        updateLogImportStatus('error', 'Log import service is unavailable.');
        return;
      }
      updateLogImportStatus('info', 'Importing Torn logs in batches...');
      try {
        const summary = await logImportService.importLogs(storagePrefix, options);
        const ok = summary.ok && (!summary.errors || summary.errors.length === 0);
        const message = getImportMessage(summary);
        updateLogImportStatus(ok ? 'success' : 'error', message, summary);
        emitNotice(ok ? 'success' : 'warning', 'Log import finished', message);
        if (typeof onImport === 'function') onImport();
      } catch (error) {
        updateLogImportStatus('error', error.message || 'Could not import logs.');
        emitNotice('error', 'Log import error', error.message || 'Could not import logs.');
      }
    }

    if (apiSection) {
      const enabledSelect = apiSection.querySelector('[data-api-enabled]');
      const keyInput = apiSection.querySelector('[data-api-key-input]');
      const saveKeyButton = apiSection.querySelector('[data-save-api-key]');
      const checkKeyButton = apiSection.querySelector('[data-check-api-key]');
      const clearKeyButton = apiSection.querySelector('[data-clear-api-key]');
      const refreshPricesButton = apiSection.querySelector('[data-refresh-api-prices]');
      if (enabledSelect) enabledSelect.addEventListener('change', () => {
        if (!tornApiService || typeof tornApiService.setEnabled !== 'function') return updateApiStatus('error', 'API service is unavailable.');
        const result = tornApiService.setEnabled(storagePrefix, enabledSelect.value === 'true');
        updateApiStatus(result.enabled ? 'success' : result.hasKey ? 'info' : 'error', result.message);
        updateApiDiagnostics();
        emitNotice(result.enabled ? 'success' : result.hasKey ? 'info' : 'warning', 'API settings', result.message);
      });
      if (saveKeyButton && keyInput) saveKeyButton.addEventListener('click', () => {
        if (!tornApiService || typeof tornApiService.saveApiKey !== 'function') return updateApiStatus('error', 'API service is unavailable.');
        const result = tornApiService.saveApiKey(storagePrefix, keyInput.value);
        keyInput.value = '';
        keyInput.placeholder = result.maskedKey || 'Paste Full Access API key';
        updateApiStatus(result.ok ? 'success' : 'error', result.message);
        updateApiDiagnostics();
        emitNotice(result.ok ? 'success' : 'error', 'API key', result.message);
      });
      if (checkKeyButton) checkKeyButton.addEventListener('click', async () => {
        if (!tornApiService || typeof tornApiService.fetchKeyInfo !== 'function') return updateApiStatus('error', 'API diagnostics are unavailable.');
        checkKeyButton.disabled = true;
        updateApiStatus('info', 'Checking API...');
        try {
          const result = await tornApiService.fetchKeyInfo(storagePrefix, { bypassCache: true });
          const message = result.ok ? 'API checked.' : result.error || 'Key diagnostics failed, but log import can still be tested.';
          updateApiStatus(result.ok ? 'success' : 'warning', message);
          updateApiDiagnostics();
          emitNotice(result.ok ? 'success' : 'warning', 'API diagnostics', message);
        } finally {
          checkKeyButton.disabled = false;
        }
      });
      if (clearKeyButton) clearKeyButton.addEventListener('click', () => {
        if (!tornApiService || typeof tornApiService.clearApiKey !== 'function') return updateApiStatus('error', 'API service is unavailable.');
        const result = tornApiService.clearApiKey(storagePrefix);
        if (keyInput) {
          keyInput.value = '';
          keyInput.placeholder = 'Paste Full Access API key';
        }
        if (enabledSelect) enabledSelect.value = 'false';
        updateApiStatus('info', result.message);
        updateApiDiagnostics();
        emitNotice('info', 'API key cleared', result.message);
      });
      if (refreshPricesButton) refreshPricesButton.addEventListener('click', async () => {
        if (!tornApiService || typeof tornApiService.fetchItemPrices !== 'function') return updateApiStatus('error', 'API service is unavailable.');
        refreshPricesButton.disabled = true;
        updateApiStatus('info', 'Refreshing item prices...');
        try {
          const result = await tornApiService.fetchItemPrices(storagePrefix, { bypassCache: true });
          if (!result.ok) throw new Error(result.error || 'Item price refresh failed.');
          updateApiStatus('success', `Updated ${Array.isArray(result.data) ? result.data.length : 0} item prices.`);
          updateApiDiagnostics();
          emitNotice('success', 'Prices updated', `Updated ${Array.isArray(result.data) ? result.data.length : 0} item prices.`);
          if (typeof onImport === 'function') onImport();
        } catch (error) {
          updateApiStatus('warning', 'Item price refresh failed.');
          updateApiDiagnostics();
          emitNotice('warning', 'Item prices', 'Item price refresh failed.');
        } finally {
          refreshPricesButton.disabled = false;
        }
      });
    }

    if (logImportSection) {
      const latestButton = logImportSection.querySelector('[data-import-latest-logs]');
      const rangeButton = logImportSection.querySelector('[data-import-range-logs]');
      const testRawButton = logImportSection.querySelector('[data-test-raw-log-api]');
      const copyDebugButton = logImportSection.querySelector('[data-copy-debug-report]');
      const fromInput = logImportSection.querySelector('[data-log-import-from]');
      const toInput = logImportSection.querySelector('[data-log-import-to]');
      if (latestButton) latestButton.addEventListener('click', () => runLogImport({}));
      if (rangeButton) rangeButton.addEventListener('click', () => runLogImport({ from: fromInput ? fromInput.value : '', to: toInput ? toInput.value : '' }));
      if (testRawButton) testRawButton.addEventListener('click', async () => {
        if (!tornApiService || typeof tornApiService.testRawUserLogs !== 'function') return updateLogImportStatus('error', 'Raw log test is unavailable.');
        updateLogImportStatus('info', 'Testing raw unfiltered user -> log...');
        const result = await tornApiService.testRawUserLogs(storagePrefix);
        const debug = result.debug || getLogImportDebug(storagePrefix);
        const message = result.ok ? `Raw test ok. Raw logs ${debug.rawLogsReturned || 0}, normalized ${debug.normalizedLogs || 0}. Buy IDs ${debug.buyIdMatches || 0}, sell IDs ${debug.sellIdMatches || 0}.` : result.error || 'Raw log test failed.';
        updateLogImportStatus(result.ok ? 'success' : 'error', message, { ok: result.ok, debug, diagnosticMessage: debug.diagnosticMessage || '', errors: result.ok ? [] : [message] });
        emitNotice(result.ok ? 'success' : 'warning', 'Raw log test', message);
      });
      if (copyDebugButton) copyDebugButton.addEventListener('click', () => copyText(createDebugReport(storagePrefix), 'Debug report'));
    }

    if (exportButton) exportButton.addEventListener('click', () => {
      if (!storageService || typeof storageService.exportJson !== 'function') return setStatus('error', 'Storage service is unavailable.');
      const blob = new Blob([storageService.exportJson(storagePrefix)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getBackupFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus('success', 'Exported full app backup.');
    });
    if (importButton && fileInput) {
      importButton.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          const result = storageService && typeof storageService.importJson === 'function' ? storageService.importJson(storagePrefix, String(reader.result || '')) : { ok: false, message: 'Storage service is unavailable.' };
          fileInput.value = '';
          if (!result.ok) return setStatus('error', result.message || 'Could not import that backup.');
          setStatus('success', 'Imported full app backup.');
          if (typeof onImport === 'function') onImport();
        });
        reader.readAsText(file);
      });
    }
  }

  return { bind, render };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProBackup = FlipTrackerProBackup;
}
