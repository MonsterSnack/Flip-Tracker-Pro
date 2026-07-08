const FlipTrackerProNotificationService = (() => {
  const allowedTypes = new Set(['success', 'error', 'warning', 'info']);
  let container = null;

  function ensureContainer(rootId) {
    if (container && document.body.contains(container)) {
      return container;
    }

    container = document.createElement('div');
    container.className = 'ftp-notifications';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-label', 'Flip Tracker notifications');

    const root = rootId ? document.getElementById(rootId) : null;
    (root || document.body).appendChild(container);
    return container;
  }

  function notify({ type = 'info', title = '', message = '', duration = 3200 } = {}, options = {}) {
    const resolvedType = allowedTypes.has(type) ? type : 'info';
    const notifications = ensureContainer(options.rootId);
    const toast = document.createElement('section');

    toast.className = 'ftp-notification';
    toast.dataset.type = resolvedType;
    toast.innerHTML = `
      <strong>${title || resolvedType}</strong>
      ${message ? `<span>${message}</span>` : ''}
    `;

    notifications.appendChild(toast);
    window.requestAnimationFrame(() => {
      toast.dataset.visible = 'true';
    });

    window.setTimeout(() => {
      toast.dataset.visible = 'false';
      window.setTimeout(() => toast.remove(), 220);
    }, duration);

    return toast;
  }

  function bind(eventBus, options = {}) {
    if (!eventBus || typeof eventBus.on !== 'function') {
      return () => {};
    }

    return eventBus.on('notify', (payload) => notify(payload, options));
  }

  return {
    bind,
    notify
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProNotificationService = FlipTrackerProNotificationService;
}
