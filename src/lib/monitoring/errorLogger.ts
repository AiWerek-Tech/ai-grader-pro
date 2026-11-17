/**
 * Error Logging Service
 * Centralized error tracking and logging for the application
 */

export interface ErrorLog {
  id: string;
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  userAgent: string;
  url: string;
  userId?: string;
}

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

import { withBasePath } from '@/lib/base-path';

class ErrorLogger {
  private logs: ErrorLog[] = [];
  private maxLogs: number = 100;
  private listeners: Array<(log: ErrorLog) => void> = [];

  /**
   * Generate unique error ID
   */
  private generateId(): string {
    return `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log an error
   */
  log(
    error: Error | string,
    severity: ErrorSeverity = 'medium',
    context?: Record<string, any>
  ): ErrorLog {
    const errorLog: ErrorLog = {
      id: this.generateId(),
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date(),
      severity,
      context,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userId: this.getCurrentUserId(),
    };

    // Add to local logs
    this.logs.unshift(errorLog);
    
    // Trim logs if exceeding max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Console output in development
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod = severity === 'critical' || severity === 'high' 
        ? console.error 
        : severity === 'medium' 
        ? console.warn 
        : console.log;
      
      consoleMethod(`[${severity.toUpperCase()}] ${errorLog.message}`, errorLog);
    }

    // Send to remote logging service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToRemote(errorLog);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(errorLog));

    return errorLog;
  }

  /**
   * Get current user ID from session/storage
   */
  private getCurrentUserId(): string | undefined {
    if (typeof window !== 'undefined') {
      // Try to get from localStorage or session
      const user = localStorage.getItem('user');
      if (user) {
        try {
          const userData = JSON.parse(user);
          return userData.id || userData.userId;
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }

  /**
   * Send error to remote logging endpoint
   */
  private async sendToRemote(log: ErrorLog): Promise<void> {
    try {
      const response = await fetch(withBasePath('/api/log-error'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(log),
      });

      if (!response.ok) {
        console.error('Failed to send error log:', response.statusText);
      }
    } catch (error) {
      // Silent fail - don't create infinite error loops
      console.error('Failed to send error to remote:', error);
    }
  }

  /**
   * Get all logs
   */
  getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  /**
   * Get logs by severity
   */
  getLogsBySeverity(severity: ErrorSeverity): ErrorLog[] {
    return this.logs.filter(log => log.severity === severity);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count: number = 10): ErrorLog[] {
    return this.logs.slice(0, count);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Subscribe to error events
   */
  subscribe(callback: (log: ErrorLog) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Convenience methods for different severity levels
   */
  debug(message: string, context?: Record<string, any>): ErrorLog {
    return this.log(message, 'low', context);
  }

  info(message: string, context?: Record<string, any>): ErrorLog {
    return this.log(message, 'low', context);
  }

  warn(message: string, context?: Record<string, any>): ErrorLog {
    return this.log(message, 'medium', context);
  }

  error(error: Error | string, context?: Record<string, any>): ErrorLog {
    return this.log(error, 'high', context);
  }

  critical(error: Error | string, context?: Record<string, any>): ErrorLog {
    return this.log(error, 'critical', context);
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger();

// Export class for testing
export default ErrorLogger;
