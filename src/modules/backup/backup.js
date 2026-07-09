const FlipTrackerProBackup = (() => {
  function escapeHtml(value) {
    return window.FlipTrackerProHtml && typeof window.FlipTrackerProHtml.escapeHtml === 'function'
      ? window.FlipTrackerProHtml.escapeHtml(value)
      : String(value ?? '');
  }

  function getBackupFileName() {
    const date = new Date().toISOString().slice(0, 10);
    return `flip-tracker-pro-backup-${date}.json`;
  }

  function getStatus(status, message) {
    if (!message) {
      return '';
    }

    return `<p class="ftp-status" data-status="${escapeHtml(status)}">${escapeHtml(message)}</p>`;
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

  function getApiState(storagePrefix) {
    const tornApiService = getTornApiService();

    if (tornApiService && typeof tornApiService.getStatus === 'function') {
      return tornApiService.getStatus(storagePrefix);
    }

    const storageService = getStorageService();
    const data = storageService && typeof storageService.load === 'function'
      ? storageService.load(storagePrefix)
      : { settings: {} };
    const settings = data.settings || {};
    const hasKey = Boolean(settings.apiKey);

    return {
      enabled: Boolean(settings.apiEnabled && hasKey),
      hasKey,
      maskedKey: hasKey ? 'Saved' : '',
      status: hasKey && settings.apiEnabled ? 'ready' : 'disabled',
      lastError: settings.apiLastError || ''
    };
  }

  function getLastImportText(storagePrefix) {
    const storageService = getStorageService();
    const data = storageService && typeof storageService.load === 'function'
      ? storageService.load(storagePrefix)
      : { settings: {} };
    const value = data.settings && data.settings.logImportLastRunAt;

    if (!value) {
      return 'Log import has not run yet.';
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Last import date is unknown.' : `Last import ${date.toLocaleString()}.`;
  }

  function renderImportSummary(summary) {
    if (!summary) {
      return '';
    }

    const warnings = Array.isArray(summary.warnings) && summary.warnings.length
      ? `<small>${summary.warnings.map(escapeHtml).join(' | ')}</small>`
      : '';
    const errors = Array.isArray(summary.errors) && summary.errors.length
      ? `<small>${summary.errors.map(escapeHtml).join(' | ')}</small>`
      : '';

    return `
      <div class="ftp-profit-preview" data-log-import-summary>
        <span>Import summary</span>
        <small>Purchases ${summary.purchasesImported || 0} / Sales ${summary.salesImported || 0} / Duplicates ${summary.duplicatesSkipped || 0} / Unmatched sales ${summary.unmatchedSales || 0}</small>
        ${warnings}
        ${errors}
      </div>
    `;
  }

  function renderApiSettings(storagePrefix) {
    const apiState = getApiState(storagePrefix);
    const statusText = apiState.lastError || (apiState.enabled ? 'API ready' : apiState.hasKey ? 'API key saved, currently disabled' : 'No API key saved');
    const statusKind = apiState.status === 'error' || apiState.lastError ? 'error' : apiState.enabled ? 'success' : 'info';

    return `
      <section class="ftp-card" data-api-settings-section>
        <h2>Torn API</h2>
        <p>Your API key is stored locally in your browser only and is used only to request read-only data from Torn.</p>

        <label class="ftp-field">
          <span>API enabled</span>
          <select class="ftp-input" data-api-enabled>
            <option value="false" ${apiState.enabled ? '' : 'selected'}>Off</option>
            <option value="true" ${apiState.enabled ? 'selected' : ''}>On</option>
          </select>
        </label>

        <div class="ftp-form-grid">
          <label class="ftp-field">
            <span>API key</span>
            <input class="ftp-input" data-api-key-input type="password" autocomplete="off" placeholder="${escapeHtml(apiState.maskedKey || 'Paste API key')}">
          </label>

          <label class="ftp-field">
            <span>Status</span>
            <input class="ftp-input" type="text" value="${escapeHtml(statusText)}" readonly data-api-status>
          </label>
        </div>

        <div class="ftp-form-actions ftp-backup-actions">
          <button class="ftp-primary-button" type="button" data-save-api-key>Save API key</button>
          <button class="ftp-secondary-button" type="button" data-refresh-api-prices>Refresh item prices</button>
          <button class="ftp-danger-button" type="button" data-clear-api-key>Clear API key</button>
        </div>

        <p class="ftp-status" data-status="${statusKind}" data-api-status-message>${escapeHtml(statusText)}</p>

        <div class="ftp-profit-preview">
          <span>API privacy and rules</span>
          <small>Item prices require market/item data. Automatic buy/sell import requires user log access. Flip Tracker Pro is read-only. Your API key is saved locally only and is only sent to Torn API endpoints. No password is ever required. You can clear the key at any time.</small>
        </div>
      </section>
    `;
  }

  function renderLogImport(storagePrefix, importSummary) {
    return `
      <section class="ftp-card" data-log-import-section>
        <h2>Import Logs</h2>
        <p>Import Torn buy/sell/trade logs to create purchases and sales automatically where possible.</p>

        <div class="ftp-form-grid">
          <label class="ftp-field">
            <span>Import from</span>
            <input class="ftp-input" type="date" data-log-import-from>
          </label>

          <label class="ftp-field">
            <span>Import to</span>
            <input class="ftp-input" type="date" data-log-import-to>
          </label>
        </div>

        <div class="ftp-form-actions ftp-backup-actions">
          <button class="ftp-primary-button" type="button" data-import-latest-logs>Import latest logs</button>
          <button class="ftp-secondary-button" type="button" data-import-range-logs>Import date range</button>
        </div>

        <p class="ftp-status" data-status="info" data-log-import-status>${escapeHtml(getLastImportText(storagePrefix))}</p>
        ${renderImportSummary(importSummary)}
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

    function setStatus(status, message) {
      if (!section) {
        return;
      }

      const existingStatus = section.querySelector('.ftp-status');

      if (existingStatus) {
        existingStatus.remove();
      }

      section.insertAdjacentHTML('beforeend', getStatus(status, message));
      emitNotice(status === 'error' ? 'error' : 'success', status === 'error' ? 'Backup error' : 'Backup ready', message);
    }

    function updateApiStatus(status, message) {
      if (!apiSection) {
        return;
      }

      const statusInput = apiSection.querySelector('[data-api-status]');
      const statusMessage = apiSection.querySelector('[data-api-status-message]');

      if (statusInput) {
        statusInput.value = message;
      }

      if (statusMessage) {
        statusMessage.dataset.status = status;
        statusMessage.textContent = message;
      }
    }

    function updateLogImportStatus(status, message, summary) {
      if (!logImportSection) {
        return;
      }

      const statusMessage = logImportSection.querySelector('[data-log-import-status]');
      const existingSummary = logImportSection.querySelector('[data-log-import-summary]');

      if (statusMessage) {
        statusMessage.dataset.status = status;
        statusMessage.textContent = message;
      }

      if (existingSummary) {
        existingSummary.remove();
      }

      if (summary) {
        logImportSection.insertAdjacentHTML('beforeend', renderImportSummary(summary));
      }
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
        const message = `Imported ${summary.purchasesImported || 0} purchases and ${summary.salesImported || 0} sales. Skipped ${summary.duplicatesSkipped || 0} duplicates. ${summary.unmatchedSales || 0} unmatched sales.`;

        updateLogImportStatus(ok ? 'success' : 'error', ok ? message : (summary.errors || ['Import failed.']).join(' '), summary);
        emitNotice(ok ? 'success' : 'warning', 'Log import finished', message);

        if (typeof onImport === 'function') {
          onImport();
        }
      } catch (error) {
        updateLogImportStatus('error', error.message || 'Could not import logs.');
        emitNotice('error', 'Log import error', error.message || 'Could not import logs.');
      }
    }

    if (apiSection) {
      const enabledSelect = apiSection.querySelector('[data-api-enabled]');
      const keyInput = apiSection.querySelector('[data-api-key-input]');
      const saveKeyButton = apiSection.querySelector('[data-save-api-key]');
      const clearKeyButton = apiSection.querySelector('[data-clear-api-key]');
      const refreshPricesButton = apiSection.querySelector('[data-refresh-api-prices]');

      if (enabledSelect) {
        enabledSelect.addEventListener('change', () => {
          if (!tornApiService || typeof tornApiService.setEnabled !== 'function') {
            updateApiStatus('error', 'API service is unavailable.');
            return;
          }

          const result = tornApiService.setEnabled(storagePrefix, enabledSelect.value === 'true');
          updateApiStatus(result.enabled ? 'success' : result.hasKey ? 'info' : 'error', result.message);
          emitNotice(result.enabled ? 'success' : result.hasKey ? 'info' : 'warning', 'API settings', result.message);
        });
      }

      if (saveKeyButton && keyInput) {
        saveKeyButton.addEventListener('click', () => {
          if (!tornApiService || typeof tornApiService.saveApiKey !== 'function') {
            updateApiStatus('error', 'API service is unavailable.');
            return;
          }

          const result = tornApiService.saveApiKey(storagePrefix, keyInput.value);
          keyInput.value = '';
          keyInput.placeholder = result.maskedKey || 'Paste API key';
          updateApiStatus(result.ok ? 'success' : 'error', result.message);
          emitNotice(result.ok ? 'success' : 'error', 'API key', result.message);
        });
      }

      if (clearKeyButton) {
        clearKeyButton.addEventListener('click', () => {
          if (!tornApiService || typeof tornApiService.clearApiKey !== 'function') {
            updateApiStatus('error', 'API service is unavailable.');
            return;
          }

          const result = tornApiService.clearApiKey(storagePrefix);
          if (keyInput) {
            keyInput.value = '';
            keyInput.placeholder = 'Paste API key';
          }
          if (enabledSelect) {
            enabledSelect.value = 'false';
          }
          updateApiStatus('info', result.message);
          emitNotice('info', 'API key cleared', result.message);
        });
      }

      if (refreshPricesButton) {
        refreshPricesButton.addEventListener('click', async () => {
          if (!tornApiService || typeof tornApiService.fetchItemPrices !== 'function') {
            updateApiStatus('error', 'API service is unavailable.');
            return;
          }

          refreshPricesButton.disabled = true;
          updateApiStatus('info', 'Refreshing item prices...');

          try {
            const result = await tornApiService.fetchItemPrices(storagePrefix);

            if (!result.ok) {
              throw new Error(result.error || 'Could not refresh item prices.');
            }

            const snapshots = Array.isArray(result.data) ? result.data : [];
            updateApiStatus('success', `Updated ${snapshots.length} item prices.`);
            emitNotice('success', 'Prices updated', `Updated ${snapshots.length} item prices.`);

            if (typeof onImport === 'function') {
              onImport();
            }
          } catch (error) {
            updateApiStatus('error', error.message || 'Could not refresh item prices.');
            emitNotice('error', 'API error', error.message || 'Could not refresh item prices.');
          } finally {
            refreshPricesButton.disabled = false;
          }
        });
      }
    }

    if (logImportSection) {
      const latestButton = logImportSection.querySelector('[data-import-latest-logs]');
      const rangeButton = logImportSection.querySelector('[data-import-range-logs]');
      const fromInput = logImportSection.querySelector('[data-log-import-from]');
      const toInput = logImportSection.querySelector('[data-log-import-to]');

      if (latestButton) {
        latestButton.addEventListener('click', () => runLogImport({}));
      }

      if (rangeButton) {
        rangeButton.addEventListener('click', () => runLogImport({
          from: fromInput ? fromInput.value : '',
          to: toInput ? toInput.value : ''
        }));
      }
    }

    if (exportButton) {
      exportButton.addEventListener('click', () => {
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
    }

    if (importButton && fileInput) {
      importButton.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];

        if (!file) {
          return;
        }

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

          if (typeof onImport === 'function') {
            onImport();
          }
        });

        reader.readAsText(file);
      });
    }
  }

  return {
    bind,
    render
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProBackup = FlipTrackerProBackup;
}
