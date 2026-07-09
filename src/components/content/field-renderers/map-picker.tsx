"use client"

import { useEffect, useState, useRef } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { OpenStreetMapProvider } from "leaflet-geosearch"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
})

interface MapPickerProps {
  value: { lat?: number; lng?: number }
  onChange: (value: { lat: number; lng: number }) => void
}

function LocationMarker({ position, setPosition }: { position: L.LatLng | null; setPosition: (p: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng)
    },
  })

  return position === null ? null : <Marker position={position}></Marker>
}

export default function MapPicker({ value, onChange }: MapPickerProps) {
  const [position, setPosition] = useState<L.LatLng | null>(
    value.lat && value.lng ? new L.LatLng(value.lat, value.lng) : null
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [map, setMap] = useState<L.Map | null>(null)
  const provider = new OpenStreetMapProvider()

  useEffect(() => {
    if (position) {
      onChange({ lat: position.lat, lng: position.lng })
    }
  }, [position])

  const handleSearch = async () => {
    if (!searchQuery) return
    const results = await provider.search({ query: searchQuery })
    if (results && results.length > 0) {
      const { x, y } = results[0]
      const newPos = new L.LatLng(y, x)
      setPosition(newPos)
      if (map) {
        map.flyTo(newPos, 14)
      }
    }
  }

  return (
    <div className="space-y-2 border p-2 rounded-md bg-slate-50">
      <div className="flex gap-2 mb-2">
        <Input 
          placeholder="Cari lokasi (contoh: Jakarta)" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
        />
        <Button type="button" onClick={handleSearch} variant="secondary">
          <Search className="w-4 h-4 mr-2" />
          Cari
        </Button>
      </div>
      <div className="h-[300px] w-full rounded-md overflow-hidden relative z-0">
        <MapContainer 
          center={position || [-6.2088, 106.8456]} // Default to Jakarta
          zoom={13} 
          scrollWheelZoom={true} 
          style={{ height: "100%", width: "100%" }}
          ref={setMap}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} setPosition={setPosition} />
        </MapContainer>
      </div>
    </div>
  )
}
