const MAX_ENTRIES = 120;

export function recordPerformanceMetric(name, detail = {}) {
  if (typeof globalThis === "undefined") return;
  const performanceApi = globalThis.performance;
  const now = typeof performanceApi?.now === "function" ? performanceApi.now() : Date.now();
  const entry = {
    name,
    at: Math.round(now * 100) / 100,
    ...detail
  };
  const metrics = globalThis.__WWMCD_PERF__ ?? [];
  metrics.push(entry);
  if (metrics.length > MAX_ENTRIES) metrics.splice(0, metrics.length - MAX_ENTRIES);
  globalThis.__WWMCD_PERF__ = metrics;
}

export function measurePerformance(name, fn) {
  const performanceApi = globalThis?.performance;
  const start = typeof performanceApi?.now === "function" ? performanceApi.now() : Date.now();
  try {
    return fn();
  } finally {
    const end = typeof performanceApi?.now === "function" ? performanceApi.now() : Date.now();
    recordPerformanceMetric(name, { durationMs: Math.round((end - start) * 100) / 100 });
  }
}

export async function measureAsyncPerformance(name, fn) {
  const performanceApi = globalThis?.performance;
  const start = typeof performanceApi?.now === "function" ? performanceApi.now() : Date.now();
  try {
    return await fn();
  } finally {
    const end = typeof performanceApi?.now === "function" ? performanceApi.now() : Date.now();
    recordPerformanceMetric(name, { durationMs: Math.round((end - start) * 100) / 100 });
  }
}
