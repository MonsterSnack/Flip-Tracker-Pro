// ==UserScript==
// @name         Flip Tracker Pro
// @namespace    https://github.com/MonsterSnack/Flip-Tracker-Pro
// @version      0.7.1
// @description  Desktop-style flip tracking tools for Torn.
// @author       MonsterSnack
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/core/config.js?v=0.7.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/utils/html.js?v=0.7.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/services/event-bus.js?v=0.7.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/services/storage-service.js?v=0.7.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/services/notification-service.js?v=0.7.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/services/trade-accounting-service.js?v=0.7.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/services/torn-api-service.js?v=0.7.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/ui/window.js?v=0.7.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/services/purchase-lot-service.js?v=0.7.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/services/portfolio-service.js?v=0.7.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/services/statistics-service.js?v=0.7.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/services/flip-store.js?v=0.7.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/modules/dashboard/dashboard.js?v=0.7.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/modules/analytics/analytics.js?v=0.7.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/modules/flip-entry/flip-entry.js?v=0.7.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/modules/open-purchases/open-purchases.js?v=0.7.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/modules/backup/backup.js?v=0.7.1
// @require      https://raw.githubusercontent.com/MonsterSnack/Flip-Tracker-Pro/main/src/modules/saved-flips/saved-flips.js?v=0.7.1
// @grant        none
// ==/UserScript==

(function bootstrapFlipTrackerPro() {
  'use strict';

  const fallbackConfig = {
    appName: 'Flip Tracker Pro',
    shortName: 'FT',
    version: '0.7.1',
    rootId: 'flip-tracker-pro-root',
    storagePrefix: 'flipTrackerPro',
    defaultWindow: { width: 760, height: 560, top: 96, right: 24 }
  };

  const config = window.FlipTrackerProConfig || fallbackConfig;
  const html = window.FlipTrackerProHtml;
  const eventBus = window.FlipTrackerProEventBus;
  const storageService = window.FlipTrackerProStorageService;
  const notificationService = window.FlipTrackerProNotificationService;
  const windowShell = window.FlipTrackerProWindow;
  const portfolioService = window.FlipTrackerProPortfolioService;
  const statisticsService = window.FlipTrackerProStatisticsService;
  const flipStore = window.FlipTrackerProFlipStore;
  const dashboard = window.FlipTrackerProDashboard;
  const analytics = window.FlipTrackerProAnalytics;
  const flipEntry = window.FlipTrackerProFlipEntry;
  const openPurchases = window.FlipTrackerProOpenPurchases;
  const backup = window.FlipTrackerProBackup;
  const savedFlips = window.FlipTrackerProSavedFlips;
  const activeViewKey = `${config.storagePrefix}:activeView`;
  const routes = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'calculator', label: 'Record Sale' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'purchases', label: 'Purchases' },
    { id: 'history', label: 'History' },
    { id: 'statistics', label: 'Statistics' },
    { id: 'settings', label: 'Settings' }
  ];
  const legacyRouteMap = { analytics: 'statistics', tracker: 'dashboard' };
  let activeView = getInitialRoute();

  const styles = `
    #${config.rootId} { position: fixed; top: ${config.defaultWindow.top}px; right: ${config.defaultWindow.right}px; z-index: 100000; color: #f4f6fb; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    #${config.rootId} .ftp-window { position: relative; display: grid; grid-template-rows: auto minmax(0, 1fr); width: ${config.defaultWindow.width}px; height: ${config.defaultWindow.height}px; min-width: 320px; min-height: 360px; overflow: hidden; border: 1px solid #313744; border-radius: 8px; background: #111318; box-shadow: 0 18px 60px rgba(0,0,0,.35); }
    #${config.rootId} .ftp-window[data-display-mode="compact"] { width: 52px !important; height: 44px !important; min-width: 52px; min-height: 44px; }
    #${config.rootId} .ftp-window[data-display-mode="compact"] .ftp-titlebar { justify-content: center; width: 52px; height: 44px; padding: 0; border-bottom: 0; }
    #${config.rootId} .ftp-window[data-display-mode="compact"] .ftp-title-group { width: 100%; height: 100%; }
    #${config.rootId} .ftp-window[data-display-mode="compact"] .ftp-title-button { width: 100%; height: 100%; justify-content: center; font-size: 15px; }
    #${config.rootId} .ftp-window[data-display-mode="compact"] .ftp-version, #${config.rootId} .ftp-window[data-display-mode="compact"] .ftp-window-actions, #${config.rootId} .ftp-window[data-display-mode="compact"] .ftp-body, #${config.rootId} .ftp-window[data-display-mode="compact"] .ftp-resize-handle, #${config.rootId} .ftp-window[data-window-state="minimized"] .ftp-body, #${config.rootId} .ftp-window[data-window-state="closed"] { display: none; }
    #${config.rootId} .ftp-titlebar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 10px; border-bottom: 1px solid #313744; background: #181b22; cursor: grab; touch-action: none; user-select: none; }
    #${config.rootId} .ftp-title-group, #${config.rootId} .ftp-body, #${config.rootId} .ftp-sidebar, #${config.rootId} .ftp-main-content, #${config.rootId} .ftp-stats, #${config.rootId} .ftp-flip-list, #${config.rootId} .ftp-saved-flips, #${config.rootId} .ftp-saved-flip-main, #${config.rootId} .ftp-saved-flip-side, #${config.rootId} .ftp-form, #${config.rootId} .ftp-form-grid, #${config.rootId} .ftp-form-actions, #${config.rootId} .ftp-field, #${config.rootId} .ftp-profit-preview { display: grid; }
    #${config.rootId} .ftp-title-button { display: flex; align-items: center; width: fit-content; border: 0; background: transparent; color: #f4f6fb; cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; padding: 0; }
    #${config.rootId} .ftp-version, #${config.rootId} .ftp-stat span, #${config.rootId} .ftp-field span, #${config.rootId} .ftp-profit-preview span, #${config.rootId} .ftp-profit-preview small, #${config.rootId} .ftp-saved-flip-main span { color: #9aa3b2; font-size: 11px; }
    #${config.rootId} .ftp-body { grid-template-columns: 150px minmax(0, 1fr); min-height: 0; overflow: hidden; }
    #${config.rootId} .ftp-sidebar { align-content: start; gap: 6px; overflow-y: auto; border-right: 1px solid #313744; background: #151820; padding: 12px; }
    #${config.rootId} .ftp-nav-button { width: 100%; border: 1px solid transparent; border-radius: 6px; background: transparent; color: #9aa3b2; cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; padding: 9px 10px; text-align: left; }
    #${config.rootId} .ftp-nav-button:hover, #${config.rootId} .ftp-nav-button[data-active="true"] { border-color: #4f8cff; background: #263145; color: #f4f6fb; }
    #${config.rootId} .ftp-main-content { align-content: start; gap: 12px; min-width: 0; overflow-y: auto; padding: 14px; }
    #${config.rootId} .ftp-card, #${config.rootId} .ftp-stat { border: 1px solid #313744; border-radius: 8px; background: #20242d; padding: 12px; }
    #${config.rootId} .ftp-card h2 { margin: 0 0 6px; font-size: 13px; }
    #${config.rootId} .ftp-card p { margin: 0; color: #9aa3b2; font-size: 12px; line-height: 1.5; }
    #${config.rootId} .ftp-stats, #${config.rootId} .ftp-form-grid, #${config.rootId} .ftp-form-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    #${config.rootId} .ftp-analytics-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    #${config.rootId} .ftp-stat strong { display: block; margin-top: 4px; font-size: 18px; }
    #${config.rootId} .ftp-flip-list, #${config.rootId} .ftp-saved-flips, #${config.rootId} .ftp-chart-list { display: grid; gap: 6px; list-style: none; margin: 8px 0 0; padding: 0; }
    #${config.rootId} .ftp-flip-row, #${config.rootId} .ftp-window-actions, #${config.rootId} .ftp-row-actions, #${config.rootId} .ftp-chart-label { display: flex; align-items: center; }
    #${config.rootId} .ftp-flip-row, #${config.rootId} .ftp-saved-flip, #${config.rootId} .ftp-chart-row { border: 1px solid #313744; border-radius: 6px; background: #181b22; font-size: 12px; padding: 8px; }
    #${config.rootId} .ftp-flip-row { justify-content: space-between; gap: 10px; }
    #${config.rootId} .ftp-saved-flip { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
    #${config.rootId} .ftp-saved-flip-main, #${config.rootId} .ftp-saved-flip-side, #${config.rootId} .ftp-field, #${config.rootId} .ftp-chart-row { gap: 5px; }
    #${config.rootId} .ftp-saved-flip-side { justify-items: end; }
    #${config.rootId} .ftp-row-actions, #${config.rootId} .ftp-window-actions { gap: 6px; }
    #${config.rootId} .ftp-chart-label { justify-content: space-between; gap: 8px; }
    #${config.rootId} .ftp-chart-track { overflow: hidden; height: 8px; border-radius: 999px; background: #111318; }
    #${config.rootId} .ftp-chart-bar { display: block; height: 100%; border-radius: inherit; background: #3ecf8e; }
    #${config.rootId} .ftp-chart-bar[data-profit-state="negative"] { background: #ff6b6b; }
    #${config.rootId} [data-profit-state="positive"], #${config.rootId} .ftp-status[data-status="success"] { color: #3ecf8e; }
    #${config.rootId} [data-profit-state="negative"], #${config.rootId} .ftp-status[data-status="error"] { color: #ff6b6b; }
    #${config.rootId} .ftp-status[data-status="info"] { color: #9aa3b2; }
    #${config.rootId} .ftp-form { gap: 10px; margin-top: 10px; }
    #${config.rootId} .ftp-subheading, #${config.rootId} .ftp-backup-actions { margin-top: 10px; }
    #${config.rootId} .ftp-input { width: 100%; box-sizing: border-box; border: 1px solid #313744; border-radius: 6px; background: #181b22; color: #f4f6fb; font: inherit; font-size: 12px; outline: none; padding: 8px; }
    #${config.rootId} .ftp-input:focus { border-color: #4f8cff; }
    #${config.rootId} .ftp-profit-preview { gap: 3px; border: 1px solid #313744; border-radius: 8px; background: #181b22; padding: 10px; }
    #${config.rootId} .ftp-profit-preview strong { font-size: 20px; }
    #${config.rootId} .ftp-primary-button, #${config.rootId} .ftp-secondary-button, #${config.rootId} .ftp-danger-button, #${config.rootId} .ftp-window-button { border: 0; border-radius: 6px; color: #fff; cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; padding: 9px 10px; }
    #${config.rootId} .ftp-primary-button { background: #4f8cff; }
    #${config.rootId} .ftp-secondary-button, #${config.rootId} .ftp-window-button { background: #313744; color: #f4f6fb; }
    #${config.rootId} .ftp-danger-button { background: #3a2024; color: #ffb3b3; font-size: 11px; padding: 6px 8px; }
    #${config.rootId} .ftp-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; touch-action: none; }
    #${config.rootId} .ftp-resize-handle::after { position: absolute; right: 4px; bottom: 4px; width: 7px; height: 7px; border-right: 2px solid #586173; border-bottom: 2px solid #586173; content: ''; }
    #${config.rootId} .ftp-notifications { position: absolute; top: 52px; right: 12px; z-index: 2; display: grid; gap: 8px; width: min(280px, calc(100% - 24px)); pointer-events: none; }
    #${config.rootId} .ftp-notification { display: grid; gap: 3px; padding: 10px 12px; border: 1px solid #313744; border-radius: 8px; background: #181b22; box-shadow: 0 12px 28px rgba(0,0,0,.28); opacity: 0; transform: translateY(-6px); transition: opacity 160ms ease, transform 160ms ease; }
    #${config.rootId} .ftp-notification[data-visible="true"] { opacity: 1; transform: translateY(0); }
    #${config.rootId} .ftp-notification span { color: #9aa3b2; font-size: 11px; line-height: 1.4; }
  `;

  function escapeHtml(value) {
    return html && typeof html.escapeHtml === 'function' ? html.escapeHtml(value) : String(value ?? '');
  }

  function formatMoney(value) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0, style: 'currency', currency: 'USD' }).format(value || 0);
  }

  function formatPercent(value) {
    return `${(Number(value) || 0).toFixed(1)}%`;
  }

  function getInitialRoute() {
    const data = storageService && typeof storageService.load === 'function' ? storageService.load(config.storagePrefix) : null;
    const savedRoute = data && data.settings ? data.settings.activeRoute : window.localStorage.getItem(activeViewKey);
    const route = legacyRouteMap[savedRoute] || savedRoute || 'dashboard';
    return routes.some((item) => item.id === route) ? route : 'dashboard';
  }

  function saveActiveRoute(route) {
    if (storageService && typeof storageService.update === 'function') {
      storageService.update(config.storagePrefix, (data) => ({
        ...data,
        settings: {
          ...data.settings,
          activeRoute: route
        }
      }));
      return;
    }

    window.localStorage.setItem(activeViewKey, route);
  }

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

  function getAppData() {
    return storageService && typeof storageService.load === 'function'
      ? storageService.load(config.storagePrefix)
      : { itemPriceSnapshots: [], purchaseLots: [], sales: [], settings: {} };
  }

  function getSales(data = getAppData()) {
    return Array.isArray(data.sales) ? data.sales : [];
  }

  function getPurchaseLots(data = getAppData()) {
    return Array.isArray(data.purchaseLots) ? data.purchaseLots : [];
  }

  function getPriceSnapshots(data = getAppData()) {
    return Array.isArray(data.itemPriceSnapshots) ? data.itemPriceSnapshots : [];
  }

  function getPortfolio(data) {
    return portfolioService && typeof portfolioService.calculate === 'function'
      ? portfolioService.calculate(getPurchaseLots(data), data.settings, getPriceSnapshots(data))
      : [];
  }

  function getPortfolioSummary(portfolio) {
    return portfolioService && typeof portfolioService.summarize === 'function'
      ? portfolioService.summarize(portfolio)
      : { currentEstimatedProfit: 0, estimatedProfit: 0, itemCount: 0, openQuantity: 0, totalInvestment: 0 };
  }

  function getStatistics(data) {
    return statisticsService && typeof statisticsService.calculate === 'function'
      ? statisticsService.calculate(getSales(data), getPurchaseLots(data))
      : { averageROI: 0, lifetimeProfit: 0, monthlyProfit: 0, todayProfit: 0, totalInvestment: 0, totalTrades: 0, weeklyProfit: 0 };
  }

  function renderSidebar() {
    return `
      <nav class="ftp-sidebar" aria-label="Flip Tracker sections">
        ${routes.map((route) => `<button class="ftp-nav-button" type="button" data-view-route="${route.id}" data-active="${activeView === route.id}">${route.label}</button>`).join('')}
      </nav>
    `;
  }

  function renderModule(moduleReference, args, unavailableTitle) {
    return moduleReference && typeof moduleReference.render === 'function'
      ? moduleReference.render(args)
      : `<section class="ftp-card"><h2>${escapeHtml(unavailableTitle)}</h2><p>This section could not load.</p></section>`;
  }

  function renderPortfolio(portfolio) {
    if (!portfolio.length) {
      return '<section class="ftp-card"><h2>Portfolio</h2><p>No purchase lots yet. Add open purchases to build your portfolio.</p></section>';
    }

    const rows = portfolio.map((item) => {
      const liveHtml = item.priceUpdatedAt
        ? `<span>Live ${formatMoney(item.currentSellPrice)} / P/L <strong data-profit-state="${item.currentEstimatedProfit >= 0 ? 'positive' : 'negative'}">${formatMoney(item.currentEstimatedProfit)}</strong></span>`
        : '';

      return `
        <li class="ftp-saved-flip">
          <div class="ftp-saved-flip-main">
            <strong>${escapeHtml(item.itemName)}</strong>
            <span>Qty ${item.quantity} / Average ${formatMoney(item.averageCost)} / Invested ${formatMoney(item.totalInvestment)}</span>
            <span>Break-even ${formatMoney(item.breakEvenSellPrice)} / Target ${formatMoney(item.targetSellPrice)}</span>
            ${liveHtml}
          </div>
          <div class="ftp-saved-flip-side">
            <strong data-profit-state="${item.estimatedProfit >= 0 ? 'positive' : 'negative'}">${formatMoney(item.estimatedProfit)}</strong>
            <span>${formatPercent(item.estimatedROI)}</span>
          </div>
        </li>
      `;
    }).join('');

    return `
      <section class="ftp-card">
        <h2>Portfolio</h2>
        <p>Average cost is derived from open purchase lots, not stored directly.</p>
        <ul class="ftp-saved-flips">${rows}</ul>
      </section>
    `;
  }

  function renderStatisticsSummary(statistics) {
    return `
      <section class="ftp-stats ftp-analytics-stats" aria-label="Statistics summary">
        <div class="ftp-stat"><span>Total trades</span><strong>${statistics.totalTrades}</strong></div>
        <div class="ftp-stat"><span>Total investment</span><strong>${formatMoney(statistics.totalInvestment)}</strong></div>
        <div class="ftp-stat"><span>Lifetime profit</span><strong>${formatMoney(statistics.lifetimeProfit)}</strong></div>
        <div class="ftp-stat"><span>Today profit</span><strong>${formatMoney(statistics.todayProfit)}</strong></div>
        <div class="ftp-stat"><span>Weekly profit</span><strong>${formatMoney(statistics.weeklyProfit)}</strong></div>
        <div class="ftp-stat"><span>Monthly profit</span><strong>${formatMoney(statistics.monthlyProfit)}</strong></div>
        <div class="ftp-stat"><span>Average ROI</span><strong>${formatPercent(statistics.averageROI)}</strong></div>
      </section>
    `;
  }

  function getRouteHtml() {
    const data = getAppData();
    const sales = getSales(data);
    const purchaseLots = getPurchaseLots(data);
    const itemPriceSnapshots = getPriceSnapshots(data);
    const portfolio = getPortfolio(data);
    const statistics = getStatistics(data);
    const portfolioSummary = getPortfolioSummary(portfolio);
    const dashboardHtml = renderModule(dashboard, { portfolioSummary, statistics }, 'Dashboard unavailable');
    const recentFlipsHtml = dashboard && typeof dashboard.renderRecentFlips === 'function'
      ? dashboard.renderRecentFlips({ sales })
      : '<section class="ftp-card"><h2>Recent Flips unavailable</h2><p>This section could not load.</p></section>';
    const analyticsHtml = renderModule(analytics, { sales, statistics }, 'Statistics unavailable');
    const flipEntryHtml = renderModule(flipEntry, undefined, 'Record Sale unavailable');
    const openPurchasesHtml = renderModule(openPurchases, { itemPriceSnapshots, priceSnapshots: itemPriceSnapshots, purchaseLots }, 'Purchases unavailable');
    const backupHtml = renderModule(backup, { storagePrefix: config.storagePrefix }, 'Settings unavailable');
    const savedFlipsHtml = renderModule(savedFlips, { sales }, 'History unavailable');

    if (activeView === 'calculator') {
      return flipEntryHtml;
    }

    if (activeView === 'portfolio') {
      return renderPortfolio(portfolio);
    }

    if (activeView === 'purchases') {
      return openPurchasesHtml;
    }

    if (activeView === 'history') {
      return `${recentFlipsHtml}${savedFlipsHtml}`;
    }

    if (activeView === 'statistics') {
      return `${renderStatisticsSummary(statistics)}${analyticsHtml}`;
    }

    if (activeView === 'settings') {
      return backupHtml;
    }

    return `${dashboardHtml}${recentFlipsHtml}`;
  }

  function getAppHtml() {
    return `${renderSidebar()}<div class="ftp-main-content" data-route-content>${getRouteHtml()}</div>`;
  }

  function notify(type, title, message) {
    if (eventBus && typeof eventBus.emit === 'function') {
      eventBus.emit('notify', { message, title, type });
    }
  }

  function updateSidebarState(root) {
    root.querySelectorAll('[data-view-route]').forEach((button) => {
      button.dataset.active = String(button.dataset.viewRoute === activeView);
    });
  }

  function renderRoute(root) {
    const routeContent = root.querySelector('[data-route-content]');

    if (!routeContent) {
      return;
    }

    routeContent.innerHTML = getRouteHtml();
    updateSidebarState(root);
    bindRouteModules(root);
  }

  function setActiveRoute(root, route) {
    if (!routes.some((item) => item.id === route)) {
      return;
    }

    activeView = route;
    saveActiveRoute(route);

    if (eventBus && typeof eventBus.emit === 'function') {
      eventBus.emit('route:changed', { route: activeView });
    }

    renderRoute(root);
  }

  function bindSidebar(root) {
    root.querySelectorAll('[data-view-route]').forEach((button) => {
      button.addEventListener('click', () => setActiveRoute(root, button.dataset.viewRoute || 'dashboard'));
    });
  }

  function bindFlipEntry(root) {
    if (flipEntry && typeof flipEntry.bind === 'function') {
      flipEntry.bind(root, {
        onSave: () => {
          renderRoute(root);
          notify('success', 'Sale recorded', 'Your completed sale was saved.');
        },
        storagePrefix: config.storagePrefix,
        store: flipStore
      });
    }
  }

  function bindOpenPurchases(root) {
    if (openPurchases && typeof openPurchases.bind === 'function') {
      const data = getAppData();
      openPurchases.bind(root, {
        onChange: () => {
          renderRoute(root);
          notify('success', 'Purchases updated', 'Your purchase lots were updated.');
        },
        priceSnapshots: getPriceSnapshots(data),
        storagePrefix: config.storagePrefix,
        store: flipStore
      });
    }
  }

  function bindSavedFlips(root) {
    if (savedFlips && typeof savedFlips.bind === 'function') {
      savedFlips.bind(root, {
        onDelete: () => {
          renderRoute(root);
          notify('info', 'Flip deleted', 'The saved flip was removed.');
        },
        onEdit: (sale) => {
          activeView = 'calculator';
          saveActiveRoute(activeView);
          renderRoute(root);

          const form = root.querySelector('[data-flip-entry-form]');

          if (form && typeof form.loadFlip === 'function') {
            form.loadFlip(sale);
          }
        },
        storagePrefix: config.storagePrefix,
        store: flipStore
      });
    }
  }

  function bindBackup(root) {
    if (backup && typeof backup.bind === 'function') {
      backup.bind(root, {
        eventBus,
        onImport: () => renderRoute(root),
        storagePrefix: config.storagePrefix
      });
    }
  }

  function bindRouteModules(root) {
    if (activeView === 'calculator') {
      bindFlipEntry(root);
      return;
    }

    if (activeView === 'history') {
      bindSavedFlips(root);
      return;
    }

    if (activeView === 'purchases') {
      bindOpenPurchases(root);
      return;
    }

    if (activeView === 'settings') {
      bindBackup(root);
    }
  }

  function renderApp(root) {
    root.innerHTML = '';

    if (!windowShell) {
      root.innerHTML = '<div class="ftp-window"><main class="ftp-body"><section class="ftp-card"><h2>Startup error</h2><p>Window shell failed to load.</p></section></main></div>';
      return;
    }

    const appWindow = windowShell.createWindow({
      title: config.appName,
      shortTitle: config.shortName || 'FT',
      version: config.version,
      bodyHtml: getAppHtml(),
      storagePrefix: config.storagePrefix
    });

    root.appendChild(appWindow);
    windowShell.restorePosition(root, config.storagePrefix);
    bindSidebar(root);
    bindRouteModules(root);
  }

  function start() {
    if (!document.body) {
      window.requestAnimationFrame(start);
      return;
    }

    if (storageService && typeof storageService.load === 'function') {
      storageService.load(config.storagePrefix);
    }

    injectStyles();
    const root = createRoot();

    if (notificationService && typeof notificationService.bind === 'function') {
      notificationService.bind(eventBus, { rootId: config.rootId });
    }

    renderApp(root);
  }

  start();
}());
