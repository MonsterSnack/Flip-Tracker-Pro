const FlipTrackerProWindow = (() => {
  const viewportPadding = 8;
  const minWidth = 320;
  const minHeight = 360;

  function createElementFromHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getStorageKey(storagePrefix) {
    return `${storagePrefix || 'flipTrackerPro'}:windowState`;
  }

  function getLegacyPositionKey(storagePrefix) {
    return `${storagePrefix || 'flipTrackerPro'}:windowPosition`;
  }

  function readSavedState(storagePrefix) {
    try {
      const rawState = window.localStorage.getItem(getStorageKey(storagePrefix));
      const rawLegacyPosition = window.localStorage.getItem(getLegacyPositionKey(storagePrefix));

      if (rawState) {
        return JSON.parse(rawState);
      }

      return rawLegacyPosition ? JSON.parse(rawLegacyPosition) : null;
    } catch (error) {
      return null;
    }
  }

  function getRootAndWindow(rootOrWindow) {
    if (!rootOrWindow) {
      return { root: null, windowElement: null };
    }

    const isWindowElement = rootOrWindow.classList && rootOrWindow.classList.contains('ftp-window');
    const root = isWindowElement ? rootOrWindow.parentElement : rootOrWindow;
    const windowElement = isWindowElement ? rootOrWindow : root.querySelector('.ftp-window');

    return { root, windowElement };
  }

  function saveState(rootOrWindow, storagePrefix) {
    const { root, windowElement } = getRootAndWindow(rootOrWindow);

    if (!root || !windowElement) {
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const windowRect = windowElement.getBoundingClientRect();
    const savedState = readSavedState(storagePrefix) || {};
    const isCompact = windowElement.dataset.displayMode === 'compact';

    try {
      window.localStorage.setItem(getStorageKey(storagePrefix), JSON.stringify({
        height: isCompact && savedState.height ? savedState.height : Math.round(windowRect.height),
        left: Math.round(rootRect.left),
        top: Math.round(rootRect.top),
        width: isCompact && savedState.width ? savedState.width : Math.round(windowRect.width)
      }));
    } catch (error) {
      // Window state persistence is nice to have; the app should keep working without it.
    }
  }

  function restorePosition(root, storagePrefix) {
    const savedState = readSavedState(storagePrefix);
    const { windowElement } = getRootAndWindow(root);

    if (!root || !savedState) {
      return;
    }

    if (windowElement && savedState.width && savedState.height) {
      const maxWidth = Math.max(minWidth, window.innerWidth - (viewportPadding * 2));
      const maxHeight = Math.max(minHeight, window.innerHeight - (viewportPadding * 2));

      windowElement.style.width = `${clamp(Number(savedState.width), minWidth, maxWidth)}px`;
      windowElement.style.height = `${clamp(Number(savedState.height), minHeight, maxHeight)}px`;
    }

    const maxLeft = Math.max(viewportPadding, window.innerWidth - root.offsetWidth - viewportPadding);
    const maxTop = Math.max(viewportPadding, window.innerHeight - root.offsetHeight - viewportPadding);
    const nextLeft = clamp(Number(savedState.left) || viewportPadding, viewportPadding, maxLeft);
    const nextTop = clamp(Number(savedState.top) || viewportPadding, viewportPadding, maxTop);

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
      saveState(windowElement, storagePrefix);
    });

    titlebar.addEventListener('pointerup', (event) => {
      if (!dragState) {
        return;
      }

      saveState(windowElement, storagePrefix);
      dragState = null;
      titlebar.releasePointerCapture(event.pointerId);
      delete windowElement.dataset.dragging;
    });

    titlebar.addEventListener('pointercancel', () => {
      if (dragState) {
        saveState(windowElement, storagePrefix);
      }

      dragState = null;
      delete windowElement.dataset.dragging;
    });
  }

  function makeResizable(windowElement, storagePrefix) {
    const resizeHandle = windowElement.querySelector('[data-window-resize-handle]');
    let resizeState = null;

    if (!resizeHandle) {
      return;
    }

    resizeHandle.addEventListener('pointerdown', (event) => {
      if (windowElement.dataset.displayMode === 'compact') {
        return;
      }

      event.preventDefault();
      const rect = windowElement.getBoundingClientRect();
      resizeState = {
        height: rect.height,
        pointerX: event.clientX,
        pointerY: event.clientY,
        width: rect.width
      };

      resizeHandle.setPointerCapture(event.pointerId);
      windowElement.dataset.resizing = 'true';
    });

    resizeHandle.addEventListener('pointermove', (event) => {
      if (!resizeState) {
        return;
      }

      const root = windowElement.parentElement;
      const rootRect = root.getBoundingClientRect();
      const maxWidth = Math.max(minWidth, window.innerWidth - rootRect.left - viewportPadding);
      const maxHeight = Math.max(minHeight, window.innerHeight - rootRect.top - viewportPadding);
      const nextWidth = clamp(resizeState.width + event.clientX - resizeState.pointerX, minWidth, maxWidth);
      const nextHeight = clamp(resizeState.height + event.clientY - resizeState.pointerY, minHeight, maxHeight);

      windowElement.style.width = `${nextWidth}px`;
      windowElement.style.height = `${nextHeight}px`;
      saveState(windowElement, storagePrefix);
    });

    resizeHandle.addEventListener('pointerup', (event) => {
      if (!resizeState) {
        return;
      }

      saveState(windowElement, storagePrefix);
      resizeState = null;
      resizeHandle.releasePointerCapture(event.pointerId);
      delete windowElement.dataset.resizing;
    });

    resizeHandle.addEventListener('pointercancel', () => {
      if (resizeState) {
        saveState(windowElement, storagePrefix);
      }

      resizeState = null;
      delete windowElement.dataset.resizing;
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

        <span class="ftp-resize-handle" data-window-resize-handle aria-hidden="true"></span>
      </div>
    `);

    const titleButton = windowElement.querySelector('[data-action="toggle-display"]');
    const minimizeButton = windowElement.querySelector('[data-action="minimize"]');
    const closeButton = windowElement.querySelector('[data-action="close"]');

    titleButton.addEventListener('click', () => {
      const isCompact = windowElement.dataset.displayMode === 'compact';
      setWindowState(windowElement, 'open');
      setDisplayMode(windowElement, isCompact ? 'expanded' : 'compact', labels);
      saveState(windowElement, storagePrefix);
    });

    minimizeButton.addEventListener('click', () => {
      setWindowState(windowElement, 'open');
      setDisplayMode(windowElement, 'compact', labels);
      saveState(windowElement, storagePrefix);
    });

    closeButton.addEventListener('click', () => {
      setWindowState(windowElement, 'closed');
    });

    makeDraggable(windowElement, storagePrefix);
    makeResizable(windowElement, storagePrefix);

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
