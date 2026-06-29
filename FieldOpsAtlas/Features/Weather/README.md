# FieldOps Atlas Weather

Static Weather pages for FieldOps Atlas Web.

## Purpose

This feature folder includes:

1. RainViewer radar.
2. Open-Meteo site risk.
3. Met Office DataHub Map Images with a user-supplied key and order name.

No internal Atlas operational data belongs here.

Weather site records must be derived only from the anonymised Atlas region datasets.

## Provider notes

### RainViewer

No API key. The app calls:

```text
https://api.rainviewer.com/public/weather-maps.json
```

Then uses returned `host` and `path` values to create Leaflet radar tiles.

RainViewer examples include personal-use limits.

### Open-Meteo

No API key. The app batches visible site coordinates into compact forecast calls.

### Met Office DataHub Map Images

Requires your own DataHub API key and an active Map Images order. The key is typed into the browser session and is not stored in the repo.

The test request uses:

```text
https://data.hub.api.metoffice.gov.uk/map-images/1.0.0/orders/{order}/latest?detail=MINIMAL
```

and then previews the first returned PNG file.

## GitHub Pages

GitHub Pages URL:

```text
https://a-engi.github.io/FieldOpsAtlas-Web/FieldOpsAtlas/Features/Weather/
```

## Files

```text
FieldOpsAtlas/Features/Weather/index.html
FieldOpsAtlas/Features/Weather/styles.css
FieldOpsAtlas/Features/Weather/app.js
FieldOpsAtlas/Features/Weather/data/regions.json
FieldOpsAtlas/Features/Weather/README.md
```

## Safety

Do not commit API keys, access notes, contacts, internal links, ports, IPs, spares locations, configuration notes, job details or fault details.

Do not add separate named-location site fixtures. Weather must use the anonymised Atlas region files.
