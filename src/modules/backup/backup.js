const FlipTrackerProBackup = (() => {
  function getBackupFileName() {
    const date = new Date().toISOString().slice(0, 10);
    return `flip-tracker-pro-backup-${date}.json`;
  }

  function getStatus(status, message) {
    if (!message) {
      return '';
    }

    return `<p class="ftp-status" data-status="${status}">${message}</p>`;
  }

  function normalizeFlip(flip) {
    const now = new Date().toISOString();

    return {
      ...flip,
      id: flip.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      itemName: String(flip.itemName || 'Unnamed item'),
      buyPrice: Number(flip.buyPrice) || 0,
      sellPrice: Number(flip.sellPrice) || 0,
      quantity: Number(flip.quantity) || 1,
      fees: Number(flip.fees) || 0,
      margin: Number(flip.margin) || 0,
      profit: Number(flip.profit) || 0,
      totalBuy: Number(flip.totalBuy) || 0,
      totalSell: Number(flip.totalSell) || 0,
      createdAt: flip.createdAt || now,
      updatedAt: flip.updatedAt || now
    };
  }

  function getImportedFlips(backup) {
    if (Array.isArray(backup)) {
      return backup.map(normalizeFlip);
    }

    if (backup && Array.isArray(backup.flips)) {
      return backup.flips.map(normalizeFlip);
    }

    return null;
  }

  function render({ status = '', message = '' } = {}) {
    return `
      <section class="ftp-card" data-backup-section>
        <h2>Backup</h2>
        <p>Export your saved flips or import a backup file.</p>

        <div class="ftp-form-actions ftp-backup-actions">
          <button class="ftp-secondary-button" type="button" data-export-backup>Export</button>
          <button class="ftp-secondary-button" type="button" data-import-backup>Import</button>
        </div>

        <input type="file" accept="application/json,.json" data-import-backup-file hidden>
        ${getStatus(status, message)}
      </section>
    `;
  }

  function bind(root, { onImport, storagePrefix, store } = {}) {
    const section = root.querySelector('[data-backup-section]');
    const exportButton = root.querySelector('[data-export-backup]');
    const importButton = root.querySelector('[data-import-backup]');
    const fileInput = root.querySelector('[data-import-backup-file]');

    function setStatus(status, message) {
      if (!section) {
        return;
      }

      const existingStatus = section.querySelector('.ftp-status');

      if (existingStatus) {
        existingStatus.remove();
      }

      section.insertAdjacentHTML('beforeend', getStatus(status, message));
    }

    if (exportButton) {
      exportButton.addEventListener('click', () => {
        const flips = store && typeof store.read === 'function'
          ? store.read(storagePrefix)
          : [];
        const backup = {
          app: 'Flip Tracker Pro',
          version: '1',
          exportedAt: new Date().toISOString(),
          flips
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = getBackupFileName();
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setStatus('success', `Exported ${flips.length} saved flip${flips.length === 1 ? '' : 's'}.`);
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
          try {
            const importedFlips = getImportedFlips(JSON.parse(String(reader.result || '')));

            if (!importedFlips) {
              setStatus('error', 'That backup file did not contain saved flips.');
              return;
            }

            if (!window.confirm(`Import ${importedFlips.length} saved flip${importedFlips.length === 1 ? '' : 's'}? This will replace your current saved flips.`)) {
              fileInput.value = '';
              return;
            }

            if (store && typeof store.write === 'function') {
              store.write(storagePrefix, importedFlips);
            }

            fileInput.value = '';

            if (typeof onImport === 'function') {
              onImport();
            }
          } catch (error) {
            setStatus('error', 'Could not read that backup file.');
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
