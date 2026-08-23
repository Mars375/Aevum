/**
 * Turn the reports into pages the player can serve.
 *
 * The measurements are the most valuable thing this project has produced, and
 * they were living as files in a repository nobody could clone. This renders
 * them once, at deploy time, into fragments the player injects.
 *
 * No markdown dependency. The reports use a small, known subset — headings,
 * tables, lists, blockquotes, fenced code, and inline code/bold/italic — and a
 * parser for exactly that is shorter than the argument for shipping a general
 * one to every reader. Tables carry most of the meaning here, so they are the
 * part that had to be right.
 *
 *   npm run build-reports
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = resolve("docs/reports");
const OUT = resolve("apps/player/public/reports");

/** Everything is escaped first: the source is trusted, the habit is not. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inline = (s: string) =>
  esc(s)
    .replace(/\[([^\]]+)\]\((\/[A-Za-z0-9_./-]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

const cells = (row: string) =>
  row
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

function render(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.startsWith("```")) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.startsWith("```")) body.push(lines[i++]!);
      i += 1;
      out.push(`<pre><code>${esc(body.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
      i += 1;
      continue;
    }

    // A table is a header row, an alignment row, then body rows. The alignment
    // row is what distinguishes it from a paragraph that happens to use pipes.
    if (line.startsWith("|") && lines[i + 1]?.match(/^\|[\s:|-]+\|$/)) {
      const head = cells(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && lines[i]!.startsWith("|")) body.push(cells(lines[i++]!));
      const th = head.map((c) => `<th>${inline(c)}</th>`).join("");
      const tr = body
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
        .join("");
      out.push(`<div class="scroll"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`);
      continue;
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && (/^[-*]\s+/.test(lines[i]!) || /^\d+\.\s+/.test(lines[i]!))) {
        let text = lines[i]!.replace(/^([-*]|\d+\.)\s+/, "");
        i += 1;
        // A wrapped list item continues on the next indented line.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]!)) text += " " + lines[i++]!.trim();
        items.push(`<li>${inline(text)}</li>`);
      }
      out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }

    if (line.startsWith("> ")) {
      const body: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("> ")) body.push(lines[i++]!.slice(2));
      out.push(`<blockquote>${inline(body.join(" "))}</blockquote>`);
      continue;
    }

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !/^(#{1,4}\s|\||>\s|```|[-*]\s|\d+\.\s)/.test(lines[i]!)) {
      para.push(lines[i++]!);
    }
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return out.join("\n");
}

mkdirSync(OUT, { recursive: true });
if (!existsSync(SRC)) {
  console.error("docs/reports introuvable");
  process.exit(1);
}

const index: Array<{ slug: string; title: string; subtitle: string }> = [];

for (const file of readdirSync(SRC).filter((f) => f.endsWith(".md")).sort()) {
  const md = readFileSync(join(SRC, file), "utf8");
  const slug = file.replace(/\.md$/, "");
  const title = /^#\s+(.*)$/m.exec(md)?.[1] ?? slug;
  // The line right under the title is the standing "Statut : ..." line, which
  // is exactly the subtitle a catalogue wants.
  // Only the formatting markers come out. Stripping underscores too turned
  // `t_baa4de0e` into `tbaa4de0e` — an identifier a reader might well type.
  const subtitle = /^#\s+.*\n+(.+)$/m.exec(md)?.[1]?.replace(/[*`]/g, "") ?? "";
  writeFileSync(join(OUT, `${slug}.html`), render(md));
  index.push({ slug, title, subtitle });
}

writeFileSync(join(OUT, "index.json"), JSON.stringify(index, null, 2));
console.log(`${index.length} rapport(s) rendus dans apps/player/public/reports/`);
