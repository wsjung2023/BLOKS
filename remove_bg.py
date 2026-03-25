# /// script
# dependencies = ["rembg[cpu]", "Pillow"]
# ///
import os
from pathlib import Path
from rembg import remove

input_dir = Path(r"D:\Projects\BLOKS-dev\client-assets\sprites-v2\chars")
output_dir = Path(r"D:\Projects\BLOKS-dev\client-assets\sprites-v2\chars-nobg")
output_dir.mkdir(exist_ok=True)

files = [f for f in input_dir.glob("*.png") if not (output_dir / f.name).exists()]
print(f"Processing {len(files)} files...")

for i, f in enumerate(files):
    with open(f, "rb") as inp:
        result = remove(inp.read())
    with open(output_dir / f.name, "wb") as out:
        out.write(result)
    if (i+1) % 10 == 0:
        print(f"  {i+1}/{len(files)} done")

print("Complete!")
