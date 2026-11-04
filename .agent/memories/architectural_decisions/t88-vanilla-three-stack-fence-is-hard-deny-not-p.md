---
kind: decision
title: T88 vanilla-three stack fence is hard deny not prompt-only
tags: [t88, stack-fence, vanilla-three]
sha: c4f9c1d
agent: cursor
created: 2026-11-04
updated: 2026-11-04
---
# T88 vanilla-three stack fence is hard deny not prompt-only

When package.json has three and no react/react-dom/next, mutating tool calls that introduce React (.tsx/.jsx, react imports, npm install react*) are blocked in beforeToolCall even under YOLO. detectTechStack must not label react from stray .tsx if deps lack react. Planner gets STACK FENCE HARD note. Soft constitutions (T80) remain complementary.
