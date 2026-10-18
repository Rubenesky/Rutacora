import L from 'leaflet'

export function createBaseLayers(): Record<string, L.TileLayer> {
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })

  const openTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
      '<a href="https://viewfinderpanoramas.org">SRTM</a> | ' +
      'Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> ' +
      '(<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
  })

  // Capa IGN (Mapa Topográfico Nacional).
  //
  // El IGN NO publica una URL "XYZ" lista para usar en un tileLayer: solo
  // ofrece el servicio WMTS oficial, verificado en vivo contra su
  // GetCapabilities:
  //   https://www.ign.es/wmts/mapa-raster?service=WMTS&request=GetCapabilities
  // De ese documento oficial se confirman: la capa "MTN", el tilematrixset
  // "GoogleMapsCompatible" (EPSG:3857, compatible con Leaflet) y el formato
  // "image/jpeg". La URL de abajo es una petición WMTS KVP estándar (GetTile)
  // CONSTRUIDA a partir de esos parámetros oficiales confirmados; no es una
  // plantilla publicada literalmente por el IGN para uso directo en Leaflet.
  // Verifica visualmente al abrir el mapa que las teselas cargan bien; si no
  // es así, dímelo y la dejamos como TODO en vez de activarla por defecto.
  // Licencia confirmada: CC BY 4.0 (AccessConstraints del GetCapabilities y
  // https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf).
  const ign = L.tileLayer(
    'https://www.ign.es/wmts/mapa-raster?service=WMTS&request=GetTile&version=1.0.0' +
      '&layer=MTN&style=default&format=image/jpeg&tilematrixset=GoogleMapsCompatible' +
      '&tilematrix={z}&tilerow={y}&tilecol={x}',
    {
      maxZoom: 19,
      attribution: '&copy; Instituto Geográfico Nacional de España (IGN) · CC BY 4.0',
    },
  )

  // Capa IGN (ortofoto satélite/aérea PNOA).
  //
  // Igual que la capa topográfica: el IGN no publica una URL XYZ lista para
  // Leaflet, solo el servicio WMTS oficial, verificado en vivo contra su
  // GetCapabilities:
  //   https://www.ign.es/wmts/pnoa-ma?service=WMTS&request=GetCapabilities
  // De ese documento se confirman: la capa "OI.OrthoimageCoverage" (combina
  // PNOA de máxima actualidad con Sentinel-2), el tilematrixset
  // "GoogleMapsCompatible" y el formato "image/jpeg". El TileMatrixSetLimits
  // de esa capa para ese tilematrixset da MaxTileMatrix = 20: ese es el zoom
  // nativo máximo real (no el "~19" que aparece en el texto descriptivo del
  // servicio), por eso maxNativeZoom se fija en 20. maxZoom se deja algo por
  // encima (22) para que, si se hace más zoom, Leaflet amplíe la última
  // tesela real en vez de mostrar un hueco gris.
  // Atribución y licencia confirmadas en el AccessConstraints del propio
  // GetCapabilities: "CC BY 4.0 scne.es".
  const pnoa = L.tileLayer(
    'https://www.ign.es/wmts/pnoa-ma?service=WMTS&request=GetTile&version=1.0.0' +
      '&layer=OI.OrthoimageCoverage&style=default&format=image/jpeg' +
      '&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}',
    {
      maxZoom: 22,
      maxNativeZoom: 20,
      attribution: '&copy; Instituto Geográfico Nacional de España (IGN) · PNOA · CC BY 4.0 scne.es',
    },
  )

  return {
    'OpenStreetMap': osm,
    'OpenTopoMap': openTopoMap,
    'IGN (Mapa Topográfico Nacional)': ign,
    'Satélite (PNOA, IGN)': pnoa,
  }
}
