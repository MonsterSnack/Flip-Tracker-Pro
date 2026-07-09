const FlipTrackerProConfig = Object.freeze({
  appName: 'Flip Tracker Pro',
  shortName: 'FT',
  version: '0.8.1',
  rootId: 'flip-tracker-pro-root',
  storagePrefix: 'flipTrackerPro',
  defaultWindow: {
    width: 760,
    height: 560,
    top: 96,
    right: 24
  },
  requiredApiSelections: Object.freeze([
    'key -> info',
    'user -> log',
    'torn -> items',
    'market -> itemmarket'
  ]),
  requiredLogTypeIds: Object.freeze([1225, 1220, 4201, 1112, 4200, 5927, 5510]),
  requiredLogTypeDescriptions: Object.freeze({
    1225: 'Item buy/sell/trade log type required for Flip Tracker Pro import',
    1220: 'Item buy/sell/trade log type required for Flip Tracker Pro import',
    4201: 'Item buy/sell/trade log type required for Flip Tracker Pro import',
    1112: 'Item buy/sell/trade log type required for Flip Tracker Pro import',
    4200: 'Item buy/sell/trade log type required for Flip Tracker Pro import',
    5927: 'Item buy/sell/trade log type required for Flip Tracker Pro import',
    5510: 'Item buy/sell/trade log type required for Flip Tracker Pro import'
  })
});

function injectFlipTrackerProApiKeyHelper() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const isApiPreferencesPage = /\/preferences\.php/i.test(window.location.pathname) && String(window.location.hash || '').toLowerCase().includes('api');

  if (!isApiPreferencesPage || document.querySelector('[data-ftp-api-key-helper]')) {
    return;
  }

  const selections = FlipTrackerProConfig.requiredApiSelections.join('\n');
  const logIds = FlipTrackerProConfig.requiredLogTypeIds.join(', ');
  const setupInstructions = [
    'Create a Custom Torn API key named Flip Tracker Pro.',
    `Required selections: ${FlipTrackerProConfig.requiredApiSelections.join(', ')}.`,
    `Required user -> log IDs: ${logIds}.`,
    'If Torn lets you leave log categories/types empty, that should grant access to all log categories/types.',
    'Do not share your Torn password. Manually copy the generated key and paste it into Flip Tracker Pro.'
  ].join('\n');

  function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text);
    }
  }

  function tryFocusKeyName() {
    const possibleInputs = [...document.querySelectorAll('input[type="text"], input:not([type])')];
    const keyNameInput = possibleInputs.find((input) => /name|title|key/i.test(`${input.name || ''} ${input.id || ''} ${input.placeholder || ''}`));

    if (keyNameInput) {
      keyNameInput.focus();
      if (!keyNameInput.value) {
        keyNameInput.value = 'Flip Tracker Pro';
        keyNameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  function render() {
    const panel = document.createElement('aside');
    panel.dataset.ftpApiKeyHelper = 'true';
    panel.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:100001;max-width:360px;padding:14px;border:1px solid #313744;border-radius:8px;background:#151820;color:#f4f6fb;font:12px/1.45 Arial,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.35)';
    panel.innerHTML = `
      <strong style="display:block;margin-bottom:6px;font-size:14px">Flip Tracker Pro API helper</strong>
      <span style="display:block;color:#b8c0cf;margin-bottom:8px">Create a Custom key named <b>Flip Tracker Pro</b>. Do not use your Torn password. Copy the generated key yourself and paste it into Flip Tracker Pro.</span>
      <span style="display:block;color:#9aa3b2">Selections: ${FlipTrackerProConfig.requiredApiSelections.join(', ')}</span>
      <span style="display:block;color:#9aa3b2;margin:6px 0 10px">Log IDs: ${logIds}</span>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        <button type="button" data-copy-selections>Copy selections</button>
        <button type="button" data-copy-log-ids>Copy log IDs</button>
        <button type="button" data-copy-setup>Copy setup</button>
        <button type="button" data-focus-name>Fill key name</button>
      </div>
    `;

    panel.querySelectorAll('button').forEach((button) => {
      button.style.cssText = 'border:0;border-radius:6px;background:#313744;color:#f4f6fb;cursor:pointer;font:inherit;padding:7px 8px';
    });

    panel.querySelector('[data-copy-selections]').addEventListener('click', () => copyText(selections));
    panel.querySelector('[data-copy-log-ids]').addEventListener('click', () => copyText(logIds));
    panel.querySelector('[data-copy-setup]').addEventListener('click', () => copyText(setupInstructions));
    panel.querySelector('[data-focus-name]').addEventListener('click', tryFocusKeyName);
    document.body.appendChild(panel);
  }

  if (document.body) {
    render();
    return;
  }

  window.requestAnimationFrame(injectFlipTrackerProApiKeyHelper);
}

if (typeof window !== 'undefined') {
  window.FlipTrackerProConfig = FlipTrackerProConfig;
  injectFlipTrackerProApiKeyHelper();
}
