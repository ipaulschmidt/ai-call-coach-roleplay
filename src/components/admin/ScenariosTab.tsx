import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Copy, Pencil, Trash2, ArrowLeft, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PERSONAS_BY_AREA, PRACTICE_AREAS, DURATION_OPTIONS, deriveDefaultRubric, type PracticeArea, type CallType, type Difficulty, type Rubric } from "@/lib/session";
import { PERSONA_AVATARS } from "@/lib/personaAvatars";

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;

interface Scenario {
  id: string;
  created_at: string;
  name: string;
  practice_area: PracticeArea;
  call_type: CallType;
  difficulty: Difficulty;
  persona: string;
  duration_minutes: number;
  topics: string | null;
  topics_distilled?: string | null;
  goal?: string | null;
  scenario?: string | null;
  created_by_hint: string | null;
  featured?: boolean;
  rubric?: string | null;
}

const CALL_TYPES: { id: CallType; label: string }[] = [
  { id: "discovery", label: "Sales Discovery" },
  { id: "service", label: "Service / Onboarding" },
  { id: "tough", label: "Tough Conversation" },
];

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "Easy — Friendly, curious prospect" },
  { id: "realistic", label: "Realistic — Polite skeptic, real-world flow" },
  { id: "hard", label: "Hard — Tough objections, expert pushback" },
];

const areaLabel = (a: string) =>
  PRACTICE_AREAS.find((p) => p.id === a)?.label ?? a;

const personaFirstName = (persona: string) =>
  (persona.split(" — ")[0] || persona).split(/\s+/)[0] || persona;

const callTypeLabel = (c: string) =>
  CALL_TYPES.find((x) => x.id === c)?.label ?? c;

function buildGoalTemplate(callType: CallType, name: string): string {
  const n = (name || "").trim() || "this scenario";
  if (callType === "discovery") {
    return `Pitch ${n} to this prospect, uncover their top 1–2 pains, do a light qualification (budget, timeline, or decision process — pick what matters most), and earn a clear next step.`;
  }
  if (callType === "tough") {
    return `Navigate this conversation around ${n}, address the client's concerns directly, protect scope where needed, and close with a concrete next step.`;
  }
  return `Introduce ${n} to this client, confirm their goals and current situation, walk them through what this engagement delivers, and align on a clear path forward.`;
}

const difficultyLabel = (d: string) =>
  DIFFICULTIES.find((x) => x.id === d)?.label.split(" — ")[0] ?? d;

async function callFn(path: string, password: string, body?: unknown) {
  const resp = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": password,
      Authorization: ANON,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (resp.status === 401) throw new Error("Unauthorized");
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.error || `Failed (${resp.status})`);
  return data;
}

export default function ScenariosTab({ password }: { password: string }) {
  const [rows, setRows] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<Scenario | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await callFn("list-scenarios", password);
      setRows(d.scenarios || []);
    } catch (e: any) {
      toast.error(e.message || "Could not load scenarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async (id: string) => {
    const url = `${window.location.origin}/scenario/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2000);
    } catch {
      toast.error("Could not copy");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await callFn("delete-scenario", password, { id });
      setConfirmDelId(null);
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  };

  if (mode === "form") {
    return (
      <ScenarioForm
        password={password}
        initial={editing}
        onCancel={() => {
          setMode("list");
          setEditing(null);
        }}
        onSaved={async () => {
          setMode("list");
          setEditing(null);
          await load();
        }}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {rows.length} scenario{rows.length === 1 ? "" : "s"}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setMode("form");
            }}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" /> Create new scenario
          </Button>
        </div>
      </div>

      {rows.length === 0 && !loading && (
        <Card className="border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground">
          No scenarios yet. Click "Create new scenario" to add one.
        </Card>
      )}

      {rows.length > 0 && (
        <Card className="overflow-hidden border-border/60 bg-card/60">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-3 py-3 text-left">Practice Area</th>
                  <th className="px-3 py-3 text-left">Call Type</th>
                  <th className="px-3 py-3 text-left">Difficulty</th>
                  <th className="px-3 py-3 text-left">Persona</th>
                  <th className="px-3 py-3 text-left">Duration</th>
                  <th className="px-3 py-3 text-left">Created</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border/60">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{areaLabel(r.practice_area)}</td>
                    <td className="px-3 py-3 text-muted-foreground">{callTypeLabel(r.call_type)}</td>
                    <td className="px-3 py-3 text-muted-foreground">{difficultyLabel(r.difficulty)}</td>
                    <td className="px-3 py-3 text-muted-foreground">{personaFirstName(r.persona)}</td>
                    <td className="px-3 py-3 text-muted-foreground">{r.duration_minutes} min</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => void handleCopy(r.id)}
                        >
                          {copiedId === r.id ? (
                            <>
                              <Check className="h-3.5 w-3.5" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" /> Copy URL
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => {
                            setEditing(r);
                            setMode("form");
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        {confirmDelId === r.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Are you sure? This cannot be undone</span>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => void handleDelete(r.id)}
                            >
                              Yes
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setConfirmDelId(null)}
                            >
                              No
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => setConfirmDelId(r.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function ScenarioForm({
  password,
  initial,
  onCancel,
  onSaved,
}: {
  password: string;
  initial: Scenario | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [practiceArea, setPracticeArea] = useState<PracticeArea>(
    (initial?.practice_area as PracticeArea) || "hubspot",
  );
  const personas = useMemo(() => PERSONAS_BY_AREA[practiceArea], [practiceArea]);

  const initialPersonaId = useMemo(() => {
    if (!initial) return personas[0].id;
    // Try to recover the persona id by matching the stored persona string against
    // the known persona names for the area.
    const area = (initial.practice_area as PracticeArea) || "hubspot";
    const match = PERSONAS_BY_AREA[area].find((p) => initial.persona.startsWith(p.name));
    return match?.id ?? PERSONAS_BY_AREA[area][0].id;
  }, [initial, personas]);

  const [personaId, setPersonaId] = useState<string>(initialPersonaId);
  const [callType, setCallType] = useState<CallType>((initial?.call_type as CallType) || "discovery");
  const [difficulty, setDifficulty] = useState<Difficulty>(
    (initial?.difficulty as Difficulty) || "realistic",
  );
  const [duration, setDuration] = useState<number>(initial?.duration_minutes ?? 10);
  const [topics, setTopics] = useState(initial?.topics ?? "");
  const [backstory, setBackstory] = useState<string>(initial?.scenario ?? "");
  const [backstoryEdited, setBackstoryEdited] = useState<boolean>(!!initial?.scenario);
  const [backstoryLoading, setBackstoryLoading] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [goal, setGoal] = useState<string>(
    initial?.goal ?? buildGoalTemplate((initial?.call_type as CallType) || "discovery", initial?.name ?? ""),
  );
  const [goalEdited, setGoalEdited] = useState<boolean>(!!initial?.goal);
  const [rubric, setRubric] = useState<Rubric>(
    (initial?.rubric as Rubric) || deriveDefaultRubric((initial?.call_type as CallType) || "discovery"),
  );
  const [rubricEdited, setRubricEdited] = useState<boolean>(!!initial?.rubric);
  const [featured, setFeatured] = useState<boolean>(!!initial?.featured);
  const [saving, setSaving] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [distillStatus, setDistillStatus] = useState<"idle" | "processing" | "ok" | "failed">(
    initial?.topics
      ? initial.topics_distilled
        ? "ok"
        : "failed"
      : "idle",
  );

  const onAreaChange = (id: PracticeArea) => {
    setPracticeArea(id);
    setPersonaId(PERSONAS_BY_AREA[id][0].id);
  };

  // Auto-regenerate goal when name or callType changes, unless admin has edited it.
  useEffect(() => {
    if (goalEdited) return;
    setGoal(buildGoalTemplate(callType, name));
  }, [callType, name, goalEdited]);

  const handleTopicsBlur = async () => {
    const t = topics.trim();
    if (!t) {
      setName("");
      return;
    }
    const skipName = !!(name.trim() && initial);
    const skipBackstory = backstoryEdited;
    if (!skipName) setGenLoading(true);
    if (!skipBackstory) setBackstoryLoading(true);
    await Promise.all([
      skipName
        ? Promise.resolve()
        : callFn("generate-scenario-name", password, { topics: t })
            .then((d) => {
              if (d?.name) setName(d.name);
            })
            .catch((e) => console.error(e))
            .finally(() => setGenLoading(false)),
      skipBackstory
        ? Promise.resolve()
        : callFn("generate-scenario-backstory", password, { topics: t })
            .then((d) => {
              if (d?.backstory) setBackstory(d.backstory);
            })
            .catch((e) => console.error(e))
            .finally(() => setBackstoryLoading(false)),
      rubricEdited
        ? Promise.resolve()
        : callFn("classify-rubric", password, { goal: goal, callType: callType })
            .then((d) => {
              if (d?.rubric && !rubricEdited) setRubric(d.rubric as Rubric);
            })
            .catch((e) => console.error(e)),
    ]);
  };

  const handleSave = async () => {
    const persona = personas.find((p) => p.id === personaId)!;
    const personaString = `${persona.name} — ${persona.role}. ${persona.blurb}`;
    if (!name.trim()) {
      toast.error("Scenario name is required");
      return;
    }
    setSaving(true);
    const hasTopics = !!topics.trim();
    if (hasTopics) setDistillStatus("processing");
    try {
      const result = await callFn("save-scenario", password, {
        id: initial?.id,
        name: name.trim(),
        practice_area: practiceArea,
        call_type: callType,
        difficulty,
        persona: personaString,
        duration_minutes: duration,
        topics: topics.trim() || null,
        goal: goal.trim() || null,
        scenario: backstory.trim() || null,
        featured,
        rubric,
      });
      if (hasTopics) {
        setDistillStatus(result?.scenario?.topics_distilled ? "ok" : "failed");
      } else {
        setDistillStatus("idle");
      }
      toast.success(initial ? "Scenario updated" : "Scenario created");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
      if (hasTopics) setDistillStatus("failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to scenarios
        </Button>
        <div className="text-sm text-muted-foreground">
          {initial ? "Edit scenario" : "New scenario"}
        </div>
      </div>

      <Card className="space-y-8 border-border/60 bg-card/70 p-6 md:p-8">
        {/* Practice Area */}
        <section>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
            Practice Area
          </Label>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {PRACTICE_AREAS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onAreaChange(a.id)}
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

        {/* Persona */}
        <section>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
            Persona
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
                    <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.blurb}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Call Type */}
        <section>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
            Call Type
          </Label>
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
        </section>

        {/* Difficulty */}
        <section>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
            Difficulty
          </Label>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDifficulty(d.id)}
                className={`rounded-lg border p-3 text-left text-sm transition-all ${
                  difficulty === d.id
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border/60 bg-background/40 hover:border-border"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </section>

        {/* Duration */}
        <section>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
            Duration
          </Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDuration(d.value)}
                className={`rounded-lg border p-3 text-sm transition-all ${
                  duration === d.value
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border/60 bg-background/40 hover:border-border"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </section>

        {/* Topics */}
        <section>
          <Label htmlFor="topics" className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
            What to focus on or practice pitching
          </Label>
          <Textarea
            id="topics"
            rows={8}
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            onBlur={handleTopicsBlur}
            placeholder="Paste a service brief, Tettra excerpt, or bullet points. The AI will use this to respond as a realistic prospect or client being pitched this service."
            className="min-h-[200px] resize-y border-border/70 bg-background/50 text-sm"
          />
          {topics.trim() && distillStatus !== "idle" && (
            <p className="mt-2 text-xs">
              {distillStatus === "processing" && (
                <span className="text-muted-foreground">⏳ Processing service brief...</span>
              )}
              {distillStatus === "ok" && (
                <span className="text-primary">✓ Brief processed and ready</span>
              )}
              {distillStatus === "failed" && (
                <span className="text-destructive">
                  ⚠️ Auto-processing failed — raw content will be used
                </span>
              )}
            </p>
          )}
        </section>

        {/* Name */}
        <section>
          <Label htmlFor="name" className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
            Scenario name
          </Label>
          <div className="relative">
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "HubSpot / Breeze Agents"'
              className="bg-background/50 pr-9"
            />
            {genLoading && (
              <Sparkles className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-pulse text-primary" />
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Auto-suggested from the focus content above when you click out of that field. Edit freely.
          </p>
        </section>

        {/* Goal */}
        <section>
          <Label htmlFor="goal" className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
            Goal
          </Label>
          <Input
            id="goal"
            value={goal}
            onChange={(e) => {
              setGoal(e.target.value);
              setGoalEdited(true);
            }}
            placeholder="Shown to the rep on the live call screen"
            className="bg-background/50"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Auto-generated from the scenario name and call type. Edit freely — once edited it stops auto-updating.
          </p>
        </section>

        {/* Scoring rubric */}
        <RubricSection
          rubric={rubric}
          onChange={(r) => {
            setRubric(r);
            setRubricEdited(true);
          }}
          edited={rubricEdited}
        />

        {/* Scenario backstory */}
        <section>
          <Label htmlFor="backstory" className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
            Scenario backstory
          </Label>
          <div className="relative">
            <Textarea
              id="backstory"
              value={backstory}
              onChange={(e) => {
                setBackstory(e.target.value);
                setBackstoryEdited(true);
              }}
              placeholder="Why the prospect is on this call — auto-generated from your service brief."
              rows={3}
              className="bg-background/50 pr-9"
            />
            {backstoryLoading && (
              <Sparkles className="absolute right-3 top-3 h-4 w-4 animate-pulse text-primary" />
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Auto-generated from your service brief. Edit freely — once edited it stops auto-updating.
          </p>
        </section>

        {/* Featured toggle */}
        <section className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-background/40 p-4">
          <div className="min-w-0">
            <Label htmlFor="featured" className="text-sm font-semibold">
              Feature on homepage
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Featured scenarios appear at the top of the homepage for all reps to launch in one click.
            </p>
          </div>
          <Switch id="featured" checked={featured} onCheckedChange={setFeatured} />
        </section>

        <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-5">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save scenario"}
          </Button>
        </div>
      </Card>
    </div>
  );
}