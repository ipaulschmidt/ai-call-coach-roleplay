# Stop the AI's own voice from being captured as a user reply

## The bug

In the screenshot, the prospect's first line ("Hi there, glad we could connect today.") shows up as the user's first turn ("hi there glad we could connect today thanks for joining the call"). The mic picked up the AI's TTS playing through the speakers and treated it as the consultant talking.

We already have a guard (`muteSTTRef`) that drops STT events while the AI is speaking. But the Web Speech API buffers audio internally and can emit recognition results **after** we lift the mute — so words spoken during AI playback still leak in as a "user" turn a moment later.

## Fix (frontend only, `src/pages/Call.tsx`)

1. **Track when the AI last finished speaking.** Add `aiSpokeUntilRef` (timestamp). Set it whenever `muteSTTRef` is flipped back to `false` after a TTS turn.
2. **Hard-flush the recognizer after every AI turn.** When the AI finishes speaking, `abort()` the current `SpeechRecognition` instance (not `stop()` — `abort` discards buffered audio and pending results) and let the existing `onend` → auto-restart logic spin up a fresh recognizer. This guarantees no buffered echo is delivered as a "final" result on the next turn.
3. **Drop any final result that arrives within ~600ms of the AI finishing.** Defense in depth for the case where a result fires between `abort()` and the restart. If `Date.now() - aiSpokeUntilRef.current < 600`, clear `finalBuffer` and `interim` and skip `flush()`.
4. **Extend the post-speech buffer slightly** (350ms → 600ms) so the speaker tail has more time to clear before we re-open the mic.
5. **Suppress the very first user-side result during the opening greeting.** On call start the AI greets first; if a final result lands before the user has produced any non-AI mic activity, drop it.

No backend / edge-function changes. No persona or prompt changes. Pure echo-suppression on the client.

## Files touched

- `src/pages/Call.tsx` — add `aiSpokeUntilRef`, abort+restart STT after AI speech, guard `flush()` with the timestamp check, bump tail buffer.
