import os

root_dir = r"c:\Users\maju\Downloads\stocks-main (2)\stocks-main\server"
for root, dirs, files in os.walk(root_dir):
    for file in files:
        if file.endswith(".js") and "model" in root:
            print(os.path.join(root, file))
