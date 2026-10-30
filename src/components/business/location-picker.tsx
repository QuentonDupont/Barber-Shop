"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { DEFAULT_CENTER, loadGoogleMaps, mapId, mapsApiKey } from "@/lib/maps";
import { useT } from "@/lib/i18n/context";

export interface LocationValue {
  address: string;
  placeId: string;
  lat: number | null;
  lng: number | null;
}

/**
 * Address search with a draggable pin.
 *
 * Search gets you close; the pin is what makes it right — a shop inside a mall
 * or down a soi rarely sits where its postal address geocodes to, and the
 * customer following the map is the one who pays for that.
 *
 * Degrades to plain text entry when no Maps key is configured, so onboarding is
 * never blocked on a Google Cloud account.
 */
export function LocationPicker({
  value,
  onChange,
  error,
}: {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  error?: string;
}) {
  const t = useT();
  const hasKey = Boolean(mapsApiKey());
  const mapNode = useRef<HTMLDivElement | null>(null);
  const searchNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "failed">(
    hasKey ? "loading" : "idle",
  );
  const [locating, setLocating] = useState(false);

  // `onChange` identity changes every render in the parent; keep a ref so the
  // map effect does not tear down and rebuild on each keystroke.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const placePin = useCallback((lat: number, lng: number, panTo = true) => {
    if (!mapRef.current || !markerRef.current) return;
    const position = { lat, lng };
    markerRef.current.position = position;
    if (panTo) {
      mapRef.current.panTo(position);
      if ((mapRef.current.getZoom() ?? 0) < 16) mapRef.current.setZoom(17);
    }
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (!geocoderRef.current) return;
    try {
      const { results } = await geocoderRef.current.geocode({ location: { lat, lng } });
      const best = results[0];
      onChangeRef.current({
        ...valueRef.current,
        lat,
        lng,
        address: best?.formatted_address ?? valueRef.current.address,
        placeId: best?.place_id ?? "",
      });
    } catch {
      // Keep the coordinates even if the address lookup fails — the pin is the
      // part that actually matters for directions.
      onChangeRef.current({ ...valueRef.current, lat, lng });
    }
  }, []);

  useEffect(() => {
    if (!hasKey) return;
    let cancelled = false;

    loadGoogleMaps()
      .then(async (google) => {
        if (cancelled || !mapNode.current) return;

        const { Map } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;
        const { AdvancedMarkerElement } = (await google.maps.importLibrary(
          "marker",
        )) as google.maps.MarkerLibrary;
        const placesLib = (await google.maps.importLibrary(
          "places",
        )) as google.maps.PlacesLibrary;

        if (cancelled || !mapNode.current) return;

        const start =
          valueRef.current.lat != null && valueRef.current.lng != null
            ? { lat: valueRef.current.lat, lng: valueRef.current.lng }
            : DEFAULT_CENTER;

        const map = new Map(mapNode.current, {
          center: start,
          zoom: valueRef.current.lat != null ? 17 : 12,
          mapId: mapId(),
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy", // one-finger pan inside the page on mobile
									});
        mapRef.current = map;
        geocoderRef.current = new google.maps.Geocoder();

        const marker = new AdvancedMarkerElement({
          map,
          position: start,
          gmpDraggable: true,
        });
        markerRef.current = marker;

        marker.addListener("dragend", () => {
          const position = marker.position as google.maps.LatLngLiteral | null;
          if (!position) return;
          void reverseGeocode(position.lat, position.lng);
        });

        // Tapping the map is easier than dragging a small pin on a phone.
        map.addListener("click", (event: google.maps.MapMouseEvent) => {
          const latLng = event.latLng;
          if (!latLng) return;
          placePin(latLng.lat(), latLng.lng(), false);
          void reverseGeocode(latLng.lat(), latLng.lng());
        });

        // Places Autocomplete ships as a web component in the current API.
        if (searchNode.current && "PlaceAutocompleteElement" in placesLib) {
          const element = new placesLib.PlaceAutocompleteElement();
          element.style.width = "100%";
          searchNode.current.replaceChildren(element);

          element.addEventListener("gmp-select", async (event: Event) => {
            const detail = (event as CustomEvent<{ placePrediction?: { toPlace(): google.maps.places.Place } }>)
              .detail;
            const place = detail?.placePrediction?.toPlace();
            if (!place) return;

            await place.fetchFields({
              fields: ["location", "formattedAddress", "id", "displayName"],
            });

            const location = place.location;
            if (!location) return;

            const lat = location.lat();
            const lng = location.lng();
            placePin(lat, lng);
            onChangeRef.current({
              address: place.formattedAddress ?? valueRef.current.address,
              placeId: place.id ?? "",
              lat,
              lng,
            });
          });
        }

        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [hasKey, placePin, reverseGeocode]);

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const { latitude, longitude } = position.coords;
        placePin(latitude, longitude);
        void reverseGeocode(latitude, longitude);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <div className="space-y-4">
      {!hasKey ? (
        <Alert tone="warning" title={t("shopfrontAdmin.mapSearchOffTitle")}>
          {t("shopfrontAdmin.mapSearchOffBodyPrefix")}
          <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>
          {t("shopfrontAdmin.mapSearchOffBodySuffix")}
        </Alert>
      ) : null}

      {status === "failed" ? (
        <Alert tone="warning" title={t("shopfrontAdmin.mapLoadFailedTitle")}>
          {t("shopfrontAdmin.mapLoadFailedBody")}
        </Alert>
      ) : null}

      {hasKey && status !== "failed" ? (
        <Field
          label={t("shopfrontAdmin.searchAddressLabel")}
          hint={t("shopfrontAdmin.searchAddressHint")}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-fg-subtle" />
            <div
              ref={searchNode}
              className="[&_gmp-place-autocomplete]:block [&_gmp-place-autocomplete]:w-full [&_input]:h-12 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-border-strong [&_input]:bg-surface [&_input]:pl-10 [&_input]:pr-3.5 [&_input]:text-base"
            >
              <div className="flex h-12 items-center rounded-lg border border-border-strong bg-surface pl-10 pr-3.5 text-base text-fg-subtle">
                {status === "loading"
                  ? t("shopfrontAdmin.loadingMapSearch")
                  : t("shopfrontAdmin.searchAnAddress")}
              </div>
            </div>
          </div>
        </Field>
      ) : null}

      {hasKey && status !== "failed" ? (
        <div className="relative overflow-hidden rounded-xl border border-border">
          <div ref={mapNode} className="h-56 w-full bg-surface-muted sm:h-72" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={locating}
            onClick={useMyLocation}
            className="absolute bottom-3 left-3 shadow-sm"
          >
            <LocateFixed />
            {t("shopfrontAdmin.imHereNow")}
          </Button>
        </div>
      ) : null}

      <Field
        label={t("shopfrontAdmin.addressLabel")}
        htmlFor="address"
        error={error}
        hint={t("shopfrontAdmin.addressHint")}
        required
      >
        <Input
          id="address"
          name="address"
          value={value.address}
          onChange={(event) => onChange({ ...value, address: event.target.value })}
          placeholder={t("shopfrontAdmin.addressPlaceholder")}
          aria-invalid={Boolean(error)}
          required
        />
      </Field>

      <input type="hidden" name="placeId" value={value.placeId} />
      <input type="hidden" name="lat" value={value.lat ?? ""} />
      <input type="hidden" name="lng" value={value.lng ?? ""} />

      <p className="flex items-start gap-2 text-sm text-fg-subtle">
        {value.lat != null && value.lng != null ? (
          <>
            <MapPin className="mt-0.5 size-4 shrink-0 text-success" />
            {t("shopfrontAdmin.pinSetAt", { lat: value.lat.toFixed(5), lng: value.lng.toFixed(5) })}
          </>
        ) : (
          <>
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            {t("shopfrontAdmin.noPinYet")}
          </>
        )}
      </p>
    </div>
  );
}
