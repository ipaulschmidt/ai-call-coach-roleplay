import { supabase } from "@/integrations/supabase/client";
import type { PracticeArea } from "./session";

export interface Persona {
  id: string;
  name: string;
  role: string;
  blurb: string;
  practice_area: PracticeArea;
  gender: "female" | "male" | null;
  avatar_url: string | null;
  personality_traits: string | null;
  known_objections: string | null;
  voice_notes: string | null;
  source_type: "composite" | "real_person_modeled";
  source_reference: string | null;
  brand_context: string | null;
  created_at?: string;
}

export async function fetchPersonas(practiceArea?: PracticeArea): Promise<Persona[]> {
  const { data, error } = await supabase.functions.invoke("get-personas", {
    body: practiceArea ? { practice_area: practiceArea } : {},
  });
  if (error) throw error;
  return (data?.personas ?? []) as Persona[];
}