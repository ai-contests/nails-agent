# Original User Request

## Initial Request — 2026-06-06T22:06:34+08:00

# Teamwork Project Prompt — Draft

验证 C 端 Gallery（画廊）页面的全局搜索和动态分页功能是否已成功实现，并确保其功能逻辑符合预期。

Working directory: /Users/nev4rb14su/workspace/nails-agent
Integrity mode: demo

## Requirements

### R1. 审查 API 接口
验证 `src/app/api/gallery/route.ts` 接口是否存在并能正确处理 `page`、`limit`、`cat`、`q` 等查询参数，且能返回正确的 `items` 和 `totalPages` 结构。

### R2. 审查前端集成
验证前端组件 `src/app/[locale]/(consumer)/gallery/page.tsx` 是否已经移除了假分页逻辑，改为根据用户输入和交互动态调用 `/api/gallery` 接口。

### R3. 实际交互测试
启动前端服务，在真实的浏览器环境中测试：
1. 分页点击是否能正确加载下一页数据且总页数正确。
2. 输入搜索词（如 "nude"）后，是否能触发请求并返回准确的过滤结果（验证 500ms 防抖逻辑是否生效）。
3. 分类标签切换是否能重置页码并过滤正确分类。

### R4. 输出验证报告与只读约束
将测试结果整理成一份验证报告存放在 `docs/gallery-verification-report.md`。整个测试过程仅限验证，**绝对禁止修改任何应用程序源代码**。

## Acceptance Criteria

### 验证指标
- [ ] 验证报告成功生成在 `docs/gallery-verification-report.md`。
- [ ] 报告中必须包含对 `/api/gallery` API 端点的实际测试结果（成功或失败）。
- [ ] 报告必须包含基于真实前端点击测试的结果，确认分页和防抖搜索可以正常工作。
- [ ] 项目的 `src/` 代码未被修改（可通过 git status 验证只读约束）。
