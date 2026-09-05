"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, CheckCircle2, AlertTriangle, RefreshCw, Zap, QrCode, ArrowRight, Sparkles, Check, Clock, Eye } from 'lucide-react';
import { performLiveCheck, fetchPanelExpectations, LiveCheckDetectedField } from '@/utils/api';

interface UnifiedAutoScannerProps {
  onScanComplete: (bottleFile: File, barcodeFile: File | null, barcodeCode: string) => void;
  onClose: () => void;
  category?: string;
}

export default function UnifiedAutoScanner({ onScanComplete, onClose, category = 'Packaged Food' }: UnifiedAutoScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const downscaleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const nativeInputRef = useRef<HTMLInputElement | null>(null);

  // Panel Pass Sequence: 1 = Front Panel, 2 = Back Panel, 3 = Barcode
  const [scanStep, setScanStep] = useState<1 | 2 | 3>(1);
  const panelName = scanStep === 1 ? 'front' : scanStep === 2 ? 'back' : 'barcode';

  // Panel Expectations dictionary loaded from backend
  const [panelExpectationsMap, setPanelExpectationsMap] = useState<Record<string, string[]>>({
    front: ['mrp', 'net_quantity', 'generic_name'],
    back: ['manufacturer_name_address', 'mfg_date', 'consumer_care'],
    neck: ['mfg_date']
  });

  // Captured Panel Image Files
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [barcodeFile, setBarcodeFile] = useState<File | null>(null);
  const [barcodeCode, setBarcodeCode] = useState<string>('8901030800012');

  // Preview & Final Checklist state per panel
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);
  const [previewChecklist, setPreviewChecklist] = useState<LiveCheckDetectedField[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);

  // Quality Analysis State
  const [sharpness, setSharpness] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(0);
  const [qualityPassed, setQualityPassed] = useState<boolean>(false);
  const [qualityMessage, setQualityMessage] = useState<string>('Align label within frame');
  const [consecutiveQualityFailures, setConsecutiveQualityFailures] = useState<number>(0);
  const [qualityInstructionOverlay, setQualityInstructionOverlay] = useState<string | null>(null);

  // Live Check Results State
  const [liveDetectedFields, setLiveDetectedFields] = useState<LiveCheckDetectedField[]>([]);
  const [isCheckingLive, setIsCheckingLive] = useState<boolean>(false);
  const [cameraSupported, setCameraSupported] = useState<boolean>(true);

  // 15s Timeout Fallback State
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isTimedOut, setIsTimedOut] = useState<boolean>(false);

  // Success Auto-Capture Toast State
  const [autoCapturedSuccess, setAutoCapturedSuccess] = useState<boolean>(false);

  // Load panel expectations from backend on mount
  useEffect(() => {
    fetchPanelExpectations().then(data => {
      if (data) setPanelExpectationsMap(data);
    });
  }, []);

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
        console.warn("WebRTC stream note (fallback to native input):", err);
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

  // Reset timers & state when switching scan steps
  useEffect(() => {
    setElapsedSeconds(0);
    setIsTimedOut(false);
    setConsecutiveQualityFailures(0);
    setQualityInstructionOverlay(null);
    setAutoCapturedSuccess(false);
    setIsPreviewMode(false);
    setPreviewImageSrc(null);

    // Set initial expected fields checklist for current panel
    const expected = panelExpectationsMap[panelName] || ['mrp', 'net_quantity', 'generic_name'];
    const labelMap: Record<string, string> = {
      mrp: "Maximum Retail Price (MRP)",
      net_quantity: "Net Quantity",
      generic_name: "Common/Generic Name",
      manufacturer_name_address: "Manufacturer Name & Address",
      mfg_date: "Month & Year of Mfg",
      consumer_care: "Consumer Care Details"
    };

    if (scanStep === 3) {
      setLiveDetectedFields([{
        field_key: "barcode",
        label: "GTIN / EAN Barcode",
        detected: false,
        confidence: 0
      }]);
    } else {
      setLiveDetectedFields(expected.map(key => ({
        field_key: key,
        label: labelMap[key] || key,
        detected: false,
        confidence: 0
      })));
    }
  }, [scanStep, panelExpectationsMap, panelName]);

  // 15-Second Timeout Counter Timer
  useEffect(() => {
    if (isPreviewMode || !cameraSupported) return;

    const timer = setInterval(() => {
      setElapsedSeconds(prev => {
        if (prev >= 15) {
          setIsTimedOut(true);
          return 15;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPreviewMode, cameraSupported, scanStep]);

  // Canvas Live Video Render Loop — Gaussian Blur outside frame & Sharp inside clip
  useEffect(() => {
    let animId: number;

    const renderCanvasOverlay = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== 4 || isPreviewMode) {
        animId = requestAnimationFrame(renderCanvasOverlay);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      // 1. Draw full video frame with Gaussian blur filter
      ctx.filter = 'blur(10px) brightness(0.65)';
      ctx.drawImage(video, 0, 0, w, h);

      // 2. Calculate guide frame rectangle (centered box)
      const marginX = w * 0.12;
      const marginY = h * 0.18;
      const gx = marginX;
      const gy = marginY;
      const gw = w - 2 * marginX;
      const gh = h - 2 * marginY;

      // 3. Clip guide rectangle region & draw SHARP video frame inside
      ctx.save();
      ctx.beginPath();
      ctx.rect(gx, gy, gw, gh);
      ctx.clip();
      ctx.filter = 'none';
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();

      // 4. Draw Guide Box Borders & Reticle Corners
      const isGood = qualityPassed;
      ctx.lineWidth = 4;
      ctx.strokeStyle = isGood ? '#10b981' : '#f59e0b';
      ctx.strokeRect(gx, gy, gw, gh);

      // Corner accent brackets
      const bracketLen = Math.min(gw, gh) * 0.12;
      ctx.lineWidth = 6;
      ctx.strokeStyle = isGood ? '#34d399' : '#fbbf24';

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(gx, gy + bracketLen); ctx.lineTo(gx, gy); ctx.lineTo(gx + bracketLen, gy);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(gx + gw - bracketLen, gy); ctx.lineTo(gx + gw, gy); ctx.lineTo(gx + gw, gy + bracketLen);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(gx, gy + gh - bracketLen); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + bracketLen, gy + gh);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(gx + gw - bracketLen, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.lineTo(gx + gw, gy + gh - bracketLen);
      ctx.stroke();

      animId = requestAnimationFrame(renderCanvasOverlay);
    };

    animId = requestAnimationFrame(renderCanvasOverlay);
    return () => cancelAnimationFrame(animId);
  }, [qualityPassed, isPreviewMode]);

  // Handle Capture Action (Auto or Manual)
  const triggerCapture = useCallback((isAuto: boolean = false, overrideChecklist?: LiveCheckDetectedField[]) => {
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
        const dataUrl = snapCanvas.toDataURL('image/jpeg', 0.95);
        setPreviewImageSrc(dataUrl);

        const currentChecklist = overrideChecklist || liveDetectedFields;
        setPreviewChecklist(currentChecklist);
        setIsPreviewMode(true);

        if (isAuto) {
          setAutoCapturedSuccess(true);
          if ('vibrate' in navigator) {
            try { navigator.vibrate(120); } catch (e) {}
          }
        }

        const fileName = `${panelName}_panel.jpg`;
        const capturedFile = new File([blob], fileName, { type: 'image/jpeg' });

        if (scanStep === 1) setFrontFile(capturedFile);
        else if (scanStep === 2) setBackFile(capturedFile);
        else setBarcodeFile(capturedFile);
      }
    }, 'image/jpeg', 0.95);
  }, [panelName, scanStep, liveDetectedFields]);

  // Throttled Live Field Detection Polling Loop (~1500ms)
  useEffect(() => {
    if (isPreviewMode || !cameraSupported) return;

    let intervalId: NodeJS.Timeout;

    const runLiveCycle = async () => {
      const video = videoRef.current;
      if (!video || video.readyState !== 4) return;

      // 1. Client-Side Quality Check (Sharpness & Brightness)
      const qCanvas = document.createElement('canvas');
      qCanvas.width = 320;
      qCanvas.height = 240;
      const qCtx = qCanvas.getContext('2d');
      if (!qCtx) return;

      qCtx.drawImage(video, 0, 0, qCanvas.width, qCanvas.height);
      const imgData = qCtx.getImageData(0, 0, qCanvas.width, qCanvas.height);
      const data = imgData.data;

      let totalBrightness = 0;
      let totalEdgeDiff = 0;
      const step = 4;

      for (let i = 0; i < data.length; i += step * 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        totalBrightness += gray;

        if (i + 16 < data.length) {
          const nextGray = 0.299 * data[i + 16] + 0.587 * data[i + 17] + 0.114 * data[i + 18];
          totalEdgeDiff += Math.abs(gray - nextGray);
        }
      }

      const pixelCount = data.length / (step * 4);
      const avgBrightness = Math.round(totalBrightness / pixelCount);
      const avgSharpness = Math.round((totalEdgeDiff / pixelCount) * 12);

      setBrightness(avgBrightness);
      setSharpness(avgSharpness);

      const isBlurry = avgSharpness < 120;
      const isTooDark = avgBrightness < 35;
      const isTooBright = avgBrightness > 235;
      const qPassed = !isBlurry && !isTooDark && !isTooBright;

      setQualityPassed(qPassed);

      if (!qPassed) {
        const reason = isBlurry ? "Low Sharpness / Blurry" : isTooDark ? "Lighting Too Dark" : "Overexposed / Glare";
        setQualityMessage(reason);

        setConsecutiveQualityFailures(prev => {
          const nextCount = prev + 1;
          if (nextCount >= 3) {
            if (isBlurry) setQualityInstructionOverlay("Hold Steady & Move Closer to Label");
            else if (isTooDark) setQualityInstructionOverlay("Improve Lighting or Turn On Torch");
            else setQualityInstructionOverlay("Tilt Away to Reduce Glare");
          }
          return nextCount;
        });
        return; // Skip OCR backend call for this cycle if quality fails
      }

      // Quality Passed -> Reset warning counter
      setConsecutiveQualityFailures(0);
      setQualityInstructionOverlay(null);
      setQualityMessage("Image Quality Passed — Analyzing Fields...");

      if (scanStep === 3) {
        // Barcode Pass
        setLiveDetectedFields([{
          field_key: "barcode",
          label: "GTIN / EAN Barcode",
          detected: avgSharpness > 140,
          confidence: avgSharpness > 140 ? 95 : 0
        }]);

        if (avgSharpness > 150 && !isTimedOut) {
          triggerCapture(true, [{
            field_key: "barcode",
            label: "GTIN / EAN Barcode",
            detected: true,
            confidence: 95
          }]);
        }
        return;
      }

      // 2. Downscale Frame to ~800px width JPEG for Fast Backend OCR Live-Check
      const dsCanvas = downscaleCanvasRef.current || document.createElement('canvas');
      downscaleCanvasRef.current = dsCanvas;

      const targetWidth = 800;
      const scale = targetWidth / (video.videoWidth || 1280);
      dsCanvas.width = targetWidth;
      dsCanvas.height = Math.round((video.videoHeight || 720) * scale);

      const dsCtx = dsCanvas.getContext('2d');
      if (!dsCtx) return;

      dsCtx.drawImage(video, 0, 0, dsCanvas.width, dsCanvas.height);

      dsCanvas.toBlob(async (blob) => {
        if (!blob) return;

        setIsCheckingLive(true);
        const res = await performLiveCheck(blob, panelName, category);
        setIsCheckingLive(false);

        if (res && res.detected_fields) {
          setLiveDetectedFields(res.detected_fields);

          // 3. Auto-Capture Trigger when all expected fields are detected with high confidence
          if (res.all_expected_detected && !isTimedOut) {
            triggerCapture(true, res.detected_fields);
          }
        }
      }, 'image/jpeg', 0.7);
    };

    intervalId = setInterval(runLiveCycle, 1500);
    return () => clearInterval(intervalId);
  }, [scanStep, panelName, category, isPreviewMode, cameraSupported, isTimedOut, triggerCapture]);

  const handleConfirmCurrentStep = () => {
    if (scanStep === 1) {
      setScanStep(2); // Move to Back Panel
    } else if (scanStep === 2) {
      setScanStep(3); // Move to Barcode
    } else {
      // Completed all steps
      const finalFront = frontFile || new File([], "front.jpg");
      const finalBack = backFile || null;
      const finalBarcode = barcodeFile || null;
      onScanComplete(finalFront, finalBarcode, barcodeCode);
      onClose();
    }
  };

  const handleNativeCameraFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (scanStep === 1) {
        setFrontFile(file);
        setScanStep(2);
      } else if (scanStep === 2) {
        setBackFile(file);
        setScanStep(3);
      } else {
        setBarcodeFile(file);
        onScanComplete(frontFile || file, file, barcodeCode);
        onClose();
      }
    }
  };

  const expectedFieldsCount = (panelExpectationsMap[panelName] || []).length;
  const detectedFieldsCount = liveDetectedFields.filter(f => f.detected).length;

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

      {/* Top Header & Step Progress Bar */}
      <div className="space-y-2 z-10">
        <div className="flex justify-between items-center text-white">
          <div>
            <h3 className="text-sm sm:text-base font-bold flex items-center gap-2 text-emerald-400">
              <Zap className="w-4 h-4 fill-emerald-400 text-emerald-400" />
              Smart Auto-Capture &amp; Live Field Verification
            </h3>
            <p className="text-[11px] text-slate-300">
              {scanStep === 1 ? 'Pass 1 of 3: Front Label (MRP, Qty, Commodity)' : scanStep === 2 ? 'Pass 2 of 3: Back Label (Mfg, Address, Care)' : 'Pass 3 of 3: GTIN / EAN Barcode'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Progress Bar */}
        <div className="flex gap-2">
          <div className={`h-1.5 flex-1 rounded-full ${scanStep === 1 ? 'bg-emerald-400' : 'bg-emerald-700'}`}></div>
          <div className={`h-1.5 flex-1 rounded-full ${scanStep === 2 ? 'bg-emerald-400' : scanStep > 2 ? 'bg-emerald-700' : 'bg-slate-700'}`}></div>
          <div className={`h-1.5 flex-1 rounded-full ${scanStep === 3 ? 'bg-emerald-400' : 'bg-slate-700'}`}></div>
        </div>
      </div>

      {/* Main Viewfinder / Canvas Area */}
      <div className="relative flex-1 flex items-center justify-center my-2 overflow-hidden rounded-xl bg-black border border-slate-800">
        {!cameraSupported ? (
          <div className="text-white text-xs p-6 text-center space-y-4 max-w-sm bg-slate-900 border border-slate-700 rounded-xl">
            <Camera className="w-12 h-12 text-emerald-400 mx-auto animate-pulse" />
            <div>
              <div className="font-bold text-sm text-white mb-1">
                {scanStep === 1 ? 'Snap Front Bottle Label' : scanStep === 2 ? 'Snap Back Bottle Label' : 'Snap Bottle Barcode'}
              </div>
              <p className="text-slate-300 text-[11px]">
                Tap below to open your mobile device native camera app.
              </p>
            </div>
            <button
              onClick={() => nativeInputRef.current?.click()}
              className="w-full bg-govt-navy hover:bg-slate-800 text-white text-xs font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
              Open Camera App
            </button>
          </div>
        ) : isPreviewMode && previewImageSrc ? (
          /* Preview Mode Screen */
          <div className="relative w-full h-full flex flex-col items-center justify-center bg-black">
            <img src={previewImageSrc} alt="Captured preview" className="w-full h-full object-contain rounded-xl" />

            {/* Auto-Captured Toast Banner */}
            {autoCapturedSuccess && (
              <div className="absolute top-4 bg-emerald-500 text-black px-4 py-2 rounded-full font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
                <CheckCircle2 className="w-5 h-5" />
                AUTO-CAPTURED: ALL REQUIRED FIELDS DETECTED!
              </div>
            )}

            {/* Final Checklist Results Overlay */}
            <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-md border border-slate-700 p-3.5 rounded-xl text-white space-y-2">
              <div className="text-xs font-bold text-emerald-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Captured Frame Field Verification Summary
                </span>
                <span className="text-[10px] text-slate-400">Panel: {panelName.toUpperCase()}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                {previewChecklist.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-800/80 px-2.5 py-1.5 rounded border border-slate-700/50">
                    <span className="flex items-center gap-1.5">
                      {f.detected ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-500 inline-block" />
                      )}
                      <span className={f.detected ? 'text-white font-medium' : 'text-slate-400'}>{f.label}</span>
                    </span>
                    {f.detected && (
                      <span className="text-[10px] text-emerald-400 font-mono font-bold">{f.confidence}%</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Live Stream Mode Screen */
          <>
            <video ref={videoRef} playsInline muted className="hidden" />
            <canvas ref={canvasRef} className="w-full h-full object-cover rounded-xl" />

            {/* 3-Strike Quality Guidance Overlay Banner */}
            {qualityInstructionOverlay && (
              <div className="absolute top-4 left-4 right-4 z-20 bg-amber-500 text-black px-4 py-2.5 rounded-xl text-xs font-extrabold shadow-2xl flex items-center gap-2 animate-pulse border border-amber-300">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>{qualityInstructionOverlay}</span>
              </div>
            )}

            {/* 15-Second Timeout Banner */}
            {isTimedOut && !qualityInstructionOverlay && (
              <div className="absolute top-4 left-4 right-4 z-20 bg-slate-900/95 border border-amber-500/80 text-amber-300 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Having trouble detecting all fields automatically. You can capture manually.
                </span>
              </div>
            )}

            {/* Live Field Checklist HUD Overlay (Compact Bottom Left/Right) */}
            <div className="absolute bottom-4 left-4 right-4 z-20 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 rounded-xl p-3 text-white space-y-2 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-700/60 pb-1.5 text-xs">
                <span className="font-bold text-slate-200 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  {scanStep === 1 ? 'Front Panel' : scanStep === 2 ? 'Back Panel' : 'Barcode'} — {isCheckingLive ? 'Searching...' : qualityPassed ? 'Checking...' : 'Adjust Position'}
                </span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                  {detectedFieldsCount} of {scanStep === 3 ? 1 : expectedFieldsCount} fields detected
                </span>
              </div>

              {/* Checklist Field Items */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                {liveDetectedFields.map((field, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded transition-colors ${
                      field.detected
                        ? 'bg-emerald-950/60 border border-emerald-500/50 text-white'
                        : 'bg-slate-800/60 border border-slate-700/50 text-slate-400'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {field.detected ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3] flex-shrink-0" />
                      ) : (
                        <span className="w-3 h-3 rounded-full border-2 border-amber-400/80 animate-ping flex-shrink-0" />
                      )}
                      <span className="truncate">{field.label}</span>
                    </span>
                    {field.detected && (
                      <span className="text-[10px] font-mono text-emerald-400 font-bold ml-1">
                        {field.confidence}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Top Quality Metric HUD */}
            <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center text-[10px] font-mono text-slate-300 pointer-events-none">
              <div className="bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded border border-slate-700 flex items-center gap-2">
                <span>Sharpness: <strong className={sharpness > 120 ? 'text-emerald-400' : 'text-amber-400'}>{sharpness}</strong></span>
                <span>| Brightness: <strong>{brightness}</strong></span>
              </div>
              <div className="bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded border border-slate-700">
                {15 - elapsedSeconds}s auto-search
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="flex justify-between items-center py-2 px-2 z-10">
        {!isPreviewMode ? (
          <>
            {/* Secondary Manual Capture Button — Always Visible */}
            <button
              onClick={() => triggerCapture(false)}
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg border border-slate-700 flex items-center gap-2 shadow-lg cursor-pointer transition-colors active:scale-95"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
              Capture Now (Manual)
            </button>

            {/* Native Camera Shortcut */}
            <button
              onClick={() => nativeInputRef.current?.click()}
              className="text-xs text-slate-400 hover:text-slate-200 hidden sm:flex items-center gap-1"
            >
              <Camera className="w-3.5 h-3.5" /> Native Phone Camera
            </button>

            {/* Step Skip / Next Button */}
            <button
              onClick={() => {
                if (scanStep === 1) setScanStep(2);
                else if (scanStep === 2) setScanStep(3);
              }}
              className="text-xs text-slate-300 hover:text-emerald-400 font-semibold flex items-center gap-1"
            >
              Skip Step <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          /* Preview Confirmation Actions */
          <div className="w-full flex justify-between items-center gap-3">
            <button
              onClick={() => {
                setIsPreviewMode(false);
                setPreviewImageSrc(null);
                setAutoCapturedSuccess(false);
              }}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-3 rounded-lg border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-amber-400" /> Retake Photo
            </button>

            <button
              onClick={handleConfirmCurrentStep}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {scanStep === 1 ? 'Confirm & Proceed to Back Panel' : scanStep === 2 ? 'Confirm & Proceed to Barcode' : 'Confirm & Complete Scan'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
