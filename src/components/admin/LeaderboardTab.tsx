import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, Copy, ChevronDown, ChevronRight, Info } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import SessionCard, { type Row } from "@/components/admin/SessionCard";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";

const LEADERBOARD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-leaderboard`;

interface SessionEntry {
  id: string;
  created_at: string;
  call_type: string | null;
  rubric: string | null;
  scenario_name: string | null;
  practice_area: string | null;
  difficulty: string | null;
  persona: string | null;
  overall_score: number | null;
}

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
  sessions?: SessionEntry[];
}

type Preset = "all" | "7d" | "30d" | "custom";
type SortKey =
  | "name"
  | "email"
  | "total_sessions"
  | "sessions_last_7_days"
  | "avg_overall_score"
  | "most_recent_score"
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

const HeaderWithTip = ({
  label,
  tip,
  active,
  dir,
  onClick,
}: {
  label: string;
  tip: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) => (
  <div className="flex items-center gap-1 cursor-pointer select-none" onClick={onClick}>
    <span>{label}</span>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center text-muted-foreground/70 hover:text-foreground"
          aria-label={`About ${label}`}
        >
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{tip}</TooltipContent>
    </Tooltip>
    {active ? (
      dir === "asc" ? <ArrowUp className="ml-0.5 h-3 w-3" /> : <ArrowDown className="ml-0.5 h-3 w-3" />
    ) : (
      <ArrowUpDown className="ml-0.5 h-3 w-3 opacity-40" />
    )}
  </div>
);

const areaLabel = (a: string | null) =>
  !a ? "" : a === "hubspot" ? "HubSpot" : a === "paid_media" ? "Paid Media" : a === "globalia" ? "Globalia" : a;

type Granularity = "day" | "week" | "month";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addUnit(d: Date, g: Granularity, n = 1) {
  const x = new Date(d);
  if (g === "day") x.setDate(x.getDate() + n);
  else if (g === "week") x.setDate(x.getDate() + 7 * n);
  else x.setMonth(x.getMonth() + n);
  return x;
}
function bucketStart(d: Date, g: Granularity) {
  return g === "day" ? startOfDay(d) : g === "week" ? startOfWeek(d) : startOfMonth(d);
}
function formatBucket(d: Date, g: Granularity) {
  if (g === "month") return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  if (g === "week") return `Wk of ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function pickGranularity(preset: Preset, start: Date | null, end: Date | null): Granularity {
  if (preset === "7d") return "day";
  if (preset === "30d") return "week";
  if (preset === "all") return "month";
  if (!start) return "month";
  const e = end ?? new Date();
  const days = Math.max(1, Math.round((e.getTime() - start.getTime()) / 86400000));
  if (days <= 14) return "day";
  if (days <= 75) return "week";
  return "month";
}

interface Props {
  password: string;
  rows: Row[];
  onRowUpdate: (row: Row) => void;
  onRowDeleted: (id: string) => void;
}

const LeaderboardTab = ({ password, rows: allRows, onRowUpdate, onRowDeleted }: Props) => {
  const [preset, setPreset] = useState<Preset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("total_sessions");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

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
    // Extra defensive filter: never show anonymous rows on the leaderboard.
    const arr = rows.filter((r) => (r.email && r.email.trim()) || (r.name && r.name.toLowerCase() !== "anonymous"));
    arr.sort((a, b) => {
      const av: any = (a as any)[sortKey];
      const bv: any = (b as any)[sortKey];
      let cmp = 0;
      if (sortKey === "last_active") {
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
    const sorted = rows
      .filter((r) => (r.email && r.email.trim()) || (r.name && r.name.toLowerCase() !== "anonymous"))
      .sort((a, b) => b.total_sessions - a.total_sessions);
    const lines = sorted.map(
      (r, i) => `${i + 1}. ${r.name} — ${r.total_sessions} roleplay${r.total_sessions === 1 ? "" : "s"}`,
    );
    return `🏆 Top SmartBug Coach users (${range.label})\n\n${lines.join("\n")}`;
  }, [rows, range.label]);

  const chart = useMemo(() => {
    // Flatten all sessions across reps (already range-filtered by server).
    const dates: Date[] = [];
    for (const r of rows) {
      for (const s of r.sessions ?? []) dates.push(new Date(s.created_at));
    }

    const startDate = range.start ? new Date(range.start) : (dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null);
    const endDate = range.end ? new Date(range.end) : new Date();
    const g = pickGranularity(preset, startDate, endDate);

    if (!startDate || dates.length === 0) {
      return { data: [] as { label: string; count: number }[], granularity: g };
    }

    const counts = new Map<number, number>();
    for (const d of dates) {
      const k = bucketStart(d, g).getTime();
      counts.set(k, (counts.get(k) || 0) + 1);
    }

    const data: { label: string; count: number }[] = [];
    let cursor = bucketStart(startDate, g);
    const last = bucketStart(endDate, g);
    // Safety cap so we never render thousands of ticks.
    let guard = 0;
    while (cursor.getTime() <= last.getTime() && guard < 500) {
      data.push({
        label: formatBucket(cursor, g),
        count: counts.get(cursor.getTime()) || 0,
      });
      cursor = addUnit(cursor, g);
      guard++;
    }
    return { data, granularity: g };
  }, [rows, range.start, range.end, preset]);

  const granularityLabel = chart.granularity === "day" ? "day" : chart.granularity === "week" ? "week" : "month";

  const copySlack = async () => {
    try {
      await navigator.clipboard.writeText(slackText);
      toast.success("Slack-safe leaderboard copied");
    } catch {
      toast.error("Couldn't copy — select and copy manually");
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
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

      <Card className="border-border/60 bg-card/60 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Roleplays over time</div>
            <div className="text-xs text-muted-foreground/80">Per {granularityLabel} · {range.label}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            Total: <span className="font-semibold text-foreground">{chart.data.reduce((a, b) => a + b.count, 0)}</span>
          </div>
        </div>
        <div className="h-56 w-full">
          {chart.data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No sessions in this range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart.data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} width={30} />
                <RTooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number) => [`${value} roleplay${value === 1 ? "" : "s"}`, ""]}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(var(--primary))" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="border-border/60 bg-card/60 p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><HeaderWithTip label="Name" tip="Click a name to expand and see every session this rep has recorded." active={sortKey==="name"} dir={sortDir} onClick={() => toggleSort("name")} /></TableHead>
              <TableHead><HeaderWithTip label="Email" tip="Rep email captured on the session (if provided)." active={sortKey==="email"} dir={sortDir} onClick={() => toggleSort("email")} /></TableHead>
              <TableHead><HeaderWithTip label="Total sessions" tip="Total number of coaching sessions this rep completed within the selected date range." active={sortKey==="total_sessions"} dir={sortDir} onClick={() => toggleSort("total_sessions")} /></TableHead>
              <TableHead><HeaderWithTip label="Last 7 days" tip="Sessions this rep completed in the last 7 days (from today), independent of the range filter above." active={sortKey==="sessions_last_7_days"} dir={sortDir} onClick={() => toggleSort("sessions_last_7_days")} /></TableHead>
              <TableHead><HeaderWithTip label="Avg score" tip="Average overall score across all of this rep's sessions in range. Each session's overall score is the mean of its five scored dimensions (e.g. Sales Strategy, Technical Delivery, Consultant Confidence, Agenda Setting, Next Steps). Scored out of 100." active={sortKey==="avg_overall_score"} dir={sortDir} onClick={() => toggleSort("avg_overall_score")} /></TableHead>
              <TableHead><HeaderWithTip label="Most recent score" tip="Overall score from this rep's most recent completed session. Same 0–100 scale as Avg." active={sortKey==="most_recent_score"} dir={sortDir} onClick={() => toggleSort("most_recent_score")} /></TableHead>
              <TableHead><HeaderWithTip label="Scenario types" tip="Number of distinct scenarios / call types this rep has practiced. Higher = more range across discovery, service, scope, tough calls, etc." active={sortKey==="distinct_scenario_types"} dir={sortDir} onClick={() => toggleSort("distinct_scenario_types")} /></TableHead>
              <TableHead><HeaderWithTip label="Last active" tip="Date of this rep's most recent session in the selected range." active={sortKey==="last_active"} dir={sortDir} onClick={() => toggleSort("last_active")} /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!loading && sortedRows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No sessions in this range.</TableCell></TableRow>
            )}
            {sortedRows.map((r) => {
              const isOpen = expandedKey === r.key;
              return (
                <>
                  <TableRow
                    key={r.key}
                    className="cursor-pointer"
                    onClick={() => setExpandedKey(isOpen ? null : r.key)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <span>{r.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.email || "—"}</TableCell>
                    <TableCell>{r.total_sessions}</TableCell>
                    <TableCell>{r.sessions_last_7_days}</TableCell>
                    <TableCell className={scoreColor(r.avg_overall_score)}>{r.avg_overall_score ?? "—"}</TableCell>
                    <TableCell className={scoreColor(r.most_recent_score)}>{r.most_recent_score ?? "—"}</TableCell>
                    <TableCell>{r.distinct_scenario_types}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.last_active).toLocaleDateString()}</TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow key={r.key + "-expand"} className="bg-background/30 hover:bg-background/30">
                      <TableCell colSpan={8} className="p-0">
                        <div className="border-t border-border/60 px-5 py-4">
                          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                            Sessions ({r.sessions?.length ?? 0})
                          </div>
                          {(!r.sessions || r.sessions.length === 0) ? (
                            <div className="text-xs text-muted-foreground">No sessions.</div>
                          ) : (
                            <div className="space-y-2">
                              {r.sessions.map((s) => {
                                const full = allRows.find((row) => row.id === s.id);
                                if (!full) {
                                  return (
                                    <div
                                      key={s.id}
                                      className="rounded-md border border-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground"
                                    >
                                      {new Date(s.created_at).toLocaleString()} — {s.scenario_name || s.call_type}
                                      {s.overall_score !== null && (
                                        <span className={`ml-2 font-semibold ${scoreColor(s.overall_score)}`}>
                                          {s.overall_score}/100
                                        </span>
                                      )}
                                    </div>
                                  );
                                }
                                return (
                                  <SessionCard
                                    key={s.id}
                                    row={full}
                                    password={password}
                                    open={openSessionId === s.id}
                                    onToggle={() => setOpenSessionId(openSessionId === s.id ? null : s.id)}
                                    onRowUpdate={onRowUpdate}
                                    onRowDeleted={(id) => {
                                      if (openSessionId === id) setOpenSessionId(null);
                                      onRowDeleted(id);
                                    }}
                                    compact
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
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
    </TooltipProvider>
  );
};

export default LeaderboardTab;