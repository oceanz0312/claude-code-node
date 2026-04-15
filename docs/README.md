# 文档索引

本目录存放面向开发者与自动化 agent 的补充文档。推荐按下面顺序阅读。

## 快速导航

- [authentication.md](./authentication.md)
  认证参数说明。解释 `apiKey`、`authToken`、`baseUrl` 的职责和选型。
- [architecture.md](./architecture.md)
  架构与执行链路说明。适合在修改 `src/session.ts`、`src/exec.ts` 前阅读。
- [testing-and-validation.md](./testing-and-validation.md)
  测试结构、验证命令和常见排查方式。适合在提交修改前阅读。
- [agent-playbook.md](./agent-playbook.md)
  面向自动化 agent 的工作顺序、边界和排障建议。
- [pitfalls.md](./pitfalls.md)
  已确认的重大闭坑指南，优先记录那些会导致行为与预期明显不符的问题。
- [ai-friendly-evaluation-report/summary.md](./ai-friendly-evaluation-report/summary.md)
  当前仓库 AI 友好度评估结果与改进建议。

## 典型使用场景

- 想快速了解仓库结构：先看 [architecture.md](./architecture.md)
- 想确认如何改认证参数：看 [authentication.md](./authentication.md)
- 想先避开已知大坑：看 [pitfalls.md](./pitfalls.md)
- 想知道改完后怎么验证：看 [testing-and-validation.md](./testing-and-validation.md)
- 想以 agent 视角安全改仓库：看 [agent-playbook.md](./agent-playbook.md)
