import os

with open("src/cellManager.ts", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("  public getCellsState(): any[] {", "  }\n\n  public getCellsState(): any[] {")

with open("src/cellManager.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("Done fix cellManager.ts")
