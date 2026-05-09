import { INotebookTracker } from '@jupyterlab/notebook';
import { HITRelayClient } from './relay';

export function registerCommTarget(tracker: INotebookTracker, relay: HITRelayClient) {
  tracker.currentChanged.connect((_, panel) => {
    if (!panel) return;
    
    panel.sessionContext.kernelChanged.connect((_, args) => {
      const kernel = args.newValue;
      if (kernel) {
        kernel.requestExecute({ code: '%load_ext hit_jupyterlab_extension.kernel_extension', silent: true });
        kernel.registerCommTarget('hit_protocol', (comm, msg) => {
          comm.onMsg = (msg: any) => {
            const data = msg.content.data;
            if (data && data.nodes) {
              for (const node of data.nodes) {
                relay.sendStatePatch(node);
              }
            }
          };
        });
      }
    });

    // Also register on current kernel if it exists
    const kernel = panel.sessionContext.session?.kernel;
    if (kernel) {
        kernel.requestExecute({ code: '%load_ext hit_jupyterlab_extension.kernel_extension', silent: true });
      kernel.registerCommTarget('hit_protocol', (comm, msg) => {
        comm.onMsg = (msg: any) => {
          const data = msg.content.data;
          if (data && data.nodes) {
            for (const node of data.nodes) {
              relay.sendStatePatch(node);
            }
          }
        };
      });
    }
  });
}
