"use client";

import React, { useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import OfficerInspectionForm from '@/components/OfficerInspectionForm';
import InspectionResultView from '@/components/InspectionResultView';
import InspectionHistoryTable from '@/components/InspectionHistoryTable';
import AdminDashboard from '@/components/AdminDashboard';
import ManufacturerPortal from '@/components/ManufacturerPortal';
import RulesConfigViewer from '@/components/RulesConfigViewer';

export default function Home() {
  const [role, setRole] = useState<string>('Officer');
  const [activeTab, setActiveTab] = useState<string>('new_inspection');
  const [selectedInspection, setSelectedInspection] = useState<any | null>(null);

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    if (newRole === 'Admin') {
      setActiveTab('admin_dashboard');
    } else if (newRole === 'Manufacturer') {
      setActiveTab('manufacturer_portal');
    } else {
      setActiveTab('new_inspection');
    }
  };

  const handleInspectionComplete = (inspectionData: any) => {
    setSelectedInspection(inspectionData);
    setActiveTab('inspection_detail');
  };

  const handleSelectInspection = (inspectionData: any) => {
    setSelectedInspection(inspectionData);
    setActiveTab('inspection_detail');
  };

  return (
    <div className="min-h-screen bg-govt-light flex flex-col">
      <Header role={role} setRole={handleRoleChange} />

      <div className="flex flex-1">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} role={role} />

        <main className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'new_inspection' && (
            <OfficerInspectionForm onInspectionComplete={handleInspectionComplete} />
          )}

          {activeTab === 'inspection_detail' && selectedInspection && (
            <InspectionResultView
              inspection={selectedInspection}
              onBack={() => setActiveTab('history')}
              onRefresh={async () => {
                const res = await fetch(`http://localhost:8000/api/inspections/${selectedInspection.id}`);
                if (res.ok) {
                  const updated = await res.json();
                  setSelectedInspection(updated);
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
