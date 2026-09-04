# Website delivery

For every user-requested website change in this repository, treat commit, push, GitHub Pages deployment, and live verification as part of the request. This is standing authorization; do not ask again before completing those steps.

- Before editing, fetch `origin` and integrate the latest `origin/main` safely without discarding local work.
- After the change, run checks proportional to the change, including a mobile-width visual check for visual or responsive work.
- Commit all changes made for the request and push them to `origin/main`. Preserve unrelated user changes; never discard or overwrite them.
- GitHub Pages publishes from `main` at `/docs`. Wait for the Pages deployment for the pushed commit to succeed, then verify the affected live URL loads successfully and reflects the change.
- End every completed website-change response with a clickable affected GitHub Pages URL under `https://yaroslavvb.github.io/animated-groups-fable/`.
- Do not report the task complete until the push and live verification are complete. If either fails, keep troubleshooting when safe; otherwise report the exact blocker and current commit.

# Local previews

For preview links, host the current work on the local webserver using the existing Claude/Tailscale setup. Discover this machine's current Tailscale DNS name or IP and provide a verified URL with the server port and page path, so the user can open it from any device on their tailnet. A localhost-only link is insufficient. Reuse `.claude/launch.json` and the existing server when possible; this preference does not replace the GitHub Pages delivery steps above.
