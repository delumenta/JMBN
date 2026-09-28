# OnTheGo

OnTheGo is a live, in-the-moment travel companion—not a traditional itinerary planner.

It answers:

> “I have spare time. What should I do around here?”

## Current build

- Responsive single-page experience
- Near Me location permission
- OpenStreetMap + Overpass nearby place discovery
- Demo mode for immediate preview
- Surprise me / Places nearby / Find food modes
- Quick wins and Saved filters
- Local saved state
- Dark-mode toggle foundation
- OSM attribution through OpenStreetMap links

## Next integration

The food mode is intentionally separated so it can connect to the Travelite restaurant system:

1. Check Supabase restaurant cache.
2. Reuse fresh Google restaurant rows for 20 days.
3. If fewer than 8 suitable results remain, request one Google batch of 8–10.
4. Refresh only restaurants that have expired.
5. Insert new results into the shared restaurant pool.
6. Use OSM/Photon for coordinates when Google coordinates are unavailable.

## Product principle

OnTheGo should feel useful in ten seconds. The user should not need to create a full itinerary before getting value.
