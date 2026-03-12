import { GlassSurface } from "@/app/ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Code, FileText, Activity } from "lucide-react";

export function DetailDrawer() {
  return (
    <GlassSurface refraction="none" variant="panel" className="flex h-full min-h-[460px] flex-col overflow-hidden">
      <Card className="flex h-full flex-1 flex-col overflow-hidden border-0 bg-transparent shadow-none ring-0">
        <CardHeader className="shrink-0 border-b border-white/8 bg-white/[0.045] pb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="mb-1 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
                <Eye className="h-3 w-3" /> Event Details
              </p>
              <CardTitle className="text-lg tracking-tight text-slate-50">
                Planning Phase
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-500/25 bg-emerald-500/10 font-mono text-[10px] text-emerald-300"
              >
                Main Agent
              </Badge>
              <Badge
                variant="secondary"
                className="border border-white/10 bg-white/[0.06] font-mono text-[10px] text-slate-200"
              >
                2.1s
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(2,6,23,0.08),transparent_36%)] p-0">
          <Tabs defaultValue="summary" className="flex h-full w-full flex-col">
            <div className="shrink-0 border-b border-white/6 px-4 py-3">
              <TabsList className="h-10 rounded-full border border-white/10 bg-white/[0.05] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <TabsTrigger
                  value="summary"
                  className="rounded-full px-3 font-mono text-[11px] uppercase tracking-wider text-slate-300 data-[active]:border-white/16 data-[active]:bg-white/[0.14] data-[active]:text-slate-50"
                >
                  Summary
                </TabsTrigger>
                <TabsTrigger
                  value="io"
                  className="rounded-full px-3 font-mono text-[11px] uppercase tracking-wider text-slate-300 data-[active]:border-white/16 data-[active]:bg-white/[0.14] data-[active]:text-slate-50"
                >
                  Input / Output
                </TabsTrigger>
                <TabsTrigger
                  value="raw"
                  className="rounded-full px-3 font-mono text-[11px] uppercase tracking-wider text-slate-300 data-[active]:border-white/16 data-[active]:bg-white/[0.14] data-[active]:text-slate-50"
                >
                  Raw Event
                </TabsTrigger>
                <TabsTrigger
                  value="tokens"
                  className="rounded-full px-3 font-mono text-[11px] uppercase tracking-wider text-slate-300 data-[active]:border-amber-500/30 data-[active]:bg-amber-500/[0.12] data-[active]:text-amber-100"
                >
                  Tokens
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full px-4 py-5">
                <TabsContent value="summary" className="m-0 space-y-4 outline-none">
                  <div className="rounded-2xl border border-white/6 bg-slate-950/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <h3 className="mb-2 flex items-center gap-2 font-mono text-xs uppercase text-slate-500">
                      <FileText className="h-3 w-3" /> Description
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-300/90">
                      The main agent analyzed the user&apos;s request and spun up a
                      sub-agent to inspect the codebase with the `rg` tool before
                      deciding on the next implementation step.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/6 bg-slate-950/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <h3 className="mb-2 flex items-center gap-2 font-mono text-xs uppercase text-slate-500">
                      <Activity className="h-3 w-3" /> Execution Summary
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-300/80">
                      Planning stayed on the main lane, tool work moved into the
                      spawned worker lane, and the drawer keeps the summary-first
                      diagnostic boundary visible.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="io" className="m-0 space-y-4 outline-none">
                  <div className="rounded-2xl border border-white/6 bg-slate-950/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <h3 className="mb-2 flex items-center gap-2 font-mono text-xs uppercase text-slate-500">
                      <Code className="h-3 w-3" /> System Prompt Preview
                    </h3>
                    <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-emerald-300">
                      "You are a coding assistant. Plan out the specific steps..."
                    </pre>
                  </div>
                </TabsContent>

                <TabsContent value="raw" className="m-0 outline-none">
                  <pre className="w-full overflow-x-auto rounded-2xl border border-white/6 bg-black/40 p-4 text-[11px] text-slate-300/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
{`{
  "id": "evt-0041-x32",
  "type": "agent_action",
  "agent_role": "main",
  "metadata": {
    "duration_ms": 2101,
    "forked_from_id": "evt-0040-z01"
  }
}`}
                  </pre>
                </TabsContent>

                <TabsContent value="tokens" className="m-0 space-y-4 outline-none">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-white/6 bg-slate-950/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      <p className="font-mono text-[10px] uppercase text-slate-500">
                        Prompt Tokens
                      </p>
                      <p className="mt-1 font-mono text-xl text-slate-100">2,408</p>
                    </div>
                    <div className="rounded-2xl border border-white/6 bg-slate-950/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      <p className="font-mono text-[10px] uppercase text-slate-500">
                        Completion Tokens
                      </p>
                      <p className="mt-1 font-mono text-xl text-slate-100">142</p>
                    </div>
                  </div>
                </TabsContent>
              </ScrollArea>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </GlassSurface>
  );
}
