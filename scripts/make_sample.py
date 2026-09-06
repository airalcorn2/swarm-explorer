"""Generate a synthetic ``public/checkins.sample.json`` (the "Try the sample
data" dataset shipped with the app).

The output mimics the raw Foursquare API v2 check-in shape so it exercises the
same normalization path as a real export. Deterministic (seeded) so the sample
is stable across runs.
"""

from __future__ import annotations

import json
import random
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "checkins.sample.json"

# (venue name pool, category) per city.
CITIES = [
    {
        "city": "San Francisco", "state": "CA", "country": "United States",
        "cc": "US", "lat": 37.7749, "lng": -122.4194,
    },
    {
        "city": "Oakland", "state": "CA", "country": "United States",
        "cc": "US", "lat": 37.8044, "lng": -122.2712,
    },
    {
        "city": "New York", "state": "NY", "country": "United States",
        "cc": "US", "lat": 40.7128, "lng": -74.0060,
    },
    {
        "city": "Seattle", "state": "WA", "country": "United States",
        "cc": "US", "lat": 47.6062, "lng": -122.3321,
    },
    {
        "city": "Austin", "state": "TX", "country": "United States",
        "cc": "US", "lat": 30.2672, "lng": -97.7431,
    },
    {
        "city": "London", "state": "England", "country": "United Kingdom",
        "cc": "GB", "lat": 51.5074, "lng": -0.1278,
    },
    {
        "city": "Berlin", "state": "Berlin", "country": "Germany",
        "cc": "DE", "lat": 52.5200, "lng": 13.4050,
    },
    {
        "city": "Tokyo", "state": "Tokyo", "country": "Japan",
        "cc": "JP", "lat": 35.6762, "lng": 139.6503,
    },
    {
        "city": "Mexico City", "state": "CDMX", "country": "Mexico",
        "cc": "MX", "lat": 19.4326, "lng": -99.1332,
    },
    {
        "city": "Reykjavik", "state": "Capital Region", "country": "Iceland",
        "cc": "IS", "lat": 64.1466, "lng": -21.9426,
    },
]

CATEGORIES = {
    "Coffee Shop": ["Blue Bottle Coffee", "Ritual Roasters", "Verve Coffee",
                    "Local Grind", "Sightglass"],
    "Bar": ["The Alembic", "Trick Dog", "Zeitgeist", "Bar Basic", "Nightcap"],
    "Park": ["Dolores Park", "Central Park", "Volkspark", "Riverside Green"],
    "Restaurant": ["Nopalito", "Tartine Manufactory", "State Bird Provisions",
                   "Corner Bistro", "House of Prime Rib"],
    "Gym / Fitness Center": ["Fitness SF", "Planet Fitness", "The Pad Climbing"],
    "Airport": ["SFO International", "JFK Terminal 4", "Heathrow T5",
                "Narita Terminal 1"],
    "Museum": ["SFMOMA", "The Met", "Museum Island", "Mori Art Museum"],
    "Grocery Store": ["Bi-Rite Market", "Rainbow Grocery", "Whole Foods"],
    "Bookstore": ["City Lights", "Green Apple Books", "Dog Eared Books"],
    "Movie Theater": ["The Roxie", "Alamo Drafthouse", "AMC Metreon"],
}

SHOUTS = [
    None, None, None, None,
    "great cold brew", "back again", "trivia night", "layover :(",
    "first time here!", "morning ritual", "post-run treat", "date night",
]


def jitter(rng: random.Random, value: float, spread: float = 0.06) -> float:
    return round(value + rng.uniform(-spread, spread), 6)


def main() -> None:
    rng = random.Random(42)

    start = int(datetime(2021, 1, 1, tzinfo=timezone.utc).timestamp())
    end = int(datetime(2024, 6, 30, tzinfo=timezone.utc).timestamp())

    # Weight cities so a couple of "home" cities dominate, like real history.
    weights = [10, 6, 5, 2, 2, 2, 1, 1, 1, 1]

    n = 420
    checkins = []
    for i in range(n):
        city = rng.choices(CITIES, weights=weights, k=1)[0]
        category = rng.choice(list(CATEGORIES))
        venue_name = rng.choice(CATEGORIES[category])
        ts = rng.randint(start, end)

        checkins.append({
            "id": f"sample{i:04d}",
            "createdAt": ts,
            "type": "checkin",
            "timeZoneOffset": -420,
            "shout": rng.choice(SHOUTS),
            "venue": {
                "id": f"venue{abs(hash((venue_name, city['city']))) % 10**8:08d}",
                "name": venue_name,
                "location": {
                    "lat": jitter(rng, city["lat"]),
                    "lng": jitter(rng, city["lng"]),
                    "city": city["city"],
                    "state": city["state"],
                    "country": city["country"],
                    "cc": city["cc"],
                },
                "categories": [{
                    "name": category,
                    "primary": True,
                    "icon": {
                        "prefix": "https://ss3.4sqi.net/img/categories_v2/food/coffeeshop_",
                        "suffix": ".png",
                    },
                }],
            },
        })

    checkins.sort(key=lambda c: c["createdAt"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as fh:
        json.dump(checkins, fh, ensure_ascii=False, indent=2)
    print(f"Wrote {len(checkins)} synthetic check-ins to {OUT}")


if __name__ == "__main__":
    main()
