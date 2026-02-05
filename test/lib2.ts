function ensureArray<T>(v: T[] | undefined): T[] {
  return v ?? [];
}

export { ensureArray };