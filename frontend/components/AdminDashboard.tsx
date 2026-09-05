"use client";

import React, { useState, useEffect } from 'react';
import { BarChart3, AlertOctagon, CheckCircle, AlertTriangle, Shield, TrendingUp, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { getApiBaseUrl } from '@/utils/api';

interface AdminDashboardProps {
  onSelectInspection: (inspection: any) => void;
}

export default function AdminDashboard({ onSelectInspection }: AdminDashboardProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/api/dashboard-stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading || !stats) {
    return (
      <div className="bg-white border border-govt-border rounded-lg p-12 text-center text-slate-500">
        Loading Legal Metrology Analytics Dashboard...
      </div>
    );
  }

  const chartData = (stats.rule_violations || []).map((r: any) => ({
    name: r.rule_id,
    label: r.label,
    violations: r.count
  }));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-govt-border rounded-lg p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-govt-navy" />
            Joint Controller Enforcement Analytics &amp; Overview
          </h2>
          <p className="text-xs text-slate-500">
            Legal Metrology (Packaged Commodities) Rules 2011 compliance metrics across jurisdictional divisions.
          </p>
        </div>

        <button
          onClick={fetchStats}
          className="text-xs text-slate-600 border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-100 flex items-center gap-1.5 font-medium cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Analytics
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Inspections</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{stats.total_inspections}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-600" /> Active Register
          </div>
        </div>

        <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-4 shadow-sm">
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600" /> Compliant (PASS)
          </div>
          <div className="text-2xl font-extrabold text-emerald-900 mt-1">{stats.pass_count}</div>
          <div className="text-[11px] text-emerald-700 mt-1">
            {stats.total_inspections > 0 ? Math.round((stats.pass_count / stats.total_inspections) * 100) : 0}% Pass Rate
          </div>
        </div>

        <div className="bg-red-50/50 border border-red-200 rounded-lg p-4 shadow-sm">
          <div className="text-xs font-bold text-red-800 uppercase tracking-wider flex items-center gap-1.5">
            <AlertOctagon className="w-4 h-4 text-red-600" /> Violations (FAIL)
          </div>
          <div className="text-2xl font-extrabold text-red-900 mt-1">{stats.fail_count}</div>
          <div className="text-[11px] text-red-700 mt-1">
            Enforcement action required
          </div>
        </div>

        <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-4 shadow-sm">
          <div className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" /> Needs Review / Exempt
          </div>
          <div className="text-2xl font-extrabold text-amber-900 mt-1">
            {stats.review_count} <span className="text-sm font-normal text-slate-600">/ {stats.exempt_count}</span>
          </div>
          <div className="text-[11px] text-amber-700 mt-1">
            Low-confidence &amp; Rule 3 bulk
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white border border-govt-border rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-1">
          Rule Violation Frequency Breakdown (Rule 6 Mandatory Provisions)
        </h3>
        <p className="text-xs text-slate-500 mb-6">
          Frequency of label non-compliance instances detected across active rules.
        </p>

        <div className="h-64 w-full">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No rule violations recorded in database yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '4px', fontSize: '12px' }}
                  formatter={(value: any, name: any, item: any) => [`${value} Violations`, item.payload.label]}
                />
                <Bar dataKey="violations" fill="#0B3D6E" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#0B3D6E' : '#B91C1C'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Flagged Cases Table */}
      <div className="bg-white border border-govt-border rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-1">
          Flagged Escalated Cases Register
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Inspections flagged with Rule 6 violations or low-confidence officer review triggers.
        </p>

        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Inspection ID</th>
                <th className="py-2.5 px-4">Shop / Establishment</th>
                <th className="py-2.5 px-4">Location</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(stats.flagged_cases || []).map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-bold text-govt-navy">{c.id}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{c.shop_name}</td>
                  <td className="py-3 px-4 text-slate-600">{c.location}</td>
                  <td className="py-3 px-4 text-slate-600">{c.category}</td>
                  <td className="py-3 px-4">
                    <span className={c.overall_status === 'FAIL' ? 'badge-fail' : 'badge-review'}>
                      {c.overall_status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={async () => {
                        const apiBase = getApiBaseUrl();
                        const res = await fetch(`${apiBase}/api/inspections/${c.id}`);
                        if (res.ok) {
                          const data = await res.json();
                          onSelectInspection(data);
                        }
                      }}
                      className="text-govt-navy hover:underline font-bold text-xs"
                    >
                      Review Case
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
