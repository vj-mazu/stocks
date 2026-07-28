import os

root_dir = r"c:\Users\maju\Downloads\stocks-main (2)\stocks-main\server"
for root, dirs, files in os.walk(root_dir):
    for file in files:
        if file.endswith(".js"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                if "getArrivalsWithPagination" in content:
                    print(f"Found in {path}")
