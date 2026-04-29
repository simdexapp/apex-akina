# Apex Akina — 300-task plan to bring the game to life

10 batches × 30 tasks each. Tasks already shipped marked `[done]`. Each line
is meant to be a single PR-sized change. Order inside a batch is rough
priority; batches themselves are roughly the order you'd execute them.

---

## Batch 1 — Driving physics rebuild (1–30)

1. Rip the arclength-based player movement; integrate position from velocity vector
2. Implement Ackermann steering geometry (front wheels turn at correct angles)
3. Tire slip ratio model (longitudinal grip falls off after peak)
4. Tire slip angle model (lateral grip curve)
5. Pacejka magic-formula approximation for tire forces
6. Longitudinal load transfer (real physics, not a multiplier)
7. Lateral load transfer (corner weight shifts)
8. Open differential default
9. LSD (limited-slip differential) car option
10. Real engine torque curve from RPM
11. Per-car gear ratios driving wheel speed
12. Aero downforce scaling with v² (front + rear independent)
13. Aero drag verified against actual top speeds
14. Tire wear over lap distance (grip falloff)
15. Tire heat model: cold / optimal / overheating
16. ABS toggle in settings
17. Traction control toggle
18. Stability control toggle
19. Manual transmission option (clutch input)
20. Clutch slip simulation
21. Handbrake input + lock-up
22. Counter-steer assist toggle (driver-assist option)
23. Authentic trail-braking curve
24. Per-surface friction (asphalt / kerb / grass / dirt / wet)
25. Off-track speed loss (mud drag)
26. Light / medium / heavy crash damage tiers
27. Damage affects handling (loose suspension, blown engine)
28. Auto-respawn at last checkpoint after wreck
29. Anti-roll bar tuning per car
30. Spring + damper tuning per car

---

## Batch 2 — Car visuals + asset pipeline (31–60)

31. Source 5 royalty-free GLTF JDM-style car models
32. GLTF loader pipeline with caching layer
33. Glossy / matte / chrome material variants per car
34. Swappable wheel meshes (rim catalog)
35. Visible brake rotor + caliper meshes
36. Brake glow shader on hot brakes
37. Tire wear darkens texture over a lap
38. Tire smoke particles when sliding
39. Wheel rotation synced to actual speed
40. Front wheels visibly turn with steer input
41. Suspension travel visible on bumps
42. Body roll mesh tilt into corners
43. Brake-light emissive glow on input
44. Reverse light glow on reverse
45. Turn signals on directional input
46. Headlight cone projection at night (SpotLight)
47. Underglow as a livery option
48. Window stickers as livery extra
49. Vinyl wraps with multiple layers
50. Dirt accumulation on body over distance
51. Visible fuel cap detail
52. License plate (player handle on it)
53. Driver model in cabin (head + torso)
54. Helmet model + visor
55. Hands on steering wheel
56. Steering wheel mesh rotates with input
57. Dash cluster visible from cockpit cam
58. Side mirror live reflections
59. Damage decals on collisions (scratches, dents)
60. Paint-chip texture on heavy hits

---

## Batch 3 — Track environments (61–90)

61. Akina Pass — proper 3D mountain pass
62. Wangan — coastal expressway with elevation
63. Daikoku PA — meetup parking area (free roam zone)
64. Touge night — twisty mountain stage at night
65. Bayshore — high-speed coastal sweepers
66. Drift loop — purpose-built skidpad
67. Indoor karting circuit
68. Hill climb (uphill, point-to-point)
69. Downhill rally stage (gravel)
70. Snow stage
71. Per-track horizon billboards (mountains, city)
72. Instanced trees with LOD
73. Buildings for urban tracks
74. Streetlights with point lights
75. Pedestrian silhouettes (low-poly background)
76. Traffic cones at corner entries
77. Tire walls at runoff
78. Armco steel barriers
79. Concrete walls in tunnels
80. Tunnel sections with sodium lights
81. Bridge overpasses
82. Distant train crossing animation
83. Billboards / sponsor signs
84. Trackside spectator silhouettes
85. Pit lane entry / exit (geometry)
86. Pit garage interiors
87. Start / finish gantry with banner
88. Sector marker boards on track
89. DRS zones (highway-only)
90. Per-track weather variants confirmed

---

## Batch 4 — AI + opponents (91–120)

91. Offline-baked racing line per track
92. Brake markers along the line
93. Apex markers along the line
94. AI follows the line + reacts to player + others
95. 8 AI personality archetypes
96. Per-personality mistake patterns
97. Recurring nemesis tracking ("Rina has beaten you 3x")
98. Adaptive difficulty matchmaking
99. Boss intro cinematic per championship boss
100. Boss-specific signature pass moves
101. AI radio chatter (speech bubbles)
102. AI taunts after passing player
103. AI pit-stop logic (multi-lap races)
104. AI blue-flag awareness when lapped
105. AI yellow-flag caution behavior
106. Safety car periods after big crashes
107. Standing start option
108. Formation lap before standing start
109. Qualifying mode (single best lap sets grid)
110. Race weekend (FP → Quali → Race)
111. AI strategy state (1-stop vs 2-stop)
112. AI tire compound selection
113. AI fuel management
114. AI weather adaptation (rain pace drop)
115. Tunable rubber-band rate
116. Chain-reaction crashes from AI mistakes
117. AI gives way visibly when blue-flagged
118. AI defend-attack-cooldown FSM
119. AI overtaking variety (inside / outside / late dive)
120. AI engineer voiceover (you have the pace, etc.)

---

## Batch 5 — Audio rebuild (121–150)

121. License 8 royalty-free synthwave / Eurobeat tracks
122. Music engine with crossfade between tracks
123. Per-track BGM playlist
124. Dynamic intensity layers (calm / intense stems)
125. Crowd ambience for stadium tracks
126. Wind noise scales with speed
127. Tunnel reverb effect (convolution or simulated)
128. Sample-stitched engine sound (real recordings)
129. Per-car engine tone (I4, I6, V8, rotary)
130. Exhaust pop / burble on lift
131. Backfire flame + sound on overrev
132. Turbo whine layer
133. Wastegate flutter on shift
134. Continuous tire scrub (not just screech)
135. Surface-change audio (kerb rumble, grass swish)
136. Varied crash impact samples
137. Bodywork creak when damaged
138. Brake squeal at low speed
139. Handbrake ratchet sound
140. Mechanical gearshift clack
141. Pit limiter beeping
142. Ambient announcer voice for race start
143. Lap-counter announcer ("Lap 2 of 5")
144. Final-lap warning audio
145. Position-change ding
146. New best lap chime
147. Crash warning siren on big incident
148. Headphone surround spatialization
149. Master / music / SFX volume sliders [done]
150. Voice mute toggle

---

## Batch 6 — UI / UX (151–180)

151. Main menu redesign — single big PLAY button
152. Cohesive type system (one display + one body font)
153. Cohesive color tokens documented
154. Loading screens with tips
155. Splash logo animation
156. Mode selector card layout polish
157. Track preview thumbnails (rendered)
158. Car preview with rotating 3D [done]
159. Pre-race cinematic camera fly-around [done]
160. Countdown 3-2-1-Go visual [done]
161. Start lights gantry [done]
162. HUD: speedometer polish [done]
163. HUD: tachometer with redline
164. HUD: gear indicator [done]
165. HUD: lap timer + delta [done]
166. HUD: position indicator [done]
167. HUD: minimap with rivals
168. HUD: damage indicator
169. HUD: tire wear / temp gauges
170. HUD: fuel gauge
171. Pause menu — resume / restart / exit [done]
172. Pause hints (controls reminder)
173. Settings: graphics presets [done]
174. Settings: audio sliders [done]
175. Settings: control rebinds
176. Settings: HUD toggles [done]
177. Settings: difficulty selector [done]
178. Settings: assists (ABS / TC / SC)
179. Achievements panel [done]
180. Garage walk-around mode

---

## Batch 7 — Game modes + progression (181–210)

181. Quick Race [done]
182. Time Trial with ghost [done]
183. Hotlap mode [done]
184. Career mode — 5 championships [3 done]
185. Championship intro cinematic [done]
186. Round-by-round standings table [done]
187. Drivers' championship + teams' championship
188. Career progression unlocks (cars, liveries)
189. Endurance mode [done]
190. Drift Trial scoring refinement [done]
191. Touge 1v1 battle (follow rules)
192. Monthly time-attack events
193. Daily challenges [done]
194. Weekly challenges
195. Free roam in Daikoku PA
196. Photo mode polish [done]
197. Replay with playback controls [done]
198. Replay cinematic auto-camera
199. Driving school tutorials
200. License tests (B / A / S progression)
201. Garage car-swap workflow
202. Livery editor — basic body / stripe / accent
203. Livery editor — advanced decals + layers
204. Livery sharing via code
205. Multiple career save slots
206. New Game Plus mode
207. Cheevos: 50 unique milestones [partially done]
208. Lifetime stats tracking [done]
209. Profile portrait + bio
210. Player XP / level system [done — Skill Rating]

---

## Batch 8 — Multiplayer + online (211–240)

211. Cloudflare Worker leaderboard backend [done]
212. Per-track + per-car boards [done]
213. Daily / weekly / monthly board resets
214. Friend leaderboards
215. Ghost car of #1 worldwide
216. Ghost downloads from leaderboard
217. Ghost upload on personal best
218. Live online race (WebRTC P2P or relay)
219. Lobby system
220. Matchmaking queue
221. Skill-based matchmaking
222. Sync engine with rollback
223. Lag compensation
224. Spectator mode
225. Voice chat (push-to-talk)
226. Text chat (filtered)
227. Friends list
228. Block / report system
229. Anti-cheat (server replay validation)
230. Race wagers / virtual currency
231. Garage shop (cosmetics only)
232. Cross-platform via Tauri Steam wrapper
233. Leaderboard import / export
234. Discord rich presence
235. Twitch integration overlays
236. Stream-friendly HUD mode
237. Replay sharing via URL hash [done — ghost share]
238. Photo export to social
239. Custom game modes with rules
240. Server browser

---

## Batch 9 — Performance + tech (241–270)

241. Profile and document hot paths
242. Object pool for particles
243. Object pool for skid marks [done]
244. Frustum culling for distant rivals
245. 3-tier LOD per car (high / mid / low)
246. LOD switching by distance
247. Shadow LOD (close = full, far = simple)
248. Selective shadow casters [done]
249. Half-res bloom [done]
250. Pixel ratio cap [done]
251. PMREM environment map [done]
252. Reduce draw calls via geometry merging
253. Static batching for scenery
254. Instanced kerbs [done]
255. Texture atlas for small assets
256. Compressed textures (KTX2)
257. WebGPU renderer option
258. Worker thread for AI ticks
259. SharedArrayBuffer for ghost data
260. WebAssembly physics module (Rapier)
261. Asset bundling with hashed filenames
262. Code splitting per game mode
263. Service worker for offline play
264. PWA install banner
265. Mobile detection + lighter assets
266. iOS PWA full-screen mode
267. JS bundle target <500 KB
268. Tree-shake unused Three.js modules
269. Lazy-load track scenery
270. Memory profiler integration

---

## Batch 10 — Polish + launch (271–300)

271. Camera shake refinement
272. Per-camera FOV settings (chase / hood / cinema)
273. Pre-race cinematic intro [done]
274. Slow-mo crash camera
275. Photo mode filters (B&W, vintage, sepia)
276. Replay scrubber timeline
277. Photo mode UI polish [done]
278. Particle: rain droplets on windshield
279. Particle: snowflakes
280. Particle: volumetric fog
281. Particle: wheel-kicked dust
282. Particle: spark shower on collisions
283. Particle: tire smoke refinement [done]
284. Particle: cold-start exhaust smoke
285. HDR-quality skyboxes per time of day
286. Sun position by clock time
287. Moon with phases
288. Stars at night [done]
289. Shooting stars rare event
290. Aurora on snow tracks
291. Steam packaging via Tauri
292. Steam achievements integration
293. Steam Workshop for liveries
294. Steam Cloud save sync
295. Steam input remapping (controllers)
296. Steam screenshot hotkey
297. Localization — 8 languages
298. Accessibility: colorblind mode
299. Accessibility: subtitles + captions
300. Accessibility: scalable HUD text

---

## Notes on execution

- **Already done** (rough count): ~25 of 300 ticked. Most are HUD, mode
  scaffolding, achievements, leaderboards, intros — the meta layer.
- **Where the real work is**: Batch 1 (physics rebuild), Batch 2 (real
  car assets), Batch 3 (real track environments), Batch 4 (AI sophistication).
  These four batches alone will move the perceived quality more than the
  other six combined.
- **Suggested execution order if you want fastest visible improvement**:
  Batch 2 → Batch 3 → Batch 1 → Batch 5 → Batch 4 → 6 → 8 → 7 → 9 → 10.
  Players notice models and tracks first, physics second, audio third.
- **Realistic timeline**: solo dev with AI assistance, ~8–12 months.
  With a team of 3, ~3–4 months. Pure solo without AI, 18+ months.
- **Killer 80/20**: Batch 1 first 10 + Batch 2 first 10 + Batch 3 first 5
  + Batch 4 items 91–95 = 30 tasks that capture ~70% of the
  "feels like a real game" gap.
