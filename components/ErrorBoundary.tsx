import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Enhanced TDZ error detection
    console.error('🔴 ErrorBoundary caught error:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      isTDZError: error.message.includes('uninitialized') || error.message.includes('before initialization'),
      timestamp: new Date().toISOString()
    });
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Detailed error logging for TDZ debugging
    console.error('🔴 ErrorBoundary componentDidCatch:', {
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
      isTDZError: error.message.includes('uninitialized') || 
                  error.message.includes('before initialization') ||
                  error.message.includes('Cannot access'),
      timestamp: new Date().toISOString()
    });
    
    // Try to extract variable name from TDZ error message
    const tdZMatch = error.message.match(/Cannot access '(\w+)' before initialization|Cannot access uninitialized variable\.?\s*'?(\w+)?'?/i);
    if (tdZMatch) {
      console.error('🎯 TDZ Variable Name:', tdZMatch[1] || tdZMatch[2] || 'unknown');
    }
    
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          border: '2px solid #ef4444',
          borderRadius: '8px',
          backgroundColor: '#1f2937',
          color: '#ef4444',
          textAlign: 'center'
        }}>
          <h2 style={{ margin: '0 0 10px 0', color: '#ef4444', fontSize: '20px', fontWeight: 'bold' }}>
            Unable to load player stats
          </h2>
          <p style={{ margin: '0 0 15px 0', color: '#9ca3af', fontSize: '14px' }}>
            Please try again or search for a different player.
          </p>
          <details style={{ whiteSpace: 'pre-wrap', textAlign: 'left', marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '10px', color: '#6b7280', fontSize: '12px' }}>
              Technical Details
            </summary>
            {this.state.error && (
              <div style={{ marginBottom: '10px', fontSize: '11px', color: '#6b7280' }}>
                <strong>Error:</strong> {this.state.error.toString()}
              </div>
            )}
            {this.state.errorInfo && (
              <div style={{ fontSize: '11px', color: '#6b7280' }}>
                <strong>Component Stack:</strong> {this.state.errorInfo.componentStack}
              </div>
            )}
          </details>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              window.location.reload();
            }}
            style={{
              marginTop: '15px',
              padding: '10px 20px',
              backgroundColor: '#71FD08',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
