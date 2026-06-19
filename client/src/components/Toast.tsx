import { useState, useCallback, useEffect } from "react";

interface Toast {
  id: number;
  message: string;
  type: "error" | "info";
}

let nextId = 1;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: "error" | "info" = "error") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return { toasts, addToast };
}

interface ToastContainerProps {
  toasts: Toast[];
}

export function ToastContainer({ toasts }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg px-4 py-3 text-sm shadow-lg text-white animate-fade-in ${
            t.type === "error" ? "bg-red-600" : "bg-gray-800"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

// Auto-dismissing error boundary fallback
interface ErrorBoundaryDisplayProps {
  error: string | null;
  onDismiss: () => void;
}

export function InlineError({ error, onDismiss }: ErrorBoundaryDisplayProps) {
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [error, onDismiss]);

  if (!error) return null;
  return (
    <div
      role="alert"
      onClick={onDismiss}
      className="cursor-pointer text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3"
    >
      {error}
    </div>
  );
}
