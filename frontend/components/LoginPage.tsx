"use client";

import React, { useState } from 'react';
import { ShieldCheck, UserCheck, ShieldAlert, Building2, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';

export interface UserSession {
  username: string;
  name: string;
  badgeId: string;
  role: 'Officer' | 'Admin' | 'Manufacturer';
  department: string;
  location: string;
}

interface LoginPageProps {
  onLoginSuccess: (session: UserSession) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [selectedRole, setSelectedRole] = useState<'Officer' | 'Admin' | 'Manufacturer'>('Officer');
  const [username, setUsername] = useState('officer_sharma');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter your official username and password.');
      return;
    }

    let session: UserSession;
    if (selectedRole === 'Officer') {
      session = {
        username: username,
        name: 'Inspector R. Sharma',
        badgeId: 'LM-OFF-9042',
        role: 'Officer',
        department: 'Legal Metrology Enforcement Squad',
        location: 'Delhi Central Zone'
      };
    } else if (selectedRole === 'Admin') {
      session = {
        username: username,
        name: 'Controller K. V. Sundaram',
        badgeId: 'LM-ADM-1002',
        role: 'Admin',
        department: 'Office of Joint Controller of Legal Metrology',
        location: 'HQ Directorate, New Delhi'
      };
    } else {
      session = {
        username: username,
        name: 'PureFoods India Pvt Ltd',
        badgeId: 'MFG-REG-78921',
        role: 'Manufacturer',
        department: 'Packaged Commodities Rectification Portal',
        location: 'Gurugram Industrial Zone'
      };
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('legal_metrology_user_session', JSON.stringify(session));
    }
    onLoginSuccess(session);
  };

  const handleQuickPresetLogin = (role: 'Officer' | 'Admin' | 'Manufacturer') => {
    let session: UserSession;
    if (role === 'Officer') {
      session = {
        username: 'officer_sharma',
        name: 'Inspector R. Sharma',
        badgeId: 'LM-OFF-9042',
        role: 'Officer',
        department: 'Legal Metrology Enforcement Squad',
        location: 'Delhi Central Zone'
      };
    } else if (role === 'Admin') {
      session = {
        username: 'admin_sundaram',
        name: 'Controller K. V. Sundaram',
        badgeId: 'LM-ADM-1002',
        role: 'Admin',
        department: 'Office of Joint Controller of Legal Metrology',
        location: 'HQ Directorate, New Delhi'
      };
    } else {
      session = {
        username: 'mfg_purefoods',
        name: 'PureFoods India Pvt Ltd',
        badgeId: 'MFG-REG-78921',
        role: 'Manufacturer',
        department: 'Packaged Commodities Rectification Portal',
        location: 'Gurugram Industrial Zone'
      };
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('legal_metrology_user_session', JSON.stringify(session));
    }
    onLoginSuccess(session);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-govt-dark to-slate-900 text-white flex flex-col justify-between">
      {/* Top Ministry Banner */}
      <div className="bg-slate-950 px-6 py-2.5 border-b border-slate-800 text-xs text-slate-300 flex justify-between items-center">
        <div className="flex items-center gap-2 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block animate-pulse"></span>
          <span>Government of India • Ministry of Consumer Affairs, Food &amp; Public Distribution</span>
        </div>
        <div className="text-slate-400 font-mono text-[11px] hidden sm:block">
          Legal Metrology (Packaged Commodities) Rules, 2011 Portal
        </div>
      </div>

      {/* Main Login Card Container */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-0">
          
          {/* Header */}
          <div className="bg-slate-900 text-white p-6 text-center border-b border-slate-800 relative">
            <div className="w-14 h-14 bg-govt-navy rounded-full border-2 border-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-lg">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              Legal Metrology Compliance Assistant
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              National Enforcement &amp; Commodity Inspection Portal (SIH PS 26034)
            </p>
          </div>

          {/* Role Selection Tabs */}
          <div className="grid grid-cols-3 bg-slate-100 p-1 border-b border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => { setSelectedRole('Officer'); setUsername('officer_sharma'); }}
              className={`py-2.5 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-1 transition-all cursor-pointer ${
                selectedRole === 'Officer' ? 'bg-white text-govt-navy shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>Officer</span>
            </button>
            <button
              type="button"
              onClick={() => { setSelectedRole('Admin'); setUsername('admin_sundaram'); }}
              className={`py-2.5 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-1 transition-all cursor-pointer ${
                selectedRole === 'Admin' ? 'bg-white text-govt-navy shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Controller</span>
            </button>
            <button
              type="button"
              onClick={() => { setSelectedRole('Manufacturer'); setUsername('mfg_purefoods'); }}
              className={`py-2.5 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-1 transition-all cursor-pointer ${
                selectedRole === 'Manufacturer' ? 'bg-white text-govt-navy shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Manufacturer</span>
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div className="text-center space-y-1">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                {selectedRole === 'Officer' && 'Enforcement Officer Portal Login'}
                {selectedRole === 'Admin' && 'Joint Controller Admin Login'}
                {selectedRole === 'Manufacturer' && 'Manufacturer Rectification Portal Login'}
              </span>
              <p className="text-[11px] text-slate-500">
                Enter your credentials to access your designated workflow space.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded text-xs">
                {error}
              </div>
            )}

            <div className="space-y-3 text-xs font-medium">
              <div>
                <label className="block text-slate-700 mb-1 font-semibold">User ID / Official Badge Number</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter User ID..."
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-govt-navy outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-govt-navy outline-none font-mono"
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-govt-navy hover:bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 text-xs"
            >
              <span>Sign In to Compliance System</span>
              <ArrowRight className="w-4 h-4 text-emerald-400" />
            </button>

            {/* Quick Demo Access Presets */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-500 block text-center uppercase tracking-wider">
                Quick Single-Tap Demo Logins:
              </span>

              <div className="space-y-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleQuickPresetLogin('Officer')}
                  className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 p-2 rounded-lg text-left flex justify-between items-center transition-colors cursor-pointer"
                >
                  <div>
                    <span className="font-bold block">Inspector R. Sharma</span>
                    <span className="text-[10px] text-emerald-700">Enforcement Officer • Badge #LM-OFF-9042</span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickPresetLogin('Admin')}
                  className="w-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 p-2 rounded-lg text-left flex justify-between items-center transition-colors cursor-pointer"
                >
                  <div>
                    <span className="font-bold block">Controller K. V. Sundaram</span>
                    <span className="text-[10px] text-amber-700">Joint Controller Admin Dashboard</span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-amber-600" />
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickPresetLogin('Manufacturer')}
                  className="w-full bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 p-2 rounded-lg text-left flex justify-between items-center transition-colors cursor-pointer"
                >
                  <div>
                    <span className="font-bold block">PureFoods India Pvt Ltd</span>
                    <span className="text-[10px] text-blue-700">Manufacturer Rectification Portal</span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-950 p-3 text-center text-[11px] text-slate-500 border-t border-slate-800">
        © 2026 Legal Metrology Division • Department of Consumer Affairs • Smart India Hackathon Prototype (PS 26034)
      </div>
    </div>
  );
}
