"use client";

import React, { useState, useEffect } from 'react';
import { Settings, CheckCircle } from 'lucide-react';
import { getApiBaseUrl } from '@/utils/api';

export default function RulesConfigViewer() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiBase = getApiBaseUrl();
    fetch(`${apiBase}/api/rules`)
      .then((res) => res.json())
      .then((data) => {
        setRules(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load rules:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white border border-govt-border rounded-lg p-6 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-govt-navy" />
            Legal Metrology (PC) Rules 2011 Configuration Engine
          </h2>
          <p className="text-xs text-slate-500">
            Rules loaded dynamically at runtime from <code className="bg-slate-100 px-1 py-0.5 border rounded font-mono">rules_config.json</code> — updatable without server redeployment.
          </p>
        </div>
        <span className="text-xs font-mono bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded font-bold flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Dynamic Rules Active
        </span>
      </div>

      <div className="bg-white border border-govt-border rounded-lg shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
          Configured Rule Engine Definitions ({rules.length})
        </div>

        <div className="divide-y divide-slate-200">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading rule engine definitions...</div>
          ) : (
            rules.map((rule: any, idx: number) => (
              <div key={idx} className="p-5 hover:bg-slate-50/80 transition-colors space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                      {rule.rule_id}
                    </span>
                    <span className="text-sm font-bold text-slate-900">{rule.label}</span>
                    <span className="text-xs font-mono text-slate-500">({rule.field})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {rule.mandatory ? (
                      <span className="text-[10px] uppercase font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded border border-red-300">
                        Mandatory
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-300">
                        Optional
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-600">
                  <b>Legal Provision:</b> <span className="font-medium text-slate-900">{rule.legal_reference}</span>
                </div>

                {rule.regex_patterns && rule.regex_patterns.length > 0 && (
                  <div className="text-xs">
                    <b className="text-slate-700">Regex Patterns:</b>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {rule.regex_patterns.map((pat: string, pIdx: number) => (
                        <code key={pIdx} className="bg-slate-100 border border-slate-300 text-slate-800 font-mono text-[11px] px-2 py-0.5 rounded">
                          {pat}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {rule.must_contain_phrase && rule.must_contain_phrase.length > 0 && (
                  <div className="text-xs">
                    <b className="text-slate-700">Mandatory Inclusive Phrases:</b>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {rule.must_contain_phrase.map((ph: string, phIdx: number) => (
                        <span key={phIdx} className="bg-amber-50 text-amber-900 border border-amber-300 text-[11px] px-2 py-0.5 rounded font-medium">
                          "{ph}"
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {rule.note && (
                  <div className="text-xs bg-slate-50 p-2 rounded border border-slate-200 text-slate-600 italic">
                    <b>Note:</b> {rule.note}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
