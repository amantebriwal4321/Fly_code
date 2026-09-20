"""Cache the mushroom body learning circuit. Same shape as extract_compass.py."""

import json
import os

from dotenv import load_dotenv

load_dotenv()
from neuprint import Client

c = Client("neuprint.janelia.org", dataset="male-cns:v1.0",
           token=os.environ["NEUPRINT_APPLICATION_CREDENTIALS"])

MB = ("n.type STARTS WITH 'KC' OR n.type STARTS WITH 'MBON' "
      "OR n.type STARTS WITH 'PPL1' OR n.type STARTS WITH 'PAM'")

print("fetching neurons...")
nodes = c.fetch_custom(f"""
    MATCH (n:Neuron) WHERE {MB}
    RETURN n.bodyId AS bodyId, n.type AS type, n.instance AS instance,
           n.somaSide AS side, n.predictedNt AS nt, n.consensusNt AS nt2,
           n.pre AS pre, n.post AS post
""")
nodes["nt"] = nodes["nt"].fillna(nodes["nt2"])
nodes = nodes.drop(columns=["nt2"])

print("fetching KC->MBON and DAN->MBON edges (the plastic synapses)...")
edges = c.fetch_custom("""
    MATCH (a:Neuron)-[w:ConnectsTo]->(b:Neuron)
    WHERE (a.type STARTS WITH 'KC' OR a.type STARTS WITH 'PPL1'
           OR a.type STARTS WITH 'PAM')
      AND b.type STARTS WITH 'MBON'
      AND w.weight >= 2
    RETURN a.bodyId AS source, b.bodyId AS target, w.weight AS weight
""")

keep = set(edges["source"]) | set(edges["target"])
nodes = nodes[nodes["bodyId"].isin(keep)]

nodes.to_csv("data/mushroom_nodes.csv", index=False)
edges.to_csv("data/mushroom_edges.csv", index=False)
with open("data/mushroom.json", "w") as f:
    json.dump({"nodes": nodes.to_dict("records"),
               "edges": edges.to_dict("records")}, f)

print(f"\nneurons kept: {len(nodes)}   plastic synapses: {len(edges)}")
print("\nby class:")
grp = nodes["type"].str.extract(r"^(KC|MBON|PPL1|PAM)")[0].fillna("other")
print(grp.value_counts().to_string())
print("\nwrote data/mushroom_nodes.csv, data/mushroom_edges.csv, data/mushroom.json")
