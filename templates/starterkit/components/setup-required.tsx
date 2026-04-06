"use client";

import React from "react";
import { AlertCircle, Terminal, FileCode, ShieldAlert } from "lucide-react";

interface SetupRequiredProps {
  invalidToken?: boolean;
}

export function SetupRequired({ invalidToken }: SetupRequiredProps) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24 text-center">
      <div className="bg-white rounded-[2.5rem] p-12 shadow-2xl shadow-blue-100 border border-blue-50">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-8 mx-auto ${invalidToken ? 'bg-red-500' : 'bg-blue-600'}`}>
          {invalidToken ? <ShieldAlert className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
        </div>
        
        <h1 className="text-4xl font-extrabold text-gray-900 mb-6 tracking-tight text-balance">
          {invalidToken ? "Invalid API Token" : "Configuration Required"}
        </h1>
        
        <p className="text-xl text-gray-500 mb-10 leading-relaxed max-w-lg mx-auto">
          {invalidToken 
            ? "Your API token was rejected by SaCMS. Please check your token in your SaCMS dashboard and update your .env.local file."
            : "To get started, you need to connect this frontend to your SaCMS instance. Please set up your environment variables."
          }
        </p>

        <div className="space-y-6 text-left max-w-md mx-auto">
          {invalidToken ? (
            <div className="bg-red-50 p-6 rounded-3xl border border-red-100">
              <h3 className="flex items-center gap-2 font-bold text-red-900 mb-4">
                <ShieldAlert className="w-5 h-5" /> How to Fix
              </h3>
              <ol className="text-sm text-red-800 space-y-3 list-decimal ml-4">
                <li>Go to your SaCMS Dashboard</li>
                <li>Navigate to <strong>Settings &gt; API Keys</strong></li>
                <li>Copy a valid token for your tenant</li>
                <li>Update <span className="font-mono bg-white px-1.5 py-0.5 rounded border">SACMS_API_TOKEN</span> in your <span className="font-mono bg-white px-1.5 py-0.5 rounded border">.env.local</span></li>
              </ol>
            </div>
          ) : (
            <>
              <div className="bg-slate-50 p-6 rounded-3xl">
                <h3 className="flex items-center gap-2 font-bold text-gray-900 mb-4">
                  <Terminal className="w-5 h-5 text-blue-600" /> Step 1: Create Environment File
                </h3>
                <code className="block bg-slate-900 text-slate-100 p-4 rounded-2xl text-sm font-mono overflow-x-auto">
                  cp .env.example .env.local
                </code>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl">
                <h3 className="flex items-center gap-2 font-bold text-gray-900 mb-4">
                  <FileCode className="w-5 h-5 text-blue-600" /> Step 2: Configure Keys
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Edit your <span className="font-mono bg-white px-1.5 py-0.5 rounded border">.env.local</span> and fill in your SaCMS details:
                </p>
                <div className="bg-slate-900 p-5 rounded-2xl space-y-2 font-mono text-xs overflow-x-auto">
                  <div className="text-slate-400">NEXT_PUBLIC_SACMS_URL=<span className="text-green-400">&quot;...&quot;</span></div>
                  <div className="text-slate-400">SACMS_TENANT=<span className="text-green-400">&quot;...&quot;</span></div>
                  <div className="text-slate-400">SACMS_API_TOKEN=<span className="text-green-400">&quot;...&quot;</span></div>
                </div>
              </div>
            </>
          )}
        </div>

        <button 
          onClick={() => window.location.reload()}
          className={`mt-12 w-full text-white py-5 rounded-2xl font-bold transition-all shadow-lg active:scale-[0.98] ${invalidToken ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
        >
          Check Configuration Again
        </button>
      </div>
    </div>
  );
}
