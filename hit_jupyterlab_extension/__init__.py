from .server_extension import _load_jupyter_server_extension

def _jupyter_server_extension_points():
    return [{
        "module": "hit_jupyterlab_extension"
    }]

def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": "hit-jupyterlab-extension"
    }]
