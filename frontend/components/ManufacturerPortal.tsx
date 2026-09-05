"use client";

import React, { useState, useEffect } from 'react';
import { Building2, AlertTriangle, CheckCircle2, Send, Download } from 'lucide-react';
import { getApiBaseUrl } from '@/utils/api';

export default function ManufacturerPortal() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<any | null>(null);
  const [rectificationText, setRectificationText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchInspections = async () => {
    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/api/inspections`);
      if (response.ok) {
        const data = await response.json();
        const flagged = data.filter((i: any) => i.overall_status === 'FAIL' || i.overall_status === 'NEEDS_HUMAN_REVIEW');
        setInspections(flagged);
        if (flagged.length > 0 && !selectedInspection) {
          fetchSingleInspection(flagged[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load manufacturer records:', err);
    }
  };

  const fetchSingleInspection = async (id: string) => {
    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/api/inspections/${id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedInspection(data);
        setRectificationText(data.rectification_remark || '');
      }
    } catch (err) {
      console.error('Error fetching inspection:', err);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, []);

  const handleSubmitRectification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInspection || !rectificationText) return;
    setSubmitting(true);
    setSuccessMsg(null);

    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/api/manufacturer/rectify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspection_id: selectedInspection.id,
          remark: rectificationText
        })
      });

      if (response.ok) {
        setSuccessMsg('Rectification remark submitted successfully to enforcement authority.');
        fetchSingleInspection(selectedInspection.id);
      }
    } catch (err) {
      console.error('Error submitting rectification:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-govt-border rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-govt-navy" />
          Manufacturer / Packer / Importer Compliance Rectification Portal
        </h2>
        <p className="text-xs text-slate-500">
          Review flagged Legal Metrology non-compliance reports issued against your packaging batches and submit official rectification notices.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left List of Flagged Inspections */}
        <div className="bg-white border border-govt-border rounded-lg p-4 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b pb-2">
            Flagged Violation Notices ({inspections.length})
          </h3>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {inspections.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">
                No active violation notices found.
              </div>
            ) : (
              inspections.map((item) => (
                <div
                  key={item.id}
                  onClick={() => fetchSingleInspection(item.id)}
                  className={`p-3 border rounded-md cursor-pointer transition-colors text-xs ${
                    selectedInspection?.id === item.id
                      ? 'border-govt-navy bg-slate-50 shadow-sm'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-center font-mono font-bold text-slate-900">
                    <span>{item.id}</span>
                    <span className={item.overall_status === 'FAIL' ? 'badge-fail' : 'badge-review'}>
                      {item.overall_status}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-800 mt-1">{item.shop_name}</div>
                  <div className="text-[11px] text-slate-500">{item.location} • {item.timestamp}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Inspection Details & Rectification Submission Form */}
        <div className="md:col-span-2 space-y-6">
          {selectedInspection ? (
            <>
              <div className="bg-white border border-govt-border rounded-lg p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Notice ID: {selectedInspection.id}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Establishment: {selectedInspection.shop_name} ({selectedInspection.location})
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const apiBase = getApiBaseUrl();
                      window.open(`${apiBase}/api/inspections/${selectedInspection.id}/pdf`, '_blank');
                    }}
                    className="text-xs text-govt-navy hover:underline font-bold flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Official Notice PDF
                  </button>
                </div>

                {/* Violation Field Summary */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800">Flagged Non-Compliant Declarations:</h4>
                  <div className="space-y-2">
                    {(selectedInspection.fields || [])
                      .filter((f: any) => f.status === 'FAIL' || f.override_status === 'FAIL')
                      .map((f: any, idx: number) => (
                        <div key={idx} className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-900 space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            {f.label} ({f.legal_reference})
                          </div>
                          <div><b>Detected Label Text:</b> <code className="bg-white border border-red-200 px-1.5 py-0.5 rounded">{f.extracted_text}</code></div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Rectification Remark Form */}
                <form onSubmit={handleSubmitRectification} className="border-t border-slate-200 pt-4 space-y-3">
                  <label className="block text-xs font-bold text-slate-800">
                    Manufacturer Official Rectification &amp; Compliance Undertaking Remark *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={rectificationText}
                    onChange={(e) => setRectificationText(e.target.value)}
                    placeholder="e.g. We acknowledge the absence of toll-free customer care number on Batch #882. Distribution has been paused and corrected layout labels with 1800 toll-free number have been applied to subsequent production runs."
                    className="w-full text-xs p-3 border border-slate-300 rounded focus:ring-1 focus:ring-govt-navy outline-none"
                  />

                  {successMsg && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="bg-govt-navy hover:bg-slate-900 text-white text-xs font-bold px-5 py-2 rounded shadow flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5 text-blue-300" />
                      Submit Rectification Remark
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="bg-white border border-govt-border rounded-lg p-12 text-center text-xs text-slate-500">
              Select a violation notice from the left register to review details and submit rectification remarks.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
