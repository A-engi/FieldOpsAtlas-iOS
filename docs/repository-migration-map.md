# Repository Migration Map

No file moves are performed in this pull request.

The audit identified legacy, duplicate-looking and unreferenced files, but several are tied to dynamic globals, service-worker cache entries, archived references or anonymised data. Deleting or moving them in the same pass would be higher risk than the current text cleanup and checker work.

## Retained In Place

- `FieldOpsAtlas/Features/Weather/*`: retained while Weather provider pages and Maps weather integration are both validated by the new checker.
- `FieldOpsAtlas/Features/maps/*`: retained because Maps weather, RF paths and pane modules are dynamically loaded through page globals.
- `FieldOpsAtlas/Features/RF/archive/*` and `archive/*`: retained as archive material until a separate archive deletion decision is made.
- `data/regions/*`: retained because these are anonymised site records and should not be altered in this cleanup.
- `data/rf/wenvoe/dtt-details.json`: retained because its IDs and file path are active RF data references.
- `shell.html` and `offline-shell-menu.html`: retained as development-only shell references.

## Deferred Candidates

- Empty placeholder files and duplicate `.gitkeep` equivalents can be removed after confirming no tooling depends on those paths.
- Archived RF scripts can be deleted in a dedicated archive-removal PR.
- Weather and Maps weather modules can be merged only after production ownership is decided.
