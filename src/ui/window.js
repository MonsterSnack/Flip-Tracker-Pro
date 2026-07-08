const FlipTrackerProWindow = (() => {
  function createElementFromHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }

  function setWindowState(windowElement, nextState) {
    windowElement.dataset.windowState = nextState;
  }

  function createWindow({ title, version, bodyHtml }) {
    const windowElement = createElementFromHtml(`
      <div class="ftp-window" data-window-state="open">
        <header class="ftp-titlebar">
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

    return windowElement;
  }

  return {
    createWindow
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProWindow = FlipTrackerProWindow;
}
