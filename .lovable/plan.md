# HubCoach — v1 Plan (Core Loop)

A voice-driven HubSpot sales roleplay coach for SmartBug consultants. v1 focuses on the core loop: configure a simulation, run a live voice call against an AI prospect, and get a scored post-game report. No auth, no Supabase, no leaderboard yet — those come in v2 once the loop feels right.

## Screens

**1. Launch Simulation (`/`)**
- Hero: "HubCoach — Roleplay HubSpot calls with an AI prospect"
- Quiz Topics textarea: "Quiz me on… (e.g. AEO Brand Visibility Dashboard, Breeze Prospecting Agents)"
- Difficulty selector: Easy / Realistic / Hard
- Persona selector: Skeptical CFO, Busy Marketing Manager, Curious RevOps Lead, Technical Admin
- Call type: Discovery / Service
- "Start Call" button → navigates to `/call`

**2. Live Call (`/call`)**
- Centered pulsing audio visualizer (animates with mic input volume + AI speaking state)
- Status pill: Listening / Thinking / Speaking
- Persona card (top-left): name, role, mood
- Live scrolling transcript panel (right side on desktop, below on mobile)
- Controls: Mute mic, Push-to-talk toggle, End Call
- End Call → navigates to `/report`

**3. Post-Game Report (`/report`)**
- Three score cards (0–100): Sales Strategy, Technical Delivery, Consultant Confidence
- Overall grade + one-line summary
- "Corrective Feedback" section: bulleted, specific (e.g. "You mentioned AEO citations but didn't explain CRM-powered prompt suggestions")
- "What you nailed" section
- Full transcript (collapsible)
- Buttons: Run again (same setup) · New simulation

## Voice & Real-Time

- **Speech-to-Text**: Web Speech API (`SpeechRecognition`), continuous mode with interim results feeding the live transcript.
- **Text-to-Speech**: Browser `SpeechSynthesis` for v1 (zero setup, works immediately). Pick the best available en-US voice. Plan to upgrade to a higher-quality TTS via edge function later — UI is wired so the swap is one function.
- **Turn-taking**: When user pauses ~1.2s, finalize their turn → send to AI → speak response. Mic auto-pauses while AI speaks to avoid feedback.
- **Audio visualizer**: Web Audio API `AnalyserNode` on mic stream; pulse amplitude follows RMS volume. While AI speaks, drive pulse from a synthetic envelope.

## AI Prospect (Edge Function: `chat`)

- Streaming chat via Lovable AI Gateway, model `google/gemini-3-flash-preview`.
- System prompt assembled from: persona + difficulty + quiz topics + call type + concise-conversation rules (1–3 sentences, stay in character, never break the fourth wall, push back proportionally to difficulty, ask probing questions about the listed topics).
- Full conversation history sent each turn.
- Streams tokens back so AI can start speaking the first sentence as soon as it lands.

## Evaluation (Edge Function: `evaluate`)

- Non-streaming call to Lovable AI with `tool_choice` forcing structured output.
- Input: full transcript + original quiz topics + persona + difficulty.
- Output schema:
  ```
  {
    sales_strategy: { score: 0-100, notes: string },
    technical_delivery: { score: 0-100, notes: string,
      topics_covered: string[], topics_missed: string[] },
    consultant_confidence: { score: 0-100, notes: string,
      filler_words: string[], pacing: "slow|good|rushed" },
    corrective_feedback: string[],   // 3–6 specific items
    wins: string[],                  // 2–4 items
    summary: string
  }
  ```
- "Consultant Confidence" is computed from transcript signals (filler words, sentence length, hedging) — fair caveat shown in UI since we're not analyzing raw audio in v1.

## State

- Simulation config + transcript + report held in a Zustand store (or React context) — survives navigation between `/call` and `/report`. No DB.

## Design

- Palette (HSL tokens in `index.css`):
  - Deep Navy bg `222 47% 11%`, surface `222 40% 16%`
  - Vibrant Orange primary `22 95% 55%`
  - Slate Gray muted `215 16% 65%`, border `217 25% 25%`
  - Foreground `210 40% 98%`
- Typography: Inter, tight tracking on headings.
- Vibe: Consultant Mode — dark, focused, generous whitespace, soft glow on the active visualizer, subtle orange accents on CTAs and active states.

## Out of scope for v1 (queued for v2)
- Supabase persistence of sessions
- Auth + Team Mastery leaderboard
- Live web search of help.hubspot.com (Tavily/Firecrawl) — relying on model knowledge for now
- Premium TTS (ElevenLabs/OpenAI) via edge function

## Technical notes
- Lovable Cloud enabled for the two edge functions (`chat`, `evaluate`).
- Web Speech API is Chromium-only in practice; show a friendly fallback message on unsupported browsers (e.g. Firefox) with a text-input mode so the call still works typed.
- All AI calls go through edge functions; no API keys in the client.
