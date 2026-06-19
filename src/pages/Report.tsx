import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Copy, Link2, RefreshCw, Target, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSession, deriveDefaultRubric, type Evaluation, type Rubric, type Turn, type SimConfig } from "@/lib/session";

const scoreColor = (s: number) =>
  s >= 85 ? "text-primary" : s >= 70 ? "text-foreground" : "text-destructive";

const ScoreCard = ({
  title,
  score,
  notes,
}: {
  title: string;
  score: number;
  notes: string;
}) => (
  <Card className="border-border/60 bg-card/70 p-5 backdrop-blur">
    <div className="text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
    <div className={`mt-2 text-5xl font-bold ${scoreColor(score)}`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {score}
      <span className="text-xl text-muted-foreground">/100</span>
    </div>
    <p className="mt-3 text-sm text-muted-foreground">{notes}</p>
  </Card>
);

const Report = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { config, transcript, evaluation, setEvaluation, reset } = useSession();
  const [loading, setLoading] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [sharedConfig, setSharedConfig] = useState<SimConfig | null>(null);
  const [sharedTranscript, setSharedTranscript] = useState<Turn[] | null>(null);
  const [logStatus, setLogStatus] = useState<
    | { kind: "success"; contactUrl?: string | null; contactName?: string | null }
    | { kind: "no_contact"; email: string }
    | { kind: "api_error" }
    | null
  >(null);

  const viewConfig = id ? sharedConfig : config;
  const viewTranscript = id ? (sharedTranscript ?? []) : transcript;
  const scenarioName = viewConfig?.scenarioName?.trim() || null;
  const rubric: Rubric = viewConfig?.rubric ?? deriveDefaultRubric(viewConfig?.callType);
  const isSalesDiscovery = rubric === "sales_discovery";
  const isTough = rubric === "tough_recovery";
  const LABEL_SETS: Record<Rubric, {
    sales_strategy: string;
    technical_delivery: string;
    consultant_confidence: string;
    agenda_setting: string;
    next_steps: string;
  }> = {
    sales_discovery: {
      sales_strategy: "Sales Strategy",
      technical_delivery: "Technical Delivery",
      consultant_confidence: "Consultant Confidence",
      agenda_setting: "Agenda Setting",
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
  const labels = LABEL_SETS[rubric];

  useEffect(() => {
    if (id) {
      void loadShared(id);
      return;
    }
    if (!config || transcript.length === 0) {
      navigate("/");
      return;
    }
    if (evaluation) return;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadShared = async (sessionId: string) => {
    setLoading(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke("get-session", {
        body: { id: sessionId },
      });
      if (error) throw error;
      if (resp?.error) throw new Error(resp.error);
      const data = resp?.session;
      if (!data) {
        toast.error("Report not found");
        navigate("/");
        return;
      }
      setSharedConfig({
        practiceArea: data.practice_area as SimConfig["practiceArea"],
        persona: data.persona,
        difficulty: data.difficulty as SimConfig["difficulty"],
        callType: data.call_type as SimConfig["callType"],
        topics: data.topics ?? "",
        durationMin: 10,
        goal: "",
        scenarioName: data.scenario_name ?? undefined,
        rubric: (data.rubric as Rubric | undefined) ?? deriveDefaultRubric(data.call_type),
      });
      setSharedTranscript((data.transcript as unknown as Turn[]) ?? []);
      setEvaluation((data.evaluation as unknown as Evaluation) ?? null);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Could not load report");
    } finally {
      setLoading(false);
    }
  };

  const run = async () => {
    setLoading(true);
    try {
      const text = transcript
        .map((t) => `${t.role === "user" ? "Consultant" : "Prospect"}: ${t.content}`)
        .join("\n");
      const { data, error } = await supabase.functions.invoke("evaluate", {
        body: { transcript: text, config },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const ev = data.evaluation as Evaluation;
      setEvaluation(ev);
      // Fire HubSpot logging in the background — do not block the report.
      void logToHubSpot(ev);
      // Persist this coaching session and route to its unique URL
      try {
        const { data: inserted, error: insertErr } = await supabase.functions.invoke("save-session", {
          body: {
            practice_area: config.practiceArea,
            persona: config.persona,
            difficulty: config.difficulty,
            call_type: config.callType,
            topics: config.topics || undefined,
            consultant_name: sessionStorage.getItem("consultantName") || undefined,
            transcript,
            evaluation: ev,
            scenario_id: sessionStorage.getItem("scenarioId") || undefined,
            scenario_name:
              config.scenarioName || sessionStorage.getItem("scenarioName") || undefined,
          },
        });
        if (insertErr) throw insertErr;
        if (inserted?.error) throw new Error(inserted.error);
        if (inserted?.id) {
          navigate(`/report/${inserted.id}`, { replace: true });
        }
      } catch (saveErr) {
        console.error("Failed to save session:", saveErr);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Could not generate report");
    } finally {
      setLoading(false);
    }
  };

  const logToHubSpot = async (_ev: Evaluation) => {
    if (!config) return;
    const repEmail = (config.repEmail || sessionStorage.getItem("repEmail") || "").trim();
    if (!repEmail) return;
    const repName = (sessionStorage.getItem("consultantName") || "").trim();
    const personaName = config.persona.split(" — ")[0] ?? "";
    try {
      const { data, error } = await supabase.functions.invoke("log-session", {
        body: {
          repEmail,
          repName,
          practiceArea: config.practiceArea,
          callType: config.callType,
          personaName,
          difficulty: config.difficulty,
          durationMinutes: config.durationMin,
          quizTopics: config.topics,
          scenarioName:
            config.scenarioName || sessionStorage.getItem("scenarioName") || undefined,
          transcript,
          evaluation: _ev,
        },
      });
      if (error) {
        setLogStatus({ kind: "api_error" });
        return;
      }
      if (data?.logged) {
        setLogStatus({
          kind: "success",
          contactUrl: data.contactUrl ?? null,
          contactName: data.contactName ?? null,
        });
      } else if (data?.reason === "no_contact") {
        setLogStatus({ kind: "no_contact", email: repEmail });
      } else {
        setLogStatus({ kind: "api_error" });
      }
    } catch (e) {
      console.error("log-session failed", e);
      setLogStatus({ kind: "api_error" });
    }
  };

  const copyShareLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  if (!viewConfig && !loading) return null;

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Post-game report</div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              How you did
            </h1>
            {id && (
              <Button onClick={copyShareLink} variant="outline" size="sm" className="gap-2">
                <Link2 className="h-4 w-4" /> Copy share link
              </Button>
            )}
          </div>
          {viewConfig && (
            <div className="mt-2 text-sm text-muted-foreground">
              {viewConfig.persona?.split(" — ")[0]} · <span className="capitalize">{viewConfig.difficulty}</span> · <span className="capitalize">{viewConfig.callType}</span>
              {scenarioName && <> · Scenario: <span className="text-foreground">{scenarioName}</span></>}
            </div>
          )}
          {scenarioName && (
            <div className="mt-4 inline-flex flex-col gap-1 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">📋 Scenario</span>
              <span className="text-base font-semibold text-foreground">{scenarioName}</span>
            </div>
          )}
          {evaluation && (
            <p className="mt-3 max-w-3xl text-balance text-base text-muted-foreground">
              {evaluation.summary}
            </p>
          )}
          {!id && logStatus && (
            <p className="mt-3 text-sm text-muted-foreground">
              {logStatus.kind === "success" && (
                <span className="text-primary">
                  ✓ Session logged to your HubSpot record.
                  {logStatus.contactUrl && (
                    <>
                      {" "}
                      <a
                        href={logStatus.contactUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-primary/80"
                      >
                        View contact in HubSpot →
                      </a>
                    </>
                  )}
                </span>
              )}
              {logStatus.kind === "no_contact" && (
                <>Session complete. No HubSpot contact found for {logStatus.email} — session was not logged.</>
              )}
              {logStatus.kind === "api_error" && (
                <>Session complete. HubSpot logging failed — contact your admin.</>
              )}
            </p>
          )}
        </header>

        {loading && !evaluation && (
          <Card className="flex items-center gap-3 border-border/60 bg-card/60 p-6">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Scoring your call…</span>
          </Card>
        )}

        {evaluation && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <ScoreCard
                title={labels.sales_strategy}
                score={evaluation.sales_strategy.score}
                notes={evaluation.sales_strategy.notes}
              />
              <ScoreCard
                title={labels.technical_delivery}
                score={evaluation.technical_delivery.score}
                notes={evaluation.technical_delivery.notes}
              />
              <ScoreCard
                title={labels.consultant_confidence}
                score={evaluation.consultant_confidence.score}
                notes={evaluation.consultant_confidence.notes}
              />
            </div>

            {(evaluation.agenda_setting || evaluation.active_listening || evaluation.next_steps) && (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                {evaluation.agenda_setting && (
                  <ScoreCard
                    title={labels.agenda_setting}
                    score={evaluation.agenda_setting.score}
                    notes={evaluation.agenda_setting.notes}
                  />
                )}
                {isSalesDiscovery && evaluation.active_listening && (
                  <Card className="border-border/60 bg-card/70 p-5 backdrop-blur">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">Active Listening</div>
                    <div className={`mt-2 text-5xl font-bold ${scoreColor(evaluation.active_listening.score)}`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      {evaluation.active_listening.score}
                      <span className="text-xl text-muted-foreground">/100</span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{evaluation.active_listening.notes}</p>
                    {evaluation.active_listening.examples?.length > 0 && (
                      <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                        {evaluation.active_listening.examples.map((ex, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                            <span className="italic">"{ex}"</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                )}
                {evaluation.next_steps && (
                  <Card className="border-border/60 bg-card/70 p-5 backdrop-blur">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">{labels.next_steps}</div>
                    <div className={`mt-2 text-5xl font-bold ${scoreColor(evaluation.next_steps.score)}`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      {evaluation.next_steps.score}
                      <span className="text-xl text-muted-foreground">/100</span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{evaluation.next_steps.notes}</p>
                    {isSalesDiscovery && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className={`rounded-full px-2.5 py-1 text-xs ${evaluation.next_steps.offered_times ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                          {evaluation.next_steps.offered_times ? "Offered specific times" : "No times offered"}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs ${evaluation.next_steps.secured_meeting ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {evaluation.next_steps.secured_meeting ? "Meeting booked" : "Not booked"}
                        </span>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            )}

            {isSalesDiscovery && <div className="mt-8 grid gap-6 md:grid-cols-2">
              <Card className="border-border/60 bg-card/60 p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Target className="h-4 w-4 text-primary" /> Topic coverage
                </div>
                {evaluation.technical_delivery.topics_covered.length > 0 && (
                  <div className="mb-3">
                    <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Covered</div>
                    <div className="flex flex-wrap gap-1.5">
                      {evaluation.technical_delivery.topics_covered.map((t) => (
                        <span key={t} className="rounded-full bg-primary/15 px-2.5 py-1 text-xs text-primary">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {evaluation.technical_delivery.topics_missed.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Missed</div>
                    <div className="flex flex-wrap gap-1.5">
                      {evaluation.technical_delivery.topics_missed.map((t) => (
                        <span key={t} className="rounded-full bg-destructive/15 px-2.5 py-1 text-xs text-destructive">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              <Card className="border-border/60 bg-card/60 p-5">
                <div className="mb-3 text-sm font-semibold">Delivery signals</div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Pacing: </span>
                    <span className="font-medium capitalize">{evaluation.consultant_confidence.pacing}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Filler words: </span>
                    {evaluation.consultant_confidence.filler_words.length ? (
                      <span className="font-mono text-xs">
                        {evaluation.consultant_confidence.filler_words.join(", ")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">none detected</span>
                    )}
                  </div>
                  <p className="pt-2 text-xs italic text-muted-foreground">
                    Confidence is inferred from the transcript, not raw audio.
                  </p>
                </div>
              </Card>
            </div>}

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <Card className="border-border/60 bg-card/60 p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <XCircle className="h-4 w-4 text-destructive" /> Corrective feedback
                </div>
                <ul className="space-y-2 text-sm">
                  {evaluation.corrective_feedback.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="border-border/60 bg-card/60 p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> What you nailed
                </div>
                <ul className="space-y-2 text-sm">
                  {evaluation.wins.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <div className="mt-8">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setShowTranscript((v) => !v)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {showTranscript ? "Hide" : "Show"} full transcript
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={async () => {
                    const text = viewTranscript
                      .map((t) => `${t.role === "user" ? "Consultant" : "Prospect"}: ${t.content}`)
                      .join("\n\n");
                    try {
                      await navigator.clipboard.writeText(text);
                      toast.success("Transcript copied");
                    } catch {
                      toast.error("Couldn't copy — select and copy manually");
                    }
                  }}
                  disabled={viewTranscript.length === 0}
                >
                  <Copy className="h-3.5 w-3.5" /> Copy transcript
                </Button>
              </div>
              {showTranscript && (
                <Card className="mt-3 space-y-2 border-border/60 bg-card/60 p-5 text-sm">
              {viewTranscript.map((t, i) => (
                    <div key={i}>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        {t.role === "user" ? "You" : "Prospect"}
                      </span>
                      <p className="mt-0.5">{t.content}</p>
                    </div>
                  ))}
                </Card>
              )}
            </div>

            {!id && (
            <div className="mt-10 flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  setEvaluation(null);
                  navigate("/call");
                }}
                variant="secondary"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" /> Run again
              </Button>
              <Button
                onClick={() => {
                  reset();
                  navigate("/");
                }}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                New simulation <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            )}
            {id && (
              <div className="mt-10 flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    reset();
                    navigate("/");
                  }}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Start a new simulation <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
};

export default Report;