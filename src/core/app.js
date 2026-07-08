// ==UserScript==
// @name         Flip Tracker Pro
// @namespace    https://github.com/MonsterSnack/Flip-Tracker-Pro
// @version      0.1.1
// @description  Desktop-style flip tracking tools for Torn.
// @author       MonsterSnack
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/core/config.js?v=0.1.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/ui/window.js?v=0.1.1
// @grant        none
// ==/UserScript==

(function bootstrapFlipTrackerPro() {
  'use strict';

  const fallbackConfig = {
    appName: 'Flip Tracker Pro',
    version: '0.1.1',
    rootId: 'flip-tracker-pro-root',
    defaultWindow: {
      top: 96,
      right: 24
    }
  };

  const config = window.FlipTrackerProConfig || fallbackConfig;
  const windowShell = window.FlipTrackerProWindow;

  const styles = `
    #${config.rootId} {
      position: fixed;
      top: ${config.defaultWindow.top}px;
      right: ${config.defaultWindow.right}px;
      z-index: 100000;
      color: #f4f6fb;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    #${config.rootId} .ftp-window {
      width: 420px;
      min-height: 520px;
      overflow: hidden;
      border: 1px solid #313744;
      border-radius: 8px;
      background: #111318;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
    }

    #${config.rootId} .ftp-window[data-window-state="minimized"] {
      min-height: 0;
    }

    #${config.rootId} .ftp-window[data-window-state="minimized"] .ftp-body {
      display: none;
    }

    #${config.rootId} .ftp-window[data-window-state="closed"] {
      display: none;
    }

    #${config.rootId} .ftp-window[data-dragging="true"] .ftp-titlebar {
      cursor: grabbing;
    }

    #${config.rootId} .ftp-titlebar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid #313744;
      background: #181b22;
      cursor: grab;
      touch-action: none;
      user-select: none;
    }

    #${config.rootId} .ftp-title {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0;
    }

    #${config.rootId} .ftp-version {
      color: #9aa3b2;
      font-size: 12px;
    }

    #${config.rootId} .ftp-window-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    #${config.rootId} .ftp-window-button {
      width: 26px;
      height: 24px;
      border: 1px solid #313744;
      border-radius: 6px;
      background: #20242d;
      color: #f4f6fb;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      line-height: 1;
    }

    #${config.rootId} .ftp-window-button:hover {
      border-color: #4f8cff;
      background: #263145;
    }

    #${config.rootId} .ftp-body {
      display: grid;
      gap: 12px;
      padding: 14px;
    }

    #${config.rootId} .ftp-card,
    #${config.rootId} .ftp-stat {
      border: 1px solid #313744;
      border-radius: 8px;
      background: #20242d;
      padding: 12px;
    }

    #${config.rootId} .ftp-card h2 {
      margin: 0 0 6px;
      font-size: 13px;
    }

    #${config.rootId} .ftp-card p {
      margin: 0;
      color: #9aa3b2;
      font-size: 12px;
      line-height: 1.5;
    }

    #${config.rootId} .ftp-stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    #${config.rootId} .ftp-stat {
      background: #181b22;
    }

    #${config.rootId} .ftp-stat span {
      display: block;
      color: #9aa3b2;
      font-size: 11px;
    }

    #${config.rootId} .ftp-stat strong {
      display: block;
      margin-top: 4px;
      font-size: 18px;
    }

    #${config.rootId} .ftp-status {
      color: #3ecf8e;
      font-size: 12px;
      font-weight: 700;
    }
  `;

  function injectStyles() {
    if (document.querySelector('[data-flip-tracker-pro-styles]')) {
      return;
    }

    const styleElement = document.createElement('style');
    styleElement.dataset.flipTrackerProStyles = 'true';
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }

  function createRoot() {
    const existingRoot = document.getElementById(config.rootId);

    if (existingRoot) {
      return existingRoot;
    }

    const root = document.createElement('section');
    root.id = config.rootId;
    root.setAttribute('aria-label', config.appName);
    document.body.appendChild(root);
    return root;
  }

  function getDashboardHtml() {
    return `
      <section class="ftp-card">
        <h2>Dashboard</h2>
        <p>Your flip tracking workspace is mounted and ready for the next feature module.</p>
      </section>

      <section class="ftp-stats" aria-label="Trading summary">
        <div class="ftp-stat">
          <span>Total profit</span>
          <strong>$0</strong>
        </div>
        <div class="ftp-stat">
          <span>Active flips</span>
          <strong>0</strong>
        </div>
      </section>

      <section class="ftp-card">
        <h2>Status</h2>
        <p><span class="ftp-status">Online</span> - core app bootstrap loaded successfully. Drag the title bar to move this window.</p>
      </section>
    `;
  }

  function renderApp(root) {
    root.innerHTML = '';

    if (!windowShell) {
      root.innerHTML = '<div class="ftp-window"><main class="ftp-body"><section class="ftp-card"><h2>Startup error</h2><p>Window shell failed to load.</p></section></main></div>';
      return;
    }

    root.appendChild(windowShell.createWindow({
      title: config.appName,
      version: config.version,
      bodyHtml: getDashboardHtml()
    }));
  }

  function start() {
    if (!document.body) {
      window.requestAnimationFrame(start);
      return;
    }

    injectStyles();
    renderApp(createRoot());
  }

  start();
}());
