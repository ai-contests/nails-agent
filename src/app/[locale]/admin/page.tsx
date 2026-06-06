'use client';

import { useEffect, useState, useCallback } from "react";
import { Send, Play, Loader2, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DecisionCard } from '@/components/admin/DecisionCard';
import { TimelineNode } from '@/components/admin/TimelineNode';
import { Link } from '@/src/i18n/routing';
import { useTranslations } from 'next-intl';


interface AgentRun {
  agent_run_id: string;
  trigger_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  chat_summary: string | null;
  error_message: string | null;
  input_summary: string | null;
}

interface Finding {
  finding_id: string;
  finding_type: string;
  target_type: string;
  target_id: string | null;
  title: string;
  summary: string;
  score: number | null;
}

interface Decision {
  decision_id: string;
  action_type: string;
  target_type: string;
  target_id: string | null;
  title: string;
  summary: string;
  status: string;
}

interface Proposal {
  proposal_id: string;
  proposal_type: string;
  status: string;
  intended_action: string;
  confidence: number | null;
}

interface RunDetail {
  run: AgentRun;
  findings: Finding[];
  decisions: Decision[];
  proposals: Proposal[];
}

export default function AdminDashboard() {
  const t = useTranslations('admin');
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'agent'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/runs');
      const data = await res.json() as { runs: AgentRun[] };
      setRuns(data.runs ?? []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchRunDetail = useCallback(async (runId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/runs/${runId}`);
      const data = await res.json() as RunDetail;
      setRunDetail(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
    const initChat = async () => {
      try {
        const res = await fetch('/api/admin/chat/session', { method: 'POST' });
        const data = await res.json() as { chatSessionId?: string };
        if (data.chatSessionId) setChatSessionId(data.chatSessionId);
      } catch (e) {
        console.error('Failed to init chat session:', e);
      }
    };
    initChat();
  }, [fetchRuns]);

  // Auto-select latest run on first load
  useEffect(() => {
    if (runs.length > 0 && !selectedRunId) {
      const latest = runs[0]!;
      setSelectedRunId(latest.agent_run_id);
      fetchRunDetail(latest.agent_run_id);
    }
  }, [runs, selectedRunId, fetchRunDetail]);

  // Poll until the latest run reaches a terminal state (completed/failed)
  const pollUntilComplete = useCallback(async (runId: string) => {
    let attempts = 0;
    const maxAttempts = 40; // 40 × 4s = 160s max
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/admin/runs/${runId}`);
        const data = await res.json() as RunDetail;
        setRunDetail(data);
        await fetchRuns();
        if (data.run.status === 'completed' || data.run.status === 'failed' || attempts >= maxAttempts) {
          clearInterval(interval);
          setMessage(
            data.run.status === 'completed'
              ? `✓ Cycle complete — ${data.findings.length} findings, ${data.decisions.length} decisions`
              : `✗ Cycle failed: ${data.run.error_message ?? 'unknown error'}`
          );
        }
      } catch {
        if (attempts >= maxAttempts) clearInterval(interval);
      }
    }, 4000);
  }, [fetchRuns]);

  const triggerCycle = async () => {
    setTriggering(true);
    setMessage('Agent cycle triggered — waiting for completion...');
    try {
      await fetch('/api/admin/run', { method: 'POST' });
      // Wait 3s for the run row to be created, then start polling
      setTimeout(async () => {
        const res2 = await fetch('/api/admin/runs');
        const d2 = await res2.json() as { runs: AgentRun[] };
        if (d2.runs && d2.runs.length > 0) {
          const latest = d2.runs[0]!;
          setSelectedRunId(latest.agent_run_id);
          setRuns(d2.runs);
          pollUntilComplete(latest.agent_run_id);
        }
      }, 3000);
    } catch (e) {
      setMessage(`Error: ${(e as Error).message}`);
    } finally {
      setTriggering(false);
    }
  };

  const selectRun = (runId: string) => {
    setSelectedRunId(runId);
    fetchRunDetail(runId);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !chatSessionId || sendingChat) return;
    const userContent = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userContent }]);
    setSendingChat(true);
    try {
      const res = await fetch('/api/admin/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatSessionId, content: userContent }),
      });
      const data = await res.json() as { content?: string; error?: string };
      if (data.content) {
        setChatMessages(prev => [...prev, { role: 'agent', content: data.content! }]);
      } else if (data.error) {
        setChatMessages(prev => [...prev, { role: 'agent', content: `Error: ${data.error}` }]);
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'agent', content: `Network error: ${(e as Error).message}` }]);
    } finally {
      setSendingChat(false);
    }
  };

  // Parse real stats from last run's input_summary
  const lastRun = runs[0] ?? null;
  let inputSummary: Record<string, unknown> = {};
  if (lastRun?.input_summary) {
    try { inputSummary = JSON.parse(lastRun.input_summary) as Record<string, unknown>; } catch { /* noop */ }
  }
  const rollupSummary = inputSummary['rollupSummary'] as { styleCount?: number; tagCount?: number } | undefined;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar: Timeline of runs */}
      <aside className="w-[300px] border-r border-border-dark bg-bg-dark flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-border-dark flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-dark-primary">{t('systemTimeline')}</h2>
          <span className="text-[10px] font-mono text-accent-green bg-accent-green/10 px-2 py-0.5 rounded-full">{t('live')}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {runs.length === 0 ? (
            <p className="text-xs text-text-dark-muted text-center mt-10">{t('noRuns')}</p>
          ) : (
            runs.map((r) => (
              <button
                key={r.agent_run_id}
                onClick={() => selectRun(r.agent_run_id)}
                className={`w-full text-left rounded-md transition-colors ${selectedRunId === r.agent_run_id ? 'ring-1 ring-accent-blue/40' : ''}`}
              >
                <TimelineNode
                  id={r.agent_run_id.slice(0, 8)}
                  title={r.trigger_type}
                  status={r.status === 'completed' ? 'done' : r.status === 'failed' ? 'failed' : 'active'}
                  description={r.chat_summary || r.error_message || 'Initializing agent sequence...'}
                />
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Center: Analytics workspace */}
      <main className="flex-1 bg-bg-dark flex flex-col h-full overflow-y-auto p-8 relative">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-text-dark-primary">{t('title')}</h1>
              <Link href="/" className="text-xs text-accent-blue hover:underline">{t('backConsumer')}</Link>
            </div>
            <p className="text-xs text-text-dark-secondary">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedRunId && (
              <button
                onClick={() => fetchRunDetail(selectedRunId)}
                className="text-xs text-text-dark-muted hover:text-text-dark-primary flex items-center gap-1 px-3 py-2 border border-border-dark rounded-md transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> {t('refresh')}
              </button>
            )}
            <Button variant="admin_default" onClick={triggerCycle} disabled={triggering} className="gap-2">
              <Play className="w-4 h-4" /> {triggering ? t('triggering') : t('trigger')}
            </Button>
          </div>
        </div>

        {message && (
          <div className="mb-6 bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-xs p-3 rounded-md font-mono">
            {message}
          </div>
        )}

        {/* Real stats cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <DecisionCard
            title={t('lastRun')}
            status={lastRun
              ? (lastRun.status === 'completed' ? 'done' : lastRun.status === 'failed' ? 'failed' : 'running')
              : 'done'}
          >
            {lastRun ? (
              <div className="space-y-3">
                <div className="flex justify-between border-b border-border-dark pb-2">
                  <span className="text-text-dark-muted">{t('status')}</span>
                  <span className={`font-mono ${lastRun.status === 'completed' ? 'text-accent-green' : lastRun.status === 'failed' ? 'text-red-400' : 'text-accent-amber'}`}>
                    {lastRun.status}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border-dark pb-2">
                  <span className="text-text-dark-muted">{t('triggerType')}</span>
                  <span className="font-mono text-text-dark-primary">{lastRun.trigger_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dark-muted">{t('startedAt')}</span>
                  <span className="font-mono text-text-dark-secondary text-[11px]">
                    {new Date(lastRun.started_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-dark-muted">{t('noRunsDesc')}</p>
            )}
          </DecisionCard>

          <DecisionCard title={t('rollupStats')} status="done">
            {lastRun && rollupSummary ? (
              <div className="space-y-3">
                <div className="flex justify-between border-b border-border-dark pb-2">
                  <span className="text-text-dark-muted">{t('listedStyles')}</span>
                  <span className="font-mono text-text-dark-primary">{rollupSummary.styleCount ?? '—'}</span>
                </div>
                <div className="flex justify-between border-b border-border-dark pb-2">
                  <span className="text-text-dark-muted">{t('tagCategories')}</span>
                  <span className="font-mono text-text-dark-primary">{rollupSummary.tagCount ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dark-muted">{t('clickEvents')}</span>
                  <span className="font-mono text-text-dark-primary">
                    {(inputSummary['totalClickCount'] as number | undefined) ?? '—'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-dark-muted">{t('awaitingFirst')}</p>
            )}
          </DecisionCard>
        </div>

        {/* Run detail: findings, decisions, proposals */}
        {loadingDetail && (
          <div className="flex items-center gap-2 text-xs text-text-dark-muted mb-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('loadingDetail')}
          </div>
        )}

        {runDetail && !loadingDetail && (
          <div className="space-y-6">
            {runDetail.findings.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-text-dark-muted uppercase tracking-wider mb-3">
                  {t('findings')} ({runDetail.findings.length})
                </h3>
                <div className="space-y-2">
                  {runDetail.findings.map(f => (
                    <div key={f.finding_id} className="bg-surface-dark border border-border-dark rounded-md p-3 flex items-start gap-3">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                        f.finding_type === 'opportunity' ? 'bg-accent-green/10 text-accent-green' :
                        f.finding_type === 'anomaly' ? 'bg-red-500/10 text-red-400' :
                        'bg-accent-amber/10 text-accent-amber'
                      }`}>
                        {f.finding_type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text-dark-primary truncate">{f.title}</p>
                        <p className="text-[11px] text-text-dark-muted mt-0.5 line-clamp-2">{f.summary}</p>
                        {f.target_id && (
                          <p className="text-[10px] text-text-dark-muted font-mono mt-1">{f.target_type}: {f.target_id}</p>
                        )}
                      </div>
                      {f.score != null && (
                        <span className="text-[11px] font-mono text-text-dark-secondary shrink-0">
                          {(f.score * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {runDetail.decisions.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-text-dark-muted uppercase tracking-wider mb-3">
                  {t('decisions')} ({runDetail.decisions.length})
                </h3>
                <div className="space-y-2">
                  {runDetail.decisions.map(d => (
                    <div key={d.decision_id} className="bg-surface-dark border border-border-dark rounded-md p-3 flex items-start gap-3">
                      <ChevronRight className="w-3.5 h-3.5 text-accent-blue shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text-dark-primary truncate">{d.title}</p>
                        <p className="text-[11px] text-text-dark-muted mt-0.5 line-clamp-2">{d.summary}</p>
                        <p className="text-[10px] font-mono text-accent-blue mt-1">{d.action_type}</p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                        d.status === 'executed' ? 'bg-accent-green/10 text-accent-green' : 'bg-border-dark text-text-dark-muted'
                      }`}>
                        {d.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {runDetail.proposals.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-text-dark-muted uppercase tracking-wider mb-3">
                  {t('proposals')} ({runDetail.proposals.length})
                </h3>
                <div className="space-y-2">
                  {runDetail.proposals.map(p => (
                    <div key={p.proposal_id} className="bg-surface-dark border border-border-dark rounded-md p-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text-dark-primary truncate">{p.intended_action}</p>
                        <p className="text-[10px] font-mono text-text-dark-muted mt-1">{p.proposal_type}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {p.confidence != null && (
                          <span className="text-[11px] font-mono text-text-dark-secondary">
                            {(p.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          p.status === 'executed' ? 'bg-accent-green/10 text-accent-green' :
                          p.status === 'approved' ? 'bg-accent-blue/10 text-accent-blue' :
                          p.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                          'bg-border-dark text-text-dark-muted'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {runDetail.findings.length === 0 && runDetail.decisions.length === 0 && runDetail.proposals.length === 0 && (
              <p className="text-xs text-text-dark-muted">{t('noFindings')}</p>
            )}
          </div>
        )}
      </main>

      {/* Right Sidebar: Agent Co-Pilot Chat */}
      <aside className="w-[360px] border-l border-border-dark bg-surface-dark flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-border-dark flex items-center justify-between bg-surface-dark-elevated">
          <h2 className="text-sm font-semibold text-text-dark-primary">{t('copilotTitle')}</h2>
          <span className="w-2 h-2 rounded-full bg-accent-blue" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <div className="bg-bg-dark border border-border-dark rounded-lg p-3 w-[90%]">
            <p className="text-xs text-text-dark-secondary">{t('copilotReady')}</p>
          </div>
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`border border-border-dark rounded-lg p-3 w-[90%] ${
                msg.role === 'user'
                  ? 'bg-accent-blue/10 ml-auto border-accent-blue/20'
                  : 'bg-bg-dark'
              }`}
            >
              <div className="text-[10px] font-bold text-text-dark-muted uppercase mb-1">
                {msg.role === 'user' ? t('operator') : t('copilotTitle')}
              </div>
              <p className="text-xs text-text-dark-primary whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}
          {sendingChat && (
            <div className="flex justify-start items-center text-xs text-text-dark-muted gap-2 ml-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{t('thinking')}</span>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border-dark bg-surface-dark-elevated">
          <form onSubmit={(e) => { e.preventDefault(); sendChatMessage(); }} className="relative">
            <input
              type="text"
              placeholder={t('copilotInputPlaceholder')}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={sendingChat || !chatSessionId}
              className="w-full bg-bg-dark border border-border-dark rounded-md py-2.5 pl-3 pr-10 text-xs text-text-dark-primary focus:outline-none focus:border-border-dark-focus focus:ring-1 focus:ring-border-dark-focus disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sendingChat || !chatSessionId}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-text-dark-primary text-bg-dark rounded hover:bg-text-dark-secondary transition-colors disabled:opacity-50"
            >
              <Send className="w-3 h-3" />
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}

