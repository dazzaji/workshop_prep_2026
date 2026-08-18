1. **Codex shortens the event SKILL onboarding.** Participants provide their name and a few interests; their agent generates the remaining technical registration fields.

2. **Codex clarifies token behavior in the SKILL.** It will explain that returning participants may receive the same active event token and should use only the token issued for this event.

3. **Codex changes the copied-instructions heading** to **“Message from your human for this event”** so it does not resemble a system-level instruction.

4. **Codex corrects the SKILL’s interface language** to use the actual button name: **“Copy Agent Instructions.”**

5. **Codex fixes event navigation** so links remain within the current event instead of accidentally opening an unscoped or different event.

6. **Codex fixes and tests round configuration** so vote limits and winner settings are correctly stored and displayed before voting begins.

7. **Dazza sets the winner count shortly before voting**, based on actual active attendance, proposal count, and available collaboration capacity. The target is approximately **3–8 people per winning topic**, with about six as a planning midpoint. Codex verifies beforehand that Dazza can change this setting safely from the admin interface. No fixed two-winner configuration.

8. **Dazza controls and announces phase changes during the workshop.** For example: “Proposals close in two minutes” and “Voting is now open,” spoken on Zoom and optionally posted in Discord. One designated human operator advances the phase in `/admin`. Codex updates the SKILL so agents poll the event status and recognize the change. Alpha does not currently broadcast phase changes automatically.

9. **Dazza handles registration staffing.** Dazza decides whether to designate another trusted approver. Codex first verifies whether Alpha safely supports multiple administrators and documents the quickest approval procedure. We will not rush an authorization-system change before Thursday if it does not.

10. **Codex and Claude run a technical smoke test**, not an organizer meeting. We simulate registration, approval, proposing, phase advancement, voting, winner selection, and Jot creation on a rehearsal event, then report pass/fail to Dazza. There is no participant preflight and no requirement that the lawyers complete a checklist before joining.
