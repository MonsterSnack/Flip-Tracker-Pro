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

  function setWindowState(windowElement, nextState) {
    windowElement.dataset.windowState = nextState;
  }

  function makeDraggable(windowElement) {
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

      const maxLeft = window.innerWidth - dragState.root.offsetWidth - viewportPadding;
      const maxTop = window.innerHeight - dragState.root.offsetHeight - viewportPadding;
      const nextLeft = clamp(event.clientX - dragState.pointerOffsetX, viewportPadding, maxLeft);
      const nextTop = clamp(event.clientY - dragState.pointerOffsetY, viewportPadding, maxTop);

      dragState.root.style.left = `${nextLeft}px`;
      dragState.root.style.top = `${nextTop}px`;
    });

    titlebar.addEventListener('pointerup', (event) => {
      if (!dragState) {
        return;
      }

      dragState = null;
      titlebar.releasePointerCapture(event.pointerId);
      delete windowElement.dataset.dragging;
    });

    titlebar.addEventListener('pointercancel', () => {
      dragState = null;
      delete windowElement.dataset.dragging;
    });
  }

  function createWindow({ title, version, bodyHtml }) {
    const windowElement = createElementFromHtml(`
      <div class="ftp-window" data-window-state="open">
        <header class="ftp-titlebar" data-window-drag-handle>
          <div>
            <h1 class="ftp-title">${title}</h1>
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

    const minimizeButton = windowElement.querySelector('[data-action="minimize"]');
    const closeButton = windowElement.querySelector('[data-action="close"]');

    minimizeButton.addEventListener('click', () => {
      const isMinimized = windowElement.dataset.windowState === 'minimized';
      setWindowState(windowElement, isMinimized ? 'open' : 'minimized');
      minimizeButton.textContent = isMinimized ? '_' : '+';
    });

    closeButton.addEventListener('click', () => {
      setWindowState(windowElement, 'closed');
    });

    makeDraggable(windowElement);

    return windowElement;
  }

  return {
    createWindow
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProWindow = FlipTrackerProWindow;
}
