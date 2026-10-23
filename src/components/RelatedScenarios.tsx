import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type ScenarioRow = {
  id: string;
  name: string;
  persona: string;
  call_type: string;
  difficulty: string;
  duration_minutes: number;
  practice_area: string;
  category: string;
  goal: string | null;
};

const AREA_LABELS: Record<string, string> = {
  hubspot: "CRM & Marketing",
  paid_media: "Paid Media",
  digital_build: "Digital Build",
};

const AREA_CHIP: Record<string, string> = {
  hubspot: "border-primary/40 bg-primary/10 text-primary",
  paid_media: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  digital_build: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
};

// "UNBOUND — Booth walk-up" -> "unbound"
const familyOf = (name: string) =>
  name.split(/[—–:-]/)[0].trim().toLowerCase();

export default function RelatedScenarios({
  practiceArea,
  callType,
  rubric,
  currentName,
  currentId,
}: {
  practiceArea?: string;
  callType?: string;
  rubric?: string;
  currentName?: string | null;
  currentId?: string | null;
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState<ScenarioRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke("get-scenarios-by-category", {
        body: {},
      });
      if (error || cancelled) return;
      const all = (data?.scenarios ?? []) as ScenarioRow[];
      const isBdr = rubric === "business_development";
      const isService = callType === "service" || callType === "tough";

      const matches = all.filter((s) => {
        if (s.id === currentId) return false;
        if (currentName && s.name === currentName) return false;
        if (practiceArea && s.practice_area !== practiceArea) return false;
        if (isBdr) return s.category === "bdr";
        if (s.category === "bdr") return false;
        // AE / service: keep the same kind of call
        return isService ? s.call_type === "service" || s.call_type === "tough" : s.call_type !== "service" && s.call_type !== "tough";
      });

      const family = currentName ? familyOf(currentName) : "";
      matches.sort((a, b) => {
        const af = family && familyOf(a.name) === family ? 0 : 1;
        const bf = family && familyOf(b.name) === family ? 0 : 1;
        return af - bf;
      });

      setItems(matches.slice(0, 4));
    })();
    return () => {
      cancelled = true;
    };
  }, [practiceArea, callType, rubric, currentName, currentId]);

  if (items.length === 0) return null;

  return (
    <section className="mt-12">
      <h2
        className="mb-1 text-xl font-bold tracking-tight"
        style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}
      >
        Other relevant roleplays
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Same brand, same type of call — pick another rep and keep practicing.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((s) => (
          <Card
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/scenario/${s.id}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") navigate(`/scenario/${s.id}`);
            }}
            className="group cursor-pointer border-border/60 bg-card/70 p-4 transition-all hover:border-primary/50 hover:bg-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span
                  className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    AREA_CHIP[s.practice_area] ?? "border-border/60 bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {AREA_LABELS[s.practice_area] ?? s.practice_area}
                </span>
                <div className="mt-2 truncate text-sm font-semibold">{s.name}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {s.persona} · {s.duration_minutes} min
                </div>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
