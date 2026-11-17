'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { withBasePath } from '@/lib/base-path';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and displays fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log error to monitoring service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
    
    // Send to error tracking service
    this.logError(error, errorInfo);
  }

  private logError(error: Error, errorInfo: ErrorInfo) {
    // In production, send to error tracking service (Sentry, LogRocket, etc.)
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { extra: errorInfo });
      fetch(withBasePath('/api/log-error'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      }).catch(console.error);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = withBasePath('/dashboard');
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 rounded-[3rem] p-10 shadow-2xl max-w-md w-full text-center">
            <div className="w-20 h-20 bg-rose-500/10 rounded-3xl mx-auto mb-6 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-rose-500" />
            </div>
            
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
              Terjadi Kesalahan
            </h2>
            
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Mohon maaf, terjadi kesalahan tak terduga. Silakan coba muat ulang halaman atau kembali ke beranda.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-slate-100 dark:bg-white/5 rounded-2xl p-4 mb-6 text-left overflow-auto max-h-40">
                <p className="text-xs font-mono text-rose-500 mb-2">{this.state.error.message}</p>
                {this.state.errorInfo && (
                  <pre className="text-[10px] font-mono text-slate-500 dark:text-slate-400 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Muat Ulang
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="flex-1 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-white/10"
              >
                <Home className="w-4 h-4" />
                Beranda
              </button>
            </div>

            <button
              onClick={this.handleReset}
              className="mt-4 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-Order Component for wrapping components with Error Boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;
