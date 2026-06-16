/* FieldOps Atlas Weather display style v0.1.0
   Destination: FieldOpsAtlas/Features/Weather/weather-display-style.js

   Purpose:
   Shared Weather display constants only. This file is not API configuration.
   It stores visual/weather-layer display choices for RainViewer and Met Office
   screens, including rainfall colours, sampled reference colours, land/sea
   suggestions, frame behaviour, and classification order.
*/

(function initialiseFieldOpsWeatherDisplayStyle(global) {
  "use strict";

  const FIELDOPS_WEATHER_DISPLAY_STYLE = Object.freeze({
    version: "0.1.0",
    updated: "2026-06-16",

    rainViewer: Object.freeze({
      provider: "RainViewer",
      useNativeColours: true,
      repaintRadarPixels: false,
      useAllFrames: true,
      groupFramesHourly: false,
      defaultOpacity: 0.95,
      defaultFrameMode: "observed"
    }),

    metOffice: Object.freeze({
      provider: "Met Office",

      /*
        Display rule:
        - For a standalone Met Office-style raster image, land and sea can be
          painted with the display colours below.
        - For an OSM-backed weather overlay, land and sea should be transparent
          so the base map remains visible and land/sea cannot pollute rainfall
          counts.
      */
      surfaces: Object.freeze({
        landDisplay: "#B3D0AE",
        seaDisplay: "#9ABED6",
        overlayLand: "transparent",
        overlaySea: "transparent"
      }),

      /*
        Classification rule:
        Never classify rainfall first on a land-included raster.
        Exclude no-data, sea/background, and land before rainfall bands.
      */
      classificationOrder: Object.freeze([
        "transparent/no-data",
        "sea/background",
        "land",
        "rainfall"
      ]),

      /*
        officialHex:
          Current intended Met Office rainfall display colours used by the app.

        sampledHex:
          Approximate colours sampled from the supplied phone screenshot of
          the official Met Office website. These are reference-only because
          JPEG compression, scaling, and display processing alter the pixels.
      */
      rainfallBands: Object.freeze([
        Object.freeze({
          id: "gt32",
          label: ">32 mm/h",
          officialHex: "#B30500",
          sampledHex: "#932922",
          sampledRgb: [147, 41, 34]
        }),
        Object.freeze({
          id: "16-32",
          label: "16-32 mm/h",
          officialHex: "#FC0600",
          sampledHex: "#CF322B",
          sampledRgb: [207, 50, 43]
        }),
        Object.freeze({
          id: "8-16",
          label: "8-16 mm/h",
          officialHex: "#FD9619",
          sampledHex: "#E49B3A",
          sampledRgb: [228, 155, 58]
        }),
        Object.freeze({
          id: "4-8",
          label: "4-8 mm/h",
          officialHex: "#FCCA15",
          sampledHex: "#F2CC46",
          sampledRgb: [242, 204, 70]
        }),
        Object.freeze({
          id: "2-4",
          label: "2-4 mm/h",
          officialHex: "#0FA200",
          sampledHex: "#499B2E",
          sampledRgb: [73, 155, 46]
        }),
        Object.freeze({
          id: "1-2",
          label: "1-2 mm/h",
          officialHex: "#0FBCFF",
          sampledHex: "#56B6EB",
          sampledRgb: [86, 182, 235]
        }),
        Object.freeze({
          id: "0.5-1",
          label: "0.5-1 mm/h",
          officialHex: "#3A63F7",
          sampledHex: "#3F62DB",
          sampledRgb: [63, 98, 219]
        }),
        Object.freeze({
          id: "lt0.5",
          label: "<0.5 mm/h",
          officialHex: "#0100FB",
          sampledHex: "#0907CA",
          sampledRgb: [9, 7, 202]
        })
      ])
    })
  });

  global.FIELDOPS_WEATHER_DISPLAY_STYLE = FIELDOPS_WEATHER_DISPLAY_STYLE;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = FIELDOPS_WEATHER_DISPLAY_STYLE;
  }
})(typeof window !== "undefined" ? window : globalThis);

/* End of file: FieldOpsAtlas/Features/Weather/weather-display-style.js */
