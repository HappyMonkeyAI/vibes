# 🧪 Local LLM & Small Model Benchmark Report

Vibes is uniquely designed to punch above its weight class. While it shines with large models, its true power lies in its ability to orchestrate **local, small-scale LLMs** (3B - 14B) into highly capable agents through advanced augmentation and a strict execution contract.

---

## 📋 Executive Summary

*   **Minimum Viable Executor:** 9B models (like `Qwen 2.5 7B` or `Qwen 2.5 9B`) are the baseline for reliable code generation.
*   **The Gemma Breakthrough:** `Gemma-4-12B-QAT` is the first Gemma variant to fully support tool-calling without Jinja template bugs in local runners like LM Studio.
*   **Heterogeneous Stack:** The most efficient configuration uses a "Small Planner / Medium Executor" approach (e.g., Phi-4-Mini for planning, Qwen-9B for execution).
*   **Codex Augmentation:** Enabling RAG (Codex) is **mandatory** for sub-12B models to maintain high code quality and architectural consistency.

---

## 📊 Model Comparison Matrix

| Model Class | Role Recommendation | Tool Support | Verdict |
| :--- | :--- | :---: | :--- |
| **Qwen 2.5 9B** | 🏆 **Primary Executor** | ✅ Full | The "Gold Standard" for local agents. Reliable and clean. |
| **Gemma-4 12B QAT** | **Reviewer / Executor** | ✅ Full | Strong reasoning; first Gemma to work with local tools. |
| **Phi-4 Mini (3.8B)** | **Mission Planner** | ✅ Partial | Excellent logic; fails at complex code but great for planning. |
| **Phi-4 Reasoning+** | **All-in-One** | ✅ Full | Large (14.7B) and capable. Potential single-model solution. |
| **Qwen/Gemma 2B** | **Triage / Observer** | ❌ None | Too small for logic; perfect for lightweight monitoring. |

---

## 🔍 Detailed Test Reports

### 🟢 Test 19: The "Google Stack"
**Config:** All roles: `Gemma-4-12B-QAT` | Codex: Enabled | Thinking: Enabled
*   **Prompt:** *"Create a loading skeleton component with shimmer animation, variant shapes, and Suspense integration"*
*   **Result:** Produced 4 functional files with high-quality TypeScript.
*   **Insight:** The `-qat` variant is critical for local use. Standard `-it` versions often suffer from Jinja template errors in local inference engines.
*   **Quality:** 4/5 - Functional, but occasionally produces orphaned utility files.

### 🟡 Test 5: Heterogeneous Efficiency
**Config:** Planner: `Phi-4-Mini` | Executor: `Qwen-9B`
*   **Prompt:** *"Complex React Component Library"*
*   **Result:** 8 files produced.
*   **Insight:** A 3.8B model can plan complex missions, but executors can be "spread thin" if the plan is too broad.
*   **Quality:** 3/5 - Mixed results due to over-scoped milestones.

### 🔴 Test 7/8: Small Model Failures
*   **Insight:** Models under 7B (like Phi-4-Mini) often "hallucinate success" when used as Executors. They will report a task as complete without actually writing the code.
*   **Solution:** Vibes now enforces a **"Ground Truth" Reviewer** that reads files from disk rather than trusting agent summaries.

---

## 🛠️ Optimization Strategies for Local LLMs

To get the most out of small models, Vibes uses several "Force Multipliers":

1.  **Codex RAG (`CODEX_ENABLED=true`):** Retrieves real code snippets from your project to guide the small model. This bridges the knowledge gap in 7B-9B models.
2.  **Local Memory:** Persists failure patterns. If a model fails a tool call once, it "remembers" the fix in the next session.
3.  **JSON Self-Healing:** Small models often struggle with JSON syntax (smart quotes, trailing commas). Vibes includes a `repairJson` layer that fixes these on the fly.
4.  **Ground Truth Verification:** Agents are required to `list_dir` or `read_file` to verify their own work before finishing.

---

## 🚀 Recommended Local Stack

For the best balance of speed and intelligence on consumer hardware:

| Role | Recommended Model | Rationale |
| :--- | :--- | :--- |
| **Planner** | `phi-4-mini-reasoning` | Fast logic, good JSON structure. |
| **Executor** | `qwen3.5-9b-deepseek-v4` | Best-in-class code generation for its size. |
| **Reviewer** | `gemma-4-12b-qat` | High reasoning for catching bugs. |
| **Triage** | `qwen3.5-2b` | Zero-latency monitoring. |

---

## 📈 Future Benchmarks
We are actively testing the following models:
- [ ] **Llama 3.1 8B** (Tool calling stability)
- [ ] **Mistral NeMo 12B** (Context handling)
- [ ] **DeepSeek R1 Distills** (Reasoning-to-Code efficiency)

---
*Last Updated: June 2026*
