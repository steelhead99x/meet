'use client';

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error Boundary component that catches React errors in child components.
 * Provides a fallback UI when an error occurs instead of crashing the entire app.
 * 
 * @example
 * ```tsx
 * <RoomErrorBoundary>
 *   <YourComponent />
 * </RoomErrorBoundary>
 * ```
 */
export class RoomErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Room error caught by boundary:', error, errorInfo);
    
    // You can also log to an error reporting service here
    // Example: logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: '#070707',
            color: 'white',
          }}
        >
          <div style={{ maxWidth: '500px' }}>
            <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>
              Something went wrong
            </h2>
            <p style={{ marginBottom: '24px', color: '#888' }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                className="lk-button"
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  cursor: 'pointer',
                }}
              >
                Reload Page
              </button>
              <button
                className="lk-button"
                onClick={() => (window.location.href = '/')}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  cursor: 'pointer',
                }}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

