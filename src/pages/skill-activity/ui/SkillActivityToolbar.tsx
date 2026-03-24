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

interface SkillActivityToolbarProps {
  searchQuery: string;
  statusFilter: SkillStatusFilter;
  sortField: SkillSortField;
  totalCount: number;
  visibleCount: number;
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (filter: SkillStatusFilter) => void;
  onSortChange: (field: SkillSortField) => void;
}

const SORT_OPTIONS: { value: SkillSortField; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "name", label: "Name" },
  { value: "lastInvocation", label: "Last seen" },
  { value: "invocationCount", label: "Call count" },
];

export function SkillActivityToolbar({
  searchQuery,
  statusFilter,
  sortField,
  totalCount,
  visibleCount,
  onSearchChange,
  onStatusFilterChange,
  onSortChange,
}: SkillActivityToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        type="search"
        placeholder="Search skills…"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-8 w-52 text-sm"
      />

      <Select
        value={statusFilter}
        onValueChange={(value) => onStatusFilterChange(value as SkillStatusFilter)}
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
        value={sortField}
        onValueChange={(value) => onSortChange(value as SkillSortField)}
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
        {visibleCount === totalCount
          ? `${totalCount} skills`
          : `${visibleCount} / ${totalCount} skills`}
      </span>
    </div>
  );
}
