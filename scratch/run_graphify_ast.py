import sys
import json
from graphify.extract import collect_files, extract
from pathlib import Path

# Load files from detect output
content = open('.graphify_detect.json', 'rb').read().decode('utf-16')
detect = json.loads(content)

# Filter out scratch directories
code_files = []
for f in detect.get('files', {}).get('code', []):
    p = Path(f)
    if 'scratch' not in p.parts:
        if p.is_dir():
            code_files.extend(collect_files(p))
        else:
            code_files.append(p)

print(f"Total filtered code files: {len(code_files)}")

# Extract AST
if code_files:
    result = extract(code_files)
    Path('.graphify_ast.json').write_text(json.dumps(result, indent=2))
    print(f"AST: {len(result.get('nodes', []))} nodes, {len(result.get('edges', []))} edges")
else:
    Path('.graphify_ast.json').write_text(json.dumps({'nodes':[],'edges':[],'input_tokens':0,'output_tokens':0}))
    print("No code files - skipping AST extraction")
