const fs = require('fs');
const path = require('path');

const VERSION = '0.8.3';
const ROOT = path.resolve(__dirname, '..');
const DIST_PATH = path.join(ROOT, 'dist', 'flip-tracker-pro.user.js');

const metadataHeader = `// ==UserScript==
// @name         Flip Tracker Pro
// @namespace    https://www.torn.com/
// @version      ${VERSION}
// @description  Professional standalone flip tracking app for Torn
// @author       MonsterSnack
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @connect      api.torn.com
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==`;

const sourceFiles = [
  'src/core/config.js',
  'src/utils/html.js',
  'src/services/event-bus.js',
  'src/services/storage-service.js',
  'src/services/notification-service.js',
  'src/services/trade-accounting-service.js',
  'src/services/torn-api-service.js',
  'src/services/log-import-service.js',
  'src/ui/window.js',
  'src/services/purchase-lot-service.js',
  'src/services/portfolio-service.js',
  'src/services/statistics-service.js',
  'src/services/flip-store.js',
  'src/modules/dashboard/dashboard.js',
  'src/modules/analytics/analytics.js',
  'src/modules/flip-entry/flip-entry.js',
  'src/modules/open-purchases/open-purchases.js',
  'src/modules/backup/backup.js',
  'src/modules/saved-flips/saved-flips.js',
  'src/core/app.js'
];

const cssFiles = [
  'src/styles/app.css'
];

const globalNames = [
  'FlipTrackerProConfig',
  'FlipTrackerProHtml',
  'FlipTrackerProEventBus',
  'FlipTrackerProStorageService',
  'FlipTrackerProNotificationService',
  'FlipTrackerProTradeAccountingService',
  'FlipTrackerProTornApiService',
  'FlipTrackerProLogImportService',
  'FlipTrackerProWindow',
  'FlipTrackerProPurchaseLotService',
  'FlipTrackerProPortfolioService',
  'FlipTrackerProStatisticsService',
  'FlipTrackerProFlipStore',
  'FlipTrackerProDashboard',
  'FlipTrackerProAnalytics',
  'FlipTrackerProFlipEntry',
  'FlipTrackerProOpenPurchases',
  'FlipTrackerProBackup',
  'FlipTrackerProSavedFlips'
];

function readRequired(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Required file is missing: ${relativePath}`);
  }

  return fs.readFileSync(absolutePath, 'utf8').replace(/\r\n/g, '\n');
}

function stripUserscriptHeader(source) {
  return source.replace(/^\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
}

function stripWindowExports(source) {
  let output = source;

  globalNames.forEach((name) => {
    const simpleExport = new RegExp(`\\n?if \\(typeof window !== 'undefined'\\) \\{\\s*window\\.${name} = ${name};\\s*\\}\\s*`, 'g');
    output = output.replace(simpleExport, '\n');
    output = output.replace(new RegExp(`window\\.${name}`, 'g'), name);
  });

  output = output.replace(/window\.localStorage/g, 'localStorage');
  output = output.replace(/window\.alert/g, 'alert');
  output = output.replace(/window\.confirm/g, 'confirm');
  output = output.replace(/window\.open/g, 'window.open');
  output = output.replace(/window\.requestAnimationFrame/g, 'requestAnimationFrame');
  output = output.replace(/window\.setTimeout/g, 'setTimeout');

  return output;
}

function buildSource() {
  return sourceFiles.map((relativePath) => {
    const source = stripUserscriptHeader(readRequired(relativePath));
    return `\n  /* ${relativePath} */\n${stripWindowExports(source).trim()}\n`;
  }).join('\n');
}

function buildCss() {
  return cssFiles.map((relativePath) => `/* ${relativePath} */\n${readRequired(relativePath).trim()}\n`).join('\n');
}

function validateOutput(output) {
  const checks = [
    { pattern: /@require\b/, message: 'dist must not contain @require dependencies.' },
    { pattern: /(^|\n)\s*import\s+(?:[\w{*]|\()/, message: 'dist must not contain import statements or dynamic import().' },
    { pattern: /(^|\n)\s*export\s+/, message: 'dist must not contain export statements.' },
    { pattern: /raw\.githubusercontent\.com/i, message: 'dist must not load GitHub raw source files.' },
    { pattern: /<link\b/i, message: 'dist must not include external CSS links.' },
    { pattern: /<script\b/i, message: 'dist must not include external script tags.' }
  ];

  checks.forEach((check) => {
    if (check.pattern.test(output)) {
      throw new Error(check.message);
    }
  });
}

function renderUserscript() {
  const css = JSON.stringify(buildCss());
  const source = buildSource();

  return `${metadataHeader}

(function flipTrackerProStandalone() {
  'use strict';

  const standaloneCss = ${css};

  function injectStandaloneCss(cssText) {
    if (!cssText || !cssText.trim()) {
      return;
    }

    if (typeof GM_addStyle === 'function') {
      GM_addStyle(cssText);
      return;
    }

    const style = document.createElement('style');
    style.dataset.flipTrackerProStandaloneStyles = 'true';
    style.textContent = cssText;
    document.head.appendChild(style);
  }

  injectStandaloneCss(standaloneCss);
${source}

  if (typeof window !== 'undefined') {
    window.FlipTrackerPro = Object.freeze({
      version: FlipTrackerProConfig.version,
      config: FlipTrackerProConfig,
      services: Object.freeze({
        storage: FlipTrackerProStorageService,
        tornApi: FlipTrackerProTornApiService,
        logImport: FlipTrackerProLogImportService,
        tradeAccounting: FlipTrackerProTradeAccountingService
      }),
      runParserSelfTest: FlipTrackerProLogImportService.runParserSelfTest
    });
  }
}());
`;
}

function main() {
  const output = renderUserscript();
  validateOutput(output);
  fs.mkdirSync(path.dirname(DIST_PATH), { recursive: true });
  fs.writeFileSync(DIST_PATH, output, 'utf8');
  console.log(`Built ${path.relative(ROOT, DIST_PATH)} (${output.length.toLocaleString()} bytes).`);
}

main();