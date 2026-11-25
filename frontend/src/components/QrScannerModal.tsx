import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { X, Camera, Upload, Link2, AlertCircle } from 'lucide-react';

function extractJoinPath(rawText: string): string | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const idx = url.pathname.indexOf('/join/');
    if (idx !== -1) {
      return `${url.pathname.slice(idx)}${url.search}`;
    }
  } catch {
    // Not a full URL; check if it's a relative /join/... path or raw token
  }

  if (trimmed.startsWith('/join/')) return trimmed;
  if (/^[A-Za-z0-9_-]{16,}$/.test(trimmed)) return `/join/${trimmed}`;
  return null;
}

export function QrScannerModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);

  const handleDecoded = (text: string) => {
    const path = extractJoinPath(text);
    if (path) {
      onClose();
      navigate(path);
    } else {
      setScanError('This QR code is not a valid Common Ground hostel QR.');
    }
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let rafId = 0;
    let active = true;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera is not supported in this browser. You can upload a QR image or paste the link below.');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (!active || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const scanFrame = () => {
          if (!active || !videoRef.current || !canvasRef.current) return;
          const video = videoRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code?.data) {
                handleDecoded(code.data);
                return;
              }
            }
          }
          rafId = requestAnimationFrame(scanFrame);
        };
        rafId = requestAnimationFrame(scanFrame);
      } catch {
        if (active) {
          setCameraError('Camera permission denied or unavailable. Upload a QR image or paste the link below.');
        }
      }
    }

    void startCamera();

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError(null);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          handleDecoded(code.data);
        } else {
          setScanError('Could not detect a QR code in that image.');
        }
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setScanError(null);
    handleDecoded(manualInput);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#E85D3F]" />
            <h2 className="text-base font-bold text-slate-900">Scan Hostel QR Code</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {scanError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{scanError}</span>
          </div>
        )}

        {cameraError ? (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            {cameraError}
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-square max-h-64 mx-auto">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <div className="absolute inset-8 border-2 border-white/80 rounded-2xl pointer-events-none" />
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        <div className="flex items-center justify-center">
          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Upload QR Image
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
        </div>

        <form onSubmit={handleManualSubmit} className="pt-2 border-t border-slate-100 space-y-2">
          <label className="block text-[11px] font-semibold text-slate-500">
            Or paste hostel join link
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder={`${window.location.origin}/join/...`}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
            >
              Go
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
