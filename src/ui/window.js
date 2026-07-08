const FlipTrackerProWindow = (() => {
  const viewportPadding = 8;

  function createElementFromHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getStorageKey(storagePrefix) {
    return `${storagePrefix || 'flipTrackerPro'}:windowPosition`;
  }

  function readSavedPosition(storagePrefix) {
    try {
      const rawPosition = window.localStorage.getItem(getStorageKey(storagePrefix));
      return rawPosition ? JSON.parse(rawPosition) : null;
    } catch (error) {
      return null;
    }
  }

  function savePosition(root, storagePrefix) {
    const rootRect = root.getBoundingClientRect();

    try {
      window.localStorage.setItem(getStorageKey(storagePrefix), JSON.stringify({
        left: Math.round(rootRect.left),
        top: Math.round(rootRect.top)
      }));
    } catch (error) {
      // Position persistence is nice to have; the app should keep working without it.
    }
  }

  function restorePosition(root, storagePrefix) {
    const savedPosition = readSavedPosition(storagePrefix);

    if (!root || !savedPosition) {
      return;
    }

    const maxLeft = Math.max(viewportPadding, window.innerWidth - root.offsetWidth - viewportPadding);
    const maxTop = Math.max(viewportPadding, window.innerHeight - root.offsetHeight - viewportPadding);
    const nextLeft = clamp(Number(savedPosition.left) || viewportPadding, viewportPadding, maxLeft);
    const nextTop = clamp(Number(savedPosition.top) || viewportPadding, viewportPadding, maxTop);

    root.style.left = `${nextLeft}px`;
    root.style.top = `${nextTop}px`;
    root.style.right = 'auto';
  }

  function setWindowState(windowElement, nextState) {
    windowElement.dataset.windowState = nextState;
  }

  function setDisplayMode(windowElement, nextMode, labels) {
    const titleButton = windowElement.querySelector('[data-action="toggle-display"]');
    windowElement.dataset.displayMode = nextMode;
    titleButton.textContent = nextMode === 'compact' ? labels.shortTitle : labels.title;
    titleButton.setAttribute('aria-label', nextMode === 'compact' ? `Expand ${labels.title}` : `Collapse ${labels.title}`);
  }

  function makeDraggable(windowElement, storagePrefix) {
    const titlebar = windowElement.querySelector('[data-window-drag-handle]');
    let dragState = null;

    if (!titlebar) {
      return;
    }

    titlebar.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) {
        return;
      }

      const root = windowElement.parentElement;
      const rootRect = root.getBoundingClientRect();

      dragState = {
        root,
        pointerOffsetX: event.clientX - rootRect.left,
        pointerOffsetY: event.clientY - rootRect.top
      };

      root.style.left = `${rootRect.left}px`;
      root.style.top = `${rootRect.top}px`;
      root.style.right = 'auto';
      titlebar.setPointerCapture(event.pointerId);
      windowElement.dataset.dragging = 'true';
    });

    titlebar.addEventListener('pointermove', (event) => {
      if (!dragState) {
        return;
      }

      const maxLeft = Math.max(viewportPadding, window.innerWidth - dragState.root.offsetWidth - viewportPadding);
      const maxTop = Math.max(viewportPadding, window.innerHeight - dragState.root.offsetHeight - viewportPadding);
      const nextLeft = clamp(event.clientX - dragState.pointerOffsetX, viewportPadding, maxLeft);
      const nextTop = clamp(event.clientY - dragState.pointerOffsetY, viewportPadding, maxTop);

      dragState.root.style.left = `${nextLeft}px`;
      dragState.root.style.top = `${nextTop}px`;
      savePosition(dragState.root, storagePrefix);
    });

    titlebar.addEventListener('pointerup', (event) => {
      if (!dragState) {
        return;
      }

      savePosition(dragState.root, storagePrefix);
      dragState = null;
      titlebar.releasePointerCapture(event.pointerId);
      delete windowElement.dataset.dragging;
    });

    titlebar.addEventListener('pointercancel', () => {
      if (dragState) {
        savePosition(dragState.root, storagePrefix);
      }

      dragState = null;
      delete windowElement.dataset.dragging;
    });
  }

  function createWindow({ title, shortTitle = title, version, bodyHtml, storagePrefix }) {
    const labels = { title, shortTitle };
    const windowElement = createElementFromHtml(`
      <div class="ftp-window" data-window-state="open" data-display-mode="compact">
        <header class="ftp-titlebar" data-window-drag-handle>
          <div class="ftp-title-group">
            <button class="ftp-title-button" type="button" data-action="toggle-display" aria-label="Expand ${title}">${shortTitle}</button>
            <span class="ftp-version">v${version}</span>
          </div>

          <div class="ftp-window-actions" aria-label="Window controls">
            <button class="ftp-window-button" type="button" data-action="minimize" aria-label="Minimize ${title}">_</button>
            <button class="ftp-window-button" type="button" data-action="close" aria-label="Close ${title}">x</button>
          </div>
        </header>

        <main class="ftp-body">
          ${bodyHtml}
        </main>
      </div>
    `);

    const titleButton = windowElement.querySelector('[data-action="toggle-display"]');
    const minimizeButton = windowElement.querySelector('[data-action="minimize"]');
    const closeButton = windowElement.querySelector('[data-action="close"]');

    titleButton.addEventListener('click', () => {
      const isCompact = windowElement.dataset.displayMode === 'compact';
      setWindowState(windowElement, 'open');
      setDisplayMode(windowElement, isCompact ? 'expanded' : 'compact', labels);
    });

    minimizeButton.addEventListener('click', () => {
      setWindowState(windowElement, 'open');
      setDisplayMode(windowElement, 'compact', labels);
    });

    closeButton.addEventListener('click', () => {
      setWindowState(windowElement, 'closed');
    });

    makeDraggable(windowElement, storagePrefix);

    return windowElement;
  }

  return {
    createWindow,
    restorePosition
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProWindow = FlipTrackerProWindow;
}
