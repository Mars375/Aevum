/**
 * publish-campaigns — mettre des parties à côté du site, pour qu'un hébergeur
 * statique les montre.
 *
 * Le site public ne parle à aucun service : il lit `campaigns/index.json`,
 * puis le fichier de la partie choisie, et la rejoue dans le navigateur. Ce
 * script est donc le seul pont entre les parties jouées sur cette machine et
 * ce que le monde voit. Il n'envoie rien nulle part : il écrit des fichiers.
 *
 * Usage :
 *   npm run publish:campaigns -- <id>[=Titre] …   ajouter ou mettre à jour
 *   npm run publish:campaigns -- --remove=<id>    retirer
 *   npm run publish:campaigns -- --watch=30       republier toutes les 30 s
 *                                                 les parties jouées en direct
 *
 * `--watch` sert un hébergeur qui lit le disque (le conteneur nginx de
 * `docker-compose.yml` monte ce répertoire) : la partie avance à l'écran sans
 * reconstruire le site. Un hébergeur qui ne sert qu'un build figé ne montre
 * que l'état publié au dernier déploiement.
 *
 * Aucune clé n'est lue ici, et une partie n'en contient pas : seulement des
 * décisions, des modèles nommés, des latences et des erreurs de transport.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CampaignSchema,
  replayCampaign,
  type Campaign,
} from "../packages/world/src/campaign.js";
import { atomicWrite } from "./world-storage.js";

export interface PublishedEntry {
  id: string;
  title: string;
  seed: number;
  version: string;
  mode: string;
  models: Record<string, string>;
  turns: number;
  maxTurns: number | null;
  live: boolean;
  updatedAt: string;
  path: string;
}

const flag = (name: string) =>
  process.argv
    .find((entry) => entry.startsWith(`--${name}=`))
    ?.slice(name.length + 3);

export function publish(options: {
  source: string;
  out: string;
  add: { id: string; title?: string }[];
  remove: string[];
  now?: Date;
}): PublishedEntry[] {
  const { source, out, add, remove } = options;
  const now = (options.now ?? new Date()).toISOString();
  mkdirSync(out, { recursive: true });
  const indexPath = resolve(out, "index.json");
  let index: PublishedEntry[] = existsSync(indexPath)
    ? (JSON.parse(readFileSync(indexPath, "utf8")) as PublishedEntry[])
    : [];
  const liveFile = resolve(source, ".live.json");
  const playing = new Set<string>(
    existsSync(liveFile)
      ? (JSON.parse(readFileSync(liveFile, "utf8")) as string[])
      : [],
  );
  index = index.filter((entry) => !remove.includes(entry.id));
  for (const { id, title } of add) {
    if (!/^[a-z0-9-]{1,80}$/.test(id))
      throw new Error(`Identifiant de partie invalide : ${id}`);
    const file = resolve(source, `${id}.json`);
    if (!existsSync(file)) throw new Error(`Partie introuvable : ${file}`);
    const campaign: Campaign = CampaignSchema.parse(
      JSON.parse(readFileSync(file, "utf8")),
    );
    // Ce qu'on publie doit se rejouer : une partie que le site ne pourrait pas
    // reconstruire serait une page cassée, pas une archive.
    replayCampaign(campaign);
    // Un conseil en cours n'est pas un fait : on publie les tours joués.
    const published: Campaign = { ...campaign, pending: null };
    atomicWrite(resolve(out, `${id}.json`), JSON.stringify(published));
    const previous = index.find((entry) => entry.id === id);
    const entry: PublishedEntry = {
      id,
      title:
        title ??
        previous?.title ??
        `Monde ${campaign.seed} · ${campaign.version}`,
      seed: campaign.seed,
      version: campaign.version,
      mode: campaign.mode,
      models: campaign.models,
      turns: campaign.turns.length,
      maxTurns: campaign.maxTurns ?? null,
      live: playing.has(id),
      updatedAt:
        previous && previous.turns === campaign.turns.length
          ? previous.updatedAt
          : now,
      path: `${id}.json`,
    };
    index = [...index.filter((other) => other.id !== id), entry];
  }
  // Les parties en direct d'abord, puis les plus récentes.
  index.sort(
    (a, b) =>
      Number(b.live) - Number(a.live) || b.updatedAt.localeCompare(a.updatedAt),
  );
  atomicWrite(indexPath, JSON.stringify(index, null, 2) + "\n");
  return index;
}

async function main() {
  const source = resolve(
    flag("source") ??
      resolve(process.env.AEVUM_DATA?.trim() || ".", "worlds/spectator"),
  );
  const out = resolve(flag("out") ?? "apps/player/public/campaigns");
  const add: { id: string; title?: string }[] = process.argv
    .slice(2)
    .filter((entry) => !entry.startsWith("--"))
    .map((entry) => {
      const [id, ...title] = entry.split("=");
      return { id: id!, title: title.length ? title.join("=") : undefined };
    });
  const remove = (flag("remove") ?? "").split(",").filter(Boolean);
  const run = () => {
    const index = publish({ source, out, add, remove });
    console.log(
      `${new Date().toLocaleTimeString("fr-FR")} : ${index.length} partie(s) publiée(s) dans ${out}` +
        index
          .map(
            (e) =>
              `\n  ${e.live ? "● " : "  "}${e.id} — ${e.turns} tours — ${e.title}`,
          )
          .join(""),
    );
    return index;
  };
  const index = run();
  const every = Number(flag("watch") ?? 0);
  if (every > 0) {
    // Surveiller ce qui est publié et joué en direct, sans rien ajouter.
    add.length = 0;
    for (const entry of index) add.push({ id: entry.id });
    for (;;) {
      await new Promise((done) => setTimeout(done, every * 1000));
      const live = new Set(
        existsSync(resolve(source, ".live.json"))
          ? (JSON.parse(
              readFileSync(resolve(source, ".live.json"), "utf8"),
            ) as string[])
          : [],
      );
      // Ne recopier que ce qui a bougé ou dont l'état « en direct » a changé.
      add.length = 0;
      const current = JSON.parse(
        readFileSync(resolve(out, "index.json"), "utf8"),
      ) as PublishedEntry[];
      for (const entry of current) {
        const file = resolve(source, `${entry.id}.json`);
        if (!existsSync(file)) continue;
        // Le nombre de tours, pas la date du fichier : un conseil en cours
        // réécrit la sauvegarde sans rien ajouter à publier.
        const turns = (
          JSON.parse(readFileSync(file, "utf8")) as { turns: unknown[] }
        ).turns.length;
        const changed =
          turns !== entry.turns || live.has(entry.id) !== entry.live;
        if (changed) add.push({ id: entry.id });
      }
      if (add.length) run();
    }
  }
}

if (process.argv[1]?.endsWith("publish-campaigns.ts")) await main();
