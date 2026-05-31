import json
from pathlib import Path
from graphify.build import build_from_json
from graphify.wiki import to_wiki

out = Path("graphify-out")

extract_path = out / ".graphify_extract.json"
analysis_path = out / ".graphify_analysis.json"
labels_path = out / ".graphify_labels.json"

if not extract_path.exists():
    raise SystemExit("Arquivo ausente: graphify-out/.graphify_extract.json. Rode `graphify update .` ou gere o grafo antes.")

if not analysis_path.exists():
    raise SystemExit("Arquivo ausente: graphify-out/.graphify_analysis.json. Rode `graphify update .` ou gere o grafo antes.")

extraction = json.loads(extract_path.read_text(encoding="utf-8"))
analysis = json.loads(analysis_path.read_text(encoding="utf-8"))

labels_raw = {}
if labels_path.exists():
    labels_raw = json.loads(labels_path.read_text(encoding="utf-8"))

G = build_from_json(extraction)
communities = {int(k): v for k, v in analysis["communities"].items()}
cohesion = {int(k): v for k, v in analysis.get("cohesion", {}).items()}
labels = {int(k): v for k, v in labels_raw.items()} if labels_raw else None

n = to_wiki(
    G,
    communities,
    "graphify-out/wiki",
    community_labels=labels,
    cohesion=cohesion,
    god_nodes_data=analysis.get("gods", []),
)

print(f"Wiki gerada: {n} artigos em graphify-out/wiki/")