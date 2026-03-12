import { GlassSurface } from "@/app/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Archive,
  Calendar,
  Clock3,
  Filter,
  Folder,
  Search,
  SlidersHorizontal,
} from "lucide-react";

const FILTERS = [
  { icon: Folder, label: "Workspace", accent: "text-emerald-200" },
  { icon: Calendar, label: "Date range", accent: "text-sky-200" },
  { icon: Clock3, label: "Duration", accent: "text-amber-200" },
  { icon: Filter, label: "Status", accent: "text-rose-200" },
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
  "gap-0 overflow-hidden border-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.078),rgba(255,255,255,0.03)_18%,rgba(12,21,37,0.16)_44%,rgba(2,6,23,0.14)_100%)] shadow-none ring-0";

export function ArchiveMonitor() {
  return (
    <div className="flex h-full flex-col gap-5">
      <GlassSurface refraction="none" variant="panel" className="shrink-0">
        <Card className={PANEL_CARD_CLASS}>
          <CardContent className="flex flex-col gap-4 bg-transparent p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="max-w-[44ch]">
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-slate-500">
                  Replay search
                </p>
                <p className="mt-1 text-sm text-slate-300/78">
                  Archive uses the same control language as live, just colder and denser.
                </p>
              </div>
              <GlassSurface className="rounded-full" refraction="none" variant="control">
                <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-100">
                  <Archive className="h-3.5 w-3.5 text-sky-300" />
                  4 replays staged
                </div>
              </GlassSurface>
            </div>

            <div className="flex flex-wrap items-center gap-3 xl:flex-nowrap">
              <GlassSurface className="min-w-[16rem] flex-1 rounded-[1.4rem] xl:max-w-[28rem]" refraction="none" variant="control">
                <div className="relative flex items-center px-3 py-2.5">
                  <Search className="mr-2 h-4 w-4 text-slate-500" />
                  <Input
                    type="text"
                    placeholder="Search archived sessions"
                    className="h-auto border-0 bg-transparent px-0 py-0 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:ring-0"
                  />
                </div>
              </GlassSurface>

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
                    className="h-10 rounded-[inherit] border-0 bg-transparent px-3 text-slate-200 hover:bg-transparent hover:text-white"
                  >
                    <filter.icon className={`h-4 w-4 ${filter.accent}`} />
                    {filter.label}
                  </Button>
                </GlassSurface>
              ))}

              <GlassSurface className="rounded-full md:ml-auto" interactive refraction="soft" variant="control">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 rounded-[inherit] border-0 bg-transparent px-3 text-slate-100 hover:bg-transparent hover:text-white"
                >
                  <SlidersHorizontal className="h-4 w-4 text-amber-200" />
                  All filters
                </Button>
              </GlassSurface>
            </div>
          </CardContent>
        </Card>
      </GlassSurface>

      <GlassSurface refraction="none" variant="panel" className="flex flex-1 flex-col overflow-hidden">
        <Card className={`flex flex-1 flex-col ${PANEL_CARD_CLASS}`}>
          <CardHeader className="bg-transparent px-6 pb-4 pt-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-[30rem]">
                <p className="mb-2 text-[11px] font-mono uppercase tracking-[0.22em] text-sky-300">
                  Archived sessions
                </p>
                <CardTitle className="text-[1.55rem] font-normal tracking-tight text-white">
                  Replay-ready history
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className="border-white/10 bg-white/[0.04] font-mono text-[10px] uppercase tracking-[0.18em] text-slate-200"
              >
                Dense diagnostic list
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto bg-transparent p-0">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(7,17,29,0.76),rgba(7,17,29,0.42))] backdrop-blur-xl">
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="w-[38%] min-w-[18rem] text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                    Session
                  </TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                    Date
                  </TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                    Workspace
                  </TableHead>
                  <TableHead className="text-right text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                    Duration
                  </TableHead>
                  <TableHead className="text-right text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                    Agents
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-sm">
                {ARCHIVE_ROWS.map((row) => (
                  <TableRow
                    key={row.title}
                    className="border-white/5 transition-colors hover:bg-white/[0.04]"
                  >
                    <TableCell className="py-4 text-slate-100">
                      <div className="flex min-w-0 items-start gap-2">
                        <span className="min-w-0 max-w-[34ch] leading-snug [display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                          {row.title}
                        </span>
                        {row.flag ? (
                          <Badge
                            variant="outline"
                            className="h-5 border-white/10 bg-white/[0.04] px-2 text-[9px] uppercase tracking-[0.18em] text-slate-300"
                          >
                            {row.flag}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-slate-400">
                      {row.date}
                    </TableCell>
                    <TableCell className="text-slate-300/82">{row.workspace}</TableCell>
                    <TableCell className="text-right font-mono text-[11px] text-slate-400">
                      {row.duration}
                    </TableCell>
                    <TableCell className="text-right">
                      <GlassSurface className="ml-auto inline-flex rounded-full" refraction="none" variant="control">
                        <div className="px-2.5 py-1.5 font-mono text-[10px] text-slate-100">
                          {row.agents}
                        </div>
                      </GlassSurface>
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
