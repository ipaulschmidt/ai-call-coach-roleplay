import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Loader2, Pencil, Sparkles, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { Evaluation, Rubric, Turn } from "@/lib/session";
import { deriveDefaultRubric } from "@/lib/session";

export interface Row {
  id: string;
  created_at: string;
  practice_area: string;
  persona: string;
  difficulty: string;
  call_type: string;
  topics: string | null;
  consultant_name: string | null;
  rep_email: string | null;
  transcript: Turn[];
  evaluation: Evaluation | null;
  rubric?: string | null;
  scenario_name?: string | null;
}

const UPDATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-session`;
const DELETE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-session`;

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

const RUBRIC_LABEL_SETS: Record<Rubric, {
  sales_strategy: string;
  technical_delivery: string;
  consultant_confidence: string;
  agenda_setting: string;
  active_listening?: string;
  next_steps: string;
}> = {
  sales_discovery: {
    sales_strategy: "Sales Strategy",
    technical_delivery: "Technical Delivery",
    consultant_confidence: "Consultant Confidence",
    agenda_setting: "Agenda Setting",
    active_listening: "Active Listening",
    next_steps: "Next Steps",
  },
  service_kickoff: {
    sales_strategy: "Expectation Setting",
    technical_delivery: "Scope Clarity",
    consultant_confidence: "Value Translation",
    agenda_setting: "Delivery Confidence",
    next_steps: "Concrete Next Step",
  },
  scope_expansion: {
    sales_strategy: "Holding Scope",
    technical_delivery: "Spotting the Opportunity",
    consultant_confidence: "Materializing It",
    agenda_setting: "Relationship Warmth",
    next_steps: "Concrete Next Step",
  },
  tough_recovery: {
    sales_strategy: "Empathy & Acknowledgement",
    technical_delivery: "Options Offered",
    consultant_confidence: "Firmness & Boundaries",
    agenda_setting: "Scope & Money Protected",
    next_steps: "Concrete Next Step",
  },
};

const ScoresGrid = ({ ev, callType, rubric }: { ev: Evaluation; callType: string; rubric?: string | null }) => {
  const resolvedRubric: Rubric = (rubric as Rubric | undefined) ?? deriveDefaultRubric(callType);
  const isSalesDiscovery =
    resolvedRubric === "sales_discovery" || resolvedRubric === "business_development";
  const labels = RUBRIC_LABEL_SETS[resolvedRubric];
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Scores</div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
        <ScoreTile label={labels.sales_strategy} score={ev.sales_strategy.score} notes={ev.sales_strategy.notes} />
        <ScoreTile label={labels.technical_delivery} score={ev.technical_delivery.score} notes={ev.technical_delivery.notes} />
        <ScoreTile label={labels.consultant_confidence} score={ev.consultant_confidence.score} notes={ev.consultant_confidence.notes} />
        {ev.agenda_setting && <ScoreTile label={labels.agenda_setting} score={ev.agenda_setting.score} notes={ev.agenda_setting.notes} />}
        {isSalesDiscovery && ev.active_listening && labels.active_listening && <ScoreTile label={labels.active_listening} score={ev.active_listening.score} notes={ev.active_listening.notes} />}
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

const areaLabel = (a: string) =>
  a === "hubspot" ? "HubSpot" : a === "paid_media" ? "Paid Media" : a === "globalia" ? "Globalia" : a;

interface Props {
  row: Row;
  password: string;
  open: boolean;
  onToggle: () => void;
  onRowUpdate: (row: Row) => void;
  onRowDeleted: (id: string) => void;
  /** Compact header (used inside nested lists on the leaderboard). */
  compact?: boolean;
}

const SessionCard = ({ row: r, password, open, onToggle, onRowUpdate, onRowDeleted, compact }: Props) => {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const startEdit = () => {
    setEditing(true);
    setEditName(r.consultant_name || "");
    setEditEmail(r.rep_email || "");
  };
  const cancelEdit = () => {
    setEditing(false);
    setEditName("");
    setEditEmail("");
  };

  const authHeaders = () => ({
    "Content-Type": "application/json",
    "x-admin-password": password,
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  });

  const pushToHubSpot = async () => {
    setPushing(true);
    try {
      const resp = await fetch(UPDATE_URL, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id: r.id, push_only: true }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${resp.status})`);
      }
      const result = await resp.json().catch(() => ({}));
      const hs = result?.hubspot;
      if (hs?.logged) toast.success("Pushed to HubSpot");
      else if (hs?.reason === "no_email") toast.error("No rep email on this session");
      else if (hs?.reason === "no_contact") toast.error(`No HubSpot contact for ${r.rep_email ?? "this email"}`);
      else if (hs?.reason === "no_transcript") toast.error("No transcript to push");
      else toast.error("HubSpot push failed");
    } catch (e: any) {
      toast.error(e.message || "Push failed");
    } finally {
      setPushing(false);
    }
  };

  const generateScore = async () => {
    setScoring(true);
    try {
      const resp = await fetch(UPDATE_URL, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id: r.id, score_only: true }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${resp.status})`);
      }
      const result = await resp.json().catch(() => ({}));
      if (result?.scoring?.ok) {
        toast.success(result?.hubspot?.logged ? "Scored · pushed to HubSpot" : "Scored");
        if (result?.evaluation) onRowUpdate({ ...r, evaluation: result.evaluation });
      } else if (result?.scoring?.reason === "no_transcript") {
        toast.error("No transcript to score");
      } else if (result?.scoring?.reason === "already_scored") {
        toast.message("Already scored — refresh to view");
      } else {
        toast.error("Scoring failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Scoring failed");
    } finally {
      setScoring(false);
    }
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    try {
      const resp = await fetch(UPDATE_URL, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          id: r.id,
          consultant_name: editName.trim(),
          rep_email: editEmail.trim(),
        }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${resp.status})`);
      }
      const result = await resp.json().catch(() => ({}));
      onRowUpdate({
        ...r,
        consultant_name: editName.trim() || null,
        rep_email: editEmail.trim() || null,
      });
      if (result?.hubspot?.logged) toast.success("Updated · pushed to HubSpot");
      else if (result?.hubspot?.reason === "no_contact") toast.success(`Updated · no HubSpot contact for ${editEmail.trim()}`);
      else if (result?.hubspot?.reason === "no_transcript") toast.success("Updated · no transcript to push");
      else if (result?.hubspot) toast.success("Updated · HubSpot push failed");
      else toast.success("Updated");
      cancelEdit();
    } catch (e: any) {
      toast.error(e.message || "Update failed");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteSession = async () => {
    setDeleting(true);
    try {
      const resp = await fetch(DELETE_URL, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id: r.id }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${resp.status})`);
      }
      onRowDeleted(r.id);
      toast.success("Session deleted");
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="border-border/60 bg-card/60">
      <button
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
        onClick={onToggle}
      >
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs text-primary">
            {areaLabel(r.practice_area)}
          </span>
          {!compact && (
            <>
              <span className="text-sm font-medium">{r.consultant_name || "Anonymous"}</span>
              <span className="text-xs text-muted-foreground">{r.rep_email || "no email"}</span>
            </>
          )}
          <span className="text-xs text-muted-foreground">{r.persona.split(" — ")[0]}</span>
          <span className="text-xs text-muted-foreground capitalize">{r.difficulty} · {r.call_type}</span>
          {compact && r.scenario_name && (
            <span className="text-xs">{r.scenario_name}</span>
          )}
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            {editing ? (
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Consultant name"
                  className="h-8 max-w-[220px] bg-background/50 text-sm"
                />
                <Input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="rep@example.com"
                  type="email"
                  className="h-8 max-w-[280px] bg-background/50 text-sm"
                />
                <Button size="sm" onClick={saveEdit} disabled={savingEdit} className="h-8">
                  {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-8">
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                {!r.evaluation && r.transcript.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={generateScore}
                    disabled={scoring}
                  >
                    {scoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Generate score
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={pushToHubSpot}
                  disabled={pushing}
                >
                  {pushing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Push to HubSpot
                </Button>
                <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" onClick={startEdit}>
                  <Pencil className="h-3.5 w-3.5" /> Edit name / email
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={deleting}
                    >
                      {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes the transcript, score, and metadata for{" "}
                        <b>{r.consultant_name || "Anonymous"}</b>
                        {r.rep_email ? ` (${r.rep_email})` : ""} from{" "}
                        {new Date(r.created_at).toLocaleString()}. This can't be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={deleteSession}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete session
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
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
              <ScoresGrid ev={r.evaluation} callType={r.call_type} rubric={r.rubric} />
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
};

export default SessionCard;