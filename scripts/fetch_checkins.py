"""Pull your full Swarm/Foursquare check-in history to a local file.

This pages through the Foursquare API v2 ``/users/self/checkins`` endpoint with a
personal OAuth token and writes every check-in to a single JSON file. Load that
file into the app with its "Choose your check-ins file" button.

Getting a token (one-time, ~2 minutes):

1. Create an app at https://foursquare.com/developers/apps ; note its Client ID.
2. Set its "Redirect URI" to something like ``https://localhost/callback``
   (any URL that's yours; it never has to serve a real page).
3. Visit this URL in a browser logged into your Foursquare account, with
   CLIENT_ID and REDIRECT_URI replaced by your own values (REDIRECT_URI
   url-encoded, matching what you registered exactly)::

       https://foursquare.com/oauth2/authenticate?client_id=CLIENT_ID&response_type=token&redirect_uri=REDIRECT_URI

4. Approve; the browser redirects to ``REDIRECT_URI#access_token=XXXX`` (the page
   may fail to load - that's fine). Copy the ``access_token`` value from the
   address bar.

Then::

    export FSQ_TOKEN=XXXX
    python3 scripts/fetch_checkins.py --out checkins.json

Only this script talks to Foursquare; the app itself never calls the API.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests

API = "https://api.foursquare.com/v2/users/self/checkins"
# A dated "version" string is required by the v2 API.
API_VERSION = "20240101"
PAGE_LIMIT = 250


def fetch_all(token: str, sleep: float = 0.25) -> list[dict]:
    """Page through the entire check-in history, newest to oldest.

    Foursquare caps ``offset``-based paging (past a few hundred it starts
    repeating the first page), so instead we walk backwards in time with
    ``beforeTimestamp``: each request asks for the 250 check-ins immediately
    before the oldest one we've seen so far. De-duplication by id covers the
    edge case of multiple check-ins sharing the same second.
    """
    by_id: dict[str, dict] = {}
    before: int | None = None
    total: int | None = None

    while True:
        params = {
            "oauth_token": token,
            "v": API_VERSION,
            "limit": PAGE_LIMIT,
        }
        if before is not None:
            params["beforeTimestamp"] = before

        resp = requests.get(API, params=params, timeout=30)
        if resp.status_code != 200:
            sys.exit(
                f"API error {resp.status_code} "
                f"(beforeTimestamp={before}): {resp.text[:500]}"
            )

        block = resp.json().get("response", {}).get("checkins", {})
        if total is None:
            total = block.get("count")
        items = block.get("items", [])
        if not items:
            break

        oldest = min(int(c["createdAt"]) for c in items)
        new = 0
        for c in items:
            if c["id"] not in by_id:
                by_id[c["id"]] = c
                new += 1

        print(
            f"  {len(by_id)}"
            + (f" / {total}" if total else "")
            + f" check-ins (oldest so far: {oldest})"
        )

        # Nothing new and we're not moving further back -> we're done / stuck.
        if new == 0 and before is not None and oldest >= before - 1:
            break

        # +1 so a check-in exactly at `oldest` is re-requested (then de-duped),
        # which avoids dropping others that share that same second.
        before = oldest + 1
        time.sleep(sleep)

    return sorted(by_id.values(), key=lambda c: int(c["createdAt"]))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        default="checkins.json",
        type=Path,
        help="output file (default: checkins.json)",
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("FSQ_TOKEN"),
        help="Foursquare OAuth token (or set FSQ_TOKEN)",
    )
    args = parser.parse_args()

    if not args.token:
        sys.exit("No token. Pass --token or set FSQ_TOKEN. See this file's header.")

    print("Fetching check-ins from Foursquare...")
    checkins = fetch_all(args.token)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as fh:
        json.dump(checkins, fh, ensure_ascii=False, indent=2)

    print(f"\nWrote {len(checkins)} check-ins to {args.out}")


if __name__ == "__main__":
    main()
