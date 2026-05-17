export function createEventBus() {
  const listeners = new Map();

  function on(eventName, handler) {
    const eventListeners = listeners.get(eventName) ?? new Set();
    eventListeners.add(handler);
    listeners.set(eventName, eventListeners);
    return () => eventListeners.delete(handler);
  }

  function emit(eventName, detail = {}) {
    for (const handler of listeners.get(eventName) ?? []) {
      handler(detail);
    }
  }

  return { on, emit };
}
