# RF Legacy Shell Archive

This folder stores the old RF-local shell files after the shared root shell was introduced.

## Archived files

- `legacy-shell.css`  
  Former path: `FieldOpsAtlas/Features/RF/shell.css`

- `legacy-shell.js`  
  Former path: `FieldOpsAtlas/Features/RF/shell.js`

## Why archived

RF now uses the shared root shell:

```html
<link rel="stylesheet" href="../../../shell.css">
<script src="../../../shell.js" defer></script>
```

RF page-specific canvas/background styling should live in:

```html
<link rel="stylesheet" href="./rf-canvas.css">
```

RF content styling should stay in:

```html
<link rel="stylesheet" href="./rf.css">
```

## Do not load these archived files

These files are rollback/reference only.

They should not be linked by RF pages after the shared shell integration is complete.
