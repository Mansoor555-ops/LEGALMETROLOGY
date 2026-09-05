"use client";

import React, { useState, useRef } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, Loader2, Camera, QrCode, Zap, Sparkles, FileText, Check, Trash2, Plus } from 'lucide-react';
import GeolocationBadge from './GeolocationBadge';
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
  const [shopName, setShopName] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('Packaged Food');
  const [netQuantity, setNetQuantity] = useState('');
  const [isInstitutional, setIsInstitutional] = useState(false);
  const [barcodeCode, setBarcodeCode] = useState(scannedBarcodeCode);
  const [showSmartCamera, setShowSmartCamera] = useState(false);

  const [gpsData, setGpsData] = useState<{
    latitude?: number;
    longitude?: number;
    accuracy?: number;
  }>({});

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

  const handleBarcodeDecoded = (product: any) => {
    if (product) {
      if (product.code) setBarcodeCode(product.code);
      if (product.category) setCategory(product.category);
      if (product.net_quantity) setNetQuantity(product.net_quantity);
      if (product.product_name && !shopName) setShopName(`${product.brand} Store`);
    }
  };

  const handleLocationCaptured = (data: { latitude: number; longitude: number; accuracy: number; formattedLocation: string }) => {
    setGpsData({
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
    });
    if (!location) {
      setLocation(data.formattedLocation);
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

    if (!shopName && bottleImages.length === 0) {
      setError('Please provide establishment details or attach/snap product label photo.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('shop_name', shopName || 'Enforcement Field Inspection Site');
      formData.append('location', location || 'Field Site Location');
      if (gpsData.latitude) formData.append('latitude', gpsData.latitude.toString());
      if (gpsData.longitude) formData.append('longitude', gpsData.longitude.toString());
      if (gpsData.accuracy) formData.append('accuracy', gpsData.accuracy.toString());

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
              Package Inspection Verification &amp; Report Entry
            </h2>
            <p className="text-xs text-slate-500">
              Review scanned product parameters and run Legal Metrology (2011) compliance verification
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. High-Precision GPS Geolocation Badge */}
        <GeolocationBadge onLocationCaptured={handleLocationCaptured} />

        {/* 2. GTIN Barcode & QR Auto-Lookup */}
        <BarcodeScanner onBarcodeDecoded={handleBarcodeDecoded} />

        {/* 3. Scanned Images Preview Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Camera className="w-4 h-4 text-govt-navy" />
              Scanned Package Label Photos ({bottleImages.length})
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowSmartCamera(true)}
                className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                Live Smart Camera
              </button>
              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                className="text-xs text-govt-navy font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Upload / File Input
              </button>
            </div>
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
              <p className="font-semibold text-slate-700">Click to open Smart Camera or attach package label images</p>
              <p className="text-[11px] text-slate-400">Supports multi-angle JPEG, PNG packaging labels &amp; bottle photos</p>
            </div>
          )}
        </div>

        {/* 4. Inspection Fields Form Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium">
          <div>
            <label className="block text-slate-700 mb-1 font-semibold">Establishment / Retail Store Name</label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Enter store/establishment name..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-govt-navy outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-700 mb-1 font-semibold">Inspection Site Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Capturing GPS location..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-govt-navy outline-none bg-slate-50"
            />
          </div>

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
            <label className="block text-slate-700 mb-1 font-semibold font-sans">Declared Net Quantity (Optional User Override)</label>
            <input
              type="text"
              value={netQuantity}
              onChange={(e) => setNetQuantity(e.target.value)}
              placeholder="e.g. 500 g, 1.5 L (auto-extracted if blank)"
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

        {/* 5. Submit Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-govt-navy hover:bg-slate-900 text-white font-extrabold text-xs sm:text-sm py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 disabled:opacity-50 min-h-[48px]"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              <span>Running Multi-Photo OCR &amp; Legal Metrology Rule Engine Pipeline...</span>
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
