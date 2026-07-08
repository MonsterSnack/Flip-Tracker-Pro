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

  function render({ status = '', message = '' } = {}) {
    return `
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
    const exportButton = root.querySelector('[data-export-backup]');
    const importButton = root.querySelector('[data-import-backup]');
    const fileInput = root.querySelector('[data-import-backup-file]');
    const storageService = getStorageService();

    function setStatus(status, message) {
      if (!section) {
        return;
      }

      const existingStatus = section.querySelector('.ftp-status');

      if (existingStatus) {
        existingStatus.remove();
      }

      section.insertAdjacentHTML('beforeend', getStatus(status, message));

      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('notify', {
          type: status === 'error' ? 'error' : 'success',
          title: status === 'error' ? 'Backup error' : 'Backup ready',
          message
        });
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
