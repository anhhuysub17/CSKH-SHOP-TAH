import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Đã xảy ra lỗi không xác định.',
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full border border-slate-800 bg-slate-900 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-amber-400">
              Cảnh báo kết nối dữ liệu
            </h2>
            <p className="text-sm text-slate-300 break-words font-mono">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              className="px-4 py-2 text-xs font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors"
            >
              Tải lại ứng dụng
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
