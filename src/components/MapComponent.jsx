import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import { decode } from 'polyline-encoded';

export default function MapComponent({ 
  center, 
  hospitals = [], 
  routes = [], 
  selectedHospital,
  onMapClick 
}) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const layersRef = useRef({
    markers: L.layerGroup(),
    routes: L.layerGroup()
  })

  useEffect(() => {
    if (!mapInstance.current && mapRef.current) {
      mapInstance.current = L.map(mapRef.current).setView(center, 13)
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstance.current)

      layersRef.current.markers.addTo(mapInstance.current)
      layersRef.current.routes.addTo(mapInstance.current)

      if (onMapClick) {
        mapInstance.current.on('click', onMapClick)
      }
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [center, onMapClick])

  // Update markers when hospitals change
  useEffect(() => {
    if (!mapInstance.current) return

    layersRef.current.markers.clearLayers()

    // Add start marker
    L.marker(center, {
      icon: L.divIcon({
        className: 'start-marker',
        html: '🟢',
        iconSize: [24, 24]
      })
    }).addTo(layersRef.current.markers)

    // Add hospital markers
    hospitals.forEach(hospital => {
      if (!hospital.position) return
      
      const isSelected = selectedHospital?.id === hospital.id
      
      L.marker(hospital.position, {
        icon: L.divIcon({
          className: `hospital-marker ${isSelected ? 'selected' : ''}`,
          html: isSelected ? '🏥🔴' : '🏥',
          iconSize: [24, 24]
        })
      })
      .bindPopup(`<b>${hospital.name}</b><br>${hospital.specialty || ''}`)
      .addTo(layersRef.current.markers)
    })
  }, [hospitals, selectedHospital, center])

  // Update routes when they change
  useEffect(() => {
    if (!mapInstance.current || routes.length === 0) return

    layersRef.current.routes.clearLayers()

    routes.forEach((route, index) => {
      if (route.geometry) {
        const isSelected = selectedHospital?.id === hospitals[index]?.id
        const polyline = L.Polyline.fromEncoded(route.geometry, {
          color: isSelected ? '#FF0000' : '#3B82F6',
          weight: isSelected ? 5 : 3,
          opacity: isSelected ? 1 : 0.7
        }).addTo(layersRef.current.routes)
        
        if (isSelected) {
          mapInstance.current.fitBounds(polyline.getBounds(), {
            padding: [50, 50]
          })
        }
      }
    })
  }, [routes, selectedHospital, hospitals])

  return <div ref={mapRef} className="w-full h-96 rounded-lg" />
}