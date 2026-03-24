import { DRAWER_TABS } from "../../../entities/run";

export function buildDrawerTabOptions(rawTabAvailable: boolean) {
  return DRAWER_TABS.filter((tab) => rawTabAvailable || tab !== "raw").map((tab) => ({
    value: tab,
    label: tab,
  }));
}
