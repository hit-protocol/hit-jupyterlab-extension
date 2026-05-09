import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { INotebookTracker } from '@jupyterlab/notebook';
import { CellManager } from './cellManager';
import { HITRelayClient } from './relay';
import { registerCommTarget } from './comm';

/**
 * Initialization data for the hit-jupyterlab-extension extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'hit-jupyterlab-extension:plugin',
  description: 'HIT protocol integration for JupyterLab',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('JupyterLab extension hit-jupyterlab-extension is activated!');
    const cellManager = new CellManager(app, tracker);
    const relay = new HITRelayClient(cellManager);
    registerCommTarget(tracker, relay);
    
    tracker.currentChanged.connect(() => {
      setTimeout(() => relay.syncCells(), 1000);
    });
  }
};

export default plugin;
