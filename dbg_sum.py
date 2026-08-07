import io

BASE = 'C:/Users/maju/Downloads/stocks-main/stocks-main/'
with io.open(BASE + 'client/src/pages/ManagerValueApprovals.tsx', 'r', encoding='utf-8', newline='') as f:
    lines = [l.strip() for l in f.read().splitlines()]

start = None
for i, l in enumerate(lines):
    if l.startswith('const buildPendingSummary2'):
        start = i
        break
print('start idx:', start)

if start is not None:
    for i in range(start, start + 65):
        print(i, repr(lines[i]))
