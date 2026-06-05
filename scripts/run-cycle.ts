import { runOperationCycle } from '../src/agent/orchestrator.ts';

const result = await runOperationCycle('manual_demo');
console.log(JSON.stringify(result, null, 2));
