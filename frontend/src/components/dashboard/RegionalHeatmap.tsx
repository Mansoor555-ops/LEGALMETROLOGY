"use client";

import React, { useState } from 'react';
import { MapPin, AlertTriangle, ShieldCheck, Filter, TrendingUp } from 'lucide-react';

interface RegionalViolationData {
  region: string;
  state_code: string;
  total_inspections: number;
  violations: number;
  violation_rate: number;
  top_violated_rule: string;
}

const REGIONAL_STATS: RegionalViolationData[] = [
  { region: "North Zone (Delhi NCR)", state_code: "DL", total_inspections: 142, violations: 38, violation_rate: 26.8, top_violated_rule: "Rule 6(1)(e) - Missing Tax Clause" },
  { region: "West Zone (Maharashtra)", state_code: "MH", total_inspections: 198, violations: 44, violation_rate: 22.2, top_violated_rule: "Rule 6(1)(d) - Mfg Date Format" },
  { region: "South Zone (Karnataka)", state_code: "KA", total_inspections: 165, violations: 29, violation_rate: 17.5, top_violated_rule: "Rule 6(1)(c) - Non-Metric Net Qty" },
  { region: "East Zone (West Bengal)", state_code: "WB", total_inspections: 110, violations: 33, violation_rate: 30.0, top_violated_rule: "Rule 6(1)(f) - Consumer Care Missing" },
  { region: "Central Zone (Madhya Pradesh)", state_code: "MP", total_inspections: 95, violations: 21, violation_rate: 22.1, top_violated_rule: "Rule 6(1)(a) - Manufacturer Address" },
  { region: "North East Zone (Assam)", state_code: "AS", total_inspections: 60, violations: 19, violation_rate: 31.6, top_violated_rule: "Rule 6(1)(e) - Cross-Seller MRP Mismatch" }
];

export default function RegionalHeatmap() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All Categories");

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-5 text-slate-100 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-400" />
            REGIONAL LEGAL METROLOGY VIOLATION HEATMAP
          </h3>
          <p className="text-xs text-slate-300">
            Geographic enforcement analytics for Legal Metrology (Packaged Commodities) Rules compliance
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-xs font-bold text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            <option value="All Categories">All Categories</option>
            <option value="Packaged Food">Packaged Food</option>
            <option value="Beverages">Beverages</option>
            <option value="Cosmetics & Personal Care">Cosmetics & Personal Care</option>
            <option value="Household Goods">Household Goods</option>
          </select>
        </div>
      </div>

      {/* Dense Regional Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {REGIONAL_STATS.map((stat) => {
          const isHighAlert = stat.violation_rate >= 25.0;
          return (
            <div
              key={stat.state_code}
              className={`p-4 rounded-xl border transition-all ${
                isHighAlert
                  ? 'bg-amber-950/40 border-amber-500/60 shadow-lg'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-slate-200">{stat.region}</span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  isHighAlert ? 'bg-amber-500 text-black font-extrabold' : 'bg-slate-800 text-slate-300'
                }`}>
                  {stat.state_code}
                </span>
              </div>

              <div className="flex items-baseline justify-between my-2">
                <span className="text-2xl font-black text-white">
                  {stat.violation_rate}%
                </span>
                <span className="text-xs text-slate-300">
                  {stat.violations} / {stat.total_inspections} Violations
                </span>
              </div>

              {/* Progress Heat Bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden my-2">
                <div
                  className={`h-full rounded-full ${
                    stat.violation_rate >= 30.0
                      ? 'bg-red-500'
                      : stat.violation_rate >= 20.0
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, stat.violation_rate * 2.5)}%` }}
                />
              </div>

              <div className="text-[11px] text-slate-300 flex items-center justify-between pt-1 border-t border-slate-800/80">
                <span className="truncate">Top: {stat.top_violated_rule}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
