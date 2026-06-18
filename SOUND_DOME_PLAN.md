# Sound Dome Wellness Project — Master Plan

**Project:** Sound Temple
**Founder:** Drew
**Date:** May 8, 2026
**Status:** Planning / Pre-prototype

---

## Vision

A new wellness concept rooted in ancient acoustic architecture. Visitors enter individually tuned plaster-and-brick domes, hum or sing to activate the dome's resonant frequency, and experience the physical vibration of standing waves through their body. LED lighting responds to vocal frequency in real time, guiding users toward the resonant sweet spot. The experience is a modern revival of a practice stretching back 40,000+ years — from Paleolithic painted caves to Egyptian sarcophagi to Central Asian mosque domes.

**Tagline concept:** *"The lost ancestor of wellness is your voice."*

---

## Foundational Research Assets (Completed)

| Asset | Status | Location |
|-------|--------|----------|
| Acoustic measurements — India (Varanasi, Rajasthan, Delhi) | Done | `reference_sheet.md` |
| Acoustic measurements — Uzbekistan (Samarkand, Khiva, Bukhara) | Done | `reference_sheet.md` |
| Acoustic measurements — Egypt (King's Chamber) | Done | `reference_sheet.md` |
| Polycam LiDAR scan — Khiva North Star dome | Done | `north_star_rectangles/` (OBJ, STL, USDZ) |
| Voice recordings — dome resonances | Done | `North Pole rectangle 1 G2.m4a` + additional |
| Pitch app frequency readings | Done | Screenshots + reference sheet |
| Orientation / azimuth data for all sites | Done | `reference_sheet.md` |
| Published archaeoacoustic bibliography | Done | `reference_sheet.md` |

---

## Key Frequency Map — Proven Dome Resonances

| Frequency | Note | Source Sites | Dome Concept |
|-----------|------|-------------|--------------|
| ~93 Hz | G-flat-2 | Khiva (North Star dome) | Dome 1 — lowest, largest |
| ~104 Hz | A-flat-2 | Varanasi Surya Temple, Brahmapuri | Dome 2 |
| ~110 Hz | A2 | Varanasi "Ohm" Temple, Paleolithic caves, West Kennet | Dome 3 |
| ~120 Hz | B-flat-2 | King's Chamber, Humayun's Tomb, Gur-e-Amir | Dome 4 |
| ~131 Hz | C3 | To be designed (computed from geometry) | Dome 5 |
| ~147 Hz | D3 | To be designed | Dome 6 |
| ~165 Hz | E3 | To be designed | Dome 7 |

Seven domes. Seven celestial bodies visible to the ancient world: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn.

---

## Workstream 1: Engineering — From Polycam Scan to Construction Drawings

### 1.1 Mesh Processing & Dome Profile Extraction
- Export all Polycam scans as OBJ (primary), STL (3D printing/backup), USDZ (AR presentation)
- Write processing scripts to slice OBJ meshes at regular vertical intervals (every 10cm)
- Extract interior dome profile curve (cross-section) from each scan
- Output: ring diameter at every height increment — this IS the construction spec
- Determine dome type for each scan: hemispherical, pointed, or egg-shaped

### 1.2 Dimensional Specification
- From the Khiva North Star scan: 3.08m (W) x 4.67m (D) x 4.03m (H)
- Document wall thickness, drum height, squinch/pendentive geometry
- Map the relationship between interior dimensions and measured resonant frequency
- Produce dimension tables for each target frequency dome

### 1.3 Computational Acoustic Modeling
- Model each dome geometry using acoustic simulation (COMSOL or open-source equivalent)
- Input: Polycam mesh geometry + material absorption coefficients (lime plaster on brick: ~0.02-0.04)
- Predict resonant modes and compare against Pitch app field recordings
- If model matches field data, use the validated model to design new domes at target frequencies
- If mismatch, adjust material parameters until model matches, then extrapolate

### 1.4 Construction Material Specification
- **Structural:** Fired brick, minimum 200mm wall thickness
- **Interior finish:** Lime plaster, smooth and unbroken (no cracks, no openings — acoustic leakage kills resonance)
- **Floor:** Hard stone or polished concrete (not carpet, not wood)
- **Curing:** 6-8 weeks for lime plaster (acoustic properties change as it cures)
- **Critical constraint:** Interior surface must be continuous and smooth

### 1.5 Prototype Dome — First Build
- Target frequency: 120 Hz (B-flat-2) — most data points across 3 continents
- Location: Rajasthan, India (active traditional dome builders)
- Acoustic verification: Pitch app + professional measurement after construction
- Iterate on wall thickness / curvature if frequency is off-target

---

## Workstream 2: Wellness Experience Design

### 2.1 Entry Ritual
- Remove shoes at entrance
- Wash feet in slightly warm water (mandatory — sets the tone, hygiene, and threshold between outside world and sacred space)
- Clean, minimal reception area — marble or granite tile flooring throughout

### 2.2 Dome Experience
- Individual or shared dome sessions (2-4 people max depending on dome size)
- Session length: 15 minutes default, bookable in 15-minute increments
- Visitors can move between domes to experience different frequencies
- No talking — humming, singing pure tones only
- Staff provides brief orientation on how to find the resonant frequency (hum until the dome "sings back")

### 2.3 LED Frequency-Color Feedback System
- Microphone embedded in dome tracks dominant vocal frequency in real time
- LED strips embedded in dome base (or recessed in walls) map frequency to color
- When visitor hits the resonant frequency, dome fully illuminates — instant feedback
- Off-pitch: color shifts, dims, or pulses to guide user toward resonance
- Color mapping: lower frequencies = warm (reds, oranges), higher = cool (blues, violets)
- User control: full LED guidance mode, dim ambient mode, or complete darkness

### 2.4 Complementary Amenities
- Dry saunas (natural pairing — heat + sound in one visit)
- Stretching / yoga space
- Small gym area (weights, treadmills) — optional, depends on location and positioning
- Rest / cool-down lounge between dome sessions
- Hydration station (water, herbal tea)

### 2.5 Booking & Flow
- Online booking system — reserve specific domes and time slots
- Walk-in availability for off-peak hours
- Membership tiers: per-visit, monthly unlimited, annual
- Session flow: reception -> foot wash -> dome(s) -> sauna (optional) -> rest lounge -> exit

---

## Workstream 3: Location Strategy

### 3.1 Phase 1 — Test Markets (India & Thailand)

**India — Rajasthan (Primary)**
- Proximity to traditional dome-building artisans (Jaipur, Jodhpur)
- Low construction cost (~$2,000-5,000 per dome, ~$50,000-80,000 for full facility)
- Cultural context: ancient spiritual practices, yoga tourism infrastructure already exists
- Target cities: Jaipur, Rishikesh, Goa (tourist-accessible, wellness-adjacent)
- Consider proximity to existing archaeological sites (Brahmapuri, Varanasi corridor)

**Thailand**
- Established wellness tourism market (Chiang Mai, Koh Samui, Bangkok)
- Lower construction cost than Western markets
- Large expat and digital nomad population as early adopters
- Construction method: ferrocement (wire mesh + cement plaster) for faster build — acoustically similar to lime plaster on brick

**Uzbekistan Construction Expertise**
- Option to contract artisans from the Khiva/Samarkand sites to direct construction
- They know the exact building techniques, materials, dimensions
- Fly them to India/Thailand to supervise or consult on the build
- Alternatively: have them specify exact dimensions, materials, and techniques remotely

### 3.2 Phase 2 — Western Markets

**Target cities:** Los Angeles, San Francisco, New York City

- Position as premium wellness experience (higher price point than India/Thailand)
- Licensing model: license Sound Dome technology to existing gym chains / wellness centers
- Or: standalone Sound Temple wellness centers in high-traffic wellness neighborhoods
- NYC precedent: sauna lounges (Bathhouse, Aire Ancient Baths) proving demand for novel body-centric wellness
- LA/SF: meditation, breathwork, and sound bath culture already established — Sound Domes are the physical-architecture version of a "sound bath"
- Differentiator: **no gym has a sound temple** — first mover advantage

### 3.3 Revenue Models
- **Own & operate:** Build and run Sound Temple wellness centers directly
- **License to gyms:** Provide dome construction specs, LED system, and branding to gym partners who install domes in their facilities (recurring licensing fee + equipment sales)
- **Franchise:** Full Sound Temple franchise model with standardized build-out, training, and brand
- **Retreat / destination:** Larger-format destination wellness resort (longer-term play)

---

## Workstream 4: Technology & Product Development

### 4.1 Audio-Visual Feedback System (MVP)
- Microphone: single omnidirectional mic per dome, ceiling-mounted
- Frequency detection: real-time pitch tracking (FFT-based, similar logic to iOS Pitch app)
- LED controller: Arduino/Raspberry Pi driving addressable LED strips
- Color mapping algorithm: frequency-to-hue with brightness proportional to resonance match
- Latency target: <100ms from voice to light change

### 4.2 Mobile App (Phase 2)
- Pre-visit: book dome sessions, learn about frequencies, practice humming target notes
- In-dome: optional guided experience (like a meditation app but for singing)
- Post-visit: track which frequencies you explored, session history
- Educational content: the archaeoacoustic research, the science of resonance

### 4.3 Acoustic Measurement & QA Toolkit
- Standardized protocol for verifying dome resonant frequency after construction
- Pitch app + professional SPL meter + sweep tone generator
- Acceptance criteria: measured resonance within +/- 5 cents of target frequency
- Ongoing monitoring: quarterly acoustic check (plaster curing, settling, humidity can shift resonance)

---

## Workstream 5: Business & Legal

### 5.1 Entity Formation
- Establish company (jurisdiction TBD — India, US, or both)
- Trademark "Sound Temple" / "Sound Dome" in target markets
- Document IP: the dome-frequency design tables, LED feedback system, wellness protocol

### 5.2 Funding
- Phase 1 (India prototype): self-funded or angel round (~$50K-100K)
- Phase 2 (multi-dome facility): seed round (~$300K-500K)
- Phase 3 (Western expansion): Series A or franchise model revenue

### 5.3 Regulatory
- Building permits and occupancy codes per jurisdiction
- Health & wellness facility regulations (India, Thailand, US vary significantly)
- Sound level compliance — verify dome interior levels are within safe exposure limits
- Insurance: general liability, professional liability for wellness services

### 5.4 Team
- Drew: founder, research lead, product vision
- Architect: convert Polycam profiles to construction documents (hire in India)
- Acoustic engineer: validate computational models, verify built domes (consultant)
- Builder/contractor: traditional dome artisans (Rajasthan or Uzbek specialists)
- LED/electronics engineer: audio-visual feedback system (freelance or in-house)
- Operations: facility management, booking, customer experience (hire at launch)

---

## Workstream 6: Research Continuation

### 6.1 Additional Dome Scans
- Scan more Uzbekistan domes (Samarkand, Bukhara) to expand the frequency dataset
- Scan Indian temple interiors (Varanasi, Brahmapuri) if accessible
- Each scan: Polycam LiDAR (OBJ/STL/USDZ) + Pitch app recording + voice memo + compass bearing

### 6.2 Material Testing
- Build test boxes at small scale with different granites and plasters
- Map the relationship: dimension -> material -> resonant frequency
- Determine how precisely dimensions must be controlled to hit target frequency (tests Hypothesis A vs B)

### 6.3 Publication
- Write up findings for archaeoacoustics journal or book chapter
- "The Temple as Instrument" — orientation, shadow, resonance as unified metrological system
- This doubles as marketing material / credibility for the wellness venture

---

## Immediate Next Steps

1. **Process the Khiva North Star OBJ scan** — extract dome profile, generate construction cross-sections
2. **Build acoustic model** of the Khiva dome, validate against the G-flat-2 (~93 Hz) field recording
3. **Design the 120 Hz prototype dome** — reverse-engineer dimensions from the Gur-e-Amir / King's Chamber frequency using the validated acoustic model
4. **Source Rajasthani dome builders** — get quotes for a single prototype dome build
5. **Prototype the LED feedback system** — mic + pitch detection + LED strip on a bench-scale rig
6. **Draft pitch deck** for potential investors or partners

---

*This is a living document. Update as workstreams progress.*
