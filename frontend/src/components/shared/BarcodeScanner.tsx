"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { QrCode, Search, CheckCircle2, AlertTriangle, Camera, WifiOff, HelpCircle, RefreshCw, Keyboard } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { getApiBaseUrl } from '@/lib/api';
import { useCamera } from '@/lib/useCamera';

interface BarcodeScannerProps {
  onBarcodeDecoded: (productInfo: any) => void;
}

export default function BarcodeScanner({ onBarcodeDecoded }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [decoderReady, setDecoderReady] = useState(false);
  const [showHelpPrompt, setShowHelpPrompt] = useState(false);

  // Shared Camera Stream Lifecycle Hook
  const { stream, isCameraSupported, cameraError, stopCamera, startCamera } = useCamera({ autoStart: true });

  // Handle GTIN Lookup against Backend API
  const handleScanOrLookup = useCallback(async (codeToLookup: string) => {
    const code = codeToLookup.trim();
    if (!code) return;

    setLoading(true);
    setStatusMsg(null);

    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/products/lookup/${code}`);
      if (res.ok) {
        const data = await res.json();
        setLoading(false);
        if (data.found && data.product) {
          const prod = data.product;
          setStatusMsg(`Product identified: ${prod.product_name || prod.brand} (${prod.brand || 'Master Catalog'})`);
          onBarcodeDecoded(prod);
          return;
        }
      }
    } catch (err) {
      console.warn("Barcode API fetch warning, binding barcode string directly:", err);
    }

    setLoading(false);
    setStatusMsg(`GTIN ${code} bound to inspection record.`);
    onBarcodeDecoded({ barcode: code, gtin: code, code });
  }, [onBarcodeDecoded]);

  // Handle ZXing Continuous Decoder Stream Initialization
  useEffect(() => {
    if (scanMode !== 'camera' || !stream || !videoRef.current) return;

    let isSubscribed = true;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => {});

    setDecoderReady(true);
    setShowHelpPrompt(false);

    // 10-Second Timeout Helper Prompt
    const timeoutTimer = setTimeout(() => {
      if (isSubscribed) setShowHelpPrompt(true);
    }, 10000);

    // Continuous Frame Decoding Loop
    reader.decodeFromVideoElement(videoRef.current, (result, err) => {
      if (!isSubscribed || !result) return;

      const code = result.getText();
      if (code && isSubscribed) {
        isSubscribed = false;

        // Vibrate / Audio Confirmation
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([100, 50, 100]); } catch {}
        }

        setScannedCode(code);
        setBarcodeInput(code);

        // Immediately stop camera stream & ZXing decoder
        if (typeof (reader as any).reset === 'function') {
          (reader as any).reset();
        }
        stopCamera();

        // Trigger lookup callback
        handleScanOrLookup(code);
      }
    }).catch(decodeErr => {
      console.warn("ZXing decoder initialization note:", decodeErr);
    });

    return () => {
      isSubscribed = false;
      clearTimeout(timeoutTimer);
      try {
        if (typeof (reader as any).reset === 'function') {
          (reader as any).reset();
        }
      } catch {}
    };
  }, [scanMode, stream, stopCamera, handleScanOrLookup]);

  // Dev Demo quick-tap buttons flag
  const enableDemoBarcodes = process.env.NEXT_PUBLIC_ENABLE_DEMO_BARCODES === 'true';
  const sampleBarcodes = [
    { code: "8901030800012", label: "PureFoods Wheat Atta (500g)" },
    { code: "8901234567890", label: "GlowCare Face Wash (250ml)" },
    { code: "8909876543210", label: "Industrial Resin Sack (50kg)" }
  ];

  return (
    <div className="bg-white border border-slate-300 rounded-lg p-3.5 sm:p-4 shadow-sm space-y-3">
      {/* Top Bar Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <QrCode className="w-4 h-4 text-govt-navy" />
          Real-Time Barcode &amp; QR Scanner
        </span>

        {decoderReady && isCameraSupported && scanMode === 'camera' && (
          <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1 animate-pulse">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Auto Product Lookup Ready
          </span>
        )}
      </div>

      {/* Main Viewport: Live ZXing Video Stream or Manual Input */}
      {scanMode === 'camera' ? (
        <div className="relative w-full h-48 bg-black rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
          {!isCameraSupported || cameraError ? (
            <div className="p-4 text-center text-white space-y-2 max-w-xs">
              <WifiOff className="w-8 h-8 text-amber-400 mx-auto" />
              <div className="text-xs font-bold text-amber-300">
                {cameraError || 'Camera stream unavailable'}
              </div>
              <p className="text-[11px] text-slate-400">
                Please grant camera permissions, check address bar settings, or use manual GTIN entry below.
              </p>
              <div className="flex gap-2 justify-center pt-1">
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Retry Camera
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('manual')}
                  className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded border border-slate-700 cursor-pointer"
                >
                  Manual Entry
                </button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Scanning Reticle Frame */}
              <div className="absolute inset-4 border-2 border-emerald-400/80 rounded-lg pointer-events-none flex flex-col justify-between p-2 shadow-2xl">
                <div className="flex justify-between">
                  <span className="w-4 h-4 border-t-2 border-l-2 border-emerald-400"></span>
                  <span className="w-4 h-4 border-t-2 border-r-2 border-emerald-400"></span>
                </div>
                <div className="text-center">
                  <span className="text-[10px] font-bold bg-black/80 text-emerald-300 px-2 py-1 rounded-full border border-emerald-500/40 backdrop-blur-md">
                    Align Barcode or QR Code in Frame
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="w-4 h-4 border-b-2 border-l-2 border-emerald-400"></span>
                  <span className="w-4 h-4 border-b-2 border-r-2 border-emerald-400"></span>
                </div>
              </div>

              {/* Scanned Code Visual Confirmation Overlay */}
              {scannedCode && (
                <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center p-4 text-emerald-300 text-center space-y-1 z-20 backdrop-blur-md">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
                  <div className="text-xs font-bold uppercase tracking-wider text-white">Scanned Successfully</div>
                  <code className="text-sm font-mono font-extrabold bg-black/80 px-3 py-1 rounded text-emerald-400 border border-emerald-500/50">
                    {scannedCode}
                  </code>
                </div>
              )}

              {/* Scanning Help Prompt */}
              {showHelpPrompt && !scannedCode && (
                <div className="absolute top-2 left-2 right-2 bg-slate-950/90 border border-amber-500/60 rounded p-2 text-[10px] text-amber-300 backdrop-blur-md flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    Having trouble? Move closer or ensure adequate lighting.
                  </span>
                  <button
                    type="button"
                    onClick={() => setScanMode('manual')}
                    className="underline text-white font-bold ml-2 cursor-pointer"
                  >
                    Enter Manually
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Manual Input Mode */
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Enter 13-digit EAN/UPC barcode..."
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-govt-navy outline-none font-mono"
              />
            </div>

            <button
              type="button"
              onClick={() => handleScanOrLookup(barcodeInput)}
              disabled={loading || !barcodeInput}
              className="bg-govt-navy hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[40px]"
            >
              Lookup GTIN
            </button>
          </div>
        </div>
      )}

      {/* Mode Switcher Toggle Footer */}
      <div className="flex justify-between items-center text-xs pt-1">
        {scanMode === 'camera' ? (
          <button
            type="button"
            onClick={() => setScanMode('manual')}
            className="text-slate-600 hover:text-govt-navy font-semibold flex items-center gap-1 cursor-pointer text-[11px]"
          >
            <Keyboard className="w-3.5 h-3.5" />
            Enter Code Manually
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setScanMode('camera');
              startCamera();
            }}
            className="text-slate-600 hover:text-govt-navy font-semibold flex items-center gap-1 cursor-pointer text-[11px]"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-600" />
            Switch to Camera Barcode Scanner
          </button>
        )}
      </div>

      {/* Dev Demo Mode Quick Tap Buttons (Only rendered when NEXT_PUBLIC_ENABLE_DEMO_BARCODES === 'true') */}
      {enableDemoBarcodes && (
        <div className="text-[11px] border-t border-slate-200 pt-2 mt-2">
          <span className="text-slate-500 font-bold block mb-1">Demo Quick-Tap Sample Barcodes:</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            {sampleBarcodes.map((b) => (
              <button
                key={b.code}
                type="button"
                onClick={() => {
                  setBarcodeInput(b.code);
                  handleScanOrLookup(b.code);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-mono px-2 py-1 rounded border border-slate-300 text-left truncate cursor-pointer"
              >
                <span className="font-bold text-govt-navy block">{b.code}</span>
                <span className="text-slate-600 text-[9px] truncate">{b.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Status Feedback Message */}
      {statusMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs p-2.5 rounded flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}
    </div>
  );
}
