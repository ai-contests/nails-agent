export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { openDb, schema } from '@/db/src/client';
import { callLlmModel } from '@/src/services/llm';
import { json, generateId } from '@/app/api/_helpers';
import type { ChatMessage } from '@/src/services/llm';

export async function POST(req: NextRequest): Promise<Response> {
  const body = await req.json() as {
    chatSessionId?: string;
    content?: string;
  };
  const { chatSessionId, content } = body;

  if (!chatSessionId || !content) {
    return json({ error: 'Missing params' }, 400);
  }

  const { db } = openDb();
  const now = new Date().toISOString();

  const userMessageId = generateId('MSG');
  await db.insert(schema.agentChatMessages).values({
    message_id: userMessageId,
    chat_session_id: chatSessionId,
    role: 'user',
    content,
    created_at: now,
  });

  const lastRun = await db
    .select()
    .from(schema.agentRuns)
    .where(eq(schema.agentRuns.status, 'completed'))
    .orderBy(desc(schema.agentRuns.completed_at))
    .get();

  let context = '暂无已完成的 Agent 运行记录。';
  const relatedRunIds: string[] = [];
  const relatedFindingIds: string[] = [];
  const relatedDecisionIds: string[] = [];

  if (lastRun) {
    relatedRunIds.push(lastRun.agent_run_id);

    const [findings, decisions] = await Promise.all([
      db.select().from(schema.agentFindings).where(eq(schema.agentFindings.agent_run_id, lastRun.agent_run_id)),
      db.select().from(schema.agentDecisions).where(eq(schema.agentDecisions.agent_run_id, lastRun.agent_run_id)),
    ]);

    findings.forEach(f => relatedFindingIds.push(f.finding_id));
    decisions.forEach(d => relatedDecisionIds.push(d.decision_id));

    context = `
      最后一次 Agent 运行: ${lastRun.agent_run_id}
      触发方式: ${lastRun.trigger_type}
      完成时间: ${lastRun.completed_at}
      摘要: ${lastRun.chat_summary}
      发现事项: ${JSON.stringify(findings.map(f => ({ type: f.finding_type, title: f.title, summary: f.summary })))}
      决策记录: ${JSON.stringify(decisions.map(d => ({ action: d.action_type, summary: d.summary })))}
    `;
  }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是 Nails-Agent 运营助手，负责向 B 端运营人员解释系统当前状态与历史决策逻辑。\n\n上下文：\n${context}`,
    },
    { role: 'user', content },
  ];

  let replyText = '备用回复：LLM 模型调用失败，请稍后重试。';
  try {
    replyText = await callLlmModel(messages);
  } catch (e: unknown) {
    const err = e as Error;
    console.error('Error calling LLM for Chat:', err);
    replyText = `LLM 调用失败: ${err.message || String(e)}`;
  }

  const agentMessageId = generateId('MSG');
  await db.insert(schema.agentChatMessages).values({
    message_id: agentMessageId,
    chat_session_id: chatSessionId,
    role: 'agent',
    content: replyText,
    related_run_ids: JSON.stringify(relatedRunIds),
    related_finding_ids: JSON.stringify(relatedFindingIds),
    related_decision_ids: JSON.stringify(relatedDecisionIds),
    created_at: new Date().toISOString(),
  });

  return json({
    messageId: agentMessageId,
    role: 'agent',
    content: replyText,
    relatedRunIds,
    relatedFindingIds,
    relatedDecisionIds,
  });
}
