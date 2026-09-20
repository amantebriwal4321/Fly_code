"""Confirm the neuPrint token works. Run this tonight, and again at the venue."""

import os

from dotenv import load_dotenv

load_dotenv()

token = os.environ.get("NEUPRINT_APPLICATION_CREDENTIALS", "").strip()
if not token:
    raise SystemExit("Token missing. Paste it into .env (NEUPRINT_APPLICATION_CREDENTIALS=\"eyJ...\")")

print(f"token: set ({len(token)} chars)")  # never print the value itself

from neuprint import Client

c = Client("neuprint.janelia.org", dataset="male-cns:v1.0", token=token)
print("dataset version:", c.fetch_version())

df = c.fetch_custom("""
    MATCH (n:Neuron)
    WHERE n.type STARTS WITH 'EPG'
    RETURN n.bodyId AS bodyId, n.type AS type, n.pre AS pre, n.post AS post
    ORDER BY n.pre + n.post DESC
""")
print(f"\nE-PG compass neurons found: {len(df)}")
print(df.head(10).to_string(index=False))
