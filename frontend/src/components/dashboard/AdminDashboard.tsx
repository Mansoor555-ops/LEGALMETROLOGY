"use client";

import React, { useState, useEffect } from 'react';
import { BarChart3, AlertOctagon, CheckCircle, AlertTriangle, Shield, TrendingUp, RefreshCw, MapPin, Barcode } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { getApiBaseUrl } from '@/lib/api';
import RegionalHeatmap from './RegionalHeatmap';
import ProductMasterLookup from './ProductMasterLookup';

interface AdminDashboardProps {
  onSelectInspection: (inspection: any) => void;
}

export default function AdminDashboard({ onSelectInspection }: AdminDashboardProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'heatmap' | 'gtin'>('analytics');

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
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-12 text-center text-slate-300">
        Loading Legal Metrology Analytics &amp; Product Master Dashboard...
      </div>
    );
  }

  const chartData = (stats.rule_violations || [
    { rule_id: "RULE-6-1-E", label: "MRP Tax Clause Missing", count: 38 },
    { rule_id: "RULE-6-1-D", label: "Mfg Date Format Invalid", count: 24 },
    { rule_id: "RULE-6-1-C", label: "Net Qty Non-Metric Unit", count: 18 },
    { rule_id: "RULE-6-1-F", label: "Consumer Care Contact Missing", count: 15 },
    { rule_id: "RULE-6-1-A", label: "Manufacturer Address Missing", count: 12 }
  ]).map((r: any) => ({
    name: r.rule_id,
    label: r.label,
    violations: r.count
  }));

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Bar */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab('analytics')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              activeSubTab === 'analytics'
                ? 'bg-emerald-500 text-black font-extrabold shadow-lg'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Enforcement Analytics
          </button>

          <button
            onClick={() => setActiveSubTab('heatmap')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              activeSubTab === 'heatmap'
                ? 'bg-emerald-500 text-black font-extrabold shadow-lg'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <MapPin className="w-4 h-4" />
            Regional Heatmap
          </button>

          <button
            onClick={() => setActiveSubTab('gtin')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              activeSubTab === 'gtin'
                ? 'bg-emerald-500 text-black font-extrabold shadow-lg'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Barcode className="w-4 h-4" />
            GTIN Product Master
          </button>
        </div>

        <button
          onClick={fetchStats}
          className="text-xs text-emerald-400 bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 py-2 rounded-lg flex items-center gap-1.5 font-bold cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
        </button>
      </div>

      {activeSubTab === 'heatmap' && <RegionalHeatmap />}
      {activeSubTab === 'gtin' && <ProductMasterLookup />}

      {activeSubTab === 'analytics' && (
        <>
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Inspections</div>
              <div className="text-3xl font-black text-white mt-1">{stats.total_inspections}</div>
              <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" /> Active Database Register
              </div>
            </div>

            <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-xl p-4 shadow-lg">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Compliant (PASS)
              </div>
              <div className="text-3xl font-black text-emerald-300 mt-1">{stats.pass_count}</div>
              <div className="text-[11px] text-emerald-400 mt-1 font-bold">
                {stats.pass_rate || (stats.total_inspections > 0 ? Math.round((stats.pass_count / stats.total_inspections) * 100) : 100)}% Pass Rate
              </div>
            </div>

            <div className="bg-red-950/40 border border-red-500/50 rounded-xl p-4 shadow-lg">
              <div className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-red-400" /> Violations (FAIL)
              </div>
              <div className="text-3xl font-black text-red-300 mt-1">{stats.fail_count}</div>
              <div className="text-[11px] text-red-400 mt-1">
                Enforcement action required
              </div>
            </div>

            <div className="bg-amber-950/40 border border-amber-500/50 rounded-xl p-4 shadow-lg">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Needs Officer Review
              </div>
              <div className="text-3xl font-black text-amber-300 mt-1">
                {stats.review_count}
              </div>
              <div className="text-[11px] text-amber-400 mt-1">
                RAG quality gate triggers
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-slate-100">
            <h3 className="text-sm font-bold text-white mb-1">
              Rule Violation Frequency Breakdown (Rule 6 Mandatory Provisions)
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Frequency of label non-compliance instances detected across active rules.
            </p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '8px', fontSize: '12px', borderColor: '#334155' }}
                    formatter={(value: any, name: any, item: any) => [`${value} Violations`, item.payload.label]}
                  />
                  <Bar dataKey="violations" fill="#10B981" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#10B981' : '#EF4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
