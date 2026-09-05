"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, Zap, Sparkles, CheckCircle2, Trash2, Plus } from 'lucide-react';

interface UnifiedAutoScannerProps {
  onScanComplete: (files: File[]) => void;
  onClose: () => void;
  category?: string;
}

export default function UnifiedAutoScanner({ onScanComplete, onClose }: UnifiedAutoScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraSupported, setCameraSupported] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const [snappedFiles, setSnappedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

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

  const handleSnapPhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = video.videoWidth || 1920;
    snapCanvas.height = video.videoHeight || 1080;

    const ctx = snapCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);

    snapCanvas.toBlob((blob) => {
      if (blob) {
        const photoNum = snappedFiles.length + 1;
        const file = new File([blob], `label_photo_${photoNum}.jpg`, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);

        setSnappedFiles(prev => [...prev, file]);
        setPreviews(prev => [...prev, previewUrl]);
      }
    }, 'image/jpeg', 0.95);
  };

  const handleRemovePhoto = (index: number) => {
    setSnappedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleNativeCameraFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const newPreviews = newFiles.map(f => URL.createObjectURL(f));

      setSnappedFiles(prev => [...prev, ...newFiles]);
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const handleFinishAndEvaluate = () => {
    if (snappedFiles.length === 0) return;
    setIsProcessing(true);
    onScanComplete(snappedFiles);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col justify-between p-3 sm:p-4 overflow-hidden select-none">
      <input
        ref={nativeInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={handleNativeCameraFallback}
      />

      {/* Top Header */}
      <div className="flex justify-between items-center text-white z-10">
        <div>
          <h3 className="text-sm sm:text-base font-bold flex items-center gap-2 text-emerald-400">
            <Zap className="w-4 h-4 fill-emerald-400 text-emerald-400" />
            Legal Metrology Multi-Photo Camera Scanner
          </h3>
          <p className="text-[11px] text-slate-300">
            Snap multi-angle photos (Front, Back, Cap, Barcode) for comprehensive Rule 6 evaluation
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
                Snap Packaged Commodity Label Photos
              </div>
              <p className="text-slate-300 text-[11px]">
                Tap below to select or snap multi-angle label photos.
              </p>
            </div>
            <button
              onClick={() => nativeInputRef.current?.click()}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Camera className="w-4 h-4" />
              Open Camera / Select Photos
            </button>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover rounded-2xl" />

            {/* Sharp Focus Target Reticle Overlay */}
            <div className="absolute inset-6 sm:inset-12 border-2 border-emerald-400/90 rounded-2xl pointer-events-none flex flex-col justify-between p-4 bg-emerald-500/5 shadow-2xl">
              <div className="flex justify-between items-center">
                <span className="w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></span>
                <span className="text-[11px] font-mono font-extrabold text-emerald-400 bg-black/80 px-2.5 py-1 rounded-full border border-emerald-500/40">
                  PHOTOS SNAPPED: {snappedFiles.length}
                </span>
                <span className="w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></span>
              </div>

              <div className="text-center">
                <span className="text-xs font-bold text-emerald-300 bg-slate-950/90 px-3 py-1 rounded-full border border-emerald-500/40 inline-flex items-center gap-1.5 shadow-lg">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  OPTICAL FOCUS READY • SNAP ANY NUMBER OF LABEL ANGLES
                </span>
              </div>

              <div className="flex justify-between">
                <span className="w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></span>
                <span className="w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></span>
              </div>
            </div>
          </>
        )}

        {/* Gallery Preview Drawer inside Viewfinder */}
        {previews.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 bg-slate-950/90 border border-slate-700/80 rounded-xl p-2.5 overflow-x-auto flex items-center gap-3 backdrop-blur-md">
            {previews.map((src, i) => (
              <div key={i} className="relative flex-shrink-0 group">
                <img src={src} alt={`Snap #${i+1}`} className="w-14 h-14 object-cover rounded-lg border border-emerald-500/60" />
                <span className="absolute top-0.5 left-0.5 bg-black/80 text-emerald-400 font-mono text-[9px] font-bold px-1 rounded">
                  #{i+1}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(i)}
                  className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full p-1 shadow-md cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Shutter Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 py-2 z-10">
        <button
          onClick={() => nativeInputRef.current?.click()}
          className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 font-semibold cursor-pointer"
        >
          <Camera className="w-4 h-4 text-emerald-400" />
          Native Phone Camera / Gallery
        </button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {cameraSupported && (
            <button
              onClick={handleSnapPhoto}
              className="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/50 font-bold text-xs sm:text-sm px-5 py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Snap Photo (#{snappedFiles.length + 1})</span>
            </button>
          )}

          <button
            onClick={handleFinishAndEvaluate}
            disabled={isProcessing || snappedFiles.length === 0}
            className="flex-1 sm:flex-initial bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-2xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 border border-emerald-300 disabled:opacity-40"
          >
            <CheckCircle2 className="w-5 h-5 fill-black" />
            <span>
              {isProcessing
                ? 'Evaluating Pipeline...'
                : snappedFiles.length === 0
                ? 'Snap Photo First'
                : `FINISH & EVALUATE REPORT (${snappedFiles.length})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
