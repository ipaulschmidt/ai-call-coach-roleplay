import margaretVale from "@/assets/personas/margaret-vale.jpg";
import priyaShah from "@/assets/personas/priya-shah.jpg";
import jordanKim from "@/assets/personas/jordan-kim.jpg";
import samReyes from "@/assets/personas/sam-reyes.jpg";
import marcusHale from "@/assets/personas/marcus-hale.jpg";
import brittanyCole from "@/assets/personas/brittany-cole.jpg";
import ethanBrooks from "@/assets/personas/ethan-brooks.jpg";
import hannahReyes from "@/assets/personas/hannah-reyes.jpg";
import laurenPace from "@/assets/personas/lauren-pace.jpg";
import carlaNunez from "@/assets/personas/carla-nunez.jpg";
import miraLiu from "@/assets/personas/mira-liu.jpg";
import aishaBrown from "@/assets/personas/aisha-brown.jpg";
import jenBecker from "@/assets/personas/jen-becker.jpg";
import alexFerris from "@/assets/personas/alex-ferris.jpg";
import caseyOdom from "@/assets/personas/casey-odom.jpg";
import devonRuiz from "@/assets/personas/devon-ruiz.jpg";
import morganCastell from "@/assets/personas/morgan-castell.jpg";
import noraBianchi from "@/assets/personas/nora-bianchi.jpg";
import reeseKwan from "@/assets/personas/reese-kwan.jpg";
import samOkafor from "@/assets/personas/sam-okafor.jpg";
import whitneyCalder from "@/assets/personas/whitney-calder.jpg";

export const PERSONA_AVATARS: Record<string, string> = {
  "skeptical-cfo": margaretVale,
  "busy-marketing": priyaShah,
  "revops": jordanKim,
  "tech-admin": samReyes,
  "office-owner": marcusHale,
  "overwhelmed-owner": brittanyCole,
  "seasoned-marketer": ethanBrooks,
  "marketing-friend": hannahReyes,
  "franchisor-director": laurenPace,
  "ecom-owner": carlaNunez,
  "ai-curious-coo": miraLiu,
  "product-pm": aishaBrown,
  "wp-marketer": jenBecker,
  "guarded-ops-director": alexFerris,
  "distracted-opted-in": caseyOdom,
  "curious-first-timer": devonRuiz,
  "skeptical-comparison-shopper": morganCastell,
  "friendly-busy-marketing-lead": noraBianchi,
  "reads-every-word-on-signage": reeseKwan,
  "ops-minded-evaluator": samOkafor,
  "select-marketing-director": whitneyCalder,
};


export function personaAvatarSrc(id: string, avatarUrl?: string | null): string | undefined {
  return avatarUrl || PERSONA_AVATARS[id] || undefined;
}