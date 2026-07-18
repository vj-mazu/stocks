import re

file_path = r"c:\Users\maju\Downloads\stocks-main (2)\stocks-main\client\src\pages\Arrivals.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "placeKunchinittuId" in line or "placeWarehouseId" in line or "placeOutturnId" in line:
        print(f"{i+1}: {line.strip()}")
