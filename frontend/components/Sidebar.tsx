"use client";

import React from 'react';
import { PlusCircle, FileText, BarChart3, Settings, ShieldCheck, AlertCircle } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: string;
}

export default function Sidebar({ activeTab, setActiveTab, role }: SidebarProps) {
  return (
    <>
      {/* Desktop Navigation Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-govt-border min-h-[calc(100vh-80px)] p-4 flex-col justify-between flex-shrink-0">
        <div className="space-y-6">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 px-3">
              Enforcement Workspace
            </div>
            <nav className="space-y-1">
              {(role === 'Officer' || role === 'Admin') && (
                <button
                  onClick={() => setActiveTab('new_inspection')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold text-left transition-colors ${
                    activeTab === 'new_inspection'
                      ? 'bg-govt-navy text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  New Inspection
                </button>
              )}

              <button
                onClick={() => setActiveTab('history')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold text-left transition-colors ${
                  activeTab === 'history'
                    ? 'bg-govt-navy text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-4 h-4" />
                Inspection Records
              </button>

              {role === 'Admin' && (
                <button
                  onClick={() => setActiveTab('admin_dashboard')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold text-left transition-colors ${
                    activeTab === 'admin_dashboard'
                      ? 'bg-govt-navy text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Analytics & Violations
                </button>
              )}

              {role === 'Manufacturer' && (
                <button
                  onClick={() => setActiveTab('manufacturer_portal')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold text-left transition-colors ${
                    activeTab === 'manufacturer_portal'
                      ? 'bg-govt-navy text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <AlertCircle className="w-4 h-4" />
                  Rectification Portal
                </button>
              )}

              <button
                onClick={() => setActiveTab('rules_config')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-semibold text-left transition-colors ${
                  activeTab === 'rules_config'
                    ? 'bg-govt-navy text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Settings className="w-4 h-4" />
                Rules Config Engine
              </button>
            </nav>
          </div>

          {/* Quick Reference Box */}
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-govt-navy" />
              Rule 6 Checklist
            </div>
            <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
              <li>MRP (incl. of all taxes)</li>
              <li>Net Qty with standard unit</li>
              <li>Month & Year of Packing</li>
              <li>Mfg/Packer Name & Address</li>
              <li>Consumer Care email/phone</li>
              <li>Generic Name of Commodity</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-3 text-[11px] text-slate-400 text-center">
          Legal Metrology Division • Govt of India<br />
          SIH Field Enforcement Prototype
        </div>
      </aside>

      {/* Mobile Bottom Responsive Action Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 text-white z-40 px-2 py-2 flex justify-around items-center shadow-lg">
        {(role === 'Officer' || role === 'Admin') && (
          <button
            onClick={() => setActiveTab('new_inspection')}
            className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-3 rounded ${
              activeTab === 'new_inspection' ? 'text-emerald-400 bg-slate-800' : 'text-slate-400'
            }`}
          >
            <PlusCircle className="w-5 h-5" />
            Inspect
          </button>
        )}

        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-3 rounded ${
            activeTab === 'history' ? 'text-emerald-400 bg-slate-800' : 'text-slate-400'
          }`}
        >
          <FileText className="w-5 h-5" />
          Records
        </button>

        {role === 'Admin' && (
          <button
            onClick={() => setActiveTab('admin_dashboard')}
            className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-3 rounded ${
              activeTab === 'admin_dashboard' ? 'text-emerald-400 bg-slate-800' : 'text-slate-400'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            Analytics
          </button>
        )}

        {role === 'Manufacturer' && (
          <button
            onClick={() => setActiveTab('manufacturer_portal')}
            className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-3 rounded ${
              activeTab === 'manufacturer_portal' ? 'text-emerald-400 bg-slate-800' : 'text-slate-400'
            }`}
          >
            <AlertCircle className="w-5 h-5" />
            Rectify
          </button>
        )}

        <button
          onClick={() => setActiveTab('rules_config')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-3 rounded ${
            activeTab === 'rules_config' ? 'text-emerald-400 bg-slate-800' : 'text-slate-400'
          }`}
        >
          <Settings className="w-5 h-5" />
          Config
        </button>
      </div>
    </>
  );
}
