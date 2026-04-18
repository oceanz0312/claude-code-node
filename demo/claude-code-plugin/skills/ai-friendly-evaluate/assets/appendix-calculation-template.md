# Appendix - Calculation

## Inputs

- Project role: `{infrastructure | business}`
- D9 activated: `{true | false}`
- Dimension scores:
  - D1: {XX.X}
  - D2: {XX.X}
  - D3: {XX.X}
  - D4: {XX.X}
  - D5: {XX.X}
  - D6: {XX.X}
  - D7: {XX.X}
  - D8: {XX.X}
  - D9: {XX.X / -}

## Weight Formula

- Base formula: `{selected formula}`
- D9 adjustment: `{applied / not applied}`

## Calculation Steps

1. Base total: `{XX.X}`
2. Raw total (after D9 adjustment if any): `{XX.X}`
3. Grade cap check: `{triggered/not triggered}` - `{reason}`
4. Non-key penalty check: `{triggered/not triggered}` - `{reason}`
5. Corrected total: `{XX.X}`
6. Final grade: `{A/B/C/D}`

## Machine Output Snapshot

```json
{score-output-json}
```
