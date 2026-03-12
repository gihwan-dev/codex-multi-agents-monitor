import { GlassSurface } from "@/app/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Calendar,
  Clock3,
  Filter,
  Folder,
  Search,
  SlidersHorizontal,
} from "lucide-react";

const FILTERS = [
  { icon: Folder, label: "Workspace" },
  { icon: Calendar, label: "Date range" },
  { icon: Clock3, label: "Duration" },
  { icon: Filter, label: "Status" },
];

const ARCHIVE_ROWS = [
  {
    title: "Refactor authentication flow",
    date: "2026-03-12 14:20",
    workspace: "codex-monitor",
    duration: "4m 12s",
    agents: 3,
    flag: "Visual QA",
  },
  {
    title: "Debug PostgreSQL connection",
    date: "2026-03-11 09:15",
    workspace: "backend-api",
    duration: "18m 45s",
    agents: 5,
    flag: "Replay",
  },
  {
    title: "Setup Tailwind config",
    date: "2026-03-10 16:30",
    workspace: "landing-page",
    duration: "1m 05s",
    agents: 0,
    flag: null,
  },
  {
    title: "Investigate memory leak",
    date: "2026-03-09 11:10",
    workspace: "core-daemon",
    duration: "2h 15m",
    agents: 12,
    flag: "Flagged",
  },
];

const PANEL_CARD_CLASS =
  "gap-0 overflow-hidden border-0 bg-transparent shadow-none ring-0";

export function ArchiveMonitor() {
  return (
    <div className="flex h-full flex-col gap-5">
      <GlassSurface refraction="none" variant="panel" className="shrink-0">
        <Card className={PANEL_CARD_CLASS}>
          <CardContent className="flex flex-col gap-4 bg-transparent p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium text-slate-400">
                  Archive
                </p>
                <p className="mt-1 text-sm text-slate-300/76">
                  4 sessions ready
                </p>
              </div>
              <GlassSurface className="rounded-full" refraction="none" variant="control">
                <div className="px-3 py-2 text-[11px] font-medium tracking-[0.01em] text-slate-100">
                  4 sessions
                </div>
              </GlassSurface>
            </div>

            <div className="flex flex-col gap-3">
              <GlassSurface
                className="group/search w-full rounded-[1.4rem]"
                interactive
                refraction="soft"
                variant="control"
              >
                <div className="relative flex items-center rounded-[inherit] bg-transparent px-3 py-2.5 ring-1 ring-transparent transition-all duration-200 group-focus-within/search:bg-white/[0.065] group-focus-within/search:ring-sky-100/80 group-focus-within/search:shadow-[0_0_0_10px_rgba(191,219,254,0.18),0_18px_36px_rgba(8,47,73,0.22),inset_0_1px_0_rgba(255,255,255,0.18)]">
                  <Search className="mr-2 h-4 w-4 text-slate-500 transition-all duration-200 group-focus-within/search:scale-105 group-focus-within/search:text-slate-100" />
                  <Input
                    type="text"
                    placeholder="Search sessions"
                    className="h-auto border-0 bg-transparent px-0 py-0 text-sm text-slate-100 placeholder:text-slate-500 group-focus-within/search:placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-0"
                  />
                </div>
              </GlassSurface>

              <div className="-mx-1 overflow-x-auto no-scrollbar">
                <div className="flex min-w-max items-center gap-2 px-1">
                  {FILTERS.map((filter) => (
                    <GlassSurface
                      key={filter.label}
                      className="rounded-full"
                      interactive
                      refraction="soft"
                      variant="control"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 rounded-[inherit] border-0 bg-transparent px-3 text-[12px] font-medium text-slate-300/82 transition-colors duration-200 hover:bg-transparent hover:text-white"
                      >
                        <filter.icon className="h-4 w-4 text-slate-400" />
                        {filter.label}
                      </Button>
                    </GlassSurface>
                  ))}

                  <GlassSurface
                    className="rounded-full"
                    interactive
                    refraction="soft"
                    variant="control"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 rounded-[inherit] border-0 bg-transparent px-3 text-[12px] font-medium text-slate-300/82 transition-colors duration-200 hover:bg-transparent hover:text-white"
                    >
                      <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                      All filters
                    </Button>
                  </GlassSurface>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </GlassSurface>

      <GlassSurface refraction="none" variant="panel" className="flex flex-1 flex-col overflow-hidden">
        <Card className={`flex flex-1 flex-col ${PANEL_CARD_CLASS}`}>
          <CardHeader className="bg-transparent px-6 pb-4 pt-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="mb-2 text-[11px] font-medium text-slate-400">Archive</p>
                <CardTitle className="text-[1.55rem] font-normal tracking-tight text-white">
                  Session archive
                </CardTitle>
              </div>
              <GlassSurface className="rounded-full" refraction="none" variant="control">
                <div className="px-3 py-2 text-[11px] font-medium tracking-[0.01em] text-slate-200">
                  4 rows
                </div>
              </GlassSurface>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto bg-transparent p-0 no-scrollbar">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(7,17,29,0.44),rgba(7,17,29,0.18))] backdrop-blur-xl">
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="w-[38%] min-w-[18rem] text-[12px] font-medium text-slate-400/82">
                    Session
                  </TableHead>
                  <TableHead className="text-[12px] font-medium text-slate-400/82">
                    Date
                  </TableHead>
                  <TableHead className="text-[12px] font-medium text-slate-400/82">
                    Workspace
                  </TableHead>
                  <TableHead className="text-right text-[12px] font-medium text-slate-400/82">
                    Duration
                  </TableHead>
                  <TableHead className="text-right text-[12px] font-medium text-slate-400/82">
                    Agents
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-sm">
                {ARCHIVE_ROWS.map((row) => (
                  <TableRow
                    key={row.title}
                    className="border-white/5 transition-colors hover:bg-white/[0.055]"
                  >
                    <TableCell className="py-4 text-slate-100">
                      <div className="flex min-w-0 items-start gap-2">
                        <span className="min-w-0 max-w-[34ch] leading-snug [display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                          {row.title}
                        </span>
                        {row.flag ? (
                          <Badge
                            variant="outline"
                            className="h-5 border-white/10 bg-white/[0.035] px-2 text-[9px] font-medium tracking-[0.02em] text-slate-300"
                          >
                            {row.flag}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-[12px] text-slate-400">
                      {row.date}
                    </TableCell>
                    <TableCell className="text-slate-300/82">{row.workspace}</TableCell>
                    <TableCell className="text-right text-[12px] text-slate-400">
                      {row.duration}
                    </TableCell>
                    <TableCell className="text-right text-[12px] font-medium text-slate-200">
                      {row.agents}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </GlassSurface>
    </div>
  );
}
