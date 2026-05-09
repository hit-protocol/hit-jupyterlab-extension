"""
jpy_ext.py — HIT IPython Extension v3 (Jupyter Comms)
"""

class HITManager:
    def __init__(self, shell):
        self.shell = shell
        
    def sync(self):
        # Concise state: only names and types to save Agent tokens
        nodes = [{"uid": f"jupyter.var.{k}", "role": "view", "state": {"status": "idle", "value": k}, "metadata": {"type": type(v).__name__}, "intent": {"domain": "general", "action": "inspect", "object": "variable"}} 
                 for k, v in self.shell.user_ns.items() if not k.startswith('_')]
        
        # Add root node for completeness
        root = {
            "uid": "jupyter.kernel.root",
            "role": "container",
            "hierarchy": {"children": [n["uid"] for n in nodes]}
        }
        
        # Send state over Jupyter Comm channel instead of websocket
        try:
            from ipykernel.comm import Comm
            comm = Comm(target_name='hit_protocol', data={'nodes': [root] + nodes})
            comm.close()
        except Exception as e:
            print(f"[HIT] Comm sync error: {e}")

def load_ipython_extension(ipython):
    mgr = HITManager(ipython)
    
    def post_execute(result):
        mgr.sync()
        
    ipython.events.register('post_run_cell', post_execute)
    print("HIT Protocol v3.0 [Comm Channel Enabled] Loaded.")