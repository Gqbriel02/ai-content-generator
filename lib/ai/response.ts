export function normalizeAssistantText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
