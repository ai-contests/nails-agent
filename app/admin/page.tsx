'use client';

import { useEffect, useState } from 'react';

interface AgentRun {
  agent_run_id: string;
  trigger_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  chat_summary: string | null;
  error_message: string | null;
}

export default function AdminPage() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [triggering, setTriggering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/runs');
      const data = await res.json();
      setRuns(data.runs ?? []);
    } finally {
      setLoading(false);
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
      // Cycle runs async on server; poll once after a short delay.
      setTimeout(fetchRuns, 1500);
    } catch (e) {
      setMessage(`Error: ${(e as Error).message}`);
    } finally {
      setTriggering(false);
    }
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return '运行中…';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <main className="mx-auto max-w-5xl p-8 font-sans">
      <h1 className="text-2xl font-semibold mb-2">Nails-Agent · 运营看板</h1>
      <p className="text-sm text-gray-500 mb-6">
        立即触发一次 Agent 巡检（rollup → 复盘 → LLM → 执行 → 落证据）。
      </p>

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={triggerCycle}
          disabled={triggering}
          className="rounded bg-black text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {triggering ? '触发中…' : '立即触发 Agent 巡检'}
        </button>
        <button
          onClick={fetchRuns}
          disabled={loading}
          className="rounded border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? '刷新中…' : '刷新列表'}
        </button>
        {message && <span className="text-sm text-gray-700">{message}</span>}
      </div>

      <section>
        <h2 className="text-lg font-medium mb-3">最近 Runs</h2>
        <div className="border border-gray-200 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Run ID</th>
                <th className="px-3 py-2">Trigger</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Summary</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-gray-400">
                    暂无 run 记录
                  </td>
                </tr>
              )}
              {runs.slice(0, 20).map((r) => (
                <tr key={r.agent_run_id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs">{r.agent_run_id}</td>
                  <td className="px-3 py-2">{r.trigger_type}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.status === 'completed'
                          ? 'text-green-600'
                          : r.status === 'failed'
                          ? 'text-red-600'
                          : 'text-amber-600'
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {new Date(r.started_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {formatDuration(r.started_at, r.completed_at)}
                  </td>
                  <td className="px-3 py-2 text-gray-700 max-w-md truncate" title={r.chat_summary || r.error_message || ''}>
                    {r.chat_summary || r.error_message || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-gray-400 mt-6">
        提示：演示流程 — db:setup → 上传手图制造 session → 在 C 端点击/收藏/试戴 → 回到本页点"立即触发" → 刷新看 run 状态 → 进入下一轮。
      </p>
    </main>
  );
}
