import { createApp } from "vue";
import "./styles.css";

/**
 * Une seule des deux applications est chargée, et c'est voulu.
 *
 * `Spectator.vue` porte une feuille globale (`spectator.css`, non scopée).
 * Tant que les deux racines étaient importées ici statiquement, ses règles
 * s'appliquaient aussi aux archives : `.civilizations { position: absolute }`
 * sortait le tableau comparé de la chronique de son flux et l'écrasait sur
 * 295 px, colonnes imprimées les unes sur les autres, titre recouvert. Le
 * défaut datait de l'arrivée de l'observatoire et ne s'est vu qu'en ouvrant
 * la page. Chargée à la demande, chaque racine n'apporte que sa propre feuille.
 */
const params = new URLSearchParams(location.search);
const archive =
  params.has("archive") || params.has("world") || params.has("replay");

void (archive ? import("./App.vue") : import("./Spectator.vue")).then(
  ({ default: root }) => createApp(root).mount("#app"),
);
