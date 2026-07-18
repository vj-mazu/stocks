import re

file_path = r"c:\Users\maju\Downloads\stocks-main (2)\stocks-main\server\routes\arrivals.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# search for "placeStatus" or "arrivals" returned from arrivals get route
pos = content.find("router.get('/',")
if pos != -1:
    print(content[pos:pos+2000])
