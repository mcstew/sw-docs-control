import React, { useState, useEffect } from 'react';
import { Database, GitBranch, Sparkles, RefreshCw, FileSearch, Activity, Server, ArrowRight } from 'lucide-react';

export default function App() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 3000);
  };

  const handleAudit = () => {
    setIsAuditing(true);
    setTimeout(() => setIsAuditing(false), 4000);
  };

  return (
    <div className="min-h-screen bg-[#0a0f14] text-slate-300 font-sans p-4 md:p-8 flex items-center justify-center">
      
      {/* Main Dashboard Bezel */}
      <div className="max-w-4xl w-full bg-[#1a222c] rounded-2xl p-4 md:p-6 shadow-2xl border border-slate-800 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 px-2">
          <div className="flex items-center gap-3">
            <Activity className="text-cyan-400 w-6 h-6" />
            <h1 className="text-xl font-semibold tracking-wide text-slate-100">Docs Control</h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-mono">
            <span className="text-slate-400">dev@sudowrite.com</span>
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 border border-slate-600">
              D
            </div>
          </div>
        </div>

        {/* The "Screen" - Prius Dash Inspired */}
        <div className="relative bg-[#113338] rounded-xl border-4 border-[#0d1b1e] shadow-inner overflow-hidden">
          {/* Scanline overlay for retro feel */}
          <div className="absolute inset-0 scanlines opacity-30 pointer-events-none z-10"></div>
          
          {/* Screen Header inside the monitor */}
          <div className="flex justify-between items-end p-4 border-b border-[#1a4a50] relative z-20">
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2 glow-text">
              <span className="text-green-400">â¶</span> Data Flow Monitor
            </h2>
            <div className="text-right font-mono">
              <div className="text-[#88ccdd] text-xs uppercase tracking-widest mb-1">System Status</div>
              <div className="text-white text-lg flex items-center gap-2 justify-end">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                {isSyncing ? 'SYNCING...' : isAuditing ? 'AUDITING...' : 'OPTIMAL'}
              </div>
            </div>
          </div>

          {/* Visualization Area */}
          <div className="relative h-[320px] w-full p-8 z-20">
            
            {/* SVG Connections */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ filter: 'drop-shadow(0 0 4px rgba(250, 204, 21, 0.6))' }}>
              {/* FB to Git */}
              <path 
                d="M 20% 50% L 50% 50%" 
                fill="none" 
                stroke="#facc15" 
                strokeWidth="6" 
                strokeDasharray="12 12"
                className={isSyncing ? "animate-flow-fast" : "animate-flow-slow"}
              />
              {/* Git to AI */}
              <path 
                d="M 50% 50% L 80% 50%" 
                fill="none" 
                stroke="#facc15" 
                strokeWidth="6" 
                strokeDasharray="12 12"
                className={isAuditing ? "animate-flow-fast" : isSyncing ? "animate-flow-fast" : "animate-flow-slow"}
              />
              
              {/* Feedback loop */}
              <path 
                d="M 80% 65% L 80% 85% L 20% 85% L 20% 65%" 
                fill="none" 
                stroke="#4ade80" 
                strokeWidth="3" 
                strokeDasharray="8 8"
                className="animate-flow-reverse opacity-40"
              />
            </svg>

            {/* Nodes */}
            <div className="absolute inset-0">
              
              {/* Featurebase Node */}
              <div className="absolute left-[20%] top-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
                <div className="text-[#88ccdd] font-mono text-xs mb-2 uppercase tracking-widest bg-[#113338] px-2">Source</div>
                <div className={`w-24 h-24 rounded-lg flex flex-col items-center justify-center border-2 transition-colors duration-300 relative ${isSyncing ? 'bg-cyan-900/90 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]' : 'bg-[#1a2c35] border-[#2a4a55]'}`}>
                  <Database className={`w-10 h-10 ${isSyncing ? 'text-cyan-300' : 'text-slate-400'}`} />
                  <span className="font-mono text-white mt-2 font-bold">FB</span>
                </div>
                <div className="mt-3 text-sm text-slate-300 font-medium bg-[#113338] px-2">Featurebase</div>
              </div>

              {/* Git Node */}
              <div className="absolute left-[50%] top-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
                <div className="text-[#88ccdd] font-mono text-xs mb-2 uppercase tracking-widest bg-[#113338] px-2">Storage</div>
                <div className="w-24 h-24 rounded-lg bg-[#1a2c35] border-2 border-[#2a4a55] flex flex-col items-center justify-center relative">
                  <GitBranch className="w-10 h-10 text-green-400" />
                  <span className="font-mono text-white mt-2 font-bold">GIT</span>
                </div>
                <div className="mt-3 text-sm text-slate-300 font-medium bg-[#113338] px-2">Repository</div>
              </div>

              {/* AI Node */}
              <div className="absolute left-[80%] top-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
                <div className="text-[#88ccdd] font-mono text-xs mb-2 uppercase tracking-widest bg-[#113338] px-2">Processor</div>
                <div className={`w-24 h-24 rounded-lg flex flex-col items-center justify-center border-2 transition-colors duration-300 relative ${isAuditing ? 'bg-purple-900/90 border-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.5)]' : 'bg-[#1a2c35] border-[#2a4a55]'}`}>
                  <Sparkles className={`w-10 h-10 ${isAuditing ? 'text-purple-300' : 'text-purple-400'}`} />
                  <span className="font-mono text-white mt-2 font-bold">AI</span>
                </div>
                <div className="mt-3 text-sm text-slate-300 font-medium bg-[#113338] px-2">AI Engine</div>
              </div>

            </div>
          </div>

          {/* Bottom Stats / Controls Bar inside the screen */}
          <div className="bg-[#0d1b1e] p-4 flex justify-between items-center border-t border-[#1a4a50] relative z-20">
            
            {/* Pill Buttons */}
            <div className="flex gap-4">
              <button 
                onClick={handleSync}
                disabled={isSyncing}
                className="group relative px-6 py-1.5 rounded-full border-2 border-[#4ade80] bg-transparent text-[#4ade80] font-mono text-sm font-bold uppercase tracking-wider hover:bg-[#4ade80] hover:text-[#0d1b1e] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Consumption</span> {/* Using Prius terminology for fun, normally "Sync" */}
                </div>
              </button>

              <button 
                onClick={handleAudit}
                disabled={isAuditing}
                className="group relative px-6 py-1.5 rounded-full border-2 border-[#88ccdd] bg-transparent text-[#88ccdd] font-mono text-sm font-bold uppercase tracking-wider hover:bg-[#88ccdd] hover:text-[#0d1b1e] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-2">
                  <FileSearch className="w-4 h-4" />
                  <span>Audit</span>
                </div>
              </button>
            </div>

            {/* Fake Stats */}
            <div className="flex gap-8 font-mono">
              <div>
                <div className="text-[#88ccdd] text-[10px] uppercase tracking-widest">Throughput</div>
                <div className="text-white text-xl">1.2 <span className="text-sm text-slate-400">mb/s</span></div>
              </div>
              <div>
                <div className="text-[#88ccdd] text-[10px] uppercase tracking-widest">Docs Processed</div>
                <div className="text-white text-xl">99.9 <span className="text-sm text-slate-400">%</span></div>
              </div>
            </div>

          </div>
        </div>

        {/* Lower Control Panels (Outside the main monitor) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-[#1e293b] rounded-xl p-5 border border-slate-700/50">
            <h3 className="text-slate-200 font-medium mb-2 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              Synchronization
            </h3>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              Pull latest documentation structures from Featurebase and push local repository changes to maintain parity.
            </p>
            <button 
              onClick={handleSync}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Force Sync Now
            </button>
          </div>

          <div className="bg-[#1e293b] rounded-xl p-5 border border-slate-700/50">
            <h3 className="text-slate-200 font-medium mb-2 flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-purple-400" />
              Documentation Audit
            </h3>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              Analyze recent changelogs against the current knowledge base to identify contradictions or missing entries.
            </p>
            <button 
              onClick={handleAudit}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Run Deep Audit
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
