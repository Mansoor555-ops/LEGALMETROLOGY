"use client";

import React, { useState } from 'react';
import { Download, CheckCircle, XCircle, AlertTriangle, Shield, UserCheck, ArrowLeft, Eye, Edit3, Save } from 'lucide-react';

import { getApiBaseUrl } from '@/utils/api';

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
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/api/inspections/${inspection.id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_key: selectedField.field_key,
          override_status: overrideStatus,
          override_note: overrideNote,
          officer_notes: officerNotes
        })
      });

      if (response.ok) {
        const data = await response.json();
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
          <span className="badge-pass">
            <CheckCircle className="w-3.5 h-3.5" /> Compliant (PASS)
          </span>
        );
      case 'FAIL':
        return (
          <span className="badge-fail">
            <XCircle className="w-3.5 h-3.5" /> Violation (FAIL)
          </span>
        );
      case 'NEEDS_HUMAN_REVIEW':
        return (
          <span className="badge-review">
            <AlertTriangle className="w-3.5 h-3.5" /> Needs Review
          </span>
        );
      case 'EXEMPT':
        return (
          <span className="badge-exempt">
            <Shield className="w-3.5 h-3.5" /> Exempt (Rule 3)
          </span>
        );
      default:
        return <span className="badge-exempt">{status}</span>;
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

      {/* Mandatory Declarations Compliance Table */}
      {!isExempt && (
        <div className="bg-white border border-govt-border rounded-lg shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-5 py-3 border-b border-govt-border flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Rule 6 Mandatory Declarations Evaluation
            </h3>
            <span className="text-[11px] text-slate-500">
              Confidence threshold: 60% (Score &lt;0.6 routed to Human Review)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Mandatory Field</th>
                  <th className="py-2.5 px-4">Rule Ref</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Extracted Label Text</th>
                  <th className="py-2.5 px-4">Conf / Panel</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {fields.map((f: any, idx: number) => {
                  const effectiveStatus = f.manual_override && f.override_status ? f.override_status : f.status;
                  const confPct = Math.round((f.confidence || 0) * 100);

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
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{f.legal_reference || f.rule_id}</td>
                      <td className="py-3 px-4">{getStatusBadge(effectiveStatus)}</td>
                      <td className="py-3 px-4 font-mono text-[11px] max-w-xs truncate text-slate-800">
                        {f.extracted_text || <span className="text-slate-400 italic">Not detected</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${confPct < 60 ? 'text-amber-700' : 'text-slate-700'}`}>
                            {confPct}%
                          </span>
                          <span className="text-[10px] uppercase font-semibold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                            {f.source_panel || 'front'}
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

      {/* Manual Override & Visual Evidence Modal / Drawer */}
      {selectedField && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-300 rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-govt-navy" />
                Officer Manual Override: {selectedField.label}
              </h4>
              <button
                onClick={() => setSelectedField(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1.5">
              <div><b>Rule Reference:</b> {selectedField.legal_reference}</div>
              <div><b>Source Panel:</b> {selectedField.source_panel?.toUpperCase()}</div>
              <div><b>OCR Extracted Text:</b> <code className="bg-white border px-1.5 py-0.5 rounded">{selectedField.extracted_text}</code></div>
              <div><b>OCR Confidence Score:</b> {Math.round(selectedField.confidence * 100)}%</div>
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
                  Officer Overriding Reason / Remark *
                </label>
                <textarea
                  rows={3}
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  placeholder="e.g. Declaration verified visually on side seal; OCR smudge resolved upon manual inspection."
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
                Save Officer Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
