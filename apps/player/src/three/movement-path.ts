export interface MotionOffset {
  dx: number;
  dz: number;
  path?: { dx: number; dz: number }[];
}

export function pathOffset(
  path: readonly number[],
  from: number,
  to: number,
  size: number,
): MotionOffset | null {
  if (
    path.length < 2 ||
    path.length > 8 ||
    path[0] !== from ||
    path.at(-1) !== to
  )
    return null;
  if (
    path.some(
      (tile, i) =>
        !Number.isInteger(tile) ||
        tile < 0 ||
        tile >= size * size ||
        (i > 0 &&
          Math.abs((tile % size) - (path[i - 1]! % size)) +
            Math.abs(
              Math.floor(tile / size) - Math.floor(path[i - 1]! / size),
            ) !==
            1),
    )
  )
    return null;
  const offsets = path.map((tile) => ({
    dx: (tile % size) - (to % size),
    dz: Math.floor(tile / size) - Math.floor(to / size),
  }));
  return { ...offsets[0]!, path: offsets };
}

export function sampleOffset(
  offset: MotionOffset | undefined,
  progress: number,
) {
  if (!offset) return { dx: 0, dz: 0 };
  const t = Math.max(0, Math.min(1, progress));
  if (!offset.path) return { dx: offset.dx * (1 - t), dz: offset.dz * (1 - t) };
  const index = t * (offset.path.length - 1),
    first = Math.floor(index);
  const a = offset.path[first]!,
    b = offset.path[Math.min(first + 1, offset.path.length - 1)]!;
  return {
    dx: a.dx + (b.dx - a.dx) * (index - first),
    dz: a.dz + (b.dz - a.dz) * (index - first),
  };
}
