/**
 * System Health Monitor Hook
 * Monitors database connectivity, API response times, memory usage,
 * error rates, and provides an overall health score.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  lastChecked: string;
  message: string;
  critical?: boolean;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'down';
  score: number; // 0-100
  checks: HealthCheck[];
  uptime: number;
  errorRate: number;
  memoryUsage: number;
  lastUpdated: string;
}

export interface HealthCheckConfig {
  name: string;
  checkFn: () => Promise<{ ok: boolean; latency: number; message: string }>;
  interval: number; // ms
  critical: boolean;
}

const DEFAULT_HEALTH: SystemHealth = {
  overall: 'healthy',
  score: 100,
  checks: [],
  uptime: 0,
  errorRate: 0,
  memoryUsage: 0,
  lastUpdated: new Date().toISOString(),
};

export function useSystemHealth(checkConfigs: HealthCheckConfig[] = []) {
  const [health, setHealth] = useState<SystemHealth>(DEFAULT_HEALTH);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const startTimeRef = useRef(Date.now());
  const errorCountRef = useRef(0);
  const totalChecksRef = useRef(0);
  const intervalRefs = useRef<NodeJS.Timeout[]>([]);

  /**
   * Run a single health check
   */
  const runCheck = useCallback(async (config: HealthCheckConfig): Promise<HealthCheck> => {
    try {
      const result = await config.checkFn();
      totalChecksRef.current++;

      if (!result.ok) {
        errorCountRef.current++;
      }

      const status: HealthCheck['status'] = result.ok
        ? result.latency < 1000
          ? 'healthy'
          : 'degraded'
        : 'down';

      return {
        name: config.name,
        status,
        latency: result.latency,
        lastChecked: new Date().toISOString(),
        message: result.message,
      };
    } catch (error: any) {
      totalChecksRef.current++;
      errorCountRef.current++;

      return {
        name: config.name,
        status: 'down',
        latency: -1,
        lastChecked: new Date().toISOString(),
        message: error.message || 'Health check failed',
      };
    }
  }, []);

  /**
   * Run all health checks and compute overall health
   */
  const runAllChecks = useCallback(async () => {
    if (checkConfigs.length === 0) return;

    const checks = await Promise.all(checkConfigs.map(config => runCheck(config)));

    const errorRate =
      totalChecksRef.current > 0
        ? (errorCountRef.current / totalChecksRef.current) * 100
        : 0;

    // Calculate health score
    const degradedCount = checks.filter(c => c.status === 'degraded').length;
    const downCount = checks.filter(c => c.status === 'down').length;
    const criticalDown = checks.some(c => c.critical && c.status === 'down');

    let score = 100;
    score -= downCount * 30;
    score -= degradedCount * 10;
    score = Math.max(0, Math.min(100, score));

    const overall: SystemHealth['overall'] = criticalDown
      ? 'down'
      : score >= 80
        ? 'healthy'
        : score >= 50
          ? 'degraded'
          : 'down';

    // Memory usage (if available)
    let memoryUsage = 0;
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const perfMemory = (performance as any).memory;
      if (perfMemory) {
        memoryUsage = Math.round((perfMemory.usedJSHeapSize / perfMemory.jsHeapSizeLimit) * 100);
      }
    }

    const uptime = Date.now() - startTimeRef.current;

    setHealth({
      overall,
      score,
      checks,
      uptime,
      errorRate: Math.round(errorRate * 100) / 100,
      memoryUsage,
      lastUpdated: new Date().toISOString(),
    });
  }, [checkConfigs, runCheck]);

  /**
   * Start monitoring
   */
  const startMonitoring = useCallback(
    (intervalMs: number = 30000) => {
      setIsMonitoring(true);

      // Run immediately
      runAllChecks();

      // Run periodically
      const interval = setInterval(runAllChecks, intervalMs);
      intervalRefs.current.push(interval);
    },
    [runAllChecks]
  );

  /**
   * Stop monitoring
   */
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    intervalRefs.current.forEach(clearInterval);
    intervalRefs.current = [];
  }, []);

  /**
   * Get health summary text
   */
  const getHealthSummary = useCallback((): string => {
    if (health.checks.length === 0) return 'Belum ada health check';
    const healthy = health.checks.filter(c => c.status === 'healthy').length;
    const total = health.checks.length;
    return `${healthy}/${total} services healthy (Score: ${health.score}%)`;
  }, [health]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intervalRefs.current.forEach(clearInterval);
    };
  }, []);

  return {
    health,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    runAllChecks,
    getHealthSummary,
  };
}

/**
 * Factory for creating common health check configs
 */
export function createSiswaHealthChecks(
  fetchDataFn: () => Promise<{ success: boolean; data?: any[] }>
): HealthCheckConfig[] {
  return [
    {
      name: 'Database (Siswa)',
      checkFn: async () => {
        const start = Date.now();
        try {
          const result = await fetchDataFn();
          const latency = Date.now() - start;
          return {
            ok: result.success,
            latency,
            message: result.success
              ? `${(result.data || []).length} records loaded`
              : 'Failed to fetch data',
          };
        } catch (error: any) {
          return { ok: false, latency: Date.now() - start, message: error.message };
        }
      },
      interval: 60000,
      critical: true,
    },
  ];
}
