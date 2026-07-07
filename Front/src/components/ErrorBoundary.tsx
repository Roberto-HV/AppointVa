import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center text-2xl select-none">
              ⚠️
            </div>
            <h1 className="text-lg font-bold text-gray-800">Algo salió mal</h1>
            <p className="text-sm text-gray-500 max-w-sm">
              Ocurrió un error inesperado. Por favor recarga la página o intenta más tarde.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 bg-[#C8A961] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition"
            >
              Recargar página
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
