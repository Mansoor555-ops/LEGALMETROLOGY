"use client";

import React, { useState, useRef, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Camera, QrCode, Zap, Sparkles, FileText, Check, Trash2, Plus } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import SmartCaptureCamera from './SmartCaptureCamera';
import { getApiBaseUrl } from '@/utils/api';

interface OfficerInspectionFormProps {
  onInspectionComplete: (result: any) => void;
  scannedFile?: File | File[] | null;
  scannedBarcodeCode?: string;
}

export default function OfficerInspectionForm({
  onInspectionComplete,
  scannedFile = null,
  scannedBarcodeCode = ''
}: OfficerInspectionFormProps) {
  const [category, setCategory] = useState('Packaged Food');
  const [netQuantity, setNetQuantity] = useState('');
  const [isInstitutional, setIsInstitutional] = useState(false);
  const [barcodeCode, setBarcodeCode] = useState(scannedBarcodeCode);
  const [showSmartCamera, setShowSmartCamera] = useState(false);

  const [gpsCoords, setGpsCoords] = useState<{ latitude?: number; longitude?: number; accuracy?: number }>({});

  const initialFiles: File[] = scannedFile
    ? Array.isArray(scannedFile)
      ? scannedFile
      : [scannedFile]
    : [];

  const [bottleImages, setBottleImages] = useState<File[]>(initialFiles);
  const [bottlePreviews, setBottlePreviews] = useState<string[]>(
    initialFiles.map(f => URL.createObjectURL(f))
  );

  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Background Auto-GPS Acquisition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
        },
        (err) => console.log("Background GPS note:", err.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  const handleBarcodeDecoded = (product: any) => {
    if (product) {
      if (product.code) setBarcodeCode(product.code);
      if (product.category) setCategory(product.category);
      if (product.net_quantity) setNetQuantity(product.net_quantity);
    }
  };

  const handleNativeCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const newPreviews = newFiles.map(f => URL.createObjectURL(f));

      setBottleImages(prev => [...prev, ...newFiles]);
      setBottlePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const handleSmartCameraComplete = (files: File[]) => {
    setShowSmartCamera(false);
    if (files && files.length > 0) {
      const newPreviews = files.map(f => URL.createObjectURL(f));
      setBottleImages(prev => [...prev, ...files]);
      setBottlePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setBottleImages(prev => prev.filter((_, i) => i !== index));
    setBottlePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const executePipeline = async (e: React.FormEvent) => {
    e.preventDefault();

    if (bottleImages.length === 0) {
      setError('Please attach or snap product label photos for empirical OCR & Rule 6 evaluation.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('shop_name', 'Verified Field Inspection Site');
      formData.append('location', gpsCoords.latitude ? `GPS (${gpsCoords.latitude.toFixed(4)}, ${gpsCoords.longitude?.toFixed(4)})` : 'Field Site Location');
      if (gpsCoords.latitude) formData.append('latitude', gpsCoords.latitude.toString());
      if (gpsCoords.longitude) formData.append('longitude', gpsCoords.longitude.toString());
      if (gpsCoords.accuracy) formData.append('accuracy', gpsCoords.accuracy.toString());

      formData.append('category', category);
      formData.append('net_quantity', netQuantity);
      formData.append('is_institutional', isInstitutional ? 'true' : 'false');
      if (barcodeCode) formData.append('barcode_code', barcodeCode);

      // Append all attached images
      bottleImages.forEach((img, idx) => {
        formData.append('images', img);
        formData.append(`photo_${idx + 1}`, img);
      });

      if (bottleImages.length > 0) {
        formData.append('front_image', bottleImages[0]);
        if (bottleImages.length > 1) {
          formData.append('back_image', bottleImages[1]);
        } else {
          formData.append('back_image', bottleImages[0]);
        }
      }

      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/api/inspect`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to run inspection server pipeline');
      }

      const data = await response.json();
      setLoading(false);
      if (data.success) {
        onInspectionComplete(data.inspection);
      } else {
        setError(data.message || 'Inspection processing failed');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Error connecting to enforcement backend server');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={handleNativeCameraChange}
      />

      {showSmartCamera && (
        <SmartCaptureCamera
          onScanComplete={handleSmartCameraComplete}
          onClose={() => setShowSmartCamera(false)}
          category={category}
        />
      )}

      <form onSubmit={executePipeline} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6 space-y-6">
        <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-govt-navy" />
              Extracted Commodity Declarations &amp; Verification Form
            </h2>
            <p className="text-xs text-slate-500">
              Submit label photos to evaluate Rule 6 mandatory declarations (MRP, Net Qty, Mfg Date, Manufacturer Address)
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Scanned Package Label Photos Section */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Camera className="w-4 h-4 text-govt-navy" />
              Packaged Commodity Label Photos ({bottleImages.length})
            </span>
            <button
              type="button"
              onClick={() => setShowSmartCamera(true)}
              className="text-xs bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 rounded-lg font-extrabold flex items-center gap-1 cursor-pointer transition-all shadow-sm"
            >
              <Camera className="w-3.5 h-3.5 fill-black" />
              Snap Photos
            </button>
          </div>

          {bottlePreviews.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              {bottlePreviews.map((previewUrl, idx) => (
                <div key={idx} className="relative group border border-slate-200 rounded-lg p-1">
                  <img src={previewUrl} alt={`Label photo ${idx+1}`} className="w-full h-24 object-cover rounded-md" />
                  <span className="absolute bottom-1.5 left-1.5 bg-black/75 text-white text-[9px] font-mono px-1.5 py-0.5 rounded font-bold">
                    #{idx+1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full p-1 shadow cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div
              onClick={() => setShowSmartCamera(true)}
              className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-500 text-xs hover:border-govt-navy hover:bg-slate-100 transition-colors cursor-pointer space-y-2"
            >
              <Camera className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-semibold text-slate-700">Click to snap packaged commodity label photos</p>
              <p className="text-[11px] text-slate-400">Captures multi-angle photos for empirical OCR &amp; Rule 6 compliance check</p>
            </div>
          )}
        </div>

        {/* 2. GTIN Barcode & QR Auto-Lookup */}
        <BarcodeScanner onBarcodeDecoded={handleBarcodeDecoded} />

        {/* 3. Extracted Commodity Parameter Overrides */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium">
          <div>
            <label className="block text-slate-700 mb-1 font-semibold">Commodity Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-govt-navy outline-none bg-white"
            >
              <option value="Packaged Food">Packaged Food</option>
              <option value="Beverages">Beverages</option>
              <option value="Cosmetics & Personal Care">Cosmetics &amp; Personal Care</option>
              <option value="Household Goods">Household Goods</option>
              <option value="Industrial Raw Materials">Industrial Raw Materials</option>
              <option value="Imported Commodity">Imported Commodity</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 mb-1 font-semibold font-sans">Declared Net Quantity (Optional Manual Override)</label>
            <input
              type="text"
              value={netQuantity}
              onChange={(e) => setNetQuantity(e.target.value)}
              placeholder="Auto-extracted via OCR if left blank (e.g. 500 g, 1.5 L)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-govt-navy outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-700 mb-1 font-semibold font-sans">GTIN / EAN Barcode Code</label>
            <input
              type="text"
              value={barcodeCode}
              onChange={(e) => setBarcodeCode(e.target.value)}
              placeholder="Enter or scan GTIN code..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-govt-navy outline-none font-mono"
            />
          </div>

          <div className="flex items-center gap-3 pt-4">
            <input
              type="checkbox"
              id="isInstitutional"
              checked={isInstitutional}
              onChange={(e) => setIsInstitutional(e.target.checked)}
              className="w-4 h-4 text-govt-navy rounded focus:ring-govt-navy cursor-pointer"
            />
            <label htmlFor="isInstitutional" className="text-xs text-slate-700 cursor-pointer font-semibold font-sans">
              Rule 3 Exemption: Declared for Institutional / Industrial Use (&gt; 25 kg/L)
            </label>
          </div>
        </div>

        {/* 4. Submit Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-govt-navy hover:bg-slate-900 text-white font-extrabold text-xs sm:text-sm py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 disabled:opacity-50 min-h-[48px]"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              <span>Running OCR &amp; Legal Metrology Rule Engine Pipeline...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>RUN LEGAL METROLOGY INSPECTION &amp; GENERATE CERTIFICATE</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
