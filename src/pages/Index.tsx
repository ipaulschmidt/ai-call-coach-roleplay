import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mic, Sparkles, Target, Lock, ArrowRight, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  PERSONAS_BY_AREA,
  PRACTICE_AREAS,
  DURATION_OPTIONS,
  buildGoal,
  pickScenario,
  useSession,
  type CallType,
  type Difficulty,
  type PracticeArea,
  TOUGH_SITUATIONS,
  getToughSituation,
  pickToughVariant,
  buildToughGoal,
  deriveDefaultRubric,
  type Rubric,
  SCOPE_SITUATIONS,
  EXPANSION_SITUATIONS,
  SALES_SITUATIONS,
  getLibrarySituation,
  pickLibraryVariant,
  buildScopeExpansionGoal,
  buildSalesLibraryGoal,
  type LibrarySituation,
  type ToughSituation,
} from "@/lib/session";
import logo from "@/assets/smartbug-logo.png";
import { PERSONA_AVATARS } from "@/lib/personaAvatars";

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;

interface FeaturedScenario {
  id: string;
  name: string;
  persona: string;
  call_type: string;
  difficulty: string;
  duration_minutes: number;
  practice_area: string;
}

const CALL_TYPE_LABELS: Record<string, string> = {
  discovery: "Sales Discovery",
  service: "Service / Onboarding",
  tough: "Tough Conversation",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Easy",
  realistic: "Realistic",
  hard: "Hard",
};

function findPersonaForScenario(area: string, persona: string): { id: string; name: string } | null {
  const list = PERSONAS_BY_AREA[area as PracticeArea];
  if (!list) return null;
  const match = list.find((p) => persona.startsWith(p.name));
  return match ? { id: match.id, name: match.name } : null;
}

const DIFFICULTIES: { id: Difficulty; label: string; desc: string }[] = [
  { id: "easy", label: "Easy", desc: "Friendly, curious prospect" },
  { id: "realistic", label: "Realistic", desc: "Polite skeptic, real-world flow" },
  { id: "hard", label: "Hard", desc: "Tough objections, expert pushback" },
];

type Audience = "sales" | "service";

const Index = () => {
  const navigate = useNavigate();
  const { setConfig, reset } = useSession();
  const [audience, setAudience] = useState<Audience>("sales");
  const callType: CallType = audience === "sales" ? "discovery" : "service";

  const [practiceArea, setPracticeArea] = useState<PracticeArea>("hubspot");
  const personas = useMemo(() => PERSONAS_BY_AREA[practiceArea], [practiceArea]);
  const [topics, setTopics] = useState("");
  const [consultantName, setConsultantName] = useState("");
  const [repEmail, setRepEmail] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("realistic");
  const [personaId, setPersonaId] = useState<string>(personas[0].id);
  const [durationMin, setDurationMin] = useState<number>(10);
  const [featured, setFeatured] = useState<FeaturedScenario[]>([]);
  const [rubric, setRubric] = useState<Rubric>("sales_discovery");

  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}/get-featured-scenarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: ANON },
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d?.scenarios)) setFeatured(d.scenarios);
      })
      .catch((e) => console.error("featured fetch failed", e));
    return () => {
      cancelled = true;
    };
  }, []);

  // For build-your-own discovery/service calls, debounce-call classify-rubric
  // whenever the goal-relevant inputs change. The result is used silently — no UI picker.
  useEffect(() => {
    const goal = buildGoal(practiceArea, callType, topics.trim(), durationMin);
    let cancelled = false;
    const t = window.setTimeout(() => {
      fetch(`${BASE}/classify-rubric`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: ANON },
        body: JSON.stringify({ goal, callType }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          const next = (d?.rubric as Rubric | undefined) ?? deriveDefaultRubric(callType);
          setRubric(next);
        })
        .catch((e) => {
          console.error("classify-rubric failed", e);
          if (!cancelled) setRubric(deriveDefaultRubric(callType));
        });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [callType, practiceArea, topics, durationMin]);

  const handleAreaChange = (id: PracticeArea) => {
    setPracticeArea(id);
    setPersonaId(PERSONAS_BY_AREA[id][0].id);
    setTopics("");
  };

  const handleAudienceChange = (a: Audience) => {
    setAudience(a);
  };

  // Start the build-your-own custom call (Sales=discovery, Service=service)
  const start = () => {
    const email = repEmail.trim();
    if (!email) return;
    const persona = personas.find((p) => p.id === personaId)!;
    reset();
    const finalTopics = topics.trim();
    setConfig({
      topics: finalTopics,
      difficulty,
      persona: `${persona.name} — ${persona.role}. ${persona.blurb}`,
      callType,
      practiceArea,
      durationMin,
      goal: buildGoal(practiceArea, callType, finalTopics, durationMin),
      scenario: pickScenario(practiceArea, callType, finalTopics),
      personaId: persona.id,
      personaAvatar: PERSONA_AVATARS[persona.id],
      repEmail: email,
      rubric,
    });
    sessionStorage.setItem("consultantName", consultantName.trim());
    sessionStorage.setItem("repEmail", email);
    sessionStorage.removeItem("scenarioId");
    navigate("/call");
  };

  // Start a library bucket from the Service tab.
  // kind: "kickoff" | "scope" | "tough"
  const startLibrary = (kind: "kickoff" | "scope" | "tough" | "sales", situationId?: string) => {
    const email = repEmail.trim();
    if (!email) {
      alert("Please enter your work email above before starting a library scenario.");
      return;
    }
    const persona = personas.find((p) => p.id === personaId)!;
    reset();

    let cfg: Parameters<typeof setConfig>[0];
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
    } else {
      // tough
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

    setConfig(cfg);
    sessionStorage.setItem("consultantName", consultantName.trim());
    sessionStorage.setItem("repEmail", email);
    sessionStorage.removeItem("scenarioId");
    navigate("/call");
  };

  const currentArea = PRACTICE_AREAS.find((a) => a.id === practiceArea)!;
  const selectedPersona = personas.find((p) => p.id === personaId)!;
  const selectedDifficulty = DIFFICULTIES.find((d) => d.id === difficulty)!;
  const selectedDuration = DURATION_OPTIONS.find((d) => d.value === durationMin)!;

  // Shared "session basics" block used by both tabs (and library rows on Service tab).
  const SessionBasics = (
    <Card className="space-y-6 border-border/60 bg-card/70 p-6 shadow-elevated backdrop-blur md:p-8">
      <section>
        <div className="mb-3 flex items-baseline gap-3">
          <span className="text-xs font-mono text-primary">01</span>
          <Label className="text-base font-semibold">Pick your practice area</Label>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {PRACTICE_AREAS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => handleAreaChange(a.id)}
              className={`rounded-lg border p-4 text-left transition-all ${
                practiceArea === a.id
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-border/60 bg-background/40 hover:border-border"
              }`}
            >
              <div className="text-sm font-semibold">{a.label}</div>
              <div className="mt-1 text-xs text-muted-foreground line-clamp-3">{a.tagline}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline gap-3">
          <span className="text-xs font-mono text-primary">02</span>
          <Label className="text-base font-semibold">Choose your prospect</Label>
        </div>
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
                  className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-border"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="truncate text-xs text-primary">{p.role}</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.blurb}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline gap-3">
          <span className="text-xs font-mono text-primary">03</span>
          <Label className="text-base font-semibold">Roleplay length</Label>
        </div>
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
              <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{d.desc}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline gap-3">
          <span className="text-xs font-mono text-primary">04</span>
          <Label className="text-base font-semibold">Your details</Label>
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
      </section>
    </Card>
  );

  const renderLibraryRow = (
    s: LibrarySituation | ToughSituation,
    kind: "scope" | "tough",
  ) => (
    <div
      key={s.id}
      className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-background/30 px-3 py-2.5 transition-colors hover:border-border"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{s.label}</div>
        <div className="truncate text-xs text-muted-foreground">{s.subtitle}</div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => startLibrary(kind, s.id)}
        disabled={!repEmail.trim()}
        className="shrink-0 gap-1"
      >
        Start
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  const FeaturedSection = featured.length > 0 && (
    <section className="mb-10">
      <div className="mb-5">
        <h2
          className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl"
          style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}
        >
          <Star className="h-6 w-6 fill-primary text-primary" />
          Featured practice scenarios
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Curated sessions your team is focused on right now. Click to start.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((s) => {
          const personaInfo = findPersonaForScenario(s.practice_area, s.persona);
          const avatar = personaInfo ? PERSONA_AVATARS[personaInfo.id] : undefined;
          const personaName = personaInfo?.name ?? s.persona.split(" — ")[0];
          return (
            <Card
              key={s.id}
              className="flex flex-col gap-4 border-border/60 bg-card/70 p-5 backdrop-blur transition-all hover:border-primary/60 hover:shadow-elevated"
            >
              <div className="text-base font-semibold leading-snug">{s.name}</div>
              <div className="flex items-center gap-3">
                {avatar && (
                  <img
                    src={avatar}
                    alt={personaName}
                    className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-border"
                  />
                )}
                <div className="min-w-0 text-sm">
                  <div className="truncate font-medium">{personaName}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {CALL_TYPE_LABELS[s.call_type] ?? s.call_type}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <span className="rounded-full border border-border/60 bg-background/40 px-2 py-0.5">
                  {DIFFICULTY_LABELS[s.difficulty] ?? s.difficulty}
                </span>
                <span className="rounded-full border border-border/60 bg-background/40 px-2 py-0.5">
                  {s.duration_minutes} min
                </span>
              </div>
              <Button
                onClick={() => navigate(`/scenario/${s.id}`)}
                className="mt-auto gap-1.5"
                size="sm"
              >
                Start this scenario
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Card>
          );
        })}
      </div>
    </section>
  );

  const OrBuildSeparator = (
    <div className="my-10 flex items-center gap-4">
      <Separator className="flex-1" />
      <span className="shrink-0 text-sm text-muted-foreground">Or build your own session</span>
      <Separator className="flex-1" />
    </div>
  );

  const BuildYourOwn = (
    <div className="space-y-6">
      {SessionBasics}

      <Card className="space-y-6 border-border/60 bg-card/70 p-6 shadow-elevated backdrop-blur md:p-8">
        <section>
          <div className="mb-3 flex items-baseline gap-3">
            <span className="text-xs font-mono text-primary">05</span>
            <Label className="text-base font-semibold">Difficulty</Label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDifficulty(d.id)}
                className={`rounded-lg border p-4 text-left transition-all ${
                  difficulty === d.id
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border/60 bg-background/40 hover:border-border"
                }`}
              >
                <div className="font-semibold">{d.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{d.desc}</div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-baseline gap-3">
            <span className="text-xs font-mono text-primary">06</span>
            <Label htmlFor="topics" className="text-base font-semibold">
              Personalize the conversation
            </Label>
          </div>
          <Label
            htmlFor="topics"
            className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"
          >
            <Target className="h-3.5 w-3.5 text-primary" />
            What to focus on or practice pitching
          </Label>
          <Textarea
            id="topics"
            rows={6}
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            placeholder="Enter topic keywords — or paste content from a service brief or Tettra article. For best results, paste the ICP, language indicators, pricing, and common objections sections rather than the full document. The AI will use whatever you put here to respond as a realistic prospect being pitched that service. Leave blank for general practice."
            className="min-h-[160px] resize-none border-border/70 bg-background/50 text-sm"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Specific tactics, tools, or services. Leave blank to use defaults for {currentArea.label}.
          </p>
        </section>

        <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <div className="font-semibold">
              Ready to call <span className="text-primary">{selectedPersona.name}</span>?
            </div>
            <div className="text-xs text-muted-foreground">
              {audience === "sales" ? "Sales Discovery" : "Service / Onboarding"} · {selectedDifficulty.label} ·{" "}
              {selectedDuration.label} · {currentArea.label}
            </div>
          </div>
          <Button
            onClick={start}
            size="lg"
            disabled={!repEmail.trim()}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 glow"
          >
            Start the roleplay
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </Card>
    </div>
  );

  const ServiceLibrary = (
    <Card className="border-border/60 bg-card/70 p-6 shadow-elevated backdrop-blur md:p-8">
      <div className="mb-4">
        <h2
          className="text-xl font-bold tracking-tight md:text-2xl"
          style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}
        >
          Self-serve scenario library
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a bucket and start. A variant is rolled when you hit Start, so each run feels fresh. Uses the
          persona, length, and email you set above.
        </p>
        {!repEmail.trim() && (
          <p className="mt-2 text-xs text-destructive">
            Enter your work email above to enable Start buttons.
          </p>
        )}
      </div>

      <Accordion type="multiple" defaultValue={["kickoff", "scope", "tough"]} className="w-full">
        <AccordionItem value="kickoff">
          <AccordionTrigger className="text-left">
            Kickoff &amp; status
            <span className="ml-auto mr-2 text-xs font-normal text-muted-foreground">
              Friendly client kickoff / status calls
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-background/30 px-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">Service kickoff / status call</div>
                <div className="truncate text-xs text-muted-foreground">
                  Align on goals, scope, stakeholders, and next steps with a signed client.
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => startLibrary("kickoff")}
                disabled={!repEmail.trim()}
                className="shrink-0 gap-1"
              >
                Start
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="scope">
          <AccordionTrigger className="text-left">
            Scope &amp; expansion
            <span className="ml-auto mr-2 text-xs font-normal text-muted-foreground">
              Hold scope or spot expansion signals
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {[...SCOPE_SITUATIONS, ...EXPANSION_SITUATIONS].map((s) => renderLibraryRow(s, "scope"))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tough">
          <AccordionTrigger className="text-left">
            Tough conversations
            <span className="ml-auto mr-2 text-xs font-normal text-muted-foreground">
              Hard moments with existing clients
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {TOUGH_SITUATIONS.map((s) => renderLibraryRow(s, "tough"))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );

  const SalesLibrary = (
    <Card className="border-border/60 bg-card/70 p-6 shadow-elevated backdrop-blur md:p-8">
      <div className="mb-4">
        <h2
          className="text-xl font-bold tracking-tight md:text-2xl"
          style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}
        >
          Self-serve scenario library
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a discovery bucket and start. A variant is rolled when you hit Start, so each run feels fresh.
          Uses the persona, length, and email you set below.
        </p>
        {!repEmail.trim() && (
          <p className="mt-2 text-xs text-destructive">
            Enter your work email in the builder below to enable Start buttons.
          </p>
        )}
      </div>
      <Accordion type="multiple" defaultValue={["sales"]} className="w-full">
        <AccordionItem value="sales">
          <AccordionTrigger className="text-left">
            Discovery scenarios
            <span className="ml-auto mr-2 text-xs font-normal text-muted-foreground">
              Pre-sale conversations with prospects
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {SALES_SITUATIONS.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-background/30 px-3 py-2.5 transition-colors hover:border-border"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{s.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{s.subtitle}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startLibrary("sales", s.id)}
                    disabled={!repEmail.trim()}
                    className="shrink-0 gap-1"
                  >
                    Start
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );

  const OrPickPathSeparator = (
    <div className="my-10 flex items-center gap-4">
      <Separator className="flex-1" />
      <span className="shrink-0 text-sm text-muted-foreground">Or pick a practice path</span>
      <Separator className="flex-1" />
    </div>
  );

  const CollapsedBuilder = (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="builder" className="rounded-xl border border-border/60 bg-card/40 px-4 backdrop-blur">
        <AccordionTrigger className="text-left">
          <div>
            <div className="text-base font-semibold">Build your own session</div>
            <div className="text-xs font-normal text-muted-foreground">
              Set up a custom roleplay from scratch.
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pt-2">{BuildYourOwn}</div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );

  return (
    <main className="min-h-screen px-4 py-8 md:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex items-center justify-between">
          <img src={logo} alt="SmartBug" className="h-7 md:h-8" />
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Lock className="h-3.5 w-3.5" /> Admin
          </Link>
        </div>

        {/* Editorial hero */}
        <header className="mb-10 max-w-3xl md:mb-12">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            SmartBug · Consultant Mode
          </div>
          <h1
            className="text-balance text-5xl font-bold leading-[0.95] tracking-tight md:text-7xl"
            style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}
          >
            Sharpen your craft.<br />
            <span className="text-primary">One call at a time.</span>
          </h1>
          <p className="mt-5 max-w-xl text-balance text-base text-muted-foreground md:text-lg">
            Roleplay SmartBug, Point Success, and Globalia discovery & delivery conversations against an AI client.
            Get coached on strategy, technical accuracy, and confidence.
          </p>
        </header>

        {/* Audience tabs */}
        <div className="mb-8">
          <div className="inline-flex rounded-full border border-border/60 bg-card/40 p-1 backdrop-blur">
            {(["sales", "service"] as Audience[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => handleAudienceChange(a)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                  audience === a
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {a === "sales" ? "Sales" : "Service"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {audience === "sales"
              ? "Pre-sale discovery with prospects who haven't bought yet."
              : "Post-sale: kickoffs, scope & expansion, and tough client conversations."}
          </p>
        </div>

        {audience === "sales" ? (
          <>
            {FeaturedSection}
            {featuredForAudience.length > 0 && OrBuildSeparator}
            {BuildYourOwn}
          </>
        ) : (
          <>
            {FeaturedSection}
            {featuredForAudience.length > 0 && OrBuildSeparator}
            {ServiceLibrary}
            {OrBuildSeparator}
            {BuildYourOwn}
          </>
        )}

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <Mic className="h-3.5 w-3.5" /> Voice powered by your browser. Best in Chrome or Edge. Mic permission required.
        </p>

        <section className="mt-16">
          <h2
            className="mb-6 text-center text-2xl font-bold tracking-tight md:text-3xl"
            style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}
          >
            Frequently asked questions
          </h2>
          <Card className="border-border/60 bg-card/70 p-2 backdrop-blur md:p-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="discovery-vs-service">
                <AccordionTrigger className="text-left">
                  What's the difference between a Discovery call and a Service / Onboarding call?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <p className="mb-3">
                    <span className="font-semibold text-foreground">Discovery</span> is a pre-sale conversation with a prospect who hasn't bought yet. Your job is to diagnose their business problem, qualify fit, uncover budget / timeline / decision process, and earn the right to propose a solution. The prospect is skeptical, comparing options, and pushing back on value. Success looks like: clear pain identified, mutual next step booked, and you've avoided pitching features too early.
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Service / Onboarding</span> happens after the deal is signed. The client has already bought — now you're kicking off the engagement, aligning on goals, setting expectations, gathering access, and building the project plan. The tone is collaborative, not persuasive. Success looks like: scope confirmed, stakeholders mapped, timeline agreed, and the client feels confident in the roadmap. You're managing a relationship, not winning one.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="how-scoring-works">
                <AccordionTrigger className="text-left">How does scoring work?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  After you end the call, the AI evaluates your transcript on strategy, technical accuracy, and confidence — and gives you specific feedback on what to improve.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="practice-areas">
                <AccordionTrigger className="text-left">Which practice areas are supported?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  HubSpot (CRM, Marketing Hub, Sales Hub, Service Hub, Breeze AI), Paid Media (Point Success Media's PPC, paid social, programmatic), and Globalia (e-commerce, custom AI, app development, WordPress).
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="mic-tips">
                <AccordionTrigger className="text-left">Mic isn't working in the preview?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Chrome blocks mic access in embedded iframes. Open the preview in a new tab (↗ top-right) or just type your replies in the transcript box. Use headphones to avoid the prospect's voice being picked up by your mic.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        </section>
      </div>
    </main>
  );
};

export default Index;