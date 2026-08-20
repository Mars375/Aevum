<script setup lang="ts">
import { computed } from "vue";
import { turningPoints, type Year } from "@abs/world";

/**
 * La montée et la chute des empires, en une image.
 *
 * Les quatre courbes de population disent qui grandit ; elles ne disent pas qui
 * *tient le monde*. Une aire empilée le dit : chaque bande est la part du
 * plateau qu'une civilisation détient, et la bande grise ce que personne n'a
 * encore pris. On y lit d'un coup le moment où le monde se referme, et celui où
 * un empire en absorbe un autre.
 *
 * Les tournants viennent de `@abs/world` — la même définition que la chronique
 * écrite, pour que la page et le texte ne racontent pas deux histoires.
 */
const props = defineProps<{ years: Year[]; at: number }>();
const emit = defineEmits<{ seek: [number] }>();

const COLOURS: Record<string, string> = {
  crimson: "var(--crimson)",
  azure: "var(--azure)",
  verdant: "var(--verdant)",
  amber: "var(--amber)",
};

const W = 720;
const H = 190;
const PAD = { top: 10, right: 8, bottom: 22, left: 8 };

const ids = computed(() => props.years[0]?.world.civs.map((c) => c.id) ?? []);
const lastTick = computed(() => Math.max(1, props.years.at(-1)?.tick ?? 1));
const total = computed(() => props.years[0]?.world.board.length ?? 1);

const px = (tick: number) => PAD.left + (tick / lastTick.value) * (W - PAD.left - PAD.right);
const py = (share: number) => H - PAD.bottom - share * (H - PAD.top - PAD.bottom);

/** Une bande par civilisation, empilée dans un ordre fixe pour ne pas sauter d'une année à l'autre. */
const bands = computed(() => {
  const out: Array<{ id: string; d: string }> = [];
  let floor = props.years.map(() => 0);

  for (const id of ids.value) {
    const top = props.years.map((y, i) => {
      const civ = y.world.civs.find((c) => c.id === id)!;
      return floor[i]! + civ.territory / total.value;
    });
    const up = props.years.map((y, i) => `${px(y.tick).toFixed(1)},${py(top[i]!).toFixed(1)}`);
    const down = props.years
      .map((y, i) => `${px(y.tick).toFixed(1)},${py(floor[i]!).toFixed(1)}`)
      .reverse();
    out.push({ id, d: `M${up.join(" L")} L${down.join(" L")} Z` });
    floor = top;
  }
  return out;
});

const turns = computed(() => turningPoints(props.years));

const nearest = (tick: number) => props.years.reduce((b, y) => (Math.abs(y.tick - tick) < Math.abs(b.tick - tick) ? y : b), props.years[0]!);

function onClick(e: MouseEvent) {
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * W;
  const tick = Math.round(((x - PAD.left) / (W - PAD.left - PAD.right)) * lastTick.value);
  emit("seek", nearest(Math.max(0, Math.min(lastTick.value, tick))).tick);
}

const summary = computed(() => turns.value.map((t) => `an ${t.tick}, ${t.text}`).join(" "));
</script>

<template>
  <figure class="share">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="`Part du monde tenue par chaque civilisation sur ${lastTick} ans. ${summary || 'Aucun tournant date.'}`"
      @click="onClick"
    >
      <!-- Ce que personne ne tient : le fond, qui disparaît quand le monde se referme. -->
      <rect :x="PAD.left" :y="PAD.top" :width="W - PAD.left - PAD.right" :height="H - PAD.top - PAD.bottom" fill="#161b30" />

      <path v-for="b in bands" :key="b.id" :d="b.d" :fill="COLOURS[b.id]" opacity="0.85" />

      <g v-for="(t, i) in turns" :key="i">
        <line :x1="px(t.tick)" :y1="PAD.top" :x2="px(t.tick)" :y2="H - PAD.bottom" class="turn" :class="t.kind" />
        <title>an {{ t.tick }} — {{ t.text }}</title>
      </g>

      <line :x1="px(at)" :y1="PAD.top - 4" :x2="px(at)" :y2="H - PAD.bottom" class="cursor" />

      <text :x="PAD.left" :y="H - 6" class="tick-label">an 0</text>
      <text :x="W - PAD.right" :y="H - 6" class="tick-label" text-anchor="end">an {{ lastTick }}</text>
    </svg>

    <figcaption class="mono">
      part du plateau tenue — le gris est ce que personne n'a pris.
      <span v-if="turns.length"> Les traits verticaux datent les tournants.</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.share {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

svg {
  width: 100%;
  height: auto;
  display: block;
  cursor: crosshair;
}

/* Un tournant se lit d'abord par sa position, la couleur ne fait que trier. */
.turn {
  stroke: var(--fg);
  stroke-width: 1;
  opacity: 0.35;
  stroke-dasharray: 2 3;
}

.turn.EXTINCTION {
  stroke: var(--crimson);
  opacity: 0.9;
  stroke-dasharray: none;
}

.turn.BOARD_FULL {
  stroke: var(--accent);
  opacity: 0.8;
  stroke-dasharray: none;
}

.cursor {
  stroke: var(--fg);
  stroke-width: 1.5;
}

.tick-label {
  fill: var(--muted);
  font-size: 9px;
  font-family: var(--mono);
}

figcaption {
  font-size: 11px;
  color: var(--muted);
}
</style>
