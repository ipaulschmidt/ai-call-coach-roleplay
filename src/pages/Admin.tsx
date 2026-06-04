import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Lock, Loader2, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/smartbug-logo.png";
import type { Evaluation, Turn } from "@/lib/session";

interface Row {
  id: string;
  created_at: string;
  practice_area: string;
  persona: string;
  difficulty: string;
  call_type: string;
  topics: string | null;
  consultant_name: string | null;
  transcript: Turn[];
  evaluation: Evaluation | null;
}

const ADMIN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-sessions`;

const scoreColor = (s: number) =>
  s >= 85 ? "text-primary" : s >= 70 ? "text-foreground" : "text-destructive";

const ScoreTile = ({ label, score, notes }: { label: string; score: number; notes: string }) => (
  <div className="rounded-md border border-border/60 bg-background/40 p-3">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={`mt-1 text-2xl font-bold ${scoreColor(score)}`}>
      {score}
      <span className="text-sm text-muted-foreground">/100</span>
    </div>
    {notes && <p className="mt-1.5 text-xs text-muted-foreground">{notes}</p>}
  </div>
);

const ScoresGrid = ({ ev, callType }: { ev: Evaluation; callType: string }) => {
  const isTough = callType === "tough";
  const labels = isTough
    ? {
        sales_strategy: "Empathy",
        technical_delivery: "Options Offered",
        consultant_confidence: "Firmness",
        agenda_setting: "Scope & Money",
        next_steps: "Next Step",
      }
    : {
        sales_strategy: "Sales Strategy",
        technical_delivery: "Technical Delivery",
        consultant_confidence: "Consultant Confidence",
        agenda_setting: "Agenda Setting",
        active_listening: "Active Listening",
        next_steps: "Next Steps",
      };
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Scores</div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
        <ScoreTile label={labels.sales_strategy} score={ev.sales_strategy.score} notes={ev.sales_strategy.notes} />
        <ScoreTile label={labels.technical_delivery} score={ev.technical_delivery.score} notes={ev.technical_delivery.notes} />
        <ScoreTile label={labels.consultant_confidence} score={ev.consultant_confidence.score} notes={ev.consultant_confidence.notes} />
        {ev.agenda_setting && <ScoreTile label={labels.agenda_setting} score={ev.agenda_setting.score} notes={ev.agenda_setting.notes} />}
        {!isTough && ev.active_listening && <ScoreTile label={(labels as any).active_listening} score={ev.active_listening.score} notes={ev.active_listening.notes} />}
        {ev.next_steps && <ScoreTile label={labels.next_steps} score={ev.next_steps.score} notes={ev.next_steps.notes} />}
      </div>
    </div>
  );
};

const SignalsBlock = ({ ev }: { ev: Evaluation }) => {
  const tc = ev.technical_delivery.topics_covered ?? [];
  const tm = ev.technical_delivery.topics_missed ?? [];
  const fillers = ev.consultant_confidence.filler_words ?? [];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-md border border-border/60 bg-background/40 p-3">
        <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Topic coverage</div>
        {tc.length > 0 && (
          <div className="mb-2">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Covered</div>
            <div className="flex flex-wrap gap-1.5">
              {tc.map((t) => (
                <span key={t} className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{t}</span>
              ))}
            </div>
          </div>
        )}
        {tm.length > 0 && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Missed</div>
            <div className="flex flex-wrap gap-1.5">
              {tm.map((t) => (
                <span key={t} className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">{t}</span>
              ))}
            </div>
          </div>
        )}
        {tc.length === 0 && tm.length === 0 && (
          <div className="text-xs text-muted-foreground">No topic coverage data.</div>
        )}
      </div>
      <div className="rounded-md border border-border/60 bg-background/40 p-3 text-sm">
        <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Delivery signals</div>
        <div><span className="text-muted-foreground">Pacing: </span><span className="font-medium capitalize">{ev.consultant_confidence.pacing}</span></div>
        <div><span className="text-muted-foreground">Filler words: </span>{fillers.length ? <span className="font-mono text-xs">{fillers.join(", ")}</span> : <span className="text-muted-foreground">none detected</span>}</div>
        {ev.next_steps && (
          <div className="mt-1">
            <span className="text-muted-foreground">Times offered: </span>
            <span className="font-medium">{ev.next_steps.offered_times ? "Yes" : "No"}</span>
            <span className="text-muted-foreground"> · Meeting booked: </span>
            <span className="font-medium">{ev.next_steps.secured_meeting ? "Yes" : "No"}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const Admin = () => {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async (pwd: string) => {
    setLoading(true);
    try {
      const resp = await fetch(ADMIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": pwd,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      if (resp.status === 401) {
        toast.error("Wrong password");
        setAuthed(false);
        sessionStorage.removeItem("adminPwd");
        return;
      }
      if (!resp.ok) throw new Error(`Failed (${resp.status})`);
      const data = await resp.json();
      setRows(data.sessions || []);
      setAuthed(true);
      sessionStorage.setItem("adminPwd", pwd);
    } catch (e: any) {
      toast.error(e.message || "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem("adminPwd");
    if (saved) {
      setPassword(saved);
      void load(saved);
    }
  }, []);

  const areaLabel = (a: string) =>
    a === "hubspot" ? "HubSpot" : a === "paid_media" ? "Paid Media" : a === "globalia" ? "Globalia" : a;

  if (!authed) {
    return (
      <main className="min-h-screen px-4 py-16">
        <div className="mx-auto max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <img src={logo} alt="SmartBug" className="h-7" />
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
          </div>
          <Card className="border-border/60 bg-card/70 p-6 backdrop-blur">
            <div className="mb-4 flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <h1 className="text-lg font-semibold">Admin access</h1>
            </div>
            <Label htmlFor="pwd" className="text-xs">Admin password</Label>
            <Input
              id="pwd"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && password && load(password)}
              className="mt-1.5 bg-background/50"
              autoFocus
            />
            <Button
              onClick={() => load(password)}
              disabled={!password || loading}
              className="mt-4 w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logo} alt="SmartBug" className="h-7" />
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Admin</div>
              <h1 className="text-2xl font-bold">Past coaching calls</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => load(password)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                sessionStorage.removeItem("adminPwd");
                setAuthed(false);
                setPassword("");
                setRows([]);
              }}
            >
              Sign out
            </Button>
          </div>
        </div>

        {rows.length === 0 && !loading && (
          <Card className="border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground">
            No coaching calls saved yet.
          </Card>
        )}

        <div className="space-y-3">
          {rows.map((r) => {
            const open = openId === r.id;
            return (
              <Card key={r.id} className="border-border/60 bg-card/60">
                <button
                  className="flex w-full items-center justify-between gap-4 p-4 text-left"
                  onClick={() => setOpenId(open ? null : r.id)}
                >
                  <div className="flex flex-1 flex-wrap items-center gap-3">
                    {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs text-primary">
                      {areaLabel(r.practice_area)}
                    </span>
                    <span className="text-sm font-medium">{r.consultant_name || "Anonymous"}</span>
                    <span className="text-xs text-muted-foreground">{r.persona.split(" — ")[0]}</span>
                    <span className="text-xs text-muted-foreground capitalize">{r.difficulty} · {r.call_type}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  {r.evaluation && (
                    <div className="hidden text-right text-xs md:block">
                      <div>Strategy <b>{r.evaluation.sales_strategy.score}</b></div>
                      <div>Technical <b>{r.evaluation.technical_delivery.score}</b></div>
                      <div>Confidence <b>{r.evaluation.consultant_confidence.score}</b></div>
                    </div>
                  )}
                </button>
                {open && (
                  <div className="space-y-5 border-t border-border/60 px-5 py-5">
                    {r.topics && (
                      <div>
                        <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Topics</div>
                        <div className="text-sm">{r.topics}</div>
                      </div>
                    )}
                    {r.evaluation && (
                      <>
                        <div>
                          <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Summary</div>
                          <p className="text-sm">{r.evaluation.summary}</p>
                        </div>
                        <ScoresGrid ev={r.evaluation} callType={r.call_type} />
                        {r.call_type !== "tough" && <SignalsBlock ev={r.evaluation} />}
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Wins</div>
                            <ul className="list-disc space-y-1 pl-5 text-sm">
                              {r.evaluation.wins.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                          </div>
                          <div>
                            <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Corrective feedback</div>
                            <ul className="list-disc space-y-1 pl-5 text-sm">
                              {r.evaluation.corrective_feedback.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                          </div>
                        </div>
                      </>
                    )}
                    <div>
                      <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Transcript</div>
                      <div className="mb-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 gap-1.5 px-2 text-xs"
                          onClick={async () => {
                            const text = r.transcript
                              .map((t) => `${t.role === "user" ? "Consultant" : "Prospect"}: ${t.content}`)
                              .join("\n\n");
                            try {
                              await navigator.clipboard.writeText(text);
                              toast.success("Transcript copied");
                            } catch {
                              toast.error("Couldn't copy — select and copy manually");
                            }
                          }}
                          disabled={r.transcript.length === 0}
                        >
                          <Copy className="h-3.5 w-3.5" /> Copy transcript
                        </Button>
                      </div>
                      <div className="space-y-2 rounded-md border border-border/60 bg-background/40 p-3 text-sm">
                        {r.transcript.map((t, i) => (
                          <div key={i}>
                            <span className="text-xs uppercase tracking-wider text-muted-foreground">
                              {t.role === "user" ? "Consultant" : "Prospect"}
                            </span>
                            <p className="mt-0.5">{t.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
};

export default Admin;
