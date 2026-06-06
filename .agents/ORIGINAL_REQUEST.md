# Original User Request

## Initial Request — 2026-06-06T12:22:32Z

# Teamwork Project Prompt — Draft

全面审查当前前端代码仓库（特别是页面和组件），分析其与设计目标/PRD 的对齐情况，找出尚未实现、实现不全或存在问题的点，并输出一份详细的差距分析（Gap Analysis）总结报告。

Working directory: /Users/nev4rb14su/workspace/nails-agent
Integrity mode: demo

## Requirements

### R1. 确立预期基准 (Baseline Reference)
仔细阅读并理解 `/Users/nev4rb14su/workspace/nails-agent/docs/product/PRD.md` 以及同目录下的其他关键设计文档，建立产品应有的完整功能与视觉预期标准。

### R2. 代码审查与对比 (Codebase Audit)
系统性审查前端代码目录（包含各个 Page 和 Component），重点对比实际代码实现与 PRD 预期之间的差距。审查范围需同时覆盖**功能逻辑**（如数据对接、状态流转）和**视觉 UI**（布局、基础交互）。

### R3. 生成输出与禁止修改 (Output & Read-only constraint)
将分析结果整理成一份条理清晰的 Markdown 报告，存放在 `docs/` 目录下（例如 `docs/frontend-gap-analysis.md`）。整个过程必须是纯分析性质的，**绝对禁止修改任何应用程序源代码**。

### R4. 实际前端交互测试 (Interactive Testing)
必须启动前端服务，并在实际的浏览器或渲染环境中测试页面的交互功能（如按钮点击、路由跳转、弹窗开启等交互逻辑）。**禁止**测试上传图片、调用重度特征提取等复杂业务功能，专注验证基础交互和流程是否如 PRD 预期般串联顺畅。

## Acceptance Criteria

### 报告格式与验证指标
- [ ] 报告文件已成功生成并存在于 `docs/` 目录下。
- [ ] 报告内必须有明确的分类，至少包含“功能逻辑缺失/问题”与“视觉交互差距”两大类。
- [ ] 报告中指出的每一个 Gap 必须溯源并提及它对应 PRD 中的具体功能模块。
- [ ] 报告必须包含基于**实际运行与点击测试**得出的发现（例如某些按钮点击无响应、路由 404 等），而不能仅仅基于静态代码阅读。
- [ ] 项目的 `src/` 或其他应用代码文件没有任何被修改的记录（可通过 git status 验证只读限制）。

## Follow-up — 2026-06-06T20:23:01+08:00

Your mission is to completely review the frontend codebase (pages and components) against the PRD (`/Users/nev4rb14su/workspace/nails-agent/docs/product/PRD.md`) and other design documents to identify missing features, incomplete implementations, or issues, and produce a detailed Gap Analysis report in `docs/frontend-gap-analysis.md`. 
Constraints:
- ABSOLUTELY NO modifications to application source code.
- Must launch frontend service and test interactive features in a browser (button clicks, routing, modals, etc.). Do not test complex operations like image uploads or heavy feature extraction.
- The output report must categorize issues into at least '功能逻辑缺失/问题' (Functional/Logic Gaps) and '视觉交互差距' (Visual/Interactive Gaps), and each Gap must trace back to a specific feature module in the PRD.
- The report must include findings based on actual interactive testing.
- Your working directory is `/Users/nev4rb14su/workspace/nails-agent/.agents/orchestrator`.
- The original request is available at `/Users/nev4rb14su/workspace/nails-agent/.agents/ORIGINAL_REQUEST.md`.
- Keep in mind to respond to user in Simplified Chinese but keep code comments/docs in English.
- Dispatch subagents as needed to perform the analysis, start the dev server, run tests, and compile the report.
- Maintain your state in `.agents/orchestrator/progress.md`, `.agents/orchestrator/plan.md`, and `.agents/orchestrator/context.md`.
- Keep `.agents/orchestrator/progress.md` updated so I can track your progress.
- Report back when the gap analysis report is complete.
