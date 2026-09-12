# Strategic experience — spectator-3

New campaigns support one persistent plan per ruler: founding, construction, research or domestic delivery. Plans never issue orders themselves. A ruler must still send the concrete orders and pay their costs. Omission preserves the plan; null cancels it; a different target replaces it. Repeating the same target preserves its age. The engine measures progress from world state and flags six turns without progress for reconsideration.

The spectator panel shows the target, rationale, measured progress, status and last verification turn. Routes have direction arrows and a destination marker; selecting a unit offers camera recentering. Models receive only their own plan. spectator-1 and spectator-2 keep their existing state signatures and rules; start a new campaign to use plans.

Validation on 2026-09-12: three deterministic campaigns of 120 turns completed 36, 31 and 41 plans; exact replay succeeded. Three saved v1/v2 campaigns replayed at turns 50, 52 and 60. Results: docs/reports/strategic-probe.json. Demo: eae45425-95a1-4a19-a34e-2623a1417ae0.

Real Nous smoke: Longcat and Laguna S returned valid founding plans with no rejected actions in joint resolution. Laguna XS failed schema validation, then correction hit HTTP 429. Ling failed schema validation twice. No local substitution. Detailed evidence: docs/reports/strategic-nous-smoke.json. This is a single-turn integration check, not evidence of long-run strategic quality. Gateway errors now include safe schema paths/codes to assist correction, without provider values or bodies.

Browser control was unavailable on the final verification attempt; visual validation remains outstanding. National pooled stocks, abstract international trade and limited combat presentation remain current limitations.
