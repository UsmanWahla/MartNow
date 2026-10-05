import { useEffect, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { divIcon, type Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { reverseStoreLocation, searchStoreLocations, type StoreLocationResult } from "../api";
import { getApiError } from "../auth";

export interface StoreLocationValue {
  address: string;
  latitude: string;
  longitude: string;
}

interface StoreLocationPickerProps {
  value: StoreLocationValue;
  onChange: (value: StoreLocationValue) => void;
  error?: string;
  label?: string;
  searchPlaceholder?: string;
  showAdvancedCoordinates?: boolean;
  mapHeightClass?: string;
}

const DEFAULT_CENTER: [number, number] = [30.3753, 69.3451];

const markerIcon = divIcon({
  className: "store-location-marker",
  html: '<span aria-hidden="true"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function asCoordinate(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatCoordinate(value: number) {
  return String(Math.round(value * 10_000_000) / 10_000_000);
}

function MapPosition({
  latitude,
  longitude,
  onPick,
}: {
  latitude: number | null;
  longitude: number | null;
  onPick: (latitude: number, longitude: number) => void;
}) {
  const map = useMap();
  const hasPosition = latitude != null && longitude != null;

  useEffect(() => {
    if (hasPosition) {
      map.setView([latitude!, longitude!], Math.max(map.getZoom(), 16), { animate: true });
    }
  }, [hasPosition, latitude, longitude, map]);

  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  if (!hasPosition) {
    return null;
  }

  return (
    <Marker
      position={[latitude, longitude]}
      icon={markerIcon}
      draggable
      eventHandlers={{
        dragend(event) {
          const position = (event.target as LeafletMarker).getLatLng();
          onPick(position.lat, position.lng);
        },
      }}
    />
  );
}

function StoreLocationPicker({
  value,
  onChange,
  error,
  label = "Store location",
  searchPlaceholder = "Search area, road, city or landmark",
  showAdvancedCoordinates = true,
  mapHeightClass = "h-64",
}: StoreLocationPickerProps) {
  const [queryOverride, setQueryOverride] = useState<string | null>(null);
  const [results, setResults] = useState<StoreLocationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const latitude = asCoordinate(value.latitude);
  const longitude = asCoordinate(value.longitude);
  const query = queryOverride ?? value.address;

  function updateCoordinates(nextLatitude: number, nextLongitude: number) {
    onChange({
      ...value,
      latitude: formatCoordinate(nextLatitude),
      longitude: formatCoordinate(nextLongitude),
    });
    setMessage("Pin updated. Select “Update address from pin” if the address also needs refreshing.");
  }

  function selectLocation(location: StoreLocationResult) {
    setQueryOverride(location.address);
    setResults([]);
    setMessage("Location selected. Latitude and longitude were set automatically.");
    onChange({
      address: location.address,
      latitude: formatCoordinate(location.latitude),
      longitude: formatCoordinate(location.longitude),
    });
  }

  async function handleSearch() {
    const text = query.trim() || value.address.trim();

    if (text.length < 3) {
      setMessage("Enter at least 3 characters to search for a location.");
      return;
    }

    setSearching(true);
    setMessage("");

    try {
      const locations = await searchStoreLocations(text);
      setResults(locations);
      setMessage(locations.length ? "Select the correct location." : "No matching location was found.");
    } catch (searchError) {
      setResults([]);
      setMessage(getApiError(searchError, "Unable to search locations"));
    } finally {
      setSearching(false);
    }
  }

  function handleCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage("Current location is not supported by this browser.");
      return;
    }

    setLocating(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextLatitude = position.coords.latitude;
        const nextLongitude = position.coords.longitude;

        try {
          selectLocation(await reverseStoreLocation(nextLatitude, nextLongitude));
        } catch (reverseError) {
          updateCoordinates(nextLatitude, nextLongitude);
          setMessage(getApiError(reverseError, "Coordinates were set, but the address could not be found."));
        } finally {
          setLocating(false);
        }
      },
      (locationError) => {
        setLocating(false);
        setMessage(locationError.message || "Unable to access your current location.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }

  async function updateAddressFromPin() {
    if (latitude == null || longitude == null) {
      setMessage("Select a location on the map first.");
      return;
    }

    setLocating(true);
    setMessage("");

    try {
      selectLocation(await reverseStoreLocation(latitude, longitude));
    } catch (reverseError) {
      setMessage(getApiError(reverseError, "Unable to find an address for this pin"));
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={error ? "field-input field-input--error" : "field-input"}
            value={query}
            placeholder={searchPlaceholder}
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              const address = event.target.value;
              setQueryOverride(address);
              setResults([]);
              setMessage("");
              onChange({ ...value, address });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSearch();
              }
            }}
          />
          <button
            type="button"
            className="shop-btn shrink-0 bg-teal-700 text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={searching}
            onClick={() => void handleSearch()}
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>
        {error ? <p className="field-error-text">{error}</p> : null}
      </div>

      {results.length ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {results.map((location) => (
            <button
              key={`${location.latitude}-${location.longitude}`}
              type="button"
              className="block w-full border-b border-slate-100 px-3 py-2.5 text-left text-sm text-slate-700 last:border-b-0 hover:bg-teal-50"
              onClick={() => selectLocation(location)}
            >
              {location.address}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={locating}
          onClick={handleCurrentLocation}
        >
          {locating ? "Locating..." : "Use current location"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={locating || latitude == null || longitude == null}
          onClick={() => void updateAddressFromPin()}
        >
          Update address from pin
        </button>
        <span className="text-xs text-slate-500">Search, use your device, or click and drag the map pin.</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <MapContainer center={DEFAULT_CENTER} zoom={5} className={`${mapHeightClass} w-full`} scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapPosition latitude={latitude} longitude={longitude} onPick={updateCoordinates} />
        </MapContainer>
      </div>

      <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
        <span>Latitude: {latitude == null ? "Not set" : formatCoordinate(latitude)}</span>
        <span>Longitude: {longitude == null ? "Not set" : formatCoordinate(longitude)}</span>
      </div>
      {message ? <p className="text-xs leading-relaxed text-slate-500">{message}</p> : null}

      {showAdvancedCoordinates ? <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-slate-600">Advanced coordinates</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Latitude
            <input
              className="field-input mt-1.5"
              value={value.latitude}
              placeholder="-90 to 90"
              onChange={(event) => onChange({ ...value, latitude: event.target.value })}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Longitude
            <input
              className="field-input mt-1.5"
              value={value.longitude}
              placeholder="-180 to 180"
              onChange={(event) => onChange({ ...value, longitude: event.target.value })}
            />
          </label>
        </div>
      </details> : null}
    </div>
  );
}

export default StoreLocationPicker;
