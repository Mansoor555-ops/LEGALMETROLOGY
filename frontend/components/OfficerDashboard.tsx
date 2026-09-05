"use client";

import React, { useState, useEffect } from 'react';
import { Camera, Zap, AlertTriangle, FileText, CheckCircle2, ArrowRight, RefreshCw, Layers, Loader2 } from 'lucide-react';
import SmartCaptureCamera from './SmartCaptureCamera';
import { getApiBaseUrl } from '@/utils/api';
import { UserSession } from './LoginPage';

interface OfficerDashboardProps {
  session: UserSession | null;
  onSelectInspection: (inspection: any) => void;
}

export default function OfficerDashboard({ session, onSelectInspection }: OfficerDashboardProps) {
  const [showAutoScanner, setShowAutoScanner] = useState(false);
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchRecentInspections = async () => {
    setLoading(true);
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/inspections?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setInspections(data);
      }
    } catch (err) {
      console.warn("Could not fetch inspections list:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecentInspections();
  }, []);

  const handleScanCompleteFromScanner = async (files: File[]) => {
    setShowAutoScanner(false);
    if (!files || files.length === 0) return;

    setIsAnalyzing(true);
    setErrorMsg(null);

    // Auto submit to inspection API
    const formData = new FormData();
    formData.append('shop_name', 'Verified Field Inspection Site');
    formData.append('location', session?.location || 'Field Site Location');
    formData.append('category', 'Packaged Food');
    formData.append('net_quantity', '');
    formData.append('is_institutional', 'false');

    files.forEach((f, idx) => {
      formData.append('images', f);
      formData.append(`photo_${idx + 1}`, f);
    });

    if (files.length > 0) {
      formData.append('front_image', files[0]);
      if (files.length > 1) {
        formData.append('back_image', files[1]);
      } else {
        formData.append('back_image', files[0]);
      }
    }

    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/inspect`, {
        method: 'POST',
        body: formData
      });

      setIsAnalyzing(false);

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status} error during evaluation`);
      }

      const data = await res.json();
      if (data.success && data.inspection) {
        onSelectInspection(data.inspection);
      } else {
        setErrorMsg(data.message || 'Inspection processing failed. Please try again.');
      }
    } catch (err: any) {
      setIsAnalyzing(false);
      setErrorMsg(err.message || 'Error connecting to Legal Metrology enforcement server.');
    }
  };

  const passCount = inspections.filter(i => i.overall_status === 'PASS').length;
  const failCount = inspections.filter(i => i.overall_status === 'FAIL' || i.overall_status === 'NON_COMPLIANT').length;
  const totalCount = inspections.length;
  const passRate = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 100;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Fullscreen Analyzing Overlay HUD */}
      {isAnalyzing && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex flex-col items-center justify-center p-6 text-white text-center select-none backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-md w-full shadow-2xl space-y-5">
            <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-extrabold text-white flex items-center justify-center gap-2">
                <Zap className="w-5 h-5 fill-emerald-400 text-emerald-400" />
                EVALUATING PACKAGED COMMODITY
              </h3>
              <p className="text-xs text-slate-300">
                Running Optical Character Recognition (OCR), region segmentation, and Rule 6 compliance check across snapped label photos...
              </p>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div className="bg-emerald-400 h-full w-3/4 animate-pulse"></div>
            </div>
            <p className="text-[11px] font-mono text-emerald-400">
              Checking MRP • Net Quantity • Mfg Date • Manufacturer Address
            </p>
          </div>
        </div>
      )}

      {/* Smart Capture Camera Launcher */}
      {showAutoScanner && (
        <SmartCaptureCamera
          onScanComplete={handleScanCompleteFromScanner}
          onClose={() => setShowAutoScanner(false)}
        />
      )}

      {/* Error Alert Notification Banner */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-slate-500 hover:text-slate-800 font-bold px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Hero Card for Field Officer */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 rounded-full text-xs font-bold font-mono">
              <Zap className="w-3.5 h-3.5 fill-emerald-400" />
              OFFICER ENFORCEMENT HUD • BADGE #{session?.badgeId || 'LM-OFF-9042'}
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Welcome, {session?.name || 'Enforcement Inspector'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Department of Consumer Affairs • {session?.department || 'Legal Metrology Field Squad'}. Ready for instant packaged commodity compliance scanning.
            </p>
          </div>

          {/* Single Unified Primary Scan Button */}
          <div className="w-full md:w-auto">
            <button
              onClick={() => setShowAutoScanner(true)}
              className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-8 py-4 rounded-xl shadow-2xl flex items-center justify-center gap-3 cursor-pointer transition-all active:scale-95 text-sm sm:text-base border border-emerald-300 min-h-[52px]"
            >
              <Camera className="w-6 h-6 fill-black" />
              <span>SCAN PACKAGED COMMODITY</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center text-blue-600 font-bold">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase block">Total Field Inspections</span>
            <span className="text-xl font-extrabold text-slate-900">{totalCount}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center text-emerald-600 font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase block">Compliant Packages</span>
            <span className="text-xl font-extrabold text-emerald-600">{passCount} ({passRate}%)</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 border border-red-200 rounded-xl flex items-center justify-center text-red-600 font-bold">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase block">Violations Flagged</span>
            <span className="text-xl font-extrabold text-red-600">{failCount}</span>
          </div>
        </div>
      </div>

      {/* Recent Field Inspection Logs */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-govt-navy" />
              Recent Field Inspection Certificates &amp; Records
            </h3>
            <p className="text-xs text-slate-500">Live inspection records saved in enforcement database</p>
          </div>
          <button
            onClick={fetchRecentInspections}
            className="text-xs text-govt-navy font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh List
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading inspection history...</div>
        ) : inspections.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-3">
            <p>No field inspections recorded yet.</p>
            <button
              onClick={() => setShowAutoScanner(true)}
              className="bg-govt-navy text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer inline-flex items-center gap-2"
            >
              <Camera className="w-4 h-4 text-emerald-400" /> Start First Auto-Scan
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Inspection ID</th>
                  <th className="p-3">Establishment / Shop</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Compliance Status</th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {inspections.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-govt-navy">{item.id}</td>
                    <td className="p-3 font-semibold text-slate-800">{item.shop_name}</td>
                    <td className="p-3 text-slate-600">{item.category}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        item.overall_status === 'PASS'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : item.overall_status === 'EXEMPT'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-red-100 text-red-800 border border-red-300'
                      }`}>
                        {item.overall_status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">{item.timestamp}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onSelectInspection(item)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded font-bold text-[11px] border border-slate-300 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>View Details</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
