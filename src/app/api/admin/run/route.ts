export const dynamic = 'force-dynamic';
import { json } from '@/app/api/_helpers';
import { runOperationCycle } from '@/src/agent/orchestrator';

export async function POST(): Promise<Response> {
  (async () => {
    try {
      await runOperationCycle('manual_demo');
    } catch (e) {
      console.error('Error running manual agent cycle:', e);
    }
  })();

  return json({ status: 'triggered', message: '手动触发运营 Agent 巡检任务启动成功。' });
}
