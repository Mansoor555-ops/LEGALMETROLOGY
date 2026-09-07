"use client";

import React, { useState, useEffect } from 'react';
import { Search, Barcode, AlertTriangle, CheckCircle2, History, Package } from 'lucide-react';
import { lookupProductMaster, fetchAllProductsMaster } from '@/lib/api';

export default function ProductMasterLookup() {
  const [searchGtin, setSearchGtin] = useState<string>('');
  const [productsList, setProductsList] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    const res = await fetchAllProductsMaster();
    if (res && res.products) {
      setProductsList(res.products);
    }
    setLoading(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchGtin.trim()) return;
    
    setLoading(true);
    const res = await lookupProductMaster(searchGtin.trim());
    if (res && res.found) {
      setSelectedProduct(res.product);
    } else {
      setSelectedProduct(null);
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-5 text-slate-100 shadow-xl space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
            <Barcode className="w-5 h-5 text-emerald-400" />
            GTIN / BARCODE PRODUCT MASTER & CROSS-SELLER MRP TRACKER
          </h3>
          <p className="text-xs text-slate-300">
            Cross-seller MRP discrepancy detection for identical commodities across locations
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search GTIN / Barcode..."
              value={searchGtin}
              onChange={(e) => setSearchGtin(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
          <button
            type="submit"
            className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors"
          >
            Search GTIN
          </button>
        </form>
      </div>

      {/* Main Master Records View */}
      {selectedProduct ? (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex justify-between items-start border-b border-slate-800 pb-3">
            <div>
              <span className="text-xs font-mono font-bold text-emerald-400 block">
                GTIN: {selectedProduct.gtin || selectedProduct.barcode}
              </span>
              <h4 className="text-sm font-extrabold text-white">{selectedProduct.product_name}</h4>
              <p className="text-xs text-slate-300">Category: {selectedProduct.category}</p>
            </div>

            {selectedProduct.has_mrp_mismatch ? (
              <span className="bg-amber-950 text-amber-300 border border-amber-500/60 text-xs font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                MRP MISMATCH DETECTED ({selectedProduct.mrp_variation_range})
              </span>
            ) : (
              <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/60 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                MRP UNIFORM ACROSS SELLERS ({selectedProduct.mrp_variation_range})
              </span>
            )}
          </div>

          {/* Historical Scans Table */}
          <div>
            <h5 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
              <History className="w-4 h-4 text-emerald-400" />
              Historical Scans Across Sellers & Enforcement Sites:
            </h5>
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-900 text-slate-300 border-b border-slate-800 font-bold">
                  <tr>
                    <th className="p-2.5">Date & Time</th>
                    <th className="p-2.5">Inspection ID</th>
                    <th className="p-2.5">Seller / Location</th>
                    <th className="p-2.5">Declared MRP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {selectedProduct.declared_mrps?.map((entry: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-900/60">
                      <td className="p-2.5 text-slate-300 font-mono">{entry.timestamp}</td>
                      <td className="p-2.5 text-emerald-400 font-bold">{entry.inspection_id}</td>
                      <td className="p-2.5 font-medium">{entry.seller_location}</td>
                      <td className="p-2.5 font-mono font-extrabold text-amber-300">₹{entry.mrp?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={() => setSelectedProduct(null)}
            className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
          >
            ← Back to all GTIN Product Master records
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs text-slate-200">
            <thead className="bg-slate-950 text-slate-300 border-b border-slate-800 font-bold">
              <tr>
                <th className="p-3">GTIN / Barcode</th>
                <th className="p-3">Product Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">MRP Variation Range</th>
                <th className="p-3">Cross-Seller Status</th>
                <th className="p-3">Last Scanned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {productsList.length > 0 ? (
                productsList.map((prod) => (
                  <tr
                    key={prod.barcode}
                    onClick={() => setSelectedProduct(prod)}
                    className="hover:bg-slate-900 cursor-pointer transition-colors"
                  >
                    <td className="p-3 font-mono text-emerald-400 font-bold">{prod.barcode}</td>
                    <td className="p-3 font-bold text-white">{prod.product_name}</td>
                    <td className="p-3 text-slate-300">{prod.category}</td>
                    <td className="p-3 font-mono font-bold text-amber-300">{prod.mrp_variation_range}</td>
                    <td className="p-3">
                      {prod.has_mrp_mismatch ? (
                        <span className="text-amber-400 font-bold bg-amber-950/90 border border-amber-500/50 px-2 py-0.5 rounded text-[10px]">
                          ⚠️ MRP MISMATCH
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold bg-emerald-950/90 border border-emerald-500/50 px-2 py-0.5 rounded text-[10px]">
                          ✓ UNIFORM
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-400">{prod.last_scanned}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-300">
                    No GTIN product master records registered yet. Scan packaged commodities to populate master records.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
