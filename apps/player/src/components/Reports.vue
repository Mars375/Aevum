<script setup lang="ts">
import { onMounted, ref, watch } from "vue";

/**
 * The measurements, readable.
 *
 * Everything this project claims about itself was measured, and several of
 * those measurements refuted the claim they were meant to support. That record
 * was living as markdown in a repository nobody could clone. It is the most
 * valuable thing here, so it gets a place in the product rather than a footnote.
 *
 * The pages are rendered at deploy time; the browser downloads one fragment
 * when a reader asks for it, and no markdown parser at all.
 */
interface Entry {
  slug: string;
  title: string;
  subtitle: string;
}

const index = ref<Entry[]>([]);
const current = ref<string>("");
const html = ref<string>("");
const failed = ref(false);

async function open(slug: string) {
  current.value = slug;
  try {
    const res = await fetch(`reports/${slug}.html`);
    if (!res.ok) throw new Error(String(res.status));
    html.value = await res.text();
    failed.value = false;
  } catch {
    failed.value = true;
  }
  const url = new URL(location.href);
  url.searchParams.set("rapport", slug);
  history.replaceState(null, "", url);
}

onMounted(async () => {
  try {
    const res = await fetch("reports/index.json");
    if (res.ok) index.value = await res.json();
  } catch {
    failed.value = true;
    return;
  }
  const asked = new URLSearchParams(location.search).get("rapport");
  const first = index.value.find((e) => e.slug === asked) ?? index.value[0];
  if (first) await open(first.slug);
});

watch(current, () => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
</script>

<template>
  <div class="reports">
    <nav class="card list" aria-label="Rapports">
      <button
        v-for="entry in index"
        :key="entry.slug"
        class="entry"
        :aria-current="current === entry.slug ? 'page' : undefined"
        @click="open(entry.slug)"
      >
        <span class="t">{{ entry.title }}</span>
        <span class="s mono">{{ entry.subtitle }}</span>
      </button>
    </nav>

    <article v-if="!failed" class="card doc" v-html="html"></article>
    <p v-else class="card doc muted">
      Ce déploiement ne sert aucun rapport. Ils se construisent avec
      <code>npm run build-reports</code>.
    </p>
  </div>
</template>

<style scoped>
.reports {
  display: grid;
  gap: var(--s4);
  align-items: start;
}

@media (min-width: 1000px) {
  .reports {
    grid-template-columns: 17rem minmax(0, 1fr);
  }

  .list {
    position: sticky;
    top: var(--s4);
  }
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  padding: var(--s3);
}

.entry {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
  text-align: left;
  min-height: 0;
  padding: var(--s2) var(--s3);
  background: transparent;
  border-color: transparent;
}

.entry:hover {
  background: var(--card-raised);
}

.entry[aria-current="page"] {
  border-color: var(--accent);
  background: var(--card-raised);
}

.entry .t {
  font-size: 13.5px;
  line-height: 1.35;
}

.entry .s {
  font-size: 10.5px;
  color: var(--muted);
  line-height: 1.4;
}

.doc {
  padding: var(--s5);
  /* Reading measure, whatever the screen. A table can still exceed it and
     scrolls inside its own container. */
  font-size: 15px;
  line-height: 1.65;
}

.muted {
  color: var(--muted);
}

.doc :deep(h1) {
  font-size: 25px;
  margin: 0 0 var(--s3);
  max-width: 30ch;
}

.doc :deep(h2) {
  font-size: 19px;
  margin: var(--s6) 0 var(--s2);
  padding-top: var(--s3);
  border-top: 1px solid var(--border-soft);
}

.doc :deep(h3) {
  font-size: 15px;
  margin: var(--s5) 0 var(--s2);
  color: var(--accent);
}

.doc :deep(p),
.doc :deep(ul),
.doc :deep(ol) {
  max-width: 72ch;
}

.doc :deep(p) {
  margin: 0 0 var(--s3);
}

.doc :deep(li) {
  margin-bottom: var(--s2);
}

.doc :deep(code) {
  font-family: var(--mono);
  font-size: 12.5px;
  background: var(--card-raised);
  border: 1px solid var(--border-soft);
  border-radius: 3px;
  padding: 1px 5px;
}

.doc :deep(pre) {
  background: var(--card-raised);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
  padding: var(--s3);
  overflow-x: auto;
}

.doc :deep(pre code) {
  background: none;
  border: 0;
  padding: 0;
}

.doc :deep(blockquote) {
  margin: var(--s4) 0;
  padding: var(--s3) var(--s4);
  border-left: 2px solid var(--accent);
  background: var(--card-raised);
  font-family: var(--mono);
  font-size: 14px;
  max-width: 72ch;
}

.doc :deep(.scroll) {
  overflow-x: auto;
  margin: 0 0 var(--s4);
}

.doc :deep(table) {
  border-collapse: collapse;
  min-width: 100%;
  font-size: 13.5px;
}

.doc :deep(th),
.doc :deep(td) {
  text-align: left;
  padding: var(--s2) var(--s3);
  border-bottom: 1px solid var(--border-soft);
  vertical-align: top;
  white-space: nowrap;
}

.doc :deep(th) {
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 400;
  border-bottom-color: var(--border);
}

.doc :deep(td:first-child) {
  white-space: normal;
}

.doc :deep(strong) {
  color: var(--fg);
}
</style>
