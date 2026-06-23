# Task 1 Report: Capacity Calculation and Shared Capacity Table

## Status: DONE

## Commit

`3ec570d feat: add rate limiter capacity model and shared capacity table`

## TDD Evidence

### RED (Step 2)

Command:
```
npm test -- tests/rate-limiter-estimates.test.ts
```

Output:
```
FAIL  tests/rate-limiter-estimates.test.ts [ tests/rate-limiter-estimates.test.ts ]
Error: Failed to resolve import "@/lib/rate-limiter-estimates" from "tests/rate-limiter-estimates.test.ts". Does the file exist?
Test Files  1 failed (1)
Tests  no tests
```

### GREEN (Step 4)

Command:
```
npm test -- tests/rate-limiter-estimates.test.ts
```

Output:
```
Test Files  1 passed (1)
Tests  3 passed (3)
```

### Final Verification (Step 9)

Command:
```
npm test -- tests/rate-limiter-estimates.test.ts tests/url-shortener-estimates.test.ts
```

Output:
```
Test Files  2 passed (2)
Tests  5 passed (5)
```

`npm run typecheck` — clean (no output)
`npm run lint` — clean (no output)

## Files Changed

| File | Action |
|------|--------|
| `lib/rate-limiter-estimates.ts` | Created — pure capacity calculation for rate limiter |
| `tests/rate-limiter-estimates.test.ts` | Created — TDD test (written first, RED, then GREEN) |
| `components/learning/capacity-table.tsx` | Created — shared presentational component |
| `components/learning/capacity-model.tsx` | Refactored — now a thin wrapper over CapacityTable |
| `components/learning/rate-limiter-capacity.tsx` | Created — rate limiter wrapper over CapacityTable |
| `mdx-components.tsx` | Modified — added RateLimiterCapacity import and registration |

## Self-Review Findings

1. **Regression safety**: `CapacityModel`'s public props (`{ assumptions: CapacityAssumptions }`) are unchanged. The url-shortener estimates test (5 assertions) still passes.

2. **Output equivalence**: The refactored `CapacityModel` produces identical HTML structure to the original — same CSS classes, same grid layout, same element nesting. The only difference is the data now flows through pre-formatted `AssumptionRow[]` / `ResultRow[]` arrays.

3. **One minor note**: The original `capacity-model.tsx` rendered `cacheWorkingSetGB` with `fmt(r.cacheWorkingSetGB, 0)` (explicit 0 digits). The new thin wrapper calls `fmt(r.cacheWorkingSetGB)` (defaulting to 0). Functionally identical since the default is also 0 — verified by test.

4. **No improvised designs**: All code is transcribed verbatim from the brief. No departures from the specified interfaces or values.
