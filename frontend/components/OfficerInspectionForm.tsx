"use client";

import React, { useState, useRef } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, Loader2, Camera, QrCode, Zap, Sparkles, FileText, Check } from 'lucide-react';
import GeolocationBadge from './GeolocationBadge';
import BarcodeScanner from './BarcodeScanner';
import { getApiBaseUrl } from '@/utils/api';

interface OfficerInspectionFormProps {
  onInspectionComplete: (result: any) => void;
  scannedFile?: File | null;
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

  const [gpsData, setGpsData] = useState<{
    latitude?: number;
    longitude?: number;
    accuracy?: number;
  }>({});

  const [bottleImage, setBottleImage] = useState<File | null>(scannedFile);
  const [bottlePreview, setBottlePreview] = useState<string | null>(
    scannedFile ? URL.createObjectURL(scannedFile) : null
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
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBottleImage(file);
      setBottlePreview(URL.createObjectURL(file));
    }
  };

  const executePipeline = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!shopName && !bottleImage) {
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

      if (bottleImage) {
        formData.append('front_image', bottleImage);
        formData.append('back_image', bottleImage);
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
        capture="environment"
        className="hidden"
        onChange={handleNativeCameraChange}
      />

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

        {/* 3. Scanned Image Preview Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Camera className="w-4 h-4 text-govt-navy" />
              Scanned Package Label Photo
            </span>
            <button
              type="button"
              onClick={() => nativeCameraInputRef.current?.click()}
              className="text-xs text-govt-navy font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              {bottleImage ? 'Change Photo' : 'Snap Photo'}
            </button>
          </div>

          {bottlePreview ? (
            <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <img src={bottlePreview} alt="Scanned label preview" className="w-20 h-20 object-cover rounded-lg border border-slate-300" />
              <div className="text-xs space-y-1">
                <span className="font-bold text-slate-900 block">{bottleImage?.name || 'scanned_label.jpg'}</span>
                <span className="text-emerald-700 font-semibold text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                  ✓ Photo attached for empirical OCR extraction
                </span>
              </div>
            </div>
          ) : (
            <div
              onClick={() => nativeCameraInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-500 text-xs hover:border-govt-navy hover:bg-slate-100 transition-colors cursor-pointer space-y-2"
            >
              <Camera className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-semibold text-slate-700">Click to attach or snap package label image</p>
              <p className="text-[11px] text-slate-400">Supports JPEG, PNG packaging labels &amp; bottle photos</p>
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
            <label className="block text-slate-700 mb-1 font-semibold">Declared Net Quantity (Optional User Override)</label>
            <input
              type="text"
              value={netQuantity}
              onChange={(e) => setNetQuantity(e.target.value)}
              placeholder="e.g. 500 g, 1.5 L (auto-extracted if blank)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-govt-navy outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-700 mb-1 font-semibold">GTIN / EAN Barcode Code</label>
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
            <label htmlFor="isInstitutional" className="text-xs text-slate-700 cursor-pointer font-semibold">
              Rule 3 Exemption: Declared for Institutional / Industrial Use ($> 25\text{kg/L}$)
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
