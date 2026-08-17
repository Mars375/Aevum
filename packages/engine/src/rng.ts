/**
 * Seeded PRNG (mulberry32). Ruleset v1 consumes no randomness at all — damage,
 * deployment and initiative are fixed — so this is plumbing for phase 2 rather
 * than something the engine leans on today.
 *
 * `calls` is exposed precisely so invariant I9 can assert it stays at 0. When a
 * future rule starts rolling dice, that test fails and forces the change to be
 * acknowledged instead of sliding in unnoticed.
 */
export class SeededRng {
  private state: number;
  public calls = 0;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.calls += 1;
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
