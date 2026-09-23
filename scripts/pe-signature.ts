/**
 * La table de signature qu'un exécutable autonome hérite de `node.exe`.
 *
 * Mesuré sur Node 26 : `node --build-sea` ajoute une section de ressources
 * EXACTEMENT à l'endroit où se trouvait la table de signature de `node.exe`,
 * repousse cette table en fin de fichier, mais laisse l'en-tête la désigner à
 * son ancien emplacement — en plein milieu de la nouvelle section. Windows
 * exécute le fichier, mais le signataire le déclare « pas une application
 * Win32 valide » et refuse d'y poser une signature.
 *
 * Fonction pure : des octets entrent, des octets sortent. Elle ne coupe que si
 * la table annoncée est bien là, entière, en fin de fichier — jamais à
 * l'aveugle dans un binaire.
 */
export function withoutStaleSignature(bytes: Buffer): {
  bytes: Buffer;
  removedBytes: number;
} {
  if (bytes.length < 0x40 || bytes.toString("latin1", 0, 2) !== "MZ")
    throw new Error("Pas un exécutable : signature MZ absente");
  const pe = bytes.readUInt32LE(0x3c);
  if (bytes.toString("latin1", pe, pe + 4) !== "PE\0\0")
    throw new Error("Pas un exécutable PE");
  const optional = pe + 24;
  const magic = bytes.readUInt16LE(optional);
  if (magic !== 0x10b && magic !== 0x20b)
    throw new Error(`En-tête optionnel inconnu : 0x${magic.toString(16)}`);
  // Le répertoire de sécurité est la cinquième entrée des répertoires de
  // données, qui commencent 96 octets plus loin en PE32, 112 en PE32+.
  const security = optional + (magic === 0x20b ? 112 : 96) + 4 * 8;
  const tableSize = bytes.readUInt32LE(security + 4);
  const sections = bytes.readUInt16LE(pe + 6);
  const table = optional + bytes.readUInt16LE(pe + 20);
  let end = 0;
  for (let i = 0; i < sections; i++) {
    const header = table + i * 40;
    end = Math.max(
      end,
      bytes.readUInt32LE(header + 20) + bytes.readUInt32LE(header + 16),
    );
  }
  if (tableSize === 0 && bytes.length === end)
    return { bytes, removedBytes: 0 };
  if (bytes.length - end !== tableSize)
    throw new Error(
      `Table de signature inattendue : ${bytes.length - end} octets après les sections, ${tableSize} annoncés`,
    );
  const out = Buffer.from(bytes.subarray(0, end));
  out.writeUInt32LE(0, security);
  out.writeUInt32LE(0, security + 4);
  return { bytes: out, removedBytes: tableSize };
}
