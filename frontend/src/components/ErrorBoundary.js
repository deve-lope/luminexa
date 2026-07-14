import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
          <p className="mt-2 max-w-sm text-sm text-slate-600">
            Try refreshing the page. If the problem continues, sign out and sign in again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 min-h-[44px] rounded-xl bg-luminexa-accent px-6 font-medium text-white"
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
