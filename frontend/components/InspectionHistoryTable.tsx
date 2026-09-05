"use client";

import React, { useState, useEffect } from 'react';
import { Search, FileText, Download, CheckCircle, XCircle, AlertTriangle, Shield, RefreshCw } from 'lucide-react';
import { getApiBaseUrl } from '@/utils/api';

interface InspectionHistoryTableProps {
  onSelectInspection: (inspection: any) => void;
}

export default function InspectionHistoryTable({ onSelectInspection }: InspectionHistoryTableProps) {
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchInspections = async () => {
    setLoading(true);
    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/api/inspections`);
      if (response.ok) {
        const data = await response.json();
        setInspections(data);
      }
    } catch (err) {
      console.error('Failed to fetch inspection history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, []);

  const filteredInspections = inspections.filter((item) => {
    const matchesSearch =
      item.shop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || item.overall_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASS':
        return <span className="badge-pass"><CheckCircle className="w-3 h-3" /> PASS</span>;
      case 'FAIL':
        return <span className="badge-fail"><XCircle className="w-3 h-3" /> FAIL</span>;
      case 'NEEDS_HUMAN_REVIEW':
        return <span className="badge-review"><AlertTriangle className="w-3 h-3" /> NEEDS REVIEW</span>;
      case 'EXEMPT':
        return <span className="badge-exempt"><Shield className="w-3 h-3" /> EXEMPT</span>;
      default:
        return <span className="badge-exempt">{status}</span>;
    }
  };

  return (
    <div className="bg-white border border-govt-border rounded-lg shadow-sm space-y-4 p-4 sm:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-govt-navy" />
            Legal Metrology Inspection Records Log
          </h2>
          <p className="text-xs text-slate-500">
            Historical enforcement register of packaged commodity label compliance inspections.
          </p>
        </div>

        <button
          onClick={fetchInspections}
          className="text-xs text-slate-600 border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-100 flex items-center gap-1.5 font-medium cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh List
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Shop Name, Location, or Inspection ID..."
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-govt-navy outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded px-3 py-2 bg-white font-medium focus:ring-1 focus:ring-govt-navy outline-none cursor-pointer w-full sm:w-auto"
          >
            <option value="ALL">All Statuses</option>
            <option value="PASS">Compliant (PASS)</option>
            <option value="FAIL">Violation (FAIL)</option>
            <option value="NEEDS_HUMAN_REVIEW">Needs Review</option>
            <option value="EXEMPT">Exempt (Rule 3)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-200 rounded">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-4">Inspection ID</th>
              <th className="py-2.5 px-4">Date &amp; Time</th>
              <th className="py-2.5 px-4">Shop / Establishment</th>
              <th className="py-2.5 px-4">Location</th>
              <th className="py-2.5 px-4">Category</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  Loading inspection records...
                </td>
              </tr>
            ) : filteredInspections.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No inspection records match the current filter query.
                </td>
              </tr>
            ) : (
              filteredInspections.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onSelectInspection(item)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-bold text-govt-navy">{item.id}</td>
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{item.timestamp}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{item.shop_name}</td>
                  <td className="py-3 px-4 text-slate-600">{item.location}</td>
                  <td className="py-3 px-4 text-slate-600">{item.category}</td>
                  <td className="py-3 px-4">{getStatusBadge(item.overall_status)}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const apiBase = getApiBaseUrl();
                        window.open(`${apiBase}/api/inspections/${item.id}/pdf`, '_blank');
                      }}
                      className="text-xs text-govt-navy hover:underline font-semibold inline-flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
