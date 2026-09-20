"""Pull ER (landmark input) and PFL3 (steering) plus their coupling to the core
compass, into data/compass_plus.json. Additive: the core 6 types are unchanged.

ER  = ring neurons, the fly's real visual-landmark input to EPG.
PFL3 = the fly's real steering output (compares heading to goal -> turn).
"""
import json, os
from dotenv import load_dotenv
load_dotenv()
from neuprint import Client

c = Client("neuprint.janelia.org", dataset="male-cns:v1.0",
           token=os.environ["NEUPRINT_APPLICATION_CREDENTIALS"])

core = json.load(open("data/compass.json"))
core_types = sorted({n["type"] for n in core["nodes"]})
print("core types:", core_types)

# nodes: core + all ER* + PFL3
nodes = c.fetch_custom("""
  MATCH (n:Neuron)
  WHERE n.type IN ['EPG','Delta7','PEN_a(PEN1)','PEN_b(PEN2)','PEG','EL']
     OR n.type STARTS WITH 'ER' OR n.type = 'PFL3'
  RETURN n.bodyId AS bodyId, n.type AS type, n.instance AS instance,
         n.somaSide AS side, n.predictedNt AS nt, n.consensusNt AS nt2,
         n.pre AS pre, n.post AS post
""")
nodes["nt"] = nodes["nt"].fillna(nodes["nt2"]); nodes = nodes.drop(columns=["nt2"])
ids = set(nodes["bodyId"])

edges = c.fetch_custom("""
  MATCH (a:Neuron)-[w:ConnectsTo]->(b:Neuron)
  WHERE (a.type IN ['EPG','Delta7','PEN_a(PEN1)','PEN_b(PEN2)','PEG','EL']
         OR a.type STARTS WITH 'ER' OR a.type = 'PFL3')
    AND (b.type IN ['EPG','Delta7','PEN_a(PEN1)','PEN_b(PEN2)','PEG','EL']
         OR b.type STARTS WITH 'ER' OR b.type = 'PFL3')
  RETURN a.bodyId AS source, b.bodyId AS target, w.weight AS weight
""")

out = {"nodes": nodes.to_dict("records"), "edges": edges.to_dict("records")}
json.dump(out, open("data/compass_plus.json", "w"))
from collections import Counter
print("nodes:", len(nodes), dict(Counter(n[:4] for n in nodes["type"])))
print("edges:", len(edges))
print("wrote data/compass_plus.json")
