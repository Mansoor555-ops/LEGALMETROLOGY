"use client";

import React from 'react';
import { ShieldCheck, UserCheck, Building2, ShieldAlert } from 'lucide-react';

interface HeaderProps {
  role: string;
  setRole: (role: string) => void;
}

export default function Header({ role, setRole }: HeaderProps) {
  return (
    <header className="bg-govt-dark text-white shadow-md border-b border-slate-700">
      {/* Top Ministry Banner */}
      <div className="bg-slate-900 px-6 py-1.5 text-xs text-slate-300 flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center gap-2 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>
          <span>Government of India • Ministry of Consumer Affairs, Food & Public Distribution</span>
        </div>
        <div className="text-slate-400 font-mono text-[11px]">
          Legal Metrology (Packaged Commodities) Rules, 2011 Compliance Portal
        </div>
      </div>

      {/* Main Branding Header */}
      <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          {/* Official Emblem Placeholder */}
          <div className="w-10 h-10 bg-slate-800 border border-slate-600 rounded flex items-center justify-center text-amber-400 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Legal Metrology Compliance Assistant
              <span className="text-xs font-semibold px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-700 rounded">
                SIH PS 26034
              </span>
            </h1>
            <p className="text-xs text-slate-300">
              Department of Consumer Affairs • Legal Metrology Division Enforcement Tool
            </p>
          </div>
        </div>

        {/* Role Selector */}
        <div className="flex items-center gap-3 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-md">
          <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            {role === 'Officer' && <UserCheck className="w-4 h-4 text-emerald-400" />}
            {role === 'Admin' && <ShieldAlert className="w-4 h-4 text-amber-400" />}
            {role === 'Manufacturer' && <Building2 className="w-4 h-4 text-blue-400" />}
            Active Role:
          </span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="bg-slate-900 border border-slate-600 text-white text-xs font-semibold rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
          >
            <option value="Officer">Enforcement Officer</option>
            <option value="Admin">Joint Controller (Admin)</option>
            <option value="Manufacturer">Manufacturer / Importer</option>
          </select>
        </div>
      </div>
    </header>
  );
}
