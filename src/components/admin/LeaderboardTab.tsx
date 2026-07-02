import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Minus, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const LEADERBOARD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-leaderboard`;

interface LeaderboardRow {
  key: string;
  name: string;
  email: string | null;
  total_sessions: number;
  sessions_last_7_days: number;
  avg_overall_score: number | null;
  most_recent_score: number | null;
  first_score: number | null;
  score_trend: "up" | "down" | "flat" | null;
  distinct_scenario_types: number;
  last_active: string;
}

type Preset = "all" | "7d" | "30d" | "custom";
type SortKey =
  | "name"
  | "email"
  | "total_sessions"
  | "sessions_last_7_days"
  | "avg_overall_score"
  | "most_recent_score"
  | "score_trend"
  | "distinct_scenario_types"
  | "last_active";

function computeRange(preset: Preset, customStart: string, customEnd: string): { start: string | null; end: string | null; label: string } {
  const now = new Date();
  if (preset === "7d") {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: null, label: "Last 7 days" };
  }
  if (preset === "30d") {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: null, label: "Last 30 days" };
  }
  if (preset === "custom" && customStart) {
    const startDate = new Date(customStart);
    const endDate = customEnd ? new Date(customEnd) : null;
    if (endDate) endDate.setHours(23, 59, 59, 999);
    const fmt = (d: Date) => d.toLocaleDateString();
    return {
      start: startDate.toISOString(),
      end: endDate ? endDate.toISOString() : null,
      label: `${fmt(startDate)}${endDate ? " – " + fmt(endDate) : "+"}`,
    };
  }
  return { start: null, end: null, label: "all time" };
}

const scoreColor = (s: number | null) =>
  s === null ? "text-muted-foreground" : s >= 85 ? "text-primary" : s >= 70 ? "text-foreground" : "text-destructive";

const TrendIcon = ({ trend }: { trend: LeaderboardRow["score_trend"] }) => {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-primary" aria-label="Up" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-destructive" aria-label="Down" />;
  if (trend === "flat") return <Minus className="h-4 w-4 text-muted-foreground" aria-label="Flat" />;
  return <span className="text-xs text-muted-foreground">—</span>;
};

interface Props {
  password: string;
}

const LeaderboardTab = ({ password }: Props) => {
  const [preset, setPreset] = useState<Preset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("total_sessions");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const range = computeRange(preset, customStart, customEnd);

  const load = async () => {
    setLoading(true);
    try {
      const resp = await fetch(LEADERBOARD_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          rangeStart: range.start,
          rangeEnd: range.end,
        }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${resp.status})`);
      }
      const data = await resp.json();
      setRows(data.leaderboard || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customStart, customEnd]);

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    const trendRank: Record<string, number> = { up: 3, flat: 2, down: 1 };
    arr.sort((a, b) => {
      const av: any = (a as any)[sortKey];
      const bv: any = (b as any)[sortKey];
      let cmp = 0;
      if (sortKey === "score_trend") {
        cmp = (trendRank[av || ""] || 0) - (trendRank[bv || ""] || 0);
      } else if (sortKey === "last_active") {
        cmp = new Date(av).getTime() - new Date(bv).getTime();
      } else if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else if (av === null && bv !== null) {
        cmp = -1;
      } else if (av !== null && bv === null) {
        cmp = 1;
      } else {
        cmp = String(av || "").localeCompare(String(bv || ""));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "email" ? "asc" : "desc");
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" />;
    return sortDir === "asc"
      ? <ArrowUp className="ml-1 inline h-3 w-3" />
      : <ArrowDown className="ml-1 inline h-3 w-3" />;
  };

  const slackText = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.total_sessions - a.total_sessions);
    const lines = sorted.map(
      (r, i) => `${i + 1}. ${r.name} — ${r.total_sessions} roleplay${r.total_sessions === 1 ? "" : "s"}`,
    );
    return `🏆 Top SmartBug Coach users (${range.label})\n\n${lines.join("\n")}`;
  }, [rows, range.label]);

  const copySlack = async () => {
    try {
      await navigator.clipboard.writeText(slackText);
      toast.success("Slack-safe leaderboard copied");
    } catch {
      toast.error("Couldn't copy — select and copy manually");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Range</div>
            <div className="flex gap-1">
              {(["all", "7d", "30d", "custom"] as Preset[]).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={preset === p ? "default" : "secondary"}
                  onClick={() => setPreset(p)}
                  className="h-8"
                >
                  {p === "all" ? "All time" : p === "7d" ? "Last 7 days" : p === "30d" ? "Last 30 days" : "Custom"}
                </Button>
              ))}
            </div>
          </div>
          {preset === "custom" && (
            <div className="flex items-end gap-2">
              <div>
                <Label htmlFor="ls" className="text-xs">Start</Label>
                <Input
                  id="ls"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 bg-background/50 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="le" className="text-xs">End</Label>
                <Input
                  id="le"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 bg-background/50 text-sm"
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={load} disabled={loading} className="h-8">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
          <Button size="sm" onClick={copySlack} disabled={rows.length === 0} className="h-8 gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Copy Slack-safe leaderboard
          </Button>
        </div>
      </div>

      <Card className="border-border/60 bg-card/60 p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>Name{sortIcon("name")}</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("email")}>Email{sortIcon("email")}</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("total_sessions")}>Total{sortIcon("total_sessions")}</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("sessions_last_7_days")}>Last 7d{sortIcon("sessions_last_7_days")}</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("avg_overall_score")}>Avg{sortIcon("avg_overall_score")}</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("most_recent_score")}>Most recent{sortIcon("most_recent_score")}</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("score_trend")}>Trend{sortIcon("score_trend")}</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("distinct_scenario_types")}>Types{sortIcon("distinct_scenario_types")}</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("last_active")}>Last active{sortIcon("last_active")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!loading && sortedRows.length === 0 && (
              <TableRow><TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">No sessions in this range.</TableCell></TableRow>
            )}
            {sortedRows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.email || "—"}</TableCell>
                <TableCell>{r.total_sessions}</TableCell>
                <TableCell>{r.sessions_last_7_days}</TableCell>
                <TableCell className={scoreColor(r.avg_overall_score)}>{r.avg_overall_score ?? "—"}</TableCell>
                <TableCell className={scoreColor(r.most_recent_score)}>{r.most_recent_score ?? "—"}</TableCell>
                <TableCell><TrendIcon trend={r.score_trend} /></TableCell>
                <TableCell>{r.distinct_scenario_types}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.last_active).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="border-border/60 bg-card/60 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Slack-safe export</div>
          <Button size="sm" variant="secondary" onClick={copySlack} disabled={rows.length === 0} className="h-7 gap-1.5 px-2 text-xs">
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
        </div>
        <pre className="whitespace-pre-wrap rounded-md border border-border/60 bg-background/40 p-3 text-xs">{slackText}</pre>
      </Card>
    </div>
  );
};

export default LeaderboardTab;