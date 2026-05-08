import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mic, Sparkles, Target, Lock, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
} from "@/lib/session";
import logo from "@/assets/smartbug-logo.png";
import { PERSONA_AVATARS } from "@/lib/personaAvatars";

const DIFFICULTIES: { id: Difficulty; label: string; desc: string }[] = [
  { id: "easy", label: "Easy", desc: "Friendly, curious prospect" },
  { id: "realistic", label: "Realistic", desc: "Polite skeptic, real-world flow" },
  { id: "hard", label: "Hard", desc: "Tough objections, expert pushback" },
];

const CALL_TYPES: {
  id: CallType;
  label: string;
  subhead: string;
  bullets: string[];
}[] = [
  {
    id: "discovery",
    label: "Sales Discovery",
    subhead: "Pre-sale conversation with a prospect who hasn't bought yet.",
    bullets: [
      "Surface business pain and the cost of doing nothing",
      "Qualify budget, timeline, and decision process",
      "Handle pricing pushback and competitor comparisons",
      "Earn the right to a concrete next step",
    ],
  },
  {
    id: "service",
    label: "Service / Onboarding",
    subhead: "Post-sale kickoff with a client who has already signed.",
    bullets: [
      "Align on goals, success criteria, and scope",
      "Map stakeholders and gather access / data needs",
      "Set realistic timelines and milestones",
      "Manage early concerns and build confidence in the plan",
    ],
  },
  {
    id: "tough",
    label: "Tough Conversation",
    subhead: "Existing-client hard moment — the call you'd rather not make.",
    bullets: [
      "Lead with empathy and acknowledgement, not excuses",
      "Hold a firm, specific boundary without burning the relationship",
      "Offer concrete options instead of vague reassurance",
      "Protect scope, money, and timeline; land a real next step",
    ],
  },
];

const Index = () => {
  const navigate = useNavigate();
  const { setConfig, reset } = useSession();
  const [practiceArea, setPracticeArea] = useState<PracticeArea>("hubspot");
  const personas = useMemo(() => PERSONAS_BY_AREA[practiceArea], [practiceArea]);
  const [topics, setTopics] = useState("");
  const [consultantName, setConsultantName] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("realistic");
  const [personaId, setPersonaId] = useState<string>(personas[0].id);
  const [callType, setCallType] = useState<CallType>("discovery");
  const [durationMin, setDurationMin] = useState<number>(10);
  const [situationId, setSituationId] = useState<string>(TOUGH_SITUATIONS[0].id);

  const handleAreaChange = (id: PracticeArea) => {
    setPracticeArea(id);
    setPersonaId(PERSONAS_BY_AREA[id][0].id);
    setTopics("");
  };

  const start = () => {
    const persona = personas.find((p) => p.id === personaId)!;
    reset();
    const finalTopics = topics.trim();
    const isTough = callType === "tough";
    const variant = isTough ? pickToughVariant(situationId) : undefined;
    const sit = isTough ? getToughSituation(situationId) : undefined;
    setConfig({
      topics: finalTopics,
      difficulty: isTough ? "realistic" : difficulty,
      persona: `${persona.name} — ${persona.role}. ${persona.blurb}`,
      callType,
      practiceArea,
      durationMin,
      goal: isTough && variant
        ? buildToughGoal(situationId, variant.label, durationMin)
        : buildGoal(practiceArea, callType === "tough" ? "service" : callType, finalTopics, durationMin),
      scenario: isTough && variant
        ? variant.scenario
        : pickScenario(practiceArea, callType === "tough" ? "service" : callType, finalTopics),
      personaId: persona.id,
      personaAvatar: PERSONA_AVATARS[persona.id],
      situationId: isTough ? situationId : undefined,
      situationLabel: isTough ? sit?.label : undefined,
      variantId: isTough ? variant?.id : undefined,
      internalPlaybook: isTough ? variant?.internalPlaybook : undefined,
    });
    // Stash consultant name for Report to persist
    sessionStorage.setItem("consultantName", consultantName.trim());
    navigate("/call");
  };

  const currentArea = PRACTICE_AREAS.find((a) => a.id === practiceArea)!;
  const selectedPersona = personas.find((p) => p.id === personaId)!;
  const selectedDifficulty = DIFFICULTIES.find((d) => d.id === difficulty)!;
  const selectedDuration = DURATION_OPTIONS.find((d) => d.value === durationMin)!;
  const selectedCallType = CALL_TYPES.find((c) => c.id === callType)!;
  const selectedSituation = getToughSituation(situationId);
  const isTough = callType === "tough";

  return (
    <main className="min-h-screen px-4 py-8 md:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex items-center justify-between">
          <img src={logo} alt="SmartBug" className="h-7 md:h-8" />
          <Link to="/admin" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Lock className="h-3.5 w-3.5" /> Admin
          </Link>
        </div>

        {/* Editorial hero */}
        <header className="mb-12 max-w-3xl md:mb-16">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            SmartBug · Consultant Mode
          </div>
          <h1 className="text-balance text-5xl font-bold leading-[0.95] tracking-tight md:text-7xl" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>
            Sharpen your craft.<br />
            <span className="text-primary">One call at a time.</span>
          </h1>
          <p className="mt-5 max-w-xl text-balance text-base text-muted-foreground md:text-lg">
            Roleplay SmartBug, Point Success, and Globalia discovery & delivery conversations against an AI client. Get coached on strategy, technical accuracy, and confidence.
          </p>
        </header>

        <Card className="space-y-10 border-border/60 bg-card/70 p-6 shadow-elevated backdrop-blur md:p-10">
          {/* Step 01 */}
          <section>
            <div className="mb-4 flex items-baseline gap-3">
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

          {/* Step 02 — Persona */}
          <section>
            <div className="mb-4 flex items-baseline gap-3">
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

          {/* Step 03 — Call shape: type + difficulty + length in one row */}
          <section>
            <div className="mb-4 flex items-baseline gap-3">
              <span className="text-xs font-mono text-primary">03</span>
              <Label className="text-base font-semibold">Shape the call</Label>
            </div>

            <div className="mb-5">
              <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Call type</div>
              <div className="inline-flex rounded-full border border-border/60 bg-background/40 p-1">
                {CALL_TYPES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCallType(c.id)}
                    className={`rounded-full px-4 py-1.5 text-sm transition-all ${
                      callType === c.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-4">
                <div className="text-sm font-semibold">{selectedCallType.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{selectedCallType.subhead}</div>
                <div className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Practice scenarios where the {callType === "discovery" ? "prospect" : "client"} might…
                </div>
                <ul className="mt-2 space-y-1.5">
                  {selectedCallType.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-foreground/90">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {isTough ? (
              <div className="mb-5">
                <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Conversation type</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {TOUGH_SITUATIONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSituationId(s.id)}
                      className={`rounded-lg border p-4 text-left transition-all ${
                        situationId === s.id
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : "border-border/60 bg-background/40 hover:border-border"
                      }`}
                    >
                      <div className="text-sm font-semibold">{s.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{s.subtitle}</div>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Each conversation type has multiple variants — the specific scenario is rolled when you start the call, so the same bucket feels fresh on repeat practice.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Difficulty</div>
                <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
              </>
            )}

            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Roleplay length</div>
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
            <p className="mt-3 text-xs text-muted-foreground">
              Industry best practice for sales roleplays is 5–10 min. The prospect will start wrapping up as time runs out.
            </p>
          </section>

          {/* Step 04 — Personalize */}
          <section>
            <div className="mb-4 flex items-baseline gap-3">
              <span className="text-xs font-mono text-primary">04</span>
              <Label className="text-base font-semibold">Personalize the conversation</Label>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Label htmlFor="topics" className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  {isTough ? "Client context (optional)" : "Quiz me on…"}
                </Label>
                <Textarea
                  id="topics"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder={
                    isTough
                      ? "Drop in any specifics so the client feels real — e.g. 'B2B SaaS client, 14-month relationship, founder is the main contact, last QBR was rough, $18k/mo retainer.' Leave blank for a generic version."
                      : currentArea.defaultTopics
                  }
                  className="min-h-[120px] resize-none border-border/70 bg-background/50 text-sm"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {isTough
                    ? "Industry, length of relationship, who's on the call, retainer size, anything that's already happened — the AI client will weave it into the conversation."
                    : `Specific tactics, tools, or services. Leave blank to use defaults for ${currentArea.label}.`}
                </p>
              </div>
              <div>
                <Label htmlFor="name" className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Your name (optional)</Label>
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

          {/* Sticky-feeling CTA bar */}
          <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <div className="font-semibold">
                Ready to call <span className="text-primary">{selectedPersona.name}</span>?
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedCallType.label} · {isTough ? (selectedSituation?.label ?? "Tough conversation") : selectedDifficulty.label} · {selectedDuration.label} · {currentArea.label}
              </div>
            </div>
            <Button
              onClick={start}
              size="lg"
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 glow"
            >
              Start the roleplay
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </Card>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <Mic className="h-3.5 w-3.5" /> Voice powered by your browser. Best in Chrome or Edge. Mic permission required.
        </p>

        <section className="mt-16">
          <h2 className="mb-6 text-center text-2xl font-bold tracking-tight md:text-3xl" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>
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
