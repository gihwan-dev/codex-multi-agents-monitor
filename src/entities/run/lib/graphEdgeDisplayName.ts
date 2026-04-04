function normalizeDisplayText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function buildEdgeEndpointDisplayName(eventTitle: string, laneName: string) {
  const normalizedEventTitle = normalizeDisplayText(eventTitle);
  const normalizedLaneName = normalizeDisplayText(laneName);

  if (!normalizedEventTitle) {
    return normalizedLaneName ?? "Unknown event";
  }

  if (
    !normalizedLaneName ||
    normalizedEventTitle.toLocaleLowerCase() === normalizedLaneName.toLocaleLowerCase()
  ) {
    return normalizedEventTitle;
  }

  return `${normalizedEventTitle} (${normalizedLaneName})`;
}
