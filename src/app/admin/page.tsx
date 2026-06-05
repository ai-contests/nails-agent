'use client';

import { useEffect, useState } from "react";
import { Send, Play } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DecisionCard } from '@/components/admin/DecisionCard';
import { TimelineNode } from '@/components/admin/TimelineNode';

interface AgentRun {
  agent_run_id: string;
  trigger_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  chat_summary: string | null;
  error_message: string | null;
}

export default function AdminDashboard() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [triggering, setTriggering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchRuns = async () => {
    try {
      const res = await fetch('/api/admin/runs');
      const data = await res.json();
      setRuns(data.runs ?? []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const triggerCycle = async () => {
    setTriggering(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/run', { method: 'POST' });
      const data = await res.json();
      setMessage(data.message ?? 'Agent cycle triggered');
      setTimeout(fetchRuns, 1500);
    } catch (e) {
      setMessage(`Error: ${(e as Error).message}`);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar: Timeline */}
      <aside className="w-[300px] border-r border-border-dark bg-bg-dark flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-border-dark flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-dark-primary">System Timeline</h2>
          <span className="text-[10px] font-mono text-accent-green bg-accent-green/10 px-2 py-0.5 rounded-full">LIVE</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {runs.length === 0 ? (
            <p className="text-xs text-text-dark-muted text-center mt-10">No runs recorded.</p>
          ) : (
            runs.map((r) => (
              <TimelineNode 
                key={r.agent_run_id}
                id={r.agent_run_id.slice(0, 8)}
                title={r.trigger_type}
                status={r.status === 'completed' ? 'done' : r.status === 'failed' ? 'failed' : 'active'}
                description={r.chat_summary || r.error_message || 'Initializing agent sequence...'}
              />
            ))
          )}
        </div>
      </aside>

      {/* Center: Analytics & Controls Workspace */}
      <main className="flex-1 bg-bg-dark flex flex-col h-full overflow-y-auto p-8 relative">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-text-dark-primary mb-1">Technical Operations</h1>
            <p className="text-xs text-text-dark-secondary">Monitor AI performance, manage recommendations, and trigger manual overrides.</p>
          </div>
          <Button variant="admin_default" onClick={triggerCycle} disabled={triggering} className="gap-2">
            <Play className="w-4 h-4" /> {triggering ? 'Running...' : 'Trigger Cycle'}
          </Button>
        </div>

        {message && (
          <div className="mb-6 bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-xs p-3 rounded-md font-mono">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <DecisionCard title="Active Model Status" status="running">
            <div className="space-y-3">
              <div className="flex justify-between border-b border-border-dark pb-2">
                <span className="text-text-dark-muted">Model</span>
                <span className="font-mono text-text-dark-primary">llama-3.1-nemotron-nano</span>
              </div>
              <div className="flex justify-between border-b border-border-dark pb-2">
                <span className="text-text-dark-muted">Latency</span>
                <span className="font-mono text-accent-green">142ms avg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dark-muted">Uptime</span>
                <span className="font-mono text-text-dark-primary">99.99%</span>
              </div>
            </div>
          </DecisionCard>

          <DecisionCard title="Recent Rollup Stats" status="done">
            <div className="space-y-3">
              <div className="flex justify-between border-b border-border-dark pb-2">
                <span className="text-text-dark-muted">Events Processed</span>
                <span className="font-mono text-text-dark-primary">1,245</span>
              </div>
              <div className="flex justify-between border-b border-border-dark pb-2">
                <span className="text-text-dark-muted">Anomalies Detected</span>
                <span className="font-mono text-accent-amber">3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dark-muted">DB Sync</span>
                <span className="font-mono text-text-dark-primary">Up to date</span>
              </div>
            </div>
          </DecisionCard>
        </div>
      </main>

      {/* Right Sidebar: Co-Pilot Drawer */}
      <aside className="w-[360px] border-l border-border-dark bg-surface-dark flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-border-dark flex items-center justify-between bg-surface-dark-elevated">
          <h2 className="text-sm font-semibold text-text-dark-primary">Agent Co-Pilot</h2>
          <span className="w-2 h-2 rounded-full bg-accent-blue" />
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-bg-dark border border-border-dark rounded-lg p-3 w-[90%]">
            <p className="text-xs text-text-dark-secondary">System ready. Awaiting operational queries or manual overrides.</p>
          </div>
        </div>

        <div className="p-4 border-t border-border-dark bg-surface-dark-elevated">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Ask the agent to query logs..." 
              className="w-full bg-bg-dark border border-border-dark rounded-md py-2.5 pl-3 pr-10 text-xs text-text-dark-primary focus:outline-none focus:border-border-dark-focus focus:ring-1 focus:ring-border-dark-focus"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-text-dark-primary text-bg-dark rounded hover:bg-text-dark-secondary transition-colors">
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
