---
name: ai-friendly-score-parser
description: Parse an AI Friendly evaluation summary.md into a strict JSON scoring object. Use when a summary report already exists and the caller needs machine-readable scoring fields for persistence or projection.
---

# AI Friendly Score Parser

## Goal

Convert one `summary.md` document from AI Friendly evaluation into one machine-readable JSON object matching the server-side `EvaluationScoring` shape.

## Input

The caller will provide the full `summary.md` content inline.

## Required Output

Return exactly one JSON object and nothing else:

```json
{
  "totalScore": 46.7,
  "grade": "D",
  "keyWeaknesses": ["D1", "D4"],
  "dimensions": [
    {
      "dimension": "D1",
      "name": "文档体系",
      "weight": 20,
      "score": 35.7
    }
  ]
}
```

Do not include `evidence` unless the caller explicitly asks for it.

## Summary Shape To Expect

The current `ai-friendly-evaluate` report shape contains these relevant sections:

1. `## Final Result`
2. bullet line `Corrected Total Score`
3. bullet line `Final Grade`
4. bullet line `Key Shortboards`
5. `## Dimension Scores`
6. one markdown table with columns:
   - `Dimension`
   - `Weight`
   - `Score`
   - `Evidence Summary`

Ignore all other sections such as `Executive Summary`, `Key Findings`, `Analysis`, `Optimization Roadmap`, and appendix links.

## Canonical Dimension Name Map

The markdown table only gives `D1`..`D9`, so you must expand each dimension code to its canonical `name` field:

- `D1` -> `文档体系`
- `D2` -> `AI 行为指引与上下文管控`
- `D3` -> `代码可发现性与结构化`
- `D4` -> `类型安全与约束一致性`
- `D5` -> `可读性与注释`
- `D6` -> `可测试性与验证闭环`
- `D7` -> `构建与开发体验`
- `D8` -> `代码信噪比`
- `D9` -> `Workspace 依赖可导航性`

## Extraction Rules

1. Read `Corrected Total Score` as `totalScore`.
2. Read `Final Grade` as `grade`.
3. Read `Key Shortboards` as `keyWeaknesses`.
4. `Key Shortboards` is usually rendered as inline code, for example `` `D1`, `D4` ``. Extract only the dimension IDs.
5. Read the `Dimension Scores` table into `dimensions`.
6. Keep dimension order as it appears in the table.
7. `weight` is numeric percent without `%`.
8. `score` is numeric.
9. For each dimension row, fill `name` from the canonical map above.
10. Do not invent fields beyond the schema above.

## Output Discipline

1. Output JSON only.
2. No markdown fences.
3. No prose, prefix, suffix, or explanation.
4. If a field is absent in summary, use the most conservative valid value:
   - `keyWeaknesses`: `[]`
   - `dimensions`: `[]`
5. Preserve numbers as numbers, not strings.
6. If `Corrected Total Score` or `Final Grade` cannot be found, return:

```json
{
  "error": "unable_to_parse_summary"
}
```
