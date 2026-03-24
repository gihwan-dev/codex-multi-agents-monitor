export function getAnnouncementProps(announce: boolean) {
  if (!announce) {
    return {};
  }

  return {
    role: "status" as const,
    "aria-live": "polite" as const,
    "aria-atomic": "true" as const,
  };
}
