import os
from dotenv import load_dotenv
load_dotenv()
from neuprint import Client

c = Client("neuprint.janelia.org", dataset="male-cns:v1.0",
           token=os.environ["NEUPRINT_APPLICATION_CREDENTIALS"])

print("=== cell types in the ellipsoid body / protocerebral bridge ===")
df = c.fetch_custom("""
    MATCH (n:Neuron)
    WHERE n['EB'] = true OR n['PB'] = true
    RETURN n.type AS type, count(*) AS n
    ORDER BY n DESC
""")
print(df.head(40).to_string(index=False))
print(f"\ntotal distinct types: {len(df)}, total neurons: {df['n'].sum()}")
