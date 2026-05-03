import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, RefreshCw, Target, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSession, type Evaluation } from "@/lib/session";

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
  const { config, transcript, evaluation, setEvaluation, reset } = useSession();
  const [loading, setLoading] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (!config || transcript.length === 0) {
      navigate("/");
      return;
    }
    if (evaluation) return;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setEvaluation(data.evaluation as Evaluation);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Could not generate report");
    } finally {
      setLoading(false);
    }
  };

  if (!config) return null;

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Post-game report</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            How you did
          </h1>
          {evaluation && (
            <p className="mt-3 max-w-3xl text-balance text-base text-muted-foreground">
              {evaluation.summary}
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
                title="Sales Strategy"
                score={evaluation.sales_strategy.score}
                notes={evaluation.sales_strategy.notes}
              />
              <ScoreCard
                title="Technical Delivery"
                score={evaluation.technical_delivery.score}
                notes={evaluation.technical_delivery.notes}
              />
              <ScoreCard
                title="Consultant Confidence"
                score={evaluation.consultant_confidence.score}
                notes={evaluation.consultant_confidence.notes}
              />
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
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
            </div>

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
              <button
                onClick={() => setShowTranscript((v) => !v)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {showTranscript ? "Hide" : "Show"} full transcript
              </button>
              {showTranscript && (
                <Card className="mt-3 space-y-2 border-border/60 bg-card/60 p-5 text-sm">
                  {transcript.map((t, i) => (
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
          </>
        )}
      </div>
    </main>
  );
};

export default Report;