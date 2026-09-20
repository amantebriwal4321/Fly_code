"""Cache the central-complex ring attractor locally so venue wifi cannot break you."""

import json
import os

from dotenv import load_dotenv

load_dotenv()
from neuprint import Client

c = Client("neuprint.janelia.org", dataset="male-cns:v1.0",
           token=os.environ["NEUPRINT_APPLICATION_CREDENTIALS"])

TYPES = ["EPG", "PEN_a(PEN1)", "PEN_b(PEN2)", "PEG", "Delta7", "EL"]

TYPE_LIST = "[" + ", ".join(f"'{t}'" for t in TYPES) + "]"

nodes = c.fetch_custom(f"""
    MATCH (n:Neuron) WHERE n.type IN {TYPE_LIST}
    RETURN n.bodyId AS bodyId, n.type AS type, n.instance AS instance,
           n.somaSide AS side, n.predictedNt AS nt, n.consensusNt AS nt2,
           n.pre AS pre, n.post AS post
""")

edges = c.fetch_custom(f"""
    MATCH (a:Neuron)-[w:ConnectsTo]->(b:Neuron)
    WHERE a.type IN {TYPE_LIST} AND b.type IN {TYPE_LIST}
    RETURN a.bodyId AS source, b.bodyId AS target, w.weight AS weight
""")

nodes["nt"] = nodes["nt"].fillna(nodes["nt2"])
nodes = nodes.drop(columns=["nt2"])

nodes.to_csv("data/compass_nodes.csv", index=False)
edges.to_csv("data/compass_edges.csv", index=False)
with open("data/compass.json", "w") as f:
    json.dump({"nodes": nodes.to_dict("records"),
               "edges": edges.to_dict("records")}, f)

print(f"neurons: {len(nodes)}   connections: {len(edges)}")
print("\nby type:")
print(nodes.groupby("type").size().to_string())
print("\nneurotransmitters:")
print(nodes["nt"].value_counts(dropna=False).to_string())
print("\nwrote data/compass_nodes.csv, data/compass_edges.csv, data/compass.json")
