import {
  FRESHNESS_TAGS,
  type SkillFreshnessFilter,
  type SkillSortField,
  type SkillSourceFilter,
  SOURCE_TAGS,
} from "../../../entities/skill";
import {
  FRESHNESS_LABELS,
  SOURCE_LABELS,
} from "../../../shared/ui/monitor/SkillStatusBadge.constants";
import { Input } from "../../../shared/ui/primitives/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/ui/primitives/select";
import { SCAN_RANGE_OPTIONS, type ScanRangeValue } from "../model/types";

interface SkillActivityToolbarProps {
  searchQuery: string;
  freshnessFilter: SkillFreshnessFilter;
  sourceFilter: SkillSourceFilter;
  sortField: SkillSortField;
  scanRange: ScanRangeValue;
  totalCount: number;
  visibleCount: number;
  scanLoading: boolean;
  onSearchChange: (query: string) => void;
  onFreshnessFilterChange: (filter: SkillFreshnessFilter) => void;
  onSourceFilterChange: (filter: SkillSourceFilter) => void;
  onSortChange: (field: SkillSortField) => void;
  onScanRangeChange: (range: ScanRangeValue) => void;
}

const SORT_OPTIONS: { value: SkillSortField; label: string }[] = [
  { value: "freshness", label: "Freshness" },
  { value: "name", label: "Name" },
  { value: "lastInvocation", label: "Last seen" },
  { value: "invocationCount", label: "Call count" },
];

export function SkillActivityToolbar(props: SkillActivityToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        type="search"
        aria-label="Search skills"
        placeholder="Search skills…"
        value={props.searchQuery}
        disabled={props.scanLoading}
        onChange={(e) => props.onSearchChange(e.target.value)}
        className="h-8 w-48 text-sm"
      />

      <Select
        value={String(props.scanRange)}
        disabled={props.scanLoading}
        onValueChange={(v) => props.onScanRangeChange(Number(v) as ScanRangeValue)}
      >
        <SelectTrigger className="h-8 w-32 text-sm" aria-label="Scan range">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SCAN_RANGE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={props.freshnessFilter}
        disabled={props.scanLoading}
        onValueChange={(v) => props.onFreshnessFilterChange(v as SkillFreshnessFilter)}
      >
        <SelectTrigger className="h-8 w-28 text-sm" aria-label="Freshness filter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All freshness</SelectItem>
          {FRESHNESS_TAGS.map((tag) => (
            <SelectItem key={tag} value={tag}>{FRESHNESS_LABELS[tag]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={props.sourceFilter}
        disabled={props.scanLoading}
        onValueChange={(v) => props.onSourceFilterChange(v as SkillSourceFilter)}
      >
        <SelectTrigger className="h-8 w-28 text-sm" aria-label="Source filter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sources</SelectItem>
          {SOURCE_TAGS.map((tag) => (
            <SelectItem key={tag} value={tag}>{SOURCE_LABELS[tag]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={props.sortField} disabled={props.scanLoading} onValueChange={(v) => props.onSortChange(v as SkillSortField)}>
        <SelectTrigger className="h-8 w-28 text-sm" aria-label="Sort by">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
        {props.scanLoading ? "Scanning…" : `${props.visibleCount} / ${props.totalCount} skills`}
      </span>
    </div>
  );
}
