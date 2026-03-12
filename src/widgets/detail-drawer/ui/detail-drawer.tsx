import { GlassSurface } from "@/app/ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Code, FileText, Activity } from "lucide-react";

export function DetailDrawer() {
  return (
    <GlassSurface refraction="none" variant="panel" className="flex-1 flex flex-col mt-4 border border-white/5 rounded-xl shadow-2xl relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
      <Card className="flex-1 flex flex-col border-0 bg-transparent shadow-none ring-0 w-full rounded-none">
        <CardHeader className="pb-4 shrink-0 border-b border-white/5 bg-slate-900/40">
          <div className="flex items-start justify-between">
            <div>
              <p className="mb-1 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
                <Eye className="w-3 h-3" /> Event Details
              </p>
              <CardTitle className="text-lg text-slate-200 font-sans tracking-tight">
                Planning Phase
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 font-mono text-[10px] bg-emerald-500/10">
                Main Agent
              </Badge>
              <Badge variant="secondary" className="font-mono text-[10px] bg-white/5 text-slate-400 border-white/10">
                2.1s
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <Tabs defaultValue="summary" className="w-full h-full flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b border-white/5 bg-transparent p-0 h-10 px-4 space-x-6 shrink-0">
              <TabsTrigger 
                value="summary" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-0 font-mono text-xs uppercase tracking-wider"
              >
                Summary
              </TabsTrigger>
              <TabsTrigger 
                value="io" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-0 font-mono text-xs uppercase tracking-wider"
              >
                Input / Output
              </TabsTrigger>
              <TabsTrigger 
                value="raw" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-0 font-mono text-xs uppercase tracking-wider"
              >
                Raw Event
              </TabsTrigger>
              <TabsTrigger 
                value="tokens" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-0 font-mono text-xs uppercase tracking-wider text-amber-500/80 data-[state=active]:border-amber-500"
              >
                Tokens
              </TabsTrigger>
            </TabsList>
            
            <div className="flex-1 relative bg-slate-950/20">
              <ScrollArea className="absolute inset-0 p-6">
                <TabsContent value="summary" className="m-0 space-y-4 outline-none">
                  <div className="space-y-2">
                    <h3 className="font-mono text-xs text-slate-500 uppercase flex items-center gap-2"><FileText className="w-3 h-3"/> Description</h3>
                    <p className="text-sm text-slate-300 leading-relaxed font-sans">
                      The main agent analyzed the user's request and decided to spawn a secondary sub-agent dedicated to searching the codebase using `rg` command line tool.
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="io" className="m-0 space-y-4 outline-none">
                  <div className="space-y-2">
                    <h3 className="font-mono text-xs text-slate-500 uppercase flex items-center gap-2"><Code className="w-3 h-3"/> System Prompt Preview</h3>
                    <pre className="bg-black/40 p-3 rounded-md border border-white/10 text-xs font-mono text-emerald-300 overflow-x-auto">
                      "You are a coding assistant. Plan out the specific steps..."
                    </pre>
                  </div>
                </TabsContent>

                <TabsContent value="raw" className="m-0 outline-none">
                  <pre className="bg-black/60 p-4 rounded-md border border-white/5 text-[11px] font-mono text-slate-400 overflow-x-auto w-full">
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
                
                <TabsContent value="tokens" className="m-0 outline-none space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-1">
                      <p className="font-mono text-[10px] text-slate-500 uppercase">Prompt Tokens</p>
                      <p className="font-mono text-xl text-slate-200">2,408</p>
                    </div>
                    <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-1">
                      <p className="font-mono text-[10px] text-slate-500 uppercase">Completion Tokens</p>
                      <p className="font-mono text-xl text-slate-200">142</p>
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
