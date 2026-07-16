import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PRACTICE_AREAS, type PracticeArea } from "@/lib/session";
import { fetchPersonas, type Persona } from "@/lib/personas";
import { personaAvatarSrc } from "@/lib/personaAvatars";

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;

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

const areaLabel = (a: string) => PRACTICE_AREAS.find((p) => p.id === a)?.label ?? a;

export default function PersonasTab({ password }: { password: string }) {
  const [rows, setRows] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<Persona | null>(null);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState<PracticeArea | "all">("all");

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchPersonas();
      setRows(list);
    } catch (e: any) {
      toast.error(e.message || "Could not load personas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredRows = useMemo(
    () => (areaFilter === "all" ? rows : rows.filter((r) => r.practice_area === areaFilter)),
    [rows, areaFilter],
  );

  const handleDelete = async (id: string) => {
    try {
      await callFn("delete-persona", password, { id });
      setConfirmDelId(null);
      setRows((r) => r.filter((x) => x.id !== id));
      toast.success("Persona deleted");
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  };

  if (mode === "form") {
    return (
      <PersonaForm
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            {filteredRows.length} persona{filteredRows.length === 1 ? "" : "s"}
          </div>
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value as PracticeArea | "all")}
            className="rounded-md border border-border/60 bg-background/40 px-2 py-1 text-xs"
          >
            <option value="all">All practice areas</option>
            {PRACTICE_AREAS.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
          <Button
            onClick={() => { setEditing(null); setMode("form"); }}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" /> Create new persona
          </Button>
        </div>
      </div>

      {filteredRows.length === 0 && !loading && (
        <Card className="border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground">
          No personas yet. Click "Create new persona" to add one.
        </Card>
      )}

      {filteredRows.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredRows.map((p) => (
            <Card key={p.id} className="flex gap-3 border-border/60 bg-card/60 p-4">
              <img
                src={personaAvatarSrc(p.id, p.avatar_url) || ""}
                alt={p.name}
                className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-border"
                onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold">{p.name}</div>
                  <span className="shrink-0 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {areaLabel(p.practice_area)}
                  </span>
                </div>
                <div className="text-xs text-primary">{p.role}</div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.blurb}</div>
                {p.source_type === "real_person_modeled" && (
                  <div className="mt-1.5 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                    Real-person modeled
                  </div>
                )}
                <div className="mt-3 flex items-center justify-end gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => { setEditing(p); setMode("form"); }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  {confirmDelId === p.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Sure?</span>
                      <Button variant="destructive" size="sm" className="h-7 px-2 text-xs" onClick={() => void handleDelete(p.id)}>Yes</Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setConfirmDelId(null)}>No</Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelId(p.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonaForm({
  password, initial, onCancel, onSaved,
}: { password: string; initial: Persona | null; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [blurb, setBlurb] = useState(initial?.blurb ?? "");
  const [practiceArea, setPracticeArea] = useState<PracticeArea>(
    (initial?.practice_area as PracticeArea) || "paid_media",
  );
  const [gender, setGender] = useState<"female" | "male" | "">(initial?.gender ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatar_url ?? "");
  const [brandContext, setBrandContext] = useState(initial?.brand_context ?? "");
  const [personalityTraits, setPersonalityTraits] = useState(initial?.personality_traits ?? "");
  const [knownObjections, setKnownObjections] = useState(initial?.known_objections ?? "");
  const [voiceNotes, setVoiceNotes] = useState(initial?.voice_notes ?? "");
  const [sourceType, setSourceType] = useState<"composite" | "real_person_modeled">(
    initial?.source_type ?? "composite",
  );
  const [sourceReference, setSourceReference] = useState(initial?.source_reference ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !role.trim() || !blurb.trim()) {
      toast.error("Name, role, and blurb are required");
      return;
    }
    setSaving(true);
    try {
      await callFn("save-persona", password, {
        id: initial?.id,
        name: name.trim(),
        role: role.trim(),
        blurb: blurb.trim(),
        practice_area: practiceArea,
        gender: gender || null,
        avatar_url: avatarUrl.trim() || null,
        brand_context: brandContext.trim() || null,
        personality_traits: personalityTraits.trim() || null,
        known_objections: knownObjections.trim() || null,
        voice_notes: voiceNotes.trim() || null,
        source_type: sourceType,
        source_reference: sourceReference.trim() || null,
      });
      toast.success(initial ? "Persona updated" : "Persona created");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to personas
        </Button>
        <div className="text-sm text-muted-foreground">{initial ? "Edit persona" : "New persona"}</div>
      </div>

      <Card className="space-y-6 border-border/60 bg-card/70 p-6 md:p-8">
        <section>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Practice Area</Label>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {PRACTICE_AREAS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setPracticeArea(a.id)}
                className={`rounded-lg border p-3 text-left transition-all ${practiceArea === a.id ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border/60 bg-background/40 hover:border-border"}`}
              >
                <div className="text-sm font-semibold">{a.label}</div>
              </button>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dave Kowalski" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Role</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. NAF-Loyal Franchise Owner" />
          </div>
        </div>

        <div>
          <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Blurb (shown in the picker card)</Label>
          <Textarea value={blurb} onChange={(e) => setBlurb(e.target.value)} rows={2} placeholder="One or two sentences describing who this is and how they act." />
        </div>

        <div>
          <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Brand / business context (optional)</Label>
          <Input value={brandContext} onChange={(e) => setBrandContext(e.target.value)} placeholder="e.g. Budget Blinds franchisee, 2 locations" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Gender (for voice selection)</Label>
            <div className="flex gap-2">
              {(["female", "male"] as const).map((g) => (
                <button
                  key={g} type="button" onClick={() => setGender(g)}
                  className={`rounded-lg border px-3 py-1.5 text-sm capitalize ${gender === g ? "border-primary bg-primary/10" : "border-border/60 bg-background/40"}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Avatar image URL (optional)</Label>
            <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="Leave blank to use initials" />
          </div>
        </div>

        <div>
          <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Personality traits (comma-separated)</Label>
          <Input value={personalityTraits} onChange={(e) => setPersonalityTraits(e.target.value)} placeholder="e.g. skeptical, budget-anxious, data-driven" />
        </div>

        <div>
          <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Known objections (comma-separated)</Label>
          <Input value={knownObjections} onChange={(e) => setKnownObjections(e.target.value)} placeholder="e.g. NAF-objection, tried-it-before, too-expensive" />
        </div>

        <div>
          <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Voice notes</Label>
          <Textarea value={voiceNotes} onChange={(e) => setVoiceNotes(e.target.value)} rows={2} placeholder="How should the AI actually talk? e.g. blunt, short sentences, interrupts when frustrated." />
        </div>

        <section>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Source type</Label>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {([
              { id: "composite" as const, label: "Composite", desc: "Built from patterns, training docs, or general team knowledge — not a specific person." },
              { id: "real_person_modeled" as const, label: "Real-person modeled", desc: "Based on an actual individual's call patterns, objections, or communication style." },
            ]).map((opt) => (
              <button
                key={opt.id} type="button" onClick={() => setSourceType(opt.id)}
                className={`rounded-lg border p-3 text-left transition-all ${sourceType === opt.id ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border/60 bg-background/40 hover:border-border"}`}
              >
                <div className="text-sm font-semibold">{opt.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{opt.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {sourceType === "real_person_modeled" && (
          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Source reference</Label>
            <Input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder="e.g. Fathom call transcript, 2026-07-10, or manager notes" />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : initial ? "Save changes" : "Create persona"}
          </Button>
        </div>
      </Card>
    </div>
  );
}