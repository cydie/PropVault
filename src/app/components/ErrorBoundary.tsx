import React from 'react';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
          <div className="max-w-md w-full bg-white rounded-xl border border-red-200 shadow-lg p-6 text-center">
            <h1 className="text-lg font-semibold text-red-700 mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-600 mb-4">{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('propvault_user');
                localStorage.removeItem('propvault_token');
                window.location.reload();
              }}
              className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              Clear session &amp; reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
