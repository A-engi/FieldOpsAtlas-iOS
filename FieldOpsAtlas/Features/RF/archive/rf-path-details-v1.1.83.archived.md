# Archived RF path details collapse mechanics

Archived from the RF page during the Snipsnip cleanup.

Source page version before removal: RF v1.1.83
Active replacement version: RF v1.1.84-path-details-visible

Only the old invisible/slide/collapse mechanics are archived here. The visible Path details pane and its content builder remain active in:

- `FieldOpsAtlas/Features/RF/rf-interface.js`
- `FieldOpsAtlas/Features/RF/rf-interface.css`
- `FieldOpsAtlas/Features/RF/rf-path-builder.js`

The removed pieces were the hidden checkbox, the narrow collapse handle, the slide-off CSS, and the graph listeners that only existed to respond to that collapsing pane.

## Removed hidden checkbox template

```html
<input
  class="rf-path-toggle"
  id="rfPathPaneToggle"
  type="checkbox"
  checked
  aria-label="Toggle path details"
>
```

## Removed collapse handle from the path pane shell

```html
<label class="rf-path-handle" for="rfPathPaneToggle" aria-label="Collapse path details">
  <img
    class="rf-path-handle-icon"
    src="../../../data/icons/path-pane-chevron-gold.svg"
    alt=""
    aria-hidden="true"
    loading="lazy"
    decoding="async"
  >
</label>
```

## Removed slide/collapse CSS

```css
.rf-map-paper {
  --path-handle-width: 14px;
}

.rf-map-stage {
  right: calc(var(--path-pane-width) - var(--path-handle-width));
  transition: right 180ms ease;
}

.rf-path-toggle:not(:checked) ~ .rf-map-stage {
  right: var(--path-handle-width);
}

.rf-path-toggle {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  opacity: 0;
  pointer-events: none;
}

.rf-path-toggle:not(:checked) ~ .rf-path-pane {
  transform: translateX(calc(100% - var(--path-handle-width)));
}

.rf-path-handle {
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--path-handle-width);
}

.rf-path-pane-body {
  inset: 0 0 0 var(--path-handle-width);
}
```

## Removed graph collapse listeners

```js
const paneToggle = mapPaper ? mapPaper.querySelector(".rf-path-toggle") : null;
const pathPane = mapPaper ? mapPaper.querySelector(".rf-path-pane") : null;

if (paneToggle) {
  paneToggle.addEventListener("change", () => {
    scheduleRender();
    window.requestAnimationFrame(scheduleRender);
    window.setTimeout(scheduleRender, 220);
  });
}

if (pathPane) {
  pathPane.addEventListener("transitionend", (event) => {
    if (event.propertyName === "transform" || event.propertyName === "right") {
      scheduleRender();
    }
  });
}
```

<!-- End of FieldOpsAtlas/Features/RF/archive/rf-path-details-v1.1.83.archived.md | bottom/end of file -->
