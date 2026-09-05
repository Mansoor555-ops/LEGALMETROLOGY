"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, CheckCircle2, AlertTriangle, RefreshCw, Zap } from 'lucide-react';

interface LiveCameraViewfinderProps {
  panelName: string;
  onPhotoCaptured: (file: File, previewUrl: string) => void;
  onClose: () => void;
}

export default function LiveCameraViewfinder({ panelName, onPhotoCaptured, onClose }: LiveCameraViewfinderProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [sharpness, setSharpness] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(0);
  const [qualityStatus, setQualityStatus] = useState<'analyzing' | 'poor' | 'good'>('analyzing');
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function startCamera() {
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        setCameraError("Camera access denied or unavailable on this device. Please grant camera permission.");
      }
    }

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Frame Quality Analysis Loop (10 FPS)
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const analyzeFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== 4) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 320;
      canvas.height = 240;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Calculate brightness & edge contrast sharpness
      let totalBrightness = 0;
      let totalEdgeDiff = 0;
      const step = 4; // Sample every 4th pixel for speed

      for (let i = 0; i < data.length; i += step * 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        totalBrightness += gray;

        if (i + 16 < data.length) {
          const nextR = data[i + 16];
          const nextG = data[i + 17];
          const nextB = data[i + 18];
          const nextGray = 0.299 * nextR + 0.587 * nextG + 0.114 * nextB;
          totalEdgeDiff += Math.abs(gray - nextGray);
        }
      }

      const pixelCount = data.length / (step * 4);
      const avgBrightness = Math.round(totalBrightness / pixelCount);
      const avgSharpness = Math.round((totalEdgeDiff / pixelCount) * 10);

      setBrightness(avgBrightness);
      setSharpness(avgSharpness);

      const isGoodBrightness = avgBrightness > 40 && avgBrightness < 235;
      const isGoodSharpness = avgSharpness > 120;

      if (isGoodBrightness && isGoodSharpness) {
        setQualityStatus('good');
      } else {
        setQualityStatus('poor');
      }
    };

    intervalId = setInterval(analyzeFrame, 150);

    return () => clearInterval(intervalId);
  }, []);

  const handleSnapPhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = video.videoWidth || 1280;
    snapCanvas.height = video.videoHeight || 720;

    const ctx = snapCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);

    snapCanvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `${panelName.toLowerCase()}_camera_snap.jpg`, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);
        onPhotoCaptured(file, previewUrl);
        onClose();
      }
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col justify-between p-4 overflow-hidden">
      {/* Top Bar */}
      <div className="flex justify-between items-center text-white z-10">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-400">
            <Camera className="w-4 h-4" />
            Live Field Camera: {panelName} Panel
          </h3>
          <p className="text-[11px] text-slate-400">Hold mobile camera steady over product label</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Viewfinder Container */}
      <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden rounded-lg bg-black">
        {cameraError ? (
          <div className="text-red-400 text-xs p-6 text-center space-y-3 bg-slate-900 border border-red-800 rounded-lg max-w-sm">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
            <div>{cameraError}</div>
            <button
              onClick={onClose}
              className="bg-slate-800 text-white text-xs px-4 py-2 rounded font-bold"
            >
              Use Manual Photo Input
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover rounded-lg"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Target HUD Overlay Box */}
            <div className="absolute inset-8 sm:inset-16 border-2 border-dashed border-emerald-400/80 rounded-lg pointer-events-none flex flex-col justify-between p-3">
              <div className="flex justify-between">
                <span className="w-4 h-4 border-t-2 border-l-2 border-emerald-400"></span>
                <span className="w-4 h-4 border-t-2 border-r-2 border-emerald-400"></span>
              </div>
              <div className="text-center text-[11px] text-emerald-300 font-mono bg-black/60 px-2 py-1 rounded self-center backdrop-blur-xs">
                ALIGN {panelName.toUpperCase()} LABEL INSIDE TARGET BOX
              </div>
              <div className="flex justify-between">
                <span className="w-4 h-4 border-b-2 border-l-2 border-emerald-400"></span>
                <span className="w-4 h-4 border-b-2 border-r-2 border-emerald-400"></span>
              </div>
            </div>

            {/* Real-time Quality Meter HUD */}
            <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm border border-slate-700 px-3 py-1.5 rounded-md text-[11px] text-white flex items-center gap-2 z-10">
              {qualityStatus === 'good' ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> HIGH QUALITY (READY TO SNAP)
                </span>
              ) : (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> HOLD STEADY (FOCUSING...)
                </span>
              )}
              <span className="text-slate-400 font-mono">
                Sharpness: {sharpness} | Brightness: {brightness}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Bottom Snap Action Bar */}
      <div className="flex justify-center items-center py-2 z-10">
        <button
          onClick={handleSnapPhoto}
          disabled={!!cameraError}
          className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-transform active:scale-95 shadow-xl cursor-pointer ${
            qualityStatus === 'good'
              ? 'bg-emerald-600 border-white text-white'
              : 'bg-govt-navy border-slate-300 text-white'
          }`}
        >
          <Camera className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
}
