"use client";

import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, CheckCircle2, Shield, Sparkles, Database, Layers, ArrowUpRight, Zap } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api';

export default function SelfLearningDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [trainMessage, setTrainMessage] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/model/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.warn("Could not fetch model self-learning stats:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleTrainLocalModel = async () => {
    setTraining(true);
    setTrainMessage(null);
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/model/train`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTrainMessage(data.message || 'Local model training completed!');
        fetchStats();
      }
    } catch (err: any) {
      setTrainMessage('Training error: ' + err.message);
    }
    setTraining(false);
  };

  const dsStats = stats?.dataset_stats || {};
  const modelState = stats?.local_model_state || {};
  const totalSamples = dsStats.total_training_samples || 0;
  const verifiedSamples = dsStats.officer_verified_samples || 0;
  const accuracyPct = Math.round((modelState.estimated_accuracy || 0.70) * 100);
  const isPrimaryReady = modelState.primary_engine_ready || false;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              Autonomous Self-Learning Local Model Engine
              <span className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full border ${
                isPrimaryReady
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                  : 'bg-amber-950 text-amber-300 border-amber-500/50 animate-pulse'
              }`}>
                {isPrimaryReady ? 'PRIMARY ENGINE READY (0 API COST)' : 'COLLECTING SCANS & FINE-TUNING'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Continuously learns from every label scan &amp; officer override. Trains local Vision-OCR model to operate 100% offline.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchStats}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
            title="Refresh Training Stats"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleTrainLocalModel}
            disabled={training || totalSamples === 0}
            className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-40"
          >
            <Sparkles className="w-3.5 h-3.5 fill-black" />
            <span>{training ? 'Fine-Tuning Local Model...' : 'Train Local Model Now'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Scan Samples</span>
          <span className="text-xl font-extrabold font-mono text-white">{totalSamples}</span>
          <span className="text-[10px] text-slate-500 block">Saved in data/training_dataset</span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Officer Verified Labels</span>
          <span className="text-xl font-extrabold font-mono text-emerald-400">{verifiedSamples}</span>
          <span className="text-[10px] text-slate-500 block">Gold-standard ground truth</span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Local Model Accuracy</span>
          <span className="text-xl font-extrabold font-mono text-blue-400">{accuracyPct}%</span>
          <span className="text-[10px] text-slate-500 block">Target: &gt;90% for zero API</span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Model Version</span>
          <span className="text-sm font-extrabold font-mono text-amber-300 truncate block">{modelState.version || '1.0.0-bootstrap'}</span>
          <span className="text-[10px] text-slate-500 block">Last: {modelState.last_trained_at?.slice(0, 10) || 'Not trained'}</span>
        </div>
      </div>

      {/* Notification Message */}
      {trainMessage && (
        <div className="bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{trainMessage}</span>
        </div>
      )}
    </div>
  );
}
