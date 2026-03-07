import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

const QRModal = ({ url, onClose }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (canvasRef.current && url) {
            QRCode.toCanvas(canvasRef.current, url, {
                width: 220,
                margin: 2,
                color: { dark: '#a78bfa', light: '#0a0a0f' },
            });
        }
    }, [url]);

    if (!url) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
            <div className="card p-8 flex flex-col items-center gap-4 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold neon-text">Scan to Join Room</h3>
                <p className="text-xs text-gray-400 text-center">Share this QR code with anyone you want to invite. They&apos;ll be able to join directly.</p>
                <canvas ref={canvasRef} className="rounded-xl shadow-lg shadow-primary-500/20" />
                <div className="w-full">
                    <p className="text-xs text-gray-500 mb-2">Or copy the link:</p>
                    <div className="flex gap-2">
                        <input readOnly value={url} className="input-field text-xs font-mono flex-1 truncate" />
                    </div>
                </div>
                <button onClick={onClose} className="btn-secondary w-full text-sm">Close</button>
            </div>
        </div>
    );
};

export default QRModal;
