# AI Call Coach Roleplay

A voice-first roleplay coach for sales and client-success teams. The app plays the
prospect or client, holds a live conversation with the rep, then grades the call and
suggests what to do differently next time.

## What it does

1. **Setup**
   - Pick a practice area, a call type (sales discovery, service / onboarding, tough
     conversation), a difficulty (easy / realistic / hard), and a length.
   - Optionally type the topics you want drilled; the AI uses them to steer the call.
   - Your name and email are remembered from the last run so repeat sessions start faster.

2. **The AI prospect**
   - The AI stays in character as the persona you selected and pushes back at the level
     you asked for.
   - Turns are short and conversational (1–3 sentences), like a real call.

3. **Live call**
   - Talk with the Web Speech API for speech-to-text, or type your reply instead.
   - The AI answers out loud with text-to-speech.
   - A live transcript scrolls as the conversation goes, and typed replies are marked as
     typed so you can tell them apart from spoken ones.
   - Copy and paste are disabled inside a live call so answers stay your own; the rest of
     the app behaves normally.

4. **Evaluation**
   - When the call ends, the transcript is scored 0–100 against a rubric:
     - **Sales Strategy** — did you lead the call and handle objections?
     - **Technical Delivery** — did you explain the requested topics accurately?
     - **Consultant Confidence** — pacing, filler words, and tone.
   - The post-call report gives specific corrective feedback and links to other
     roleplays in the same practice area and call type.

5. **Persistence and admin**
   - Sessions, transcripts, and scores are stored in the backend (Lovable Cloud).
   - An admin area holds the scenario and persona library, a session log, and a team
     leaderboard with a trend chart of roleplays over time.

## Practice areas

| Code           | Label            |
| -------------- | ---------------- |
| `hubspot`      | CRM & Marketing  |
| `paid_media`   | Paid Media       |
| `digital_build`| Digital Build    |

## Stack

React 18, Vite 5, TypeScript 5, Tailwind CSS v3, shadcn/ui, and Lovable Cloud for the
database, auth, and edge functions (chat, speech, scoring).

## Configuration

Copy `.env.example` to `.env` and fill in the values your backend provides. The client
only ever reads the publishable key; server-side keys stay in the project's runtime
environment.

## Development

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

This project was built with [Lovable](https://lovable.dev).
