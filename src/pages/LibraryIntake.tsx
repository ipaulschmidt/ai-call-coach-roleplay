import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PERSONAS_BY_AREA,
  PRACTICE_AREAS,
  DURATION_OPTIONS,
  buildGoal,
  pickScenario,
  useSession,
  getLibrarySituation,
  pickLibraryVariant,
  getToughSituation,
  pickToughVariant,
  buildScopeExpansionGoal,
  buildSalesLibraryGoal,
  buildToughGoal,
  type PracticeArea,
} from "@/lib/session";
import { PERSONA_AVATARS } from "@/lib/personaAvatars";
import logo from "@/assets/smartbug-logo.png";

type Kind = "kickoff" | "scope" | "sales" | "tough";

const CALL_TYPE_FOR_KIND: Record<Kind, string> = {
  kickoff: "Service / Onboarding",
  scope: "Service / Onboarding",
  sales: "Sales Discovery",
  tough: "Tough Conversation",
};

export default function LibraryIntake() {
  const navigate = useNavigate();
  const { setConfig, reset } = useSession();
  const params = useParams<{ kind: string; situationId?: string }>();
  const kind = params.kind as Kind;
  const situationId = params.situationId;

  const [practiceArea, setPracticeArea] = useState<PracticeArea>("hubspot");
  const personas = useMemo(() => PERSONAS_BY_AREA[practiceArea], [practiceArea]);
  const [personaId, setPersonaId] = useState<string>(personas[0].id);
  const [durationMin, setDurationMin] = useState<number>(10);
  const [repEmail, setRepEmail] = useState("");
  const [consultantName, setConsultantName] = useState("");

  const { label, subtitle, notFound } = useMemo(() => {
    if (kind === "kickoff") {
      return {
        label: "Service kickoff / status call",
        subtitle: "Align on goals, scope, stakeholders, and next steps with a signed client.",
        notFound: false,
      };
    }
    if (kind === "scope" || kind === "sales") {
      const sit = getLibrarySituation(situationId);
      if (!sit) return { label: "", subtitle: "", notFound: true };
      return { label: sit.label, subtitle: sit.subtitle, notFound: false };
    }
    if (kind === "tough") {
      const sit = situationId ? getToughSituation(situationId) : undefined;
      if (!sit) return { label: "", subtitle: "", notFound: true };
      return { label: sit.label, subtitle: sit.subtitle, notFound: false };
    }
    return { label: "", subtitle: "", notFound: true };
  }, [kind, situationId]);

  const handleAreaChange = (id: PracticeArea) => {
    setPracticeArea(id);
    setPersonaId(PERSONAS_BY_AREA[id][0].id);
  };

  const start = () => {
    const email = repEmail.trim();
    if (!email) return;
    const persona = personas.find((p) => p.id === personaId)!;
    reset();

    let cfg: Parameters<typeof setConfig>[0] | null = null;
    if (kind === "kickoff") {
      cfg = {
        topics: "",
        difficulty: "realistic",
        persona: `${persona.name} — ${persona.role}. ${persona.blurb}`,
        callType: "service",
        practiceArea,
        durationMin,
        goal: buildGoal(practiceArea, "service", "", durationMin),
        scenario: pickScenario(practiceArea, "service", ""),
        personaId: persona.id,
        personaAvatar: PERSONA_AVATARS[persona.id],
        repEmail: email,
        rubric: "service_kickoff",
      };
    } else if (kind === "scope" || kind === "sales") {
      const sit = getLibrarySituation(situationId);
      const variant = situationId ? pickLibraryVariant(situationId) : undefined;
      if (!sit || !variant || !situationId) return;
      const isSales = kind === "sales";
      cfg = {
        topics: "",
        difficulty: "realistic",
        persona: `${persona.name} — ${persona.role}. ${persona.blurb}`,
        callType: isSales ? "discovery" : "service",
        practiceArea,
        durationMin,
        goal: isSales
          ? buildSalesLibraryGoal(situationId, variant.label, durationMin)
          : buildScopeExpansionGoal(situationId, variant.label, durationMin),
        scenario: variant.scenario,
        personaId: persona.id,
        personaAvatar: PERSONA_AVATARS[persona.id],
        situationId,
        situationLabel: sit.label,
        variantId: variant.id,
        internalPlaybook: variant.internalPlaybook,
        repEmail: email,
        rubric: sit.rubric,
      };
    } else if (kind === "tough") {
      const sit = situationId ? getToughSituation(situationId) : undefined;
      const variant = situationId ? pickToughVariant(situationId) : undefined;
      if (!sit || !variant || !situationId) return;
      cfg = {
        topics: "",
        difficulty: "realistic",
        persona: `${persona.name} — ${persona.role}. ${persona.blurb}`,
        callType: "tough",
        practiceArea,
        durationMin,
        goal: buildToughGoal(situationId, variant.label, durationMin),
        scenario: variant.scenario,
        personaId: persona.id,
        personaAvatar: PERSONA_AVATARS[persona.id],
        situationId,
        situationLabel: sit.label,
        variantId: variant.id,
        internalPlaybook: variant.internalPlaybook,
        repEmail: email,
        rubric: "tough_recovery",
      };
    }
    if (!cfg) return;

    setConfig(cfg);
    sessionStorage.setItem("consultantName", consultantName.trim());
    sessionStorage.setItem("repEmail", email);
    sessionStorage.removeItem("scenarioId");
    navigate("/call");
  };

  if (notFound) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold">Scenario not found.</h1>
          <Link to="/" className="text-sm text-primary underline underline-offset-2">
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  const selectedPersona = personas.find((p) => p.id === personaId)!;

  return (
    <main className="min-h-screen px-4 py-8 md:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex items-center justify-between">
          <img src={logo} alt="SmartBug" className="h-7 md:h-8" />
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            Main session builder →
          </Link>
        </div>

        <header className="mb-8">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Roleplay</div>
          <h1
            className="mt-1 text-balance text-4xl font-bold tracking-tight md:text-5xl"
            style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}
          >
            {label}
          </h1>
          {subtitle && (
            <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </header>

        <Card className="space-y-6 border-border/60 bg-card/70 p-6 backdrop-blur md:p-8">
          <section>
            <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
              Practice area
            </Label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {PRACTICE_AREAS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleAreaChange(a.id)}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    practiceArea === a.id
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border/60 bg-background/40 hover:border-border"
                  }`}
                >
                  <div className="text-sm font-semibold">{a.label}</div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
              Prospect / client
            </Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {personas.map((p) => {
                const selected = personaId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPersonaId(p.id)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                      selected
                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                        : "border-border/60 bg-background/40 hover:border-border"
                    }`}
                  >
                    <img
                      src={PERSONA_AVATARS[p.id]}
                      alt={p.name}
                      className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-border"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{p.name}</div>
                      <div className="truncate text-xs text-primary">{p.role}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
              Duration
            </Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDurationMin(d.value)}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    durationMin === d.value
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border/60 bg-background/40 hover:border-border"
                  }`}
                >
                  <div className="text-sm font-semibold">{d.label}</div>
                </button>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-background/40 p-4 text-sm md:grid-cols-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Call type</div>
              <div className="mt-0.5 font-medium">{CALL_TYPE_FOR_KIND[kind]}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Difficulty</div>
              <div className="mt-0.5 font-medium">Realistic</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Duration</div>
              <div className="mt-0.5 font-medium">{durationMin} min</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="email" className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
                Your work email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={repEmail}
                onChange={(e) => setRepEmail(e.target.value)}
                placeholder="Used to log this session to your HubSpot record"
                className="bg-background/50"
              />
            </div>
            <div>
              <Label htmlFor="name" className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
                Your name (optional)
              </Label>
              <Input
                id="name"
                value={consultantName}
                onChange={(e) => setConsultantName(e.target.value)}
                placeholder="So admins can see who ran this call"
                className="bg-background/50"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <div className="font-semibold">Ready to start?</div>
              <div className="text-xs text-muted-foreground">
                You'll be on a {durationMin}-minute call with{" "}
                <span className="text-primary">{selectedPersona.name}</span>.
              </div>
            </div>
            <Button
              onClick={start}
              size="lg"
              disabled={!repEmail.trim()}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Start the roleplay <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </Card>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <Mic className="h-3.5 w-3.5" /> Voice powered by your browser. Best in Chrome or Edge.
        </p>
      </div>
    </main>
  );
}