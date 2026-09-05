"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, Zap, Sparkles, CheckCircle2, QrCode } from 'lucide-react';

interface UnifiedAutoScannerProps {
  onScanComplete: (bottleFile: File, barcodeFile: File | null, barcodeCode: string) => void;
  onClose: () => void;
  category?: string;
}

export default function UnifiedAutoScanner({ onScanComplete, onClose }: UnifiedAutoScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraSupported, setCameraSupported] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Initialize WebRTC Camera Stream
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function initCamera() {
      try {
        const constraints: any = {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            focusMode: { ideal: "continuous" }
          },
          audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = stream;

        const track = stream.getVideoTracks()[0];
        if (track && 'applyConstraints' in track) {
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: "continuous" } as any]
            });
          } catch (e) {
            console.log("Focus constraint note:", e);
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (err) {
        console.warn("WebRTC stream note (fallback to native camera):", err);
        setCameraSupported(false);
      }
    }

    initCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleSnapAndExtract = () => {
    const video = videoRef.current;
    if (!video) return;

    setIsProcessing(true);

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = video.videoWidth || 1920;
    snapCanvas.height = video.videoHeight || 1080;

    const ctx = snapCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);

    snapCanvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'packaged_commodity_label.jpg', { type: 'image/jpeg' });
        onScanComplete(file, file, '');
        onClose();
      }
    }, 'image/jpeg', 0.95);
  };

  const handleNativeCameraFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      onScanComplete(file, file, '');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col justify-between p-3 sm:p-4 overflow-hidden select-none">
      <input
        ref={nativeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleNativeCameraFallback}
      />

      {/* Top Header */}
      <div className="flex justify-between items-center text-white z-10">
        <div>
          <h3 className="text-sm sm:text-base font-bold flex items-center gap-2 text-emerald-400">
            <Zap className="w-4 h-4 fill-emerald-400 text-emerald-400" />
            Legal Metrology Camera Scanner
          </h3>
          <p className="text-[11px] text-slate-300">
            Align bottle or packaged commodity label inside frame
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Viewfinder Area */}
      <div className="relative flex-1 flex items-center justify-center my-3 overflow-hidden rounded-2xl bg-black border border-slate-800">
        {!cameraSupported ? (
          <div className="text-white text-xs p-6 text-center space-y-4 max-w-sm bg-slate-900 border border-slate-700 rounded-xl">
            <Camera className="w-12 h-12 text-emerald-400 mx-auto animate-pulse" />
            <div>
              <div className="font-bold text-sm text-white mb-1">
                Snap Packaged Commodity Label
              </div>
              <p className="text-slate-300 text-[11px]">
                Tap below to open your phone camera to snap the bottle/package label.
              </p>
            </div>
            <button
              onClick={() => nativeInputRef.current?.click()}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Camera className="w-4 h-4" />
              Open Phone Camera App
            </button>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover rounded-2xl" />

            {/* Sharp Focus Target Reticle Overlay */}
            <div className="absolute inset-8 sm:inset-16 border-2 border-emerald-400/90 rounded-2xl pointer-events-none flex flex-col justify-between p-4 bg-emerald-500/5 shadow-2xl">
              <div className="flex justify-between">
                <span className="w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></span>
                <span className="w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></span>
              </div>

              <div className="text-center">
                <span className="text-xs font-bold text-emerald-300 bg-slate-950/90 px-3 py-1 rounded-full border border-emerald-500/40 inline-flex items-center gap-1.5 shadow-lg">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  OPTICAL FOCUS READY • ALIGN PACKAGED COMMODITY
                </span>
              </div>

              <div className="flex justify-between">
                <span className="w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></span>
                <span className="w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Shutter Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 py-2 z-10">
        <button
          onClick={() => nativeInputRef.current?.click()}
          className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 font-semibold"
        >
          <Camera className="w-4 h-4 text-emerald-400" />
          Native Phone Camera
        </button>

        <button
          onClick={handleSnapAndExtract}
          disabled={isProcessing || !cameraSupported}
          className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs sm:text-sm px-8 py-3.5 rounded-xl shadow-2xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 border border-emerald-300 disabled:opacity-50"
        >
          <Camera className="w-5 h-5 fill-black" />
          <span>{isProcessing ? 'Processing Inspection Pipeline...' : 'SNAP & EXTRACT PACKAGED COMMODITY'}</span>
        </button>
      </div>
    </div>
  );
}
