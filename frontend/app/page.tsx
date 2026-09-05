"use client";

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import LoginPage, { UserSession } from '@/components/LoginPage';
import OfficerDashboard from '@/components/OfficerDashboard';
import OfficerInspectionForm from '@/components/OfficerInspectionForm';
import InspectionResultView from '@/components/InspectionResultView';
import InspectionHistoryTable from '@/components/InspectionHistoryTable';
import AdminDashboard from '@/components/AdminDashboard';
import ManufacturerPortal from '@/components/ManufacturerPortal';
import RulesConfigViewer from '@/components/RulesConfigViewer';
import { getApiBaseUrl } from '@/utils/api';

export default function Home() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<string>('officer_dashboard');
  const [selectedInspection, setSelectedInspection] = useState<any | null>(null);
  const [isClientLoaded, setIsClientLoaded] = useState(false);

  // Restore session from localStorage on client mount
  useEffect(() => {
    setIsClientLoaded(true);
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('legal_metrology_user_session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSession(parsed);
          if (parsed.role === 'Admin') setActiveTab('admin_dashboard');
          else if (parsed.role === 'Manufacturer') setActiveTab('manufacturer_portal');
          else setActiveTab('officer_dashboard');
        } catch (e) {
          localStorage.removeItem('legal_metrology_user_session');
        }
      }
    }
  }, []);

  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    if (newSession.role === 'Admin') setActiveTab('admin_dashboard');
    else if (newSession.role === 'Manufacturer') setActiveTab('manufacturer_portal');
    else setActiveTab('officer_dashboard');
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('legal_metrology_user_session');
    }
    setSession(null);
    setSelectedInspection(null);
    setActiveTab('officer_dashboard');
  };

  const handleInspectionComplete = (inspectionData: any) => {
    setSelectedInspection(inspectionData);
    setActiveTab('inspection_detail');
  };

  const handleSelectInspection = (inspectionData: any) => {
    setSelectedInspection(inspectionData);
    setActiveTab('inspection_detail');
  };

  if (!isClientLoaded) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Loading portal...</div>;

  // Render Login Page if user is not authenticated
  if (!session) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const role = session.role;

  return (
    <div className="min-h-screen bg-govt-light flex flex-col font-sans">
      <Header session={session} onLogout={handleLogout} />

      <div className="flex flex-1">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} role={role} />

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {activeTab === 'officer_dashboard' && (
            <OfficerDashboard session={session} onSelectInspection={handleSelectInspection} />
          )}

          {activeTab === 'new_inspection' && (
            <OfficerInspectionForm onInspectionComplete={handleInspectionComplete} />
          )}

          {activeTab === 'inspection_detail' && selectedInspection && (
            <InspectionResultView
              inspection={selectedInspection}
              onBack={() => setActiveTab(role === 'Admin' ? 'admin_dashboard' : 'history')}
              onRefresh={async () => {
                try {
                  const apiBase = getApiBaseUrl();
                  const res = await fetch(`${apiBase}/api/inspections/${selectedInspection.id}`);
                  if (res.ok) {
                    const updated = await res.json();
                    setSelectedInspection(updated);
                  }
                } catch (e) {
                  console.warn("Refresh inspection details note:", e);
                }
              }}
            />
          )}

          {activeTab === 'history' && (
            <InspectionHistoryTable onSelectInspection={handleSelectInspection} />
          )}

          {activeTab === 'admin_dashboard' && (
            <AdminDashboard onSelectInspection={handleSelectInspection} />
          )}

          {activeTab === 'manufacturer_portal' && (
            <ManufacturerPortal />
          )}

          {activeTab === 'rules_config' && (
            <RulesConfigViewer />
          )}
        </main>
      </div>
    </div>
  );
}
