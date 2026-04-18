# Rubric Quick Map

## Dimensions and Weights

- D1 Documentation system: 20%
- D2 AI guidance and context control: 15%
- D3 Code discoverability and structure: 15%
- D4 Type safety and constraints consistency: 15%
- D5 Readability and comments: 10%
- D6 Testability and verification: 15% (infrastructure) / 8% (business)
- D7 Build and development experience: 5% (infrastructure) / 8% (business)
- D8 Code signal-to-noise ratio: 5%
- D9 Workspace dependency navigability: 10% (conditional)

## D9 Activation Rules

Activate D9 if any condition is true:

1. Direct workspace dependencies >= 10
2. Total workspace fan-out (direct + transitive) >= 20
3. Leaf app bundles workspace package source code

If D9 is not activated, only D1-D8 participate in total score.

## Base Total Formulas

### Infrastructure (D9 not activated)

`total = D1*0.20 + D2*0.15 + D3*0.15 + D4*0.15 + D5*0.10 + D6*0.15 + D7*0.05 + D8*0.05`

### Business (D9 not activated)

`total = D1*0.20 + D2*0.15 + D3*0.17 + D4*0.15 + D5*0.12 + D6*0.08 + D7*0.08 + D8*0.05`

### Monorepo with D9 activated

`total = base_total*0.90 + D9*0.10`

## Shortboard Correction

1. Key-dimension grade cap:
   - Infrastructure key dimensions: D1, D4, D6
   - Business key dimensions: D1, D4
   - Any key dimension < 40: max final grade C
   - Any key dimension < 60: max final grade B
2. Penalty rule:
   - If two or more non-key dimensions are < 40, subtract 5 points from total.

## Grade Mapping

- A: >= 85
- B: 70-84
- C: 50-69
- D: < 50
