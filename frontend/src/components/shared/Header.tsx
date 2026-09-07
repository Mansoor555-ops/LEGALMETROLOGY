"use client";

import React from 'react';
import { ShieldCheck, UserCheck, Building2, ShieldAlert, LogOut, User } from 'lucide-react';
import { UserSession } from './LoginPage';

interface HeaderProps {
  session: UserSession | null;
  onLogout: () => void;
}

export default function Header({ session, onLogout }: HeaderProps) {
  const role = session?.role || 'Officer';

  return (
    <header className="bg-govt-dark text-white shadow-md border-b border-slate-700 select-none">
      {/* Top Ministry Banner */}
      <div className="bg-slate-950 px-4 sm:px-6 py-1.5 text-xs text-slate-300 flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center gap-2 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block animate-pulse"></span>
          <span className="truncate">Government of India • Ministry of Consumer Affairs, Food &amp; Public Distribution</span>
        </div>
        <div className="text-slate-400 font-mono text-[11px] hidden md:block">
          Legal Metrology (Packaged Commodities) Rules, 2011 Compliance Portal
        </div>
      </div>

      {/* Main Branding Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex items-center gap-3">
          {/* Official Emblem Icon */}
          <div className="w-10 h-10 bg-slate-800 border border-slate-600 rounded-lg flex items-center justify-center text-amber-400 shadow-inner flex-shrink-0">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Legal Metrology Compliance Assistant
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-700 rounded font-mono hidden sm:inline-block">
                SIH PS 26034
              </span>
            </h1>
            <p className="text-xs text-slate-300">
              Department of Consumer Affairs • Legal Metrology Division Enforcement Tool
            </p>
          </div>
        </div>

        {/* Logged In User Profile & Logout Action */}
        {session && (
          <div className="flex items-center gap-3 bg-slate-800/90 border border-slate-700 px-3.5 py-2 rounded-xl text-xs w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-govt-navy border border-emerald-400 flex items-center justify-center text-emerald-400 font-bold text-xs shadow-inner">
                {role === 'Officer' && <UserCheck className="w-4 h-4" />}
                {role === 'Admin' && <ShieldAlert className="w-4 h-4 text-amber-400" />}
                {role === 'Manufacturer' && <Building2 className="w-4 h-4 text-blue-400" />}
              </div>

              <div>
                <div className="font-bold text-white flex items-center gap-1.5">
                  <span>{session.name}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 bg-slate-900 text-emerald-400 border border-slate-700 rounded">
                    {session.badgeId}
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 flex items-center gap-2">
                  <span className="font-medium text-slate-400">{session.department}</span>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-700/60 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95 ml-2"
              title="Sign out of official session"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
