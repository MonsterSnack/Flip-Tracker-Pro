const FlipTrackerProEventBus = (() => {
  const listeners = new Map();

  function getListeners(eventName) {
    if (!listeners.has(eventName)) {
      listeners.set(eventName, new Set());
    }

    return listeners.get(eventName);
  }

  function on(eventName, handler) {
    if (!eventName || typeof handler !== 'function') {
      return () => {};
    }

    getListeners(eventName).add(handler);
    return () => off(eventName, handler);
  }

  function off(eventName, handler) {
    const eventListeners = listeners.get(eventName);

    if (!eventListeners) {
      return;
    }

    eventListeners.delete(handler);

    if (eventListeners.size === 0) {
      listeners.delete(eventName);
    }
  }

  function once(eventName, handler) {
    if (typeof handler !== 'function') {
      return () => {};
    }

    const unsubscribe = on(eventName, (payload) => {
      unsubscribe();
      handler(payload);
    });

    return unsubscribe;
  }

  function emit(eventName, payload) {
    const eventListeners = listeners.get(eventName);

    if (!eventListeners) {
      return;
    }

    [...eventListeners].forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        window.setTimeout(() => {
          throw error;
        }, 0);
      }
    });
  }

  return {
    emit,
    off,
    on,
    once
  };
})();

if (typeof window !== 'undefined') {
  window.FlipTrackerProEventBus = FlipTrackerProEventBus;
}
