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

  function getRequiredSelections() {
    const config = getConfig();
    return Array.isArray(config.requiredApiSelections) ? config.requiredApiSelections : ['key -> info', 'user -> log', 'torn -> items', 'market -> itemmarket'];
  }

  function getRequiredLogTypeIds() {
    const config = getConfig();
    return Array.isArray(config.requiredLogTypeIds) ? config.requiredLogTypeIds : [1225, 1220, 4201, 1112, 4200, 5927, 5510];
  }

  function getStoredSettings(storagePrefix) {
    const storageService = getStorageService();
    const data = storageService && typeof storageService.load === 'function' ? storageService.load(storagePrefix) : { settings: {} };
    return data.settings || {};
  }

  function getBackupFileName() {
    return `flip-tracker-pro-backup-${new Date().toISOString().slice(0, 10)}.json`;
  }

  function getStatus(status, message) {
    return message ? `<p class="ftp-status" data-status="${escapeHtml(status)}">${escapeHtml(message)}</p>` : '';
  }

  function getSetupInstructions() {
    return [
      'Create a Custom Torn API key named Flip Tracker Pro.',
      `Required selections: ${getRequiredSelections().join(', ')}.`,
      `Required user -> log IDs: ${getRequiredLogTypeIds().join(', ')}.`,
      'The log IDs are Custom Key setup permissions. Flip Tracker Pro does not send them as request filters by default.',
      'Do not use or share your Torn password. Manually copy the generated key from Torn and paste it into Flip Tracker Pro.'
    ].join('\n');
  }

  function getApiState(storagePrefix) {
    const tornApiService = getTornApiService();

    if (tornApiService && typeof tornApiService.getStatus === 'function') {
      return tornApiService.getStatus(storagePrefix);
    }

    const settings = getStoredSettings(storagePrefix);
    const hasKey = Boolean(settings.apiKey);

    return {
      connected: Boolean(settings.apiEnabled && hasKey),
      diagnostics: settings.apiDiagnostics || {},
      enabled: Boolean(settings.apiEnabled && hasKey),
      hasKey,
      lastError: settings.apiLastError || '',
      lastErrorCode: settings.apiLastErrorCode || '',
      lastRequest: settings.apiLastRequest || {},
      maskedKey: hasKey ? 'Saved' : '',
      status: hasKey && settings.apiEnabled ? 'ready' : 'disabled'
    };
  }

  function getLogImportDebug(storagePrefix) {
    return getStoredSettings(storagePrefix).logImportDebug || {};
  }

  function getLastImportText(storagePrefix) {
    const value = getStoredSettings(storagePrefix).logImportLastRunAt;

    if (!value) {
      return 'Log import has not run yet.';
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Last import date is unknown.' : `Last import ${date.toLocaleString()}.`;
  }

  function getPermissionText(value) {
    if (value === true) return 'Looks available';
    if (value === false) return 'Not shown by key info';
    return 'Unknown until Torn returns selections';
  }

  function renderApiDiagnostics(apiState) {
    const diagnostics = apiState.diagnostics || {};
    const keyInfoText = diagnostics.keyInfoWorks ? 'key -> info works' : diagnostics.checkedAt ? 'key -> info did not work' : 'Not checked yet';
    const lastError = apiState.lastError || diagnostics.lastError || 'None';
    const lastErrorCode = apiState.lastErrorCode || diagnostics.lastErrorCode || 'None';
    const connectionText = apiState.connected ? 'API connected' : apiState.hasKey ? 'Key saved, API not connected' : 'Not connected';

    return `
      <div class="ftp-profit-preview" data-api-diagnostics>
        <span>API diagnostics</span>
        <small>Status: ${escapeHtml(connectionText)}</small>
        <small>Key check: ${escapeHtml(keyInfoText)}</small>
        <small>Key access level: ${escapeHtml(diagnostics.accessLevel || 'Unknown')}</small>
        <small>Item prices permission: ${escapeHtml(getPermissionText(diagnostics.itemPrices))}</small>
        <small>Log import permission: ${escapeHtml(getPermissionText(diagnostics.userLog))}</small>
        <small>Last API error: ${escapeHtml(String(lastErrorCode))} ${escapeHtml(lastError)}</small>
        <small>Log import uses unfiltered user -> log by default. Log IDs are Custom Key setup permissions, not default request parameters.</small>
      </div>
    `;
  }

  function renderRequiredApiBox() {
    const selections = getRequiredSelections();
    const logIds = getRequiredLogTypeIds();

    return `
      <div class="ftp-profit-preview">
        <span>Recommended key type: Custom</span>
        <small>Required API selections: ${escapeHtml(selections.join(', '))}</small>
        <small>Required user -> log IDs for Custom Key permission: ${escapeHtml(logIds.join(', '))}</small>
        <small>For Custom API keys, include user -> log and allow these log IDs. These IDs are not sent as request filters by default.</small>
        <small>Your key is stored locally in your browser only. Your key is only sent to Torn API endpoints. No Torn password is ever required.</small>
        <div class="ftp-form-actions ftp-backup-actions">
          <button class="ftp-secondary-button" type="button" data-copy-api-selections>Copy required selections</button>
          <button class="ftp-secondary-button" type="button" data-copy-log-ids>Copy required log IDs</button>
          <button class="ftp-secondary-button" type="button" data-copy-setup-instructions>Copy setup instructions</button>
        </div>
      </div>
    `;
  }

  function renderImportSummary(summary) {
    if (!summary) return '';
    const diagnostic = summary.diagnosticMessage ? `<small>${escapeHtml(summary.diagnosticMessage)}</small>` : '';
    const warnings = Array.isArray(summary.warnings) && summary.warnings.length ? `<small>${summary.warnings.map(escapeHtml).join(' | ')}</small>` : '';
    const errors = Array.isArray(summary.errors) && summary.errors.length ? `<small>${summary.errors.map(escapeHtml).join(' | ')}</small>` : '';

    return `
      <div class="ftp-profit-preview" data-log-import-summary>
        <span>Import summary</span>
        <small>Purchases ${summary.purchasesImported || 0} / Sales ${summary.salesImported || 0} / Duplicates ${summary.duplicatesSkipped || 0} / Unmatched sales ${summary.unmatchedSales || 0}</small>
        ${diagnostic}
        ${warnings}
        ${errors}
      </div>
    `;
  }

  function renderLogImportDebug(debug = {}) {
    const params = debug.lastParams && typeof debug.lastParams === 'object' ? JSON.stringify(debug.lastParams) : '{}';
    const requiredLogIds = Array.isArray(debug.requiredLogTypeIds) && debug.requiredLogTypeIds.length ? debug.requiredLogTypeIds : getRequiredLogTypeIds();
    const firstTexts = Array.isArray(debug.firstLogTexts) && debug.firstLogTexts.length ? debug.firstLogTexts.join(' | ') : '';
    const topKeys = Array.isArray(debug.responseTopLevelKeys) ? debug.responseTopLevelKeys.join(', ') : '';
    const sampleRawKeys = Array.isArray(debug.sampleRawKeys) ? debug.sampleRawKeys.join(', ') : '';

    return `
      <details class="ftp-profit-preview" data-log-import-debug>
        <summary>Import debug</summary>
        <small>Required log IDs: ${escapeHtml(requiredLogIds.join(', '))}</small>
        <small>Unfiltered attempted: ${escapeHtml(debug.unfilteredRequestAttempted ? 'yes' : 'no')}</small>
        <small>Filtered attempted: ${escapeHtml(debug.filteredRequestAttempted ? 'yes' : 'no')}</small>
        <small>Strategy used: ${escapeHtml(debug.strategyUsed || 'Not requested yet')}</small>
        <small>Range used: ${escapeHtml(debug.rangeUsed || 'Not requested yet')}</small>
        <small>Endpoint: ${escapeHtml(debug.lastEndpoint || 'Not requested yet')}</small>
        <small>Selection: ${escapeHtml(debug.lastSelections || 'None')}</small>
        <small>Params: ${escapeHtml(params)}</small>
        <small>Response keys: ${escapeHtml(topKeys || 'None')}</small>
        <small>Sample raw keys: ${escapeHtml(sampleRawKeys || 'None')}</small>
        <small>Torn error: ${escapeHtml(String(debug.lastErrorCode || 'None'))} ${escapeHtml(debug.lastError || '')}</small>
        <small>Raw logs returned: ${escapeHtml(debug.rawLogsReturned || 0)}</small>
        <small>Normalized logs: ${escapeHtml(debug.normalizedLogs || debug.logsReturned || 0)}</small>
        <small>Purchase candidates: ${escapeHtml(debug.classifiedPurchases || 0)}</small>
        <small>Sale candidates: ${escapeHtml(debug.classifiedSales || 0)}</small>
        <small>Duplicates skipped: ${escapeHtml(debug.duplicatesSkipped || 0)}</small>
        <small>Imported purchases: ${escapeHtml(debug.purchasesImported || 0)}</small>
        <small>Imported sales: ${escapeHtml(debug.salesImported || 0)}</small>
        <small>Unmatched sales: ${escapeHtml(debug.unmatchedSales || 0)}</small>
        <small>First log texts: ${escapeHtml(firstTexts || 'None')}</small>
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
        <p>Your API key is stored locally in your browser only and is used only to request read-only data from Torn.</p>
        ${renderRequiredApiBox()}
        <label class="ftp-field">
          <span>API enabled</span>
          <select class="ftp-input" data-api-enabled>
            <option value="false" ${apiState.enabled ? '' : 'selected'}>Off</option>
            <option value="true" ${apiState.enabled ? 'selected' : ''}>On</option>
          </select>
        </label>
        <div class="ftp-form-grid">
          <label class="ftp-field"><span>API key</span><input class="ftp-input" data-api-key-input type="password" autocomplete="off" placeholder="${escapeHtml(apiState.maskedKey || 'Paste API key')}"></label>
          <label class="ftp-field"><span>Status</span><input class="ftp-input" type="text" value="${escapeHtml(statusText)}" readonly data-api-status></label>
        </div>
        <div class="ftp-form-actions ftp-backup-actions">
          <button class="ftp-secondary-button" type="button" data-get-custom-api-key>Get custom API key</button>
          <button class="ftp-primary-button" type="button" data-save-api-key>Save API key</button>
          <button class="ftp-secondary-button" type="button" data-check-api-key>Check key permissions</button>
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
        <p>Import latest logs checks the last 24 hours first, then tries the last 7 days if no logs are returned.</p>
        <div class="ftp-form-grid">
          <label class="ftp-field"><span>Import from</span><input class="ftp-input" type="date" data-log-import-from></label>
          <label class="ftp-field"><span>Import to</span><input class="ftp-input" type="date" data-log-import-to></label>
        </div>
        <div class="ftp-form-actions ftp-backup-actions">
          <button class="ftp-primary-button" type="button" data-import-latest-logs>Import latest logs</button>
          <button class="ftp-secondary-button" type="button" data-import-range-logs>Import date range</button>
          <button class="ftp-secondary-button" type="button" data-test-raw-log-api>Test raw log API</button>
          <button class="ftp-secondary-button" type="button" data-copy-debug-report>Copy debug report</button>
        </div>
        <p class="ftp-status" data-status="info" data-log-import-status>${escapeHtml(getLastImportText(storagePrefix))}</p>
        ${renderImportSummary(importSummary)}
        ${renderLogImportDebug(debug)}
      </section>
    `;
  }

  function render({ status = '', message = '', storagePrefix = '', importSummary = null } = {}) {
    return `
      ${renderApiSettings(storagePrefix)}
      ${renderLogImport(storagePrefix, importSummary)}
      <section class="ftp-card" data-backup-section>
        <h2>Backup</h2>
        <p>Export or import your full app data, including settings, window state, purchase lots, sales, and backups.</p>
        <div class="ftp-form-actions ftp-backup-actions">
          <button class="ftp-secondary-button" type="button" data-export-backup>Export</button>
          <button class="ftp-secondary-button" type="button" data-import-backup>Import</button>
        </div>
        <input type="file" accept="application/json,.json" data-import-backup-file hidden>
        ${getStatus(status, message)}
      </section>
    `;
  }

  function createDebugReport(storagePrefix) {
    const debug = getLogImportDebug(storagePrefix);
    return JSON.stringify({
      appVersion: getConfig().version || debug.appVersion || '',
      endpoint: debug.lastEndpoint || '',
      selections: debug.lastSelections || '',
      params: debug.lastParams || {},
      unfilteredRequestAttempted: Boolean(debug.unfilteredRequestAttempted),
      filteredRequestAttempted: Boolean(debug.filteredRequestAttempted),
      responseTopLevelKeys: debug.responseTopLevelKeys || [],
      rawLogCount: debug.rawLogsReturned || 0,
      normalizedLogCount: debug.normalizedLogs || debug.logsReturned || 0,
      purchaseCandidates: debug.classifiedPurchases || 0,
      saleCandidates: debug.classifiedSales || 0,
      lastErrorCode: debug.lastErrorCode || '',
      lastError: debug.lastError || '',
      firstLogTexts: debug.firstLogTexts || [],
      diagnosticMessage: debug.diagnosticMessage || '',
      sampleRawKeys: debug.sampleRawKeys || []
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
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('notify', { message, title, type });
      }
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
        return;
      }
      emitNotice('info', 'Copy manually', value);
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
      if (existingDebug) existingDebug.outerHTML = renderLogImportDebug(debug || getLogImportDebug(storagePrefix));
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
      if (summary.diagnosticMessage) return summary.diagnosticMessage;
      return `Imported ${summary.purchasesImported || 0} purchases and ${summary.salesImported || 0} sales. Skipped ${summary.duplicatesSkipped || 0} duplicates. ${summary.unmatchedSales || 0} unmatched sales.`;
    }

    async function runLogImport(options = {}) {
      if (!logImportService || typeof logImportService.importLogs !== 'function') {
        updateLogImportStatus('error', 'Log import service is unavailable.');
        return;
      }
      updateLogImportStatus('info', 'Importing Torn logs...');
      try {
        const summary = await logImportService.importLogs(storagePrefix, options);
        const ok = summary.ok && (!summary.errors || summary.errors.length === 0);
        const message = getImportMessage(summary);
        updateLogImportStatus(ok ? 'success' : 'error', message, summary);
        emitNotice(ok ? 'success' : 'warning', 'Log import finished', message);
      } catch (error) {
        updateLogImportStatus('error', error.message || 'Could not import logs.');
        emitNotice('error', 'Log import error', error.message || 'Could not import logs.');
      }
    }

    if (apiSection) {
      const enabledSelect = apiSection.querySelector('[data-api-enabled]');
      const keyInput = apiSection.querySelector('[data-api-key-input]');
      const getKeyButton = apiSection.querySelector('[data-get-custom-api-key]');
      const saveKeyButton = apiSection.querySelector('[data-save-api-key]');
      const checkKeyButton = apiSection.querySelector('[data-check-api-key]');
      const clearKeyButton = apiSection.querySelector('[data-clear-api-key]');
      const refreshPricesButton = apiSection.querySelector('[data-refresh-api-prices]');
      const copySelectionsButton = apiSection.querySelector('[data-copy-api-selections]');
      const copyLogIdsButton = apiSection.querySelector('[data-copy-log-ids]');
      const copySetupButton = apiSection.querySelector('[data-copy-setup-instructions]');

      if (copySelectionsButton) copySelectionsButton.addEventListener('click', () => copyText(getRequiredSelections().join('\n'), 'Required selections'));
      if (copyLogIdsButton) copyLogIdsButton.addEventListener('click', () => copyText(getRequiredLogTypeIds().join(', '), 'Required log IDs'));
      if (copySetupButton) copySetupButton.addEventListener('click', () => copyText(getSetupInstructions(), 'Setup instructions'));
      if (getKeyButton) getKeyButton.addEventListener('click', () => {
        const url = tornApiService && typeof tornApiService.getCustomKeyBuilderUrl === 'function' ? tornApiService.getCustomKeyBuilderUrl() : 'https://www.torn.com/preferences.php#tab=api';
        window.open(url, '_blank', 'noopener,noreferrer');
        emitNotice('info', 'Create custom key', 'On Torn, create a Custom key named Flip Tracker Pro with the required selections and log IDs.');
      });
      if (enabledSelect) enabledSelect.addEventListener('change', () => {
        if (!tornApiService || typeof tornApiService.setEnabled !== 'function') {
          updateApiStatus('error', 'API service is unavailable.');
          return;
        }
        const result = tornApiService.setEnabled(storagePrefix, enabledSelect.value === 'true');
        updateApiStatus(result.enabled ? 'success' : result.hasKey ? 'info' : 'error', result.message);
        updateApiDiagnostics();
        emitNotice(result.enabled ? 'success' : result.hasKey ? 'info' : 'warning', 'API settings', result.message);
      });
      if (saveKeyButton && keyInput) saveKeyButton.addEventListener('click', () => {
        if (!tornApiService || typeof tornApiService.saveApiKey !== 'function') {
          updateApiStatus('error', 'API service is unavailable.');
          return;
        }
        const result = tornApiService.saveApiKey(storagePrefix, keyInput.value);
        keyInput.value = '';
        keyInput.placeholder = result.maskedKey || 'Paste API key';
        updateApiStatus(result.ok ? 'success' : 'error', result.message);
        updateApiDiagnostics();
        emitNotice(result.ok ? 'success' : 'error', 'API key', result.message);
      });
      if (checkKeyButton) checkKeyButton.addEventListener('click', async () => {
        if (!tornApiService || typeof tornApiService.fetchKeyInfo !== 'function') {
          updateApiStatus('error', 'API diagnostics are unavailable.');
          return;
        }
        checkKeyButton.disabled = true;
        updateApiStatus('info', 'Checking key permissions...');
        try {
          const result = await tornApiService.fetchKeyInfo(storagePrefix, { bypassCache: true });
          const message = result.ok ? 'Key permissions checked.' : result.error || 'Could not check key permissions.';
          updateApiStatus(result.ok ? 'success' : 'error', message);
          updateApiDiagnostics();
          emitNotice(result.ok ? 'success' : 'warning', 'API diagnostics', message);
        } catch (error) {
          updateApiStatus('error', error.message || 'Could not check key permissions.');
          emitNotice('error', 'API diagnostics', error.message || 'Could not check key permissions.');
        } finally {
          checkKeyButton.disabled = false;
        }
      });
      if (clearKeyButton) clearKeyButton.addEventListener('click', () => {
        if (!tornApiService || typeof tornApiService.clearApiKey !== 'function') {
          updateApiStatus('error', 'API service is unavailable.');
          return;
        }
        const result = tornApiService.clearApiKey(storagePrefix);
        if (keyInput) {
          keyInput.value = '';
          keyInput.placeholder = 'Paste API key';
        }
        if (enabledSelect) enabledSelect.value = 'false';
        updateApiStatus('info', result.message);
        updateApiDiagnostics();
        emitNotice('info', 'API key cleared', result.message);
      });
      if (refreshPricesButton) refreshPricesButton.addEventListener('click', async () => {
        if (!tornApiService || typeof tornApiService.fetchItemPrices !== 'function') {
          updateApiStatus('error', 'API service is unavailable.');
          return;
        }
        refreshPricesButton.disabled = true;
        updateApiStatus('info', 'Refreshing item prices...');
        try {
          const result = await tornApiService.fetchItemPrices(storagePrefix, { bypassCache: true });
          if (!result.ok) throw new Error(result.error || 'Could not refresh item prices.');
          const snapshots = Array.isArray(result.data) ? result.data : [];
          updateApiStatus('success', `Updated ${snapshots.length} item prices.`);
          updateApiDiagnostics();
          emitNotice('success', 'Prices updated', `Updated ${snapshots.length} item prices.`);
          if (typeof onImport === 'function') onImport();
        } catch (error) {
          updateApiStatus('error', error.message || 'Could not refresh item prices.');
          updateApiDiagnostics();
          emitNotice('error', 'API error', error.message || 'Could not refresh item prices.');
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
        if (!tornApiService || typeof tornApiService.testRawUserLogs !== 'function') {
          updateLogImportStatus('error', 'Raw log test is unavailable.');
          return;
        }
        updateLogImportStatus('info', 'Testing raw unfiltered user -> log...');
        const result = await tornApiService.testRawUserLogs(storagePrefix);
        const debug = result.debug || getLogImportDebug(storagePrefix);
        const message = result.ok
          ? `Raw test ok. Raw logs ${debug.rawLogsReturned || 0}, normalized ${debug.normalizedLogs || 0}.`
          : result.error || 'Raw log test failed.';
        updateLogImportStatus(result.ok ? 'success' : 'error', message, { ok: result.ok, debug, diagnosticMessage: debug.diagnosticMessage || '', errors: result.ok ? [] : [message] });
        emitNotice(result.ok ? 'success' : 'warning', 'Raw log test', message);
      });
      if (copyDebugButton) copyDebugButton.addEventListener('click', () => copyText(createDebugReport(storagePrefix), 'Debug report'));
    }

    if (exportButton) exportButton.addEventListener('click', () => {
      if (!storageService || typeof storageService.exportJson !== 'function') {
        setStatus('error', 'Storage service is unavailable.');
        return;
      }
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
          const result = storageService && typeof storageService.importJson === 'function'
            ? storageService.importJson(storagePrefix, String(reader.result || ''))
            : { ok: false, message: 'Storage service is unavailable.' };
          fileInput.value = '';
          if (!result.ok) {
            setStatus('error', result.message || 'Could not import that backup.');
            return;
          }
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
