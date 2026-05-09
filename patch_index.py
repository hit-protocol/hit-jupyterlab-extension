import os

with open("src/index.ts", "r", encoding="utf-8") as f:
    content = f.read()

new_activate = """  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('JupyterLab extension hit-jupyterlab-extension is activated!');
    const cellManager = new CellManager(app, tracker);
    const relay = new HITRelayClient(cellManager);
    registerCommTarget(tracker, relay);
    
    tracker.currentChanged.connect(() => {
      setTimeout(() => relay.syncCells(), 1000);
    });
  }"""

content = content.replace("""  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('JupyterLab extension hit-jupyterlab-extension is activated!');
    const cellManager = new CellManager(app, tracker);
    const relay = new HITRelayClient(cellManager);
    registerCommTarget(tracker, relay);
  }""", new_activate)

with open("src/index.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("Done index.ts")
