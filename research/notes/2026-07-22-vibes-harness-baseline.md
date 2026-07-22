# Vibes harness benchmark baseline

Date: 2026-07-22

Command:

```bash
npm run bench:harness -- --json
```

Environment:

- Node: v22.22.2
- Platform: linux/x64
- CPU: Intel(R) Core(TM) i7-7700 CPU @ 3.60GHz

Measured output:

| Metric | Workload | Result |
|---|---:|---:|
| Cold start import | one child-process import | 44.489 ms |
| Execution envelope creation | 10,000 envelopes | 16.358 ms |
| Stream adapter | 100 chunks | 0.512 ms |
| Live view model | 1,000 deltas | 0.292 ms |

This is a deterministic local baseline for pure harness overhead. It does not measure model network latency, terminal rendering latency, Git diff parsing, or provider startup. Those require provider and PTY fixtures and should be added as separate benchmark workloads rather than mixed into this baseline.
