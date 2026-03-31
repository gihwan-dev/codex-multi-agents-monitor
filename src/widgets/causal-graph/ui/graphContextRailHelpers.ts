import { formatTokens } from "../../../shared/lib/format";

export function formatTokenValue(value: number) {
  return value > 0 ? formatTokens(value) : "0";
}
