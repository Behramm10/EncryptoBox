import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 3500) => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

function ToastItem({ toast, onDismiss }) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const colors = {
        success: 'border-green-500/40 bg-green-500/10 text-green-300',
        error: 'border-red-500/40 bg-red-500/10 text-red-300',
        info: 'border-primary-500/40 bg-primary-500/10 text-primary-300',
        warning: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
    };

    return (
        <div className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-xl ${colors[toast.type] || colors.info} animate-slide-up min-w-[220px] max-w-xs`}>
            <span className="text-lg flex-shrink-0">{icons[toast.type] || icons.info}</span>
            <span className="text-sm font-medium flex-1">{toast.message}</span>
            <button onClick={() => onDismiss(toast.id)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity text-xs" aria-label="Dismiss">✕</button>
        </div>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside ToastProvider');
    return ctx.addToast;
}

export default ToastContext;
