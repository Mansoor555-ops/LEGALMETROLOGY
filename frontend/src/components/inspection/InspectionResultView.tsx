"use client";

import React, { useState } from 'react';
import { Download, CheckCircle, XCircle, AlertTriangle, Shield, UserCheck, ArrowLeft, Eye, Edit3, Save, Cpu, BookOpen } from 'lucide-react';
import { getApiBaseUrl, submitOfficerOverride } from '@/lib/api';

interface InspectionResultViewProps {
  inspection: any;
  onBack?: () => void;
  onRefresh?: () => void;
}

export default function InspectionResultView({ inspection, onBack, onRefresh }: InspectionResultViewProps) {
  const [selectedField, setSelectedField] = useState<any | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'PASS' | 'FAIL'>('PASS');
  const [overrideNote, setOverrideNote] = useState('');
  const [officerNotes, setOfficerNotes] = useState(inspection?.officer_notes || '');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  if (!inspection) return null;

  const isExempt = inspection.is_exempt;
  const fields = inspection.fields || [];

  const handleOpenOverride = (field: any) => {
    setSelectedField(field);
    setOverrideStatus(field.override_status || (field.status === 'FAIL' ? 'PASS' : 'FAIL'));
    setOverrideNote(field.override_note || '');
  };

  const handleSaveOverride = async () => {
    if (!selectedField) return;
    setOverrideSubmitting(true);
    try {
      const res = await submitOfficerOverride(inspection.id, {
        field_key: selectedField.field_key,
        original_text: selectedField.extracted_text,
        corrected_text: selectedField.extracted_text,
        officer_notes: overrideNote || officerNotes,
        new_status: overrideStatus
      });

      if (res && res.success) {
        setSelectedField(null);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error('Failed to submit manual override:', err);
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleDownloadPdf = () => {
    const apiBase = getApiBaseUrl();
    window.open(`${apiBase}/api/inspections/${inspection.id}/pdf`, '_blank');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASS':
        return (
          <span className="badge-pass inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded text-xs font-bold">
            <CheckCircle className="w-3.5 h-3.5" /> Compliant (PASS)
          </span>
        );
      case 'FAIL':
        return (
          <span className="badge-fail inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-300 px-2 py-0.5 rounded text-xs font-bold">
            <XCircle className="w-3.5 h-3.5" /> Violation (FAIL)
          </span>
        );
      case 'NEEDS_HUMAN_REVIEW':
        return (
          <span className="badge-review inline-flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded text-xs font-bold">
            <AlertTriangle className="w-3.5 h-3.5" /> Needs Review
          </span>
        );
      case 'NOT_APPLICABLE':
      case 'EXEMPT':
        return (
          <span className="badge-exempt inline-flex items-center gap-1 text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-xs font-bold">
            <Shield className="w-3.5 h-3.5 text-slate-500" /> Exempt (Rule 3)
          </span>
        );
      case 'NOT_PRESENT_ON_PANEL':
        return (
          <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-xs font-medium">
            Not Present on Scanned Panel
          </span>
        );
      default:
        return <span className="bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded text-xs font-bold">{status}</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Bar with Quick Navigation & PDF Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 border border-govt-border rounded-lg shadow-sm">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors"
              title="Back to Inspection List"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
              <span>Inspection ID: <b>{inspection.id}</b></span>
              <span>•</span>
              <span>{inspection.timestamp}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">{inspection.shop_name}</h2>
            <p className="text-xs text-slate-600">{inspection.location} • Category: {inspection.category}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {getStatusBadge(inspection.overall_status)}
          <button
            onClick={handleDownloadPdf}
            className="bg-govt-navy hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded shadow flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4" />
            Download PDF Report
          </button>
        </div>
      </div>

      {/* GTIN Barcode & Scanned Product Details Card */}
      <div className="bg-emerald-50/80 border border-emerald-300 p-4 rounded-lg text-emerald-950 text-xs shadow-xs space-y-2">
        <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
          <span className="font-extrabold text-emerald-900 text-sm flex items-center gap-2">
            <span className="font-mono bg-emerald-800 text-white text-xs px-2 py-0.5 rounded font-bold">GTIN</span>
            Scanned Barcode Product Details
          </span>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono font-bold px-2 py-0.5 rounded">
            Source: {inspection.product_details?.source || 'Field Inspection Ingest'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-1">
          <div>
            <span className="text-slate-500 font-bold block text-[10px] uppercase">Barcode / GTIN Number:</span>
            <span className="font-mono font-extrabold text-slate-900 text-sm">
              {inspection.product_details?.barcode || inspection.barcode_gtin || 'Not Scanned'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-bold block text-[10px] uppercase">Product Name:</span>
            <span className="font-bold text-slate-900 truncate block">
              {inspection.product_details?.product_name || inspection.shop_name || 'General Packaged Commodity'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-bold block text-[10px] uppercase">Brand / Company / Manufacturer:</span>
            <span className="font-bold text-slate-900 truncate block">
              {inspection.product_details?.brand_company || 'Registered Brand'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-bold block text-[10px] uppercase">Commodity Category:</span>
            <span className="font-bold text-slate-900 truncate block">
              {inspection.category || 'Packaged Food'}
            </span>
          </div>
        </div>
      </div>

      {/* Exemption Notice Banner */}
      {isExempt && (
        <div className="bg-slate-100 border border-slate-300 p-4 rounded-lg text-slate-800 text-xs flex items-start gap-3">
          <Shield className="w-5 h-5 text-govt-navy flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-slate-900">Commodity Out of Scope (Exempted under Rule 3)</div>
            <p className="text-slate-600">{inspection.exemption_reason}</p>
          </div>
        </div>
      )}

      {/* Post-Gemini Quality Warning Banner */}
      {inspection.officer_notes?.includes('Warning') && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-lg text-amber-900 text-xs flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-950">Image Quality / Obstruction Warning Detected</div>
            <p className="text-amber-800">{inspection.officer_notes}</p>
          </div>
        </div>
      )}

      {/* Smart Multi-Panel Guidance Banner */}
      {fields.some((f: any) => f.extracted_text?.toLowerCase() === 'not found' || f.status === 'FAIL') && (
        <div className="bg-blue-50 border border-blue-300 p-4 rounded-lg text-blue-950 text-xs flex items-start gap-3 shadow-xs">
          <Cpu className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-extrabold text-blue-900 text-sm">
              Single-Panel Photo Detected (Missing Side/Back Details?)
            </div>
            <p className="text-blue-800 text-[11px]">
              The Front panel of packaged commodities usually only contains the Product Name and Net Qty. Details like <b>MRP, Mfg Date, Manufacturer Address, and Customer Care</b> are printed on the <b>Side or Back panel</b>.
              To extract all 7 mandatory fields for 100% compliance, snap or attach <b>Photo #2 (Side/Back Panel)</b> when scanning!
            </p>
          </div>
        </div>
      )}
      {!isExempt && (
        <div className="bg-white border border-govt-border rounded-lg shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-5 py-3 border-b border-govt-border flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Rule 6 Mandatory Declarations Evaluation
              </h3>
              <p className="text-[11px] text-slate-500">
                Hybrid Rule Engine: Hard non-negotiable rules (Deterministic = 100% Conf) + FAISS RAG LLM Judge (Clause Citation &amp; Relevance Score)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Mandatory Field</th>
                  <th className="py-2.5 px-4">Rule Ref</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Verdict Source</th>
                  <th className="py-2.5 px-4">Extracted Label Text</th>
                  <th className="py-2.5 px-4">Confidence</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {fields.map((f: any, idx: number) => {
                  const effectiveStatus = f.manual_override && f.override_status ? f.override_status : f.status;
                  const confPct = Math.round((f.confidence || 0) * 100);
                  const isDet = (f.verdict_source === 'DETERMINISTIC');

                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {f.label}
                        {f.manual_override && (
                          <span className="ml-2 text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-normal">
                            Overridden
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{f.cited_rule_clause || f.rule_id}</td>
                      <td className="py-3 px-4">{getStatusBadge(effectiveStatus)}</td>
                      <td className="py-3 px-4">
                        {isDet ? (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded font-bold" title="Hard pure-code non-negotiable validator">
                            <Cpu className="w-3 h-3 text-blue-600" /> DETERMINISTIC
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded font-bold" title="FAISS Vector Search + LLM Judicial Evaluation">
                            <BookOpen className="w-3 h-3 text-purple-600" /> RAG JUDGE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] max-w-xs truncate text-slate-800">
                        {f.extracted_text || <span className="text-slate-400 italic">Not detected</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono font-bold text-xs ${confPct < 60 ? 'text-amber-700' : 'text-slate-800'}`}>
                            {confPct}%
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({f.confidence?.toFixed(2)})
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenOverride(f)}
                          className="text-govt-navy hover:underline font-semibold flex items-center gap-1 justify-end ml-auto text-xs"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Verify / Override
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Override & Feedback Loop Drawer */}
      {selectedField && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-300 rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-govt-navy" />
                Officer Override &amp; Feedback Loop: {selectedField.label}
              </h4>
              <button
                onClick={() => setSelectedField(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1.5">
              <div><b>Rule Clause Citation:</b> {selectedField.cited_rule_clause}</div>
              <div><b>Verdict Source:</b> <span className="font-bold">{selectedField.verdict_source}</span></div>
              <div><b>Extracted Text:</b> <code className="bg-white border px-1.5 py-0.5 rounded">{selectedField.extracted_text}</code></div>
              <div><b>Confidence Score:</b> {Math.round(selectedField.confidence * 100)}% ({selectedField.confidence?.toFixed(2)})</div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Enforcement Officer Verification Override Status
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="overrideStatus"
                      value="PASS"
                      checked={overrideStatus === 'PASS'}
                      onChange={() => setOverrideStatus('PASS')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-emerald-800">Mark Compliant (PASS)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="overrideStatus"
                      value="FAIL"
                      checked={overrideStatus === 'FAIL'}
                      onChange={() => setOverrideStatus('FAIL')}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span className="text-red-800">Mark Violation (FAIL)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Officer Overriding Remark / Feedback *
                </label>
                <textarea
                  rows={3}
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  placeholder="e.g. Verified address on side panel. Feedback stored in corrections store for few-shot prompt context."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-govt-navy outline-none"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 flex justify-end gap-2">
              <button
                onClick={() => setSelectedField(null)}
                className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOverride}
                disabled={overrideSubmitting}
                className="px-4 py-1.5 text-xs font-bold bg-govt-navy text-white rounded hover:bg-slate-900 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Submit Feedback Correction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
