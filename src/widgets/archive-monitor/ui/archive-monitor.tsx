import { GlassSurface } from "@/app/ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Archive, Calendar, Folder, Clock, Search, ListFilter, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ArchiveMonitor() {
  return (
    <div className="flex flex-col h-full gap-4">
      {/* Filter Rail */}
      <GlassSurface refraction="none" variant="panel" className="shrink-0">
        <Card className="border-0 bg-transparent shadow-none ring-0">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 flex-1 w-full">
              <div className="relative w-64 max-w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                <Input 
                  type="text" 
                  placeholder="Search sessions..." 
                  className="pl-9 bg-black/20 border-white/10 text-slate-200 placeholder:text-slate-600 focus-visible:ring-emerald-500/50"
                />
              </div>

              <Button variant="outline" size="sm" className="bg-black/20 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white group gap-2">
                <Folder className="h-4 w-4 text-slate-400 group-hover:text-emerald-400" />
                Workspace
              </Button>
              <Button variant="outline" size="sm" className="bg-black/20 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white group gap-2">
                <Calendar className="h-4 w-4 text-slate-400 group-hover:text-blue-400" />
                Date Range
              </Button>
              <Button variant="outline" size="sm" className="bg-black/20 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white group gap-2">
                <Clock className="h-4 w-4 text-slate-400 group-hover:text-amber-400" />
                Duration
              </Button>
              <Button variant="outline" size="sm" className="bg-black/20 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white group gap-2">
                <ListFilter className="h-4 w-4 text-slate-400 group-hover:text-red-400" />
                Status
              </Button>
            </div>
            
            <Button variant="secondary" size="sm" className="bg-slate-800 text-slate-200 hover:bg-slate-700 gap-2 font-mono text-xs">
              <SlidersHorizontal className="h-3 w-3" />
              All Filters
            </Button>
          </CardContent>
        </Card>
      </GlassSurface>

      {/* Main Content: List + Detail Split View (Detail reused from Timeline, here we just show the list for now) */}
      <div className="flex-1 min-h-0 flex gap-4">
        <GlassSurface refraction="none" variant="panel" className="flex-1 overflow-hidden flex flex-col">
          <Card className="border-0 bg-transparent flex-1 flex flex-col shadow-none ring-0 overflow-hidden rounded-none">
            <CardHeader className="pb-3 pt-4 px-6 border-b border-white/5 shrink-0 bg-slate-900/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-slate-400" />
                  <CardTitle className="text-lg font-sans">Archived Sessions</CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-[10px] border-white/10 bg-black/20 text-slate-400">
                  4 Items Found
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-auto flex-1">
              <Table>
                <TableHeader className="bg-slate-950/50 sticky top-0 z-10 backdrop-blur-md">
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="w-[300px] text-xs font-mono text-slate-500 font-medium">Session Title</TableHead>
                    <TableHead className="text-xs font-mono text-slate-500 font-medium">Date</TableHead>
                    <TableHead className="text-xs font-mono text-slate-500 font-medium hidden md:table-cell">Workspace</TableHead>
                    <TableHead className="text-right text-xs font-mono text-slate-500 font-medium">Duration</TableHead>
                    <TableHead className="text-right text-xs font-mono text-slate-500 font-medium">Sub-agents</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-sm">
                  {[
                    { title: "Refactor Authentication Flow", date: "2026-03-12 14:20", ws: "exem-ui", dur: "4m 12s", agents: 3, flag: false },
                    { title: "Debug PostgreSQL Connection", date: "2026-03-11 09:15", ws: "backend-api", dur: "18m 45s", agents: 5, flag: true },
                    { title: "Setup Tailwind Config", date: "2026-03-10 16:30", ws: "landing-page", dur: "1m 05s", agents: 0, flag: false },
                    { title: "Investigate Memory Leak", date: "2026-03-09 11:10", ws: "core-daemon", dur: "2h 15m", agents: 12, flag: true },
                  ].map((s, i) => (
                    <TableRow key={i} className="border-white/5 hover:bg-white/5 group cursor-pointer transition-colors">
                      <TableCell className="font-medium text-slate-300">
                         <div className="flex items-center gap-2">
                           <span className="truncate max-w-[200px]">{s.title}</span>
                           {s.flag && <Badge variant="outline" className="h-4 px-1 text-[8px] border-amber-500/30 text-amber-500/70 uppercase">Flagged</Badge>}
                         </div>
                      </TableCell>
                      <TableCell className="text-slate-400 font-mono text-xs">{s.date}</TableCell>
                      <TableCell className="text-slate-400 hidden md:table-cell">{s.ws}</TableCell>
                      <TableCell className="text-right text-slate-400 font-mono text-xs">{s.dur}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="border-white/10 text-slate-400 font-mono text-xs bg-black/20">
                          {s.agents}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </GlassSurface>
      </div>
    </div>
  );
}
