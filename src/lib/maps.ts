/**
 * Loads the Google Maps JavaScript API exactly once, on demand.
 *
 * Deliberately not a `<Script>` in the root layout: most of the app never
 * touches a map, and the Maps bundle is large enough to matter on a 4G phone.
 */
let loader: Promise<typeof google> | null = null;

export function mapsApiKey(): string | null {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null;
}

/**
 * Advanced markers need a Map ID. `DEMO_MAP_ID` works for development but shows
 * a watermark and is rate limited, so set NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID for
 * production.
 */
export function mapId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (loader) return loader;

  const key = mapsApiKey();
  if (!key) {
    return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set"));
  }

  loader = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Google Maps can only load in the browser"));
      return;
    }

    if (window.google?.maps) {
      resolve(window.google);
      return;
    }

    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      "&libraries=places,marker&loading=async&v=weekly";
    script.async = true;
    script.onerror = () => {
      loader = null;
      reject(new Error("Could not load Google Maps"));
    };
    script.onload = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("Google Maps loaded without an API surface"));
    };

    document.head.appendChild(script);
  });

  return loader;
}

/** Bangkok — a sensible starting view before the shop picks a location. */
export const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 };
