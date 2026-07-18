import json
from pathlib import Path
from collections import Counter

analysis = json.loads(Path('.graphify_analysis.json').read_text())
extraction = json.loads(Path('.graphify_extract.json').read_text())

# Map node id to label/source file
node_info = {}
for n in extraction.get('nodes', []):
    node_info[n['id']] = {
        'label': n.get('label', ''),
        'file': n.get('source_file', '')
    }

communities = analysis['communities']
labels = {}

for cid, node_ids in communities.items():
    # Gather files and labels in this community
    files = []
    node_labels = []
    for nid in node_ids:
        info = node_info.get(nid)
        if info:
            if info['file']:
                files.append(Path(info['file']).name)
            if info['label']:
                node_labels.append(info['label'])
    
    # Generate simple label based on most common file or label
    if node_labels:
        most_common_label = Counter(node_labels).most_common(1)[0][0]
        if len(most_common_label) > 30:
            most_common_label = most_common_label[:27] + "..."
        labels[cid] = f"Module: {most_common_label}"
    elif files:
        most_common_file = Counter(files).most_common(1)[0][0]
        labels[cid] = f"File: {most_common_file}"
    else:
        labels[cid] = f"Community {cid}"

# Save to graphify-out/labels.json
Path('graphify-out/labels.json').write_text(json.dumps(labels, indent=2))

# Regenerate report with labels
from graphify.build import build_from_json
from graphify.cluster import score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate

G = build_from_json(extraction)
communities_typed = {int(k): v for k, v in communities.items()}
cohesion = score_all(G, communities_typed)
gods = god_nodes(G)
surprises = surprising_connections(G, communities_typed)
labels_typed = {int(k): v for k, v in labels.items()}
questions = suggest_questions(G, communities_typed, labels_typed)

# Read detect from UTF-16
content = open('.graphify_detect.json', 'rb').read().decode('utf-16')
detection = json.loads(content)

tokens = {'input': extraction.get('input_tokens', 0), 'output': extraction.get('output_tokens', 0)}
report = generate(G, communities_typed, cohesion, labels_typed, gods, surprises, detection, tokens, '.', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report, encoding='utf-8')
print("Community labeling and report regeneration completed successfully.")
