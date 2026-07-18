import re

file_path = r"c:\Users\maju\Downloads\stocks-main (2)\stocks-main\client\src\pages\Arrivals.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# find declarations like: const kunchinittus, let kunchinittus, var kunchinittus, function parameters, map parameters, etc.
# We will list all matches of kunchinittus, warehouses, outturns
for name in ["kunchinittus", "warehouses", "outturns"]:
    matches = [m.start() for m in re.finditer(name, content)]
    print(f"--- Matches for {name} ---")
    for pos in matches:
        # get line number
        line_num = content.count("\n", 0, pos) + 1
        line_text = content[pos - 50: pos + 100].replace("\n", " ")
        print(f"Line {line_num}: ... {line_text} ...")
