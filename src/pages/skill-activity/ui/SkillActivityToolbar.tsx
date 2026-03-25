import { SKILL_STATUSES, type SkillSortField, type SkillStatusFilter } from "../../../entities/skill";
import { SKILL_STATUS_LABELS } from "../../../shared/ui/monitor/SkillStatusBadge.constants";
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
  statusFilter: SkillStatusFilter;
  sortField: SkillSortField;
  scanRange: ScanRangeValue;
  totalCount: number;
  visibleCount: number;
  scanLoading: boolean;
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (filter: SkillStatusFilter) => void;
  onSortChange: (field: SkillSortField) => void;
  onScanRangeChange: (range: ScanRangeValue) => void;
}

const SORT_OPTIONS: { value: SkillSortField; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "name", label: "Name" },
  { value: "lastInvocation", label: "Last seen" },
  { value: "invocationCount", label: "Call count" },
];

export function SkillActivityToolbar(props: SkillActivityToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        type="search"
        placeholder="Search skills…"
        value={props.searchQuery}
        onChange={(e) => props.onSearchChange(e.target.value)}
        className="h-8 w-52 text-sm"
      />

      <Select
        value={String(props.scanRange)}
        onValueChange={(v) => props.onScanRangeChange(Number(v) as ScanRangeValue)}
      >
        <SelectTrigger className="h-8 w-36 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SCAN_RANGE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={String(opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={props.statusFilter}
        onValueChange={(value) => props.onStatusFilterChange(value as SkillStatusFilter)}
      >
        <SelectTrigger className="h-8 w-36 text-sm">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {SKILL_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {SKILL_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={props.sortField}
        onValueChange={(value) => props.onSortChange(value as SkillSortField)}
      >
        <SelectTrigger className="h-8 w-32 text-sm">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
        {props.scanLoading ? "Scanning…" : `${props.visibleCount} / ${props.totalCount} skills`}
      </span>
    </div>
  );
}
