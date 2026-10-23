# AI Call Coach Roleplay

### 🎙️ The Final One-Shot Mega-Prompt: HubCoach

Copy and paste this into Lovable to build the entire infrastructure, including the "Search" capability.

**Build a high-fidelity AI sales coaching app called "HubCoach." The app is designed for SmartBug consultants to roleplay HubSpot discovery and service calls using real-time product data. Use a sleek, professional "Consultant Mode" UI with a Deep Navy, Vibrant Orange, and Slate Gray color palette.**

**Core Logic & Features:**

 1. **Dynamic Simulation Setup:**

   * Create a "Launch Simulation" screen.

   * **User Input:** Provide a text area where the user can type: "Quiz me on [specific HubSpot features or tools]." (e.g., "The new 2026 AEO Brand Visibility Dashboard" or "Breeze Prospecting Agents").

   * **Web-Search Initialization:** Before the call begins, the AI must "research" the topics provided by searching help.hubspot.com and developers.hubspot.com to ensure technical accuracy. (Simulate this using an LLM tool-call or a Perplexity/SearchAPI integration if available, otherwise instruct the LLM to use its latest 2026 training data).

 2. **AI Prospect Persona:**

   * The AI acts as a prospect. Based on the selected difficulty (Easy, Realistic, Hard) and Persona (e.g., Skeptical CFO, Busy Marketing Manager), it should challenge the user's knowledge of the specified tools.

   * The AI must be concisely conversational (1–3 sentences per turn) and stay in character.

 3. **Voice & Real-Time Interface:**

   * Implement a "Live Call" dashboard with a pulsing audio visualizer.

   * Use **Web Speech API** for real-time Speech-to-Text so the user can speak to the AI.

   * Use a high-quality **Text-to-Speech** voice for the AI prospect.

   * Add a "Live Transcript" window that scrolls as the conversation progresses.

 4. **Smart Evaluation Engine:**

   * When the call ends, the AI analyzes the transcript against three specific metrics (0-100):

     * **Sales Strategy Score:** Did they lead the call and handle objections?

     * **Technical Delivery Score:** Did they accurately explain the specific HubSpot features requested at the start?

     * **Consultant Confidence:** Analysis of pacing, filler words, and tone.

   * Display a "Post-Game Report" with specific "Corrective Feedback" (e.g., "You mentioned AEO citations, but forgot to explain how the CRM-powered prompt suggestions work").

 5. **Persistence & Leaderboard:**

   * Connect to **Supabase** to store transcripts, scores, and the specific "Quiz Topics" for every session.

   * Create a "Team Mastery" leaderboard showing who has the highest "Technical Delivery" scores on specific modules like AEO or Breeze AI.

### 🛠️ How the "Web Search" works in Lovable

Since Lovable builds on standard web stacks, the "Search" feature works best if you tell the app to use an API. After the initial build, if you want to make the "Learning" part even stronger, you can add this follow-up instruction to Lovable:

> "Add a backend function that uses a Search API (like Tavily or Serper) to fetch the top 3 results from help.hubspot.com for the user's chosen topic. Feed that text into the AI's system prompt before the call starts so it has the absolute latest 2026 documentation."

>

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f60a57a2-1d63-45d6-b1d6-1d2bd706a738).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
