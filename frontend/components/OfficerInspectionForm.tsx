"use client";

import React, { useState, useRef } from 'react';
import { Upload, AlertTriangle, CheckCircle2, ShieldAlert, Loader2, Camera, QrCode, Zap, Sparkles, ArrowRight } from 'lucide-react';
import GeolocationBadge from './GeolocationBadge';
import BarcodeScanner from './BarcodeScanner';
import UnifiedAutoScanner from './UnifiedAutoScanner';
import { getApiBaseUrl } from '@/utils/api';

interface OfficerInspectionFormProps {
  onInspectionComplete: (result: any) => void;
}

export default function OfficerInspectionForm({ onInspectionComplete }: OfficerInspectionFormProps) {
  const [shopName, setShopName] = useState('Metro Mart Supermarket');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('Packaged Food');
  const [netQuantity, setNetQuantity] = useState('500 g');
  const [isInstitutional, setIsInstitutional] = useState(false);
  const [barcodeCode, setBarcodeCode] = useState('');

  // GPS coordinates state
  const [gpsData, setGpsData] = useState<{
    latitude?: number;
    longitude?: number;
    accuracy?: number;
  }>({});

  const [bottleImage, setBottleImage] = useState<File | null>(null);
  const [barcodeImage, setBarcodeImage] = useState<File | null>(null);

  const [bottlePreview, setBottlePreview] = useState<string | null>(null);
  const [barcodePreview, setBarcodePreview] = useState<string | null>(null);

  // Native camera fallback ref
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Scanner modal state
  const [showAutoScanner, setShowAutoScanner] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBarcodeDecoded = (product: any) => {
    if (product) {
      if (product.code) setBarcodeCode(product.code);
      if (product.category) setCategory(product.category);
      if (product.net_quantity) setNetQuantity(product.net_quantity);
      if (product.product_name && !shopName) setShopName(`${product.brand} Retail Store`);
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

  const handleScanCompleteFromScanner = (bFile: File, bcFile: File | null, bCode: string) => {
    setBottleImage(bFile);
    setBottlePreview(URL.createObjectURL(bFile));
    if (bcFile) {
      setBarcodeImage(bcFile);
      setBarcodePreview(URL.createObjectURL(bcFile));
    }
    if (bCode) setBarcodeCode(bCode);

    // Auto-execute pipeline with captured images
    executePipeline(bFile, bcFile, bCode);
  };

  const handleNativeCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBottleImage(file);
      setBottlePreview(URL.createObjectURL(file));
      executePipeline(file, barcodeImage, barcodeCode);
    }
  };

  const executePipeline = async (bFile: File | null, bcFile: File | null, bCode: string) => {
    const mainFile = bFile || bottleImage;

    if (!shopName || !location) {
      setError('Please verify Establishment Name and Geolocation.');
      return;
    }

    if (!isInstitutional && !mainFile) {
      setError('Please snap or auto-scan the product package label photo.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('shop_name', shopName);
      formData.append('location', location);
      if (gpsData.latitude) formData.append('latitude', gpsData.latitude.toString());
      if (gpsData.longitude) formData.append('longitude', gpsData.longitude.toString());
      if (gpsData.accuracy) formData.append('accuracy', gpsData.accuracy.toString());

      formData.append('category', category);
      formData.append('net_quantity', netQuantity);
      formData.append('is_institutional', isInstitutional ? 'true' : 'false');
      if (bCode || barcodeCode) formData.append('barcode_code', bCode || barcodeCode);

      if (mainFile) {
        formData.append('front_image', mainFile);
        formData.append('back_image', mainFile);
      }
      if (bcFile || barcodeImage) {
        formData.append('barcode_image', bcFile || barcodeImage);
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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executePipeline(bottleImage, barcodeImage, barcodeCode);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Native Camera Input */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleNativeCameraChange}
      />

      {/* Sequential 3-Pass Smart Auto-Scanner Modal */}
      {showAutoScanner && (
        <UnifiedAutoScanner
          category={category}
          onScanComplete={handleScanCompleteFromScanner}
          onClose={() => setShowAutoScanner(false)}
        />
      )}

      <div className="bg-white border border-govt-border rounded-xl shadow-sm p-4 sm:p-6 space-y-6">
        <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-govt-navy" />
              Guided Sequential Bottle &amp; Package Inspection
            </h2>
            <p className="text-xs text-slate-500">
              Pass 1: Auto-Scan Bottle Label $\rightarrow$ Pass 2: Auto-Scan Bottle Barcode.
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

        {/* 3. Sequential Guided Auto-Scan Action Hero Section */}
        <div className="bg-slate-900 text-white rounded-xl p-6 text-center space-y-4 shadow-lg border border-slate-800">
          <div className="w-14 h-14 bg-govt-navy rounded-full flex items-center justify-center mx-auto border-2 border-emerald-400 shadow-inner">
            <Sparkles className="w-7 h-7 text-emerald-400 animate-pulse" />
          </div>

          <div>
            <h3 className="text-base font-bold text-white">Guided 2-Pass Bottle Scanner</h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto mt-1">
              Tap below to start: camera auto-captures the full bottle label first, then automatically prompts for the bottle barcode on the back/bottom.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAutoScanner(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-extrabold px-6 py-3.5 rounded-lg shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-98 min-h-[48px]"
            >
              <Zap className="w-4 h-4 fill-black" />
              START GUIDED BOTTLE SCANNER
            </button>

            <button
              type="button"
              onClick={() => nativeCameraInputRef.current?.click()}
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-5 py-3.5 rounded-lg border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors min-h-[48px]"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
              Snap Photo with Camera
            </button>
          </div>

          {(bottlePreview || barcodePreview) && (
            <div className="pt-2 flex flex-wrap justify-center gap-4">
              {bottlePreview && (
                <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 flex items-center gap-3">
                  <img src={bottlePreview} alt="Bottle Label" className="h-14 w-14 object-cover rounded" />
                  <div className="text-left text-xs">
                    <span className="text-emerald-400 font-bold block">Pass 1: Bottle Label</span>
                    <span className="text-slate-400 text-[10px]">Sharpness Locked</span>
                  </div>
                </div>
              )}
              {barcodePreview && (
                <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 flex items-center gap-3">
                  <img src={barcodePreview} alt="Barcode" className="h-14 w-14 object-cover rounded" />
                  <div className="text-left text-xs">
                    <span className="text-emerald-400 font-bold block">Pass 2: Barcode</span>
                    <span className="text-slate-400 text-[10px]">GTIN Captured</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Optional Overrides & Evaluation */}
        <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Establishment / Shop Name</label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-govt-navy outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Product Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-govt-navy outline-none bg-white cursor-pointer"
              >
                <option value="Packaged Food">Packaged Food (Atta, Snacks, Grains)</option>
                <option value="Beverages">Beverages &amp; Juices (Bottles &amp; Cans)</option>
                <option value="Cosmetics & Personal Care">Cosmetics &amp; Personal Care</option>
                <option value="Household Goods">Household Goods &amp; Detergents</option>
                <option value="Electronics & Appliances">Electronics &amp; Appliances</option>
                <option value="Industrial Raw Materials">Industrial Raw Materials</option>
                <option value="Imported Commodity">Imported Commodity</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-govt-navy hover:bg-slate-900 text-white text-xs font-bold px-6 py-3 rounded shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Processing Inspection Pipeline...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Evaluate Compliance Results
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
