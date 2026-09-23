import { describe, expect, it } from "vitest";
import { withoutStaleSignature } from "../../../scripts/pe-signature.js";

/**
 * Un exécutable minimal, fabriqué à la main : juste assez d'en-tête pour
 * placer une section et une table de signature. Le vrai `Aevum.exe` pèse cent
 * mégaoctets ; ce qui compte ici est l'arithmétique des en-têtes.
 */
function fakePe(options: {
  plus?: boolean;
  trailing?: number;
  announced?: number;
}): Buffer {
  const plus = options.plus ?? true;
  const pe = 0x80;
  const optional = pe + 24;
  const optionalSize = (plus ? 112 : 96) + 16 * 8;
  const sectionEnd = 0x600;
  const trailing = options.trailing ?? 0;
  const bytes = Buffer.alloc(sectionEnd + trailing);
  bytes.write("MZ", 0, "latin1");
  bytes.writeUInt32LE(pe, 0x3c);
  bytes.write("PE\0\0", pe, "latin1");
  bytes.writeUInt16LE(1, pe + 6); // une section
  bytes.writeUInt16LE(optionalSize, pe + 20);
  bytes.writeUInt16LE(plus ? 0x20b : 0x10b, optional);
  const section = optional + optionalSize;
  bytes.writeUInt32LE(0x200, section + 16); // taille brute
  bytes.writeUInt32LE(0x400, section + 20); // position brute
  const security = optional + (plus ? 112 : 96) + 4 * 8;
  bytes.writeUInt32LE(options.announced ? sectionEnd : 0, security);
  bytes.writeUInt32LE(options.announced ?? 0, security + 4);
  bytes.fill(0xab, sectionEnd); // la table perimee
  return bytes;
}

const securityEntry = (bytes: Buffer, plus = true) => {
  const optional = bytes.readUInt32LE(0x3c) + 24;
  const at = optional + (plus ? 112 : 96) + 4 * 8;
  return [bytes.readUInt32LE(at), bytes.readUInt32LE(at + 4)];
};

describe("la table de signature héritée de node.exe", () => {
  it("est retirée quand elle est entière en fin de fichier", () => {
    const stale = fakePe({ trailing: 16, announced: 16 });
    const { bytes, removedBytes } = withoutStaleSignature(stale);
    expect(removedBytes).toBe(16);
    expect(bytes.length).toBe(0x600);
    expect(securityEntry(bytes)).toEqual([0, 0]);
    // L'entrée n'est pas modifiée en place : l'appelant garde l'original.
    expect(securityEntry(stale)).toEqual([0x600, 16]);
  });

  it("vaut aussi pour un exécutable 32 bits", () => {
    const { bytes, removedBytes } = withoutStaleSignature(
      fakePe({ plus: false, trailing: 8, announced: 8 }),
    );
    expect(removedBytes).toBe(8);
    expect(securityEntry(bytes, false)).toEqual([0, 0]);
  });

  it("laisse intact un exécutable déjà propre", () => {
    const clean = fakePe({});
    const { bytes, removedBytes } = withoutStaleSignature(clean);
    expect(removedBytes).toBe(0);
    expect(bytes.equals(clean)).toBe(true);
  });

  /** Des octets en fin de fichier qui ne sont pas la table annoncée peuvent
   * être n'importe quoi — des données qu'un autre outil y a mises. */
  it("refuse de couper quand la fin du fichier n'est pas la table annoncée", () => {
    expect(() =>
      withoutStaleSignature(fakePe({ trailing: 32, announced: 16 })),
    ).toThrow(/inattendue/);
    expect(() => withoutStaleSignature(fakePe({ trailing: 32 }))).toThrow(
      /inattendue/,
    );
  });

  it("refuse ce qui n'est pas un exécutable", () => {
    expect(() =>
      withoutStaleSignature(Buffer.from("#!/bin/sh\n".repeat(10))),
    ).toThrow(/MZ/);
  });
});
