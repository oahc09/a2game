# Python for local creation and validation

Local validation requires Python 3.10+ and the full Draft 2020-12 validator.
An executable supplied by the trusted host wins over `A2GAME_PYTHON`, then
the checkout's `.venv`, then `python` or `python3` on PATH. A configured
interpreter is not silently replaced when it is broken. The local creator and
agent workflow check setup before starting a provider. Source/package smoke
runs carry the same validated interpreter into the child workspace.

- `A2G_E_PYTHON_UNAVAILABLE`: verify the selected executable and version.
  For example, set `A2GAME_PYTHON` to a trusted absolute executable path on
  the host. Do not add an executable to game JSON, model output or browser input.
- `A2G_E_PYTHON_SCHEMA`: install `requirements-dev.txt` using that same
  Python and repeat the command. The semantic subset is never substituted.

The CLI reports bounded setup guidance, not interpreter paths or raw probe
output. Content-service HTTP failure codes remain unchanged. This does not
establish provider, browser/SDK or historical acceptance readiness.
