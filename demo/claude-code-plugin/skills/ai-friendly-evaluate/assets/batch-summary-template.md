# AI Friendly Batch Summary

**Batch ID**: {batch_id}  
**Batch Name**: {batch_name}  
**Evaluation Date**: {YYYY-MM-DD}  
**Report Language**: {english | chinese}

---

## Executive Summary

{3-6 sentences: overall maturity of this batch, dominant shortboards, and top 1-2 priorities for next cycle.}

## Distribution Snapshot

- Total packages: {N}
- Grade distribution: {A: x, B: y, C: z, D: w}
- Average corrected score: {XX.X}
- Median corrected score: {XX.X}

---

## Package Results

| Package         | Score  | Grade     | Report                                       |
| --------------- | ------ | --------- | -------------------------------------------- |
| `{target_path}` | {XX.X} | {A/B/C/D} | [summary](./packages/{safe_name}/summary.md) |

---

## Batch Insights

- Highest score: `{pkg}` ({score}) - {one-line reason}
- Lowest score: `{pkg}` ({score}) - {one-line reason}
- Common shortboards: `{D1, D2, ...}` - {why these repeated}
- Outliers to review manually: `{pkg-1, pkg-2}`

## Priority Themes (Cross-Package)

### Theme 1

- Signal: {what data indicates this theme}
- Suggested action: {shared fix across packages}
- Expected benefit: {impact across batch}

### Theme 2

- Signal: {what data indicates this theme}
- Suggested action: {shared fix across packages}
- Expected benefit: {impact across batch}

---

## Failed Targets

- `{target_path}`: {error_message}
