import os
from dotenv import load_dotenv
load_dotenv()
from neuprint import Client

c = Client("neuprint.janelia.org", dataset="male-cns:v1.0",
           token=os.environ["NEUPRINT_APPLICATION_CREDENTIALS"])

print("=== mushroom body cell classes ===")
df = c.fetch_custom("""
    MATCH (n:Neuron)
    WHERE n.type STARTS WITH 'KC' OR n.type STARTS WITH 'MBON'
       OR n.type STARTS WITH 'PPL1' OR n.type STARTS WITH 'PAM'
    RETURN
      CASE
        WHEN n.type STARTS WITH 'KC'   THEN 'KC (Kenyon cells)'
        WHEN n.type STARTS WITH 'MBON' THEN 'MBON (output)'
        ELSE 'DAN (dopamine)'
      END AS grp,
      count(*) AS n
    ORDER BY n DESC
""")
print(df.to_string(index=False))
print(f"\ntotal: {df['n'].sum()} neurons")
