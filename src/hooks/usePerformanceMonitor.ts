/**
 * Performance Monitoring Hook
 * Tracks component render performance and web vitals
 */

import { useEffect, useRef, useCallback } from 'react';
import { errorLogger } from '@/lib/monitoring/errorLogger';

export interface PerformanceMetrics {
  renderTime: number;
  mountTime: number;
  updateCount: number;
  lastRenderTimestamp: number;
}

export interface WebVitals {
  FCP?: number; // First Contentful Paint
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  TTFB?: number; // Time to First Byte
}

/**
 * Hook to monitor component performance
 */
export function useComponentPerformance(componentName: string, threshold: number = 16) {
  const metricsRef = useRef<PerformanceMetrics>({
    renderTime: 0,
    mountTime: 0,
    updateCount: 0,
    lastRenderTimestamp: 0,
  });

  const startTimeRef = useRef<number>(0);
  const mountTimeRef = useRef<number>(0);

  useEffect(() => {
    // Record mount time
    mountTimeRef.current = performance.now();
    
    return () => {
      // Log slow unmounts if needed
      const unmountTime = performance.now() - mountTimeRef.current;
      if (unmountTime > 1000) {
        errorLogger.warn(`Component ${componentName} was mounted for ${unmountTime.toFixed(2)}ms`, {
          component: componentName,
          mountTime: unmountTime,
        });
      }
    };
  }, [componentName]);

  const startMeasure = useCallback(() => {
    startTimeRef.current = performance.now();
  }, []);

  const endMeasure = useCallback(() => {
    if (startTimeRef.current === 0) return;

    const renderTime = performance.now() - startTimeRef.current;
    metricsRef.current.renderTime = renderTime;
    metricsRef.current.updateCount++;
    metricsRef.current.lastRenderTimestamp = Date.now();

    // Log slow renders
    if (renderTime > threshold) {
      errorLogger.warn(
        `Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`,
        {
          component: componentName,
          renderTime,
          threshold,
          updateCount: metricsRef.current.updateCount,
        }
      );
    }

    startTimeRef.current = 0;
  }, [componentName, threshold]);

  return {
    startMeasure,
    endMeasure,
    metrics: metricsRef.current,
  };
}

/**
 * Hook to monitor web vitals
 */
export function useWebVitals() {
  const vitalsRef = useRef<WebVitals>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if PerformanceObserver is supported
    if ('PerformanceObserver' in window) {
      
      // First Contentful Paint
      try {
        const fcpObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              vitalsRef.current.FCP = entry.startTime;
              
              if (entry.startTime > 1800) {
                errorLogger.warn('Slow FCP detected', { 
                  FCP: entry.startTime,
                  threshold: 1800 
                });
              }
            }
          }
        });
        fcpObserver.observe({ entryTypes: ['paint'] });
      } catch (e) {
        console.error('FCP observation failed:', e);
      }

      // Largest Contentful Paint
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitalsRef.current.LCP = lastEntry.startTime;

          if (lastEntry.startTime > 2500) {
            errorLogger.warn('Slow LCP detected', { 
              LCP: lastEntry.startTime,
              threshold: 2500 
            });
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        console.error('LCP observation failed:', e);
      }

      // First Input Delay
      try {
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const fidEntry = entry as PerformanceEventTiming;
            const delay = fidEntry.processingStart - fidEntry.startTime;
            vitalsRef.current.FID = delay;

            if (delay > 100) {
              errorLogger.warn('Slow FID detected', { 
                FID: delay,
                threshold: 100 
              });
            }
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        console.error('FID observation failed:', e);
      }

      // Cumulative Layout Shift
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShiftEntry = entry as any;
            if (!layoutShiftEntry.hadRecentInput) {
              clsValue += layoutShiftEntry.value;
            }
          }
          vitalsRef.current.CLS = clsValue;

          if (clsValue > 0.1) {
            errorLogger.warn('High CLS detected', { 
              CLS: clsValue,
              threshold: 0.1 
            });
          }
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        console.error('CLS observation failed:', e);
      }
    }

    // Time to First Byte (TTFB)
    if (performance && performance.timing) {
      const timing = performance.timing;
      const ttfb = timing.responseStart - timing.navigationStart;
      vitalsRef.current.TTFB = ttfb;

      if (ttfb > 600) {
        errorLogger.warn('Slow TTFB detected', { 
          TTFB: ttfb,
          threshold: 600 
        });
      }
    }

  }, []);

  return vitalsRef.current;
}

/**
 * Hook to measure API call performance
 */
export function useApiPerformance() {
  const requestTimesRef = useRef<Map<string, number>>(new Map());

  const startRequest = useCallback((requestId: string) => {
    requestTimesRef.current.set(requestId, performance.now());
  }, []);

  const endRequest = useCallback((requestId: string, endpoint: string) => {
    const startTime = requestTimesRef.current.get(requestId);
    if (!startTime) return;

    const duration = performance.now() - startTime;
    requestTimesRef.current.delete(requestId);

    // Log slow API calls
    if (duration > 1000) {
      errorLogger.warn(`Slow API call to ${endpoint}: ${duration.toFixed(2)}ms`, {
        endpoint,
        duration,
        threshold: 1000,
      });
    }

    return duration;
  }, []);

  return { startRequest, endRequest };
}

/**
 * Hook to measure memory usage
 */
export function useMemoryMonitor() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check if performance.memory is available (Chrome only)
    const memory = (performance as any).memory;
    if (!memory) return;

    const checkMemory = () => {
      const usedMB = memory.usedJSHeapSize / 1048576;
      const totalMB = memory.totalJSHeapSize / 1048576;
      const limitMB = memory.jsHeapSizeLimit / 1048576;

      // Warn if memory usage is high (>80% of limit)
      if (usedMB / limitMB > 0.8) {
        errorLogger.warn('High memory usage detected', {
          usedMB: usedMB.toFixed(2),
          totalMB: totalMB.toFixed(2),
          limitMB: limitMB.toFixed(2),
          percentage: ((usedMB / limitMB) * 100).toFixed(2),
        });
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkMemory, 30000);
    
    // Initial check
    checkMemory();

    return () => clearInterval(interval);
  }, []);
}

export default useComponentPerformance;
