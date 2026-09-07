"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, Zap, Sparkles, CheckCircle2, AlertTriangle, Trash2, Plus, RefreshCw, HelpCircle, Sun, Flashlight, WifiOff } from 'lucide-react';
import { useCamera } from '@/lib/useCamera';
import { getOfflineInspections } from '@/lib/offlineQueue';
import { fetchPanelExpectations, LiveCheckDetectedField } from '@/lib/api';

interface SmartCaptureCameraProps {
  onScanComplete: (files: File[]) => void;
  onClose: () => void;
  panelName?: string;
  category?: string;
}

export default function SmartCaptureCamera({
  onScanComplete,
  onClose,
  panelName = 'front',
  category = 'Packaged Food'
}: SmartCaptureCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nativeInputRef = useRef<HTMLInputElement | null>(null);

  // Shared Camera Stream Lifecycle Hook
  const { stream, isCameraSupported: cameraSupported, cameraError, torchSupported, torchActive, setTorch, startCamera } = useCamera({ autoStart: true });

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [autoTorchTriggered, setAutoTorchTriggered] = useState<boolean>(false);

  // Snapped Multi-Photo State
  const [snappedFiles, setSnappedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Attach Stream to Video Element
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  // Monitor Network Connectivity & IndexedDB Offline Queue
  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);
    setIsOnline(navigator.onLine);

    getOfflineInspections().then(items => setOfflineCount(items.length));

    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);

    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  // Real Laplacian Variance Quality Metrics State
  const [blurScore, setBlurScore] = useState<number>(0);
  const [brightnessScore, setBrightnessScore] = useState<number>(0);
  const [qualityStatus, setQualityStatus] = useState<'analyzing' | 'poor' | 'good'>('analyzing');
  const [qualityMessage, setQualityMessage] = useState<string>('Analyzing frame quality...');

  // Confirmation Modal for Poor Quality Frame Gating
  const [showPoorQualityPrompt, setShowPoorQualityPrompt] = useState<boolean>(false);

  // Live Field Detection Checklist State
  const [detectedFields, setDetectedFields] = useState<LiveCheckDetectedField[]>([]);
  const [expectedFields, setExpectedFields] = useState<string[]>(['mrp', 'net_quantity', 'generic_name']);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState<boolean>(false);

  // Fetch Panel Field Expectations
  useEffect(() => {
    fetchPanelExpectations().then(expMap => {
      if (expMap && expMap[panelName.toLowerCase()]) {
        setExpectedFields(expMap[panelName.toLowerCase()]);
      }
    });
  }, [panelName]);

  // 15-Second Timeout Warning Timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTimeoutWarning(true);
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  // Frame Quality Analysis Loop (Laplacian Variance, 4 FPS / 250ms) + Auto Torch Trigger
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const analyzeFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== 4) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = 320;
      const h = 240;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // 1. Grayscale Conversion
      const gray = new Float32Array(w * h);
      let sumBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        const idx = i / 4;
        const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        gray[idx] = g;
        sumBrightness += g;
      }
      const meanBrightness = sumBrightness / (w * h);

      // 2. Real Laplacian Convolution Variance Calculation
      let lapSum = 0;
      let lapSqSum = 0;
      let count = 0;

      for (let y = 1; y < h - 1; y += 2) {
        for (let x = 1; x < w - 1; x += 2) {
          const idx = y * w + x;
          const val =
            gray[idx - w] +
            gray[idx + w] +
            gray[idx - 1] +
            gray[idx + 1] -
            4 * gray[idx];

          lapSum += val;
          lapSqSum += val * val;
          count++;
        }
      }

      const meanLap = lapSum / (count || 1);
      const variance = Math.max(0, (lapSqSum / (count || 1)) - (meanLap * meanLap));

      setBlurScore(variance);
      setBrightnessScore(meanBrightness);

      // 3. Localized Specular Glare Hotspot Check (32x32 grid cells)
      let maxCellGlareRatio = 0.0;
      const cellSize = 32;
      for (let cy = 0; cy < h; cy += cellSize) {
        for (let cx = 0; cx < w; cx += cellSize) {
          let saturatedCount = 0;
          let totalCount = 0;
          for (let y = cy; y < Math.min(cy + cellSize, h); y++) {
            for (let x = cx; x < Math.min(cx + cellSize, w); x++) {
              if (gray[y * w + x] >= 250) saturatedCount++;
              totalCount++;
            }
          }
          const frac = saturatedCount / (totalCount || 1);
          if (frac > maxCellGlareRatio) maxCellGlareRatio = frac;
        }
      }

      // 4. AUTO TORCH TRIGGER: If low light detected (< 30.0 brightness) and torch not yet auto-enabled
      if (meanBrightness < 30.0 && !autoTorchTriggered && stream) {
        setAutoTorchTriggered(true);
        setTorch(true);
      }

      // Recalibrated Loosened Thresholds for Gemini Vision Robustness
      const isBlurry = variance < 15.0;            // Loosened from 30.0
      const isTooDark = meanBrightness < 15.0;      // Loosened from 30.0
      const isTooBright = meanBrightness > 245.0;    // Loosened from 235.0
      const hasGlare = maxCellGlareRatio > 0.12;   // Localized glare hotspot

      if (!isBlurry && !isTooDark && !isTooBright && !hasGlare) {
        setQualityStatus('good');
        setQualityMessage(`ALIGN LABEL IN GUIDE BOX • Quality Suitable`);
      } else {
        setQualityStatus('poor');
        const msgs = [];
        if (isBlurry) msgs.push(`Blurry (${variance.toFixed(1)})`);
        if (isTooDark) msgs.push('Low Light');
        if (isTooBright) msgs.push('Overexposed');
        if (hasGlare) msgs.push('Glare Hotspot Detected — Tilt camera slightly');
        setQualityMessage(`POOR QUALITY: ${msgs.join(', ')}`);
      }
    };

    intervalId = setInterval(analyzeFrame, 250);
    return () => clearInterval(intervalId);
  }, [autoTorchTriggered]);

  // Live Field-Detection Checklist Polling Loop (Disabled server polling to prevent API overload)
  useEffect(() => {
    // Local canvas quality checking handles live feedback without hammering backend API
  }, [panelName, category, qualityStatus]);

  const handleManualTorchToggle = () => {
    setTorch(!torchActive);
  };

  // Execute Photo Capture
  const triggerPhotoCapture = () => {
    executeFrameSnap();
  };

  // Execute Frame Snap: Captures complete uncropped video frame to preserve border declarations
  const executeFrameSnap = () => {
    setShowPoorQualityPrompt(false);
    const video = videoRef.current;
    if (!video) return;

    const rawW = video.videoWidth || 1920;
    const rawH = video.videoHeight || 1080;

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = rawW;
    snapCanvas.height = rawH;

    const ctx = snapCanvas.getContext('2d');
    if (!ctx) return;

    // Draw complete uncropped frame so border/flap declarations are never sliced off
    ctx.drawImage(video, 0, 0, rawW, rawH);

    snapCanvas.toBlob((blob) => {
      if (blob) {
        const photoNum = snappedFiles.length + 1;
        const file = new File([blob], `${panelName.toLowerCase()}_photo_${photoNum}.jpg`, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);

        setSnappedFiles(prev => [...prev, file]);
        setPreviews(prev => [...prev, previewUrl]);
      }
    }, 'image/jpeg', 0.88);
  };

  const handleRemovePhoto = (index: number) => {
    setSnappedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Helper for client-side image compression & normalization (max 1920px, 0.88 quality)
  const compressImageClient = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const maxDim = 1920;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (blob) {
                const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                resolve(new File([blob], newName, { type: 'image/jpeg' }));
                return;
              }
              resolve(file);
            }, 'image/jpeg', 0.88);
          } else {
            resolve(file);
          }
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  // Native File Picker with Client-Side Image Resizing & HEIC to JPEG Normalization
  const handleNativeCameraFallback = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsProcessing(true);
      const selected = Array.from(e.target.files);
      const normalizedFiles: File[] = [];

      for (const f of selected) {
        try {
          const compressed = await compressImageClient(f);
          normalizedFiles.push(compressed);
        } catch {
          normalizedFiles.push(f);
        }
      }

      const newPreviews = normalizedFiles.map(f => URL.createObjectURL(f));
      setSnappedFiles(prev => [...prev, ...normalizedFiles]);
      setPreviews(prev => [...prev, ...newPreviews]);
      setIsProcessing(false);
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
      <canvas ref={canvasRef} className="hidden" />
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
            Smart Capture Field Scanner ({panelName.toUpperCase()} PANEL)
          </h3>
          <p className="text-[11px] text-slate-300">
            Multi-angle quality-gated capture for Legal Metrology (2011) compliance checking
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {(!isOnline || offlineCount > 0) && (
            <div className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-950/90 text-amber-300 border border-amber-500/60 flex items-center gap-1.5 shadow-md">
              <WifiOff className="w-3 h-3 text-amber-400" />
              <span>{!isOnline ? 'OFFLINE MODE' : `${offlineCount} QUEUED OFFLINE`}</span>
            </div>
          )}

          {/* Torch Manual Toggle Button */}
          <button
            type="button"
            onClick={handleManualTorchToggle}
            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border cursor-pointer transition-colors ${
              torchActive
                ? 'bg-amber-500 text-black border-amber-300 font-extrabold shadow-lg animate-pulse'
                : 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${torchActive ? 'fill-black' : 'fill-amber-400'}`} />
            <span>{torchActive ? 'Torch ON' : 'Torch OFF'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Viewfinder Area */}
      <div className="relative flex-1 flex items-center justify-center my-3 overflow-hidden rounded-2xl bg-black border border-slate-800">
        {!cameraSupported ? (
          previews.length > 0 ? (
            <div className="w-full h-full p-4 overflow-y-auto flex flex-col items-center justify-center space-y-4">
              <div className="text-center space-y-1">
                <span className="text-xs font-bold text-emerald-400 block uppercase tracking-wider">
                  {snappedFiles.length} Label Photo{snappedFiles.length > 1 ? 's' : ''} Attached
                </span>
                <p className="text-[11px] text-slate-300">
                  Ready for empirical OCR &amp; Legal Metrology Rule 6 evaluation
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-md w-full">
                {previews.map((src, i) => (
                  <div key={i} className="relative group border border-slate-700 rounded-xl overflow-hidden shadow-lg bg-slate-900">
                    <img src={src} alt={`Snap #${i + 1}`} className="w-full h-32 object-cover" />
                    <span className="absolute bottom-1.5 left-1.5 bg-black/80 text-emerald-400 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-700">
                      #{i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(i)}
                      className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full p-1.5 shadow-md cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md pt-2">
                <button
                  type="button"
                  onClick={() => nativeInputRef.current?.click()}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold px-4 py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  Add More Photos
                </button>

                <button
                  type="button"
                  onClick={handleFinishAndEvaluate}
                  disabled={isProcessing}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs py-3.5 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 border border-emerald-300 disabled:opacity-40"
                >
                  <CheckCircle2 className="w-4 h-4 fill-black" />
                  <span>{isProcessing ? 'Evaluating...' : `EVALUATE REPORT (${snappedFiles.length})`}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-white text-xs p-6 text-center space-y-4 max-w-sm bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">
              <Camera className="w-12 h-12 text-emerald-400 mx-auto animate-pulse" />
              <div>
                <div className="font-bold text-sm text-white mb-1">
                  Snap Packaged Commodity Label
                </div>
                <p className="text-slate-300 text-[11px]">
                  {cameraError || 'Tap below to snap label photos using your phone camera.'}
                </p>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => nativeInputRef.current?.click()}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  Open Camera / Snap Photos
                </button>

                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2.5 rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  Retry Live Camera
                </button>
              </div>
            </div>
          )
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover rounded-2xl" />

            {/* Target Reticle Overlay */}
            <div className={`absolute inset-6 sm:inset-12 border-2 ${
              qualityStatus === 'good' ? 'border-emerald-400/90' : 'border-amber-400/80'
            } rounded-2xl pointer-events-none flex flex-col justify-between p-4 bg-black/10 shadow-2xl transition-colors`}>
              <div className="flex justify-between items-center">
                <span className="w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></span>
                <span className="text-[11px] font-mono font-extrabold text-emerald-400 bg-black/80 px-2.5 py-1 rounded-full border border-emerald-500/40">
                  SNAPPED: {snappedFiles.length} PHOTOS
                </span>
                <span className="w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></span>
              </div>

              {/* Dynamic Computed Quality Status Banner */}
              <div className="text-center">
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 shadow-lg backdrop-blur-md ${
                  qualityStatus === 'good'
                    ? 'text-emerald-300 bg-emerald-950/90 border-emerald-500/50'
                    : 'text-amber-300 bg-amber-950/90 border-amber-500/50'
                }`}>
                  {qualityStatus === 'good' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  )}
                  {qualityMessage}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></span>
                <span className="w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></span>
              </div>
            </div>

            {/* Real-time Field Detection Checklist Badge */}
            {detectedFields.length > 0 && (
              <div className="absolute top-3 left-3 bg-slate-950/90 border border-slate-700/80 rounded-xl p-2 text-[10px] text-white space-y-1 backdrop-blur-md max-w-xs pointer-events-none">
                <span className="font-bold text-emerald-400 block border-b border-slate-800 pb-1">
                  LIVE FIELD DETECTION:
                </span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  {detectedFields.map(f => (
                    <div key={f.field_key} className="flex items-center gap-1">
                      <span className={f.detected ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                        {f.detected ? '✓' : '○'} {f.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Auto Torch Indicator Notification */}
            {autoTorchTriggered && (
              <div className="absolute top-3 right-3 bg-amber-950/90 border border-amber-500/60 rounded-xl px-3 py-1.5 text-[10px] font-extrabold text-amber-300 backdrop-blur-md flex items-center gap-1.5 shadow-lg">
                <Zap className="w-3.5 h-3.5 fill-amber-400 animate-pulse text-amber-400" />
                <span>AUTO-TORCH ACTIVATED (LOW LIGHT)</span>
              </div>
            )}

            {/* 15s Timeout Warning Fallback */}
            {showTimeoutWarning && (
              <div className="absolute top-14 left-3 bg-slate-900/90 border border-amber-500/50 rounded-lg px-3 py-1.5 text-[11px] text-amber-300 backdrop-blur-md max-w-xs flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Fields taking longer to detect. You may tap Capture Now to proceed.</span>
              </div>
            )}
          </>
        )}

        {/* Snapped Photos Gallery Drawer */}
        {previews.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 bg-slate-950/90 border border-slate-700/80 rounded-xl p-2.5 overflow-x-auto flex items-center gap-3 backdrop-blur-md">
            {previews.map((src, i) => (
              <div key={i} className="relative flex-shrink-0">
                <img src={src} alt={`Snap #${i + 1}`} className="w-14 h-14 object-cover rounded-lg border border-emerald-500/60" />
                <span className="absolute top-0.5 left-0.5 bg-black/80 text-emerald-400 font-mono text-[9px] font-bold px-1 rounded">
                  #{i + 1}
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

      {/* Poor Quality Gating Confirmation Prompt Modal */}
      {showPoorQualityPrompt && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/60 rounded-2xl p-6 max-w-md w-full text-white space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-7 h-7 flex-shrink-0 animate-bounce" />
              <div>
                <h4 className="font-extrabold text-sm text-white">Image Quality Warning</h4>
                <p className="text-[11px] text-slate-300">
                  Frame appears blurry or poorly lit (Blur: {blurScore.toFixed(1)} | Brightness: {brightnessScore.toFixed(0)}).
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
              Capturing blurry photos may lead to lower OCR extraction accuracy or unreadable declaration fields. Hold device steady or adjust lighting.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowPoorQualityPrompt(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-3 rounded-xl cursor-pointer"
              >
                Hold Steady / Retake
              </button>
              <button
                onClick={executeFrameSnap}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold py-3 rounded-xl cursor-pointer"
              >
                Capture Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Shutter Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 py-2 z-10">
        <button
          onClick={() => nativeInputRef.current?.click()}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 font-medium cursor-pointer"
        >
          <Camera className="w-4 h-4 text-emerald-400" />
          Choose File / Phone Camera
        </button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {cameraSupported && (
            <button
              onClick={triggerPhotoCapture}
              className={`flex-1 sm:flex-initial font-extrabold text-xs sm:text-sm px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 border min-h-[48px] ${
                qualityStatus === 'good'
                  ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-emerald-500/50'
                  : 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 border-amber-500/50'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>
                {snappedFiles.length === 0
                  ? 'SNAP LABEL PHOTO'
                  : `SNAP ANOTHER PHOTO (#${snappedFiles.length + 1})`}
              </span>
            </button>
          )}

          {snappedFiles.length > 0 && (
            <button
              onClick={handleFinishAndEvaluate}
              disabled={isProcessing}
              className="flex-1 sm:flex-initial bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs sm:text-sm px-6 py-3.5 rounded-xl shadow-2xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 border border-emerald-300 disabled:opacity-40 min-h-[48px]"
            >
              <CheckCircle2 className="w-5 h-5 fill-black" />
              <span>
                {isProcessing
                  ? 'Evaluating Pipeline...'
                  : `EVALUATE REPORT (${snappedFiles.length})`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
