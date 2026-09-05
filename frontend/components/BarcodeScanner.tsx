"use client";

import React, { useState } from 'react';
import { QrCode, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getApiBaseUrl } from '@/utils/api';

interface BarcodeScannerProps {
  onBarcodeDecoded: (productInfo: any) => void;
}

export default function BarcodeScanner({ onBarcodeDecoded }: BarcodeScannerProps) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Client-side GTIN Registry Fallback for instant mobile offline lookup
  const localBarcodeRegistry: Record<string, any> = {
    "8901030800012": {
      code: "8901030800012",
      product_name: "Whole Wheat Flour Atta",
      brand: "PureFoods",
      category: "Packaged Food",
      net_quantity: "500 g",
      manufacturer: "PureFoods India Pvt Ltd"
    },
    "8901234567890": {
      code: "8901234567890",
      product_name: "Organics Face Wash Lotion",
      brand: "GlowCare",
      category: "Cosmetics & Personal Care",
      net_quantity: "250 ml",
      manufacturer: "GlowCare Organics Pvt Ltd"
    },
    "8909876543210": {
      code: "8909876543210",
      product_name: "Industrial Polymer Resin Sack",
      brand: "ChemIndustrial",
      category: "Industrial Raw Materials",
      net_quantity: "50 kg",
      manufacturer: "ChemIndustrial Chemicals Ltd"
    },
    "7613032123456": {
      code: "7613032123456",
      product_name: "Dark Chocolate Slab",
      brand: "Apex Import",
      category: "Imported Commodity",
      net_quantity: "150 g",
      manufacturer: "Swiss Chocolatier SA / Imp by Apex Trading"
    }
  };

  const handleScanOrLookup = async (codeToLookup: string) => {
    const code = codeToLookup.trim();
    if (!code) return;

    setLoading(true);
    setStatusMsg(null);

    // 1. Check local registry first for zero-latency mobile execution
    if (localBarcodeRegistry[code]) {
      const prod = localBarcodeRegistry[code];
      setLoading(false);
      setStatusMsg(`Product identified: ${prod.product_name} (${prod.brand})`);
      onBarcodeDecoded(prod);
      return;
    }

    // 2. Fallback to API lookup
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/barcode/lookup/${code}`);
      if (res.ok) {
        const data = await res.json();
        setLoading(false);
        if (data.found) {
          setStatusMsg(`Product identified: ${data.product.product_name} (${data.product.brand})`);
          onBarcodeDecoded(data.product);
          return;
        }
      }
    } catch (err) {
      console.warn("Barcode API fetch warning, fallback to manual code binding");
    }

    setLoading(false);
    setStatusMsg(`GTIN ${code} bound to inspection; empirical camera OCR will extract net quantity & commodity.`);
    onBarcodeDecoded({ code });
  };

  const sampleBarcodes = [
    { code: "8901030800012", label: "PureFoods Wheat Atta (500g)" },
    { code: "8901234567890", label: "GlowCare Face Wash (250ml)" },
    { code: "8909876543210", label: "Industrial Resin Sack (50kg)" },
    { code: "7613032123456", label: "Dark Chocolate Slab (150g)" }
  ];

  return (
    <div className="bg-white border border-slate-300 rounded-lg p-3.5 sm:p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <QrCode className="w-4 h-4 text-govt-navy" />
          GTIN / EAN Barcode &amp; QR Scanner
        </span>
        <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-mono font-bold">
          Auto Product Lookup Ready
        </span>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder="Enter or scan 13-digit EAN/UPC barcode..."
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

      {/* Quick Tap Scan Buttons */}
      <div className="text-[11px]">
        <span className="text-slate-600 font-semibold block mb-1">Tap Sample Barcode to Scan:</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {sampleBarcodes.map((b) => (
            <button
              key={b.code}
              type="button"
              onClick={() => {
                setBarcodeInput(b.code);
                handleScanOrLookup(b.code);
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-mono px-2.5 py-1.5 rounded border border-slate-300 text-left flex justify-between items-center transition-colors cursor-pointer min-h-[36px]"
            >
              <span className="font-bold text-govt-navy">{b.code}</span>
              <span className="text-[10px] text-slate-600 truncate max-w-[150px]">{b.label}</span>
            </button>
          ))}
        </div>
      </div>

      {statusMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs p-2.5 rounded flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}
    </div>
  );
}
