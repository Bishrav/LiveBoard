export async function nextPosition<T>(
  findFirst: () => Promise<T | null>,
  getPosition: (item: T) => number,
) {
  const latest = await findFirst();

  if (!latest) {
    return 1000;
  }

  return getPosition(latest) + 1000;
}
