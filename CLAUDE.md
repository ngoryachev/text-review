# text-review — project rules

## Always publish right away

GitHub Pages for this repo serves the `develop` branch from `/`
(https://ngoryachev.github.io/text-review/). After **any** change, without
being asked, finish the task by publishing:

1. Sync and rebuild (the UI lives in `index.html`; the Go binary embeds a copy):
   ```bash
   cp index.html golang/index.html
   (cd golang && CGO_ENABLED=0 go build -ldflags "-s -w" -o text-review .)
   cp golang/text-review skill/text-review
   ```
2. Commit everything and push to `develop`.
3. Verify the live page serves the new version (poll the Pages URL for a
   string that only the new build contains, e.g. a new element id).

## Pushing: use the `ngoryachev` GitHub account

`gh` has two accounts; the active one (`nickzutobicom`) has no push access to
`ngoryachev/text-review`. Do not switch the global account — push with the
owner's token for that one command:

```bash
git -c credential.helper= \
  -c 'credential.helper=!f(){ echo username=ngoryachev; echo "password=$(gh auth token --user ngoryachev)"; }; f' \
  push origin develop
```
