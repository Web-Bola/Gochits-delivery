export interface Pt { lat: number; lng: number }
export interface MapPt extends Pt { label: string; kind: 'A' | 'B' | 'O' }

/** Full-screen map page (Leaflet + CARTO light tiles). A = pick-up, B = delivery, O = other open offers. */
export function mapHtml(points: MapPt[]): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#m{height:100%;margin:0;background:#EFE9DA}.leaflet-control-attribution{font-size:9px;opacity:.7}
.pin{display:flex;align-items:center;justify-content:center;border-radius:50%;border:3px solid #fff;box-shadow:0 3px 10px rgba(26,13,11,.35);font:800 14px sans-serif;color:#1A0D0B}
.a{width:34px;height:34px;background:#FFCC02}.b{width:34px;height:34px;background:#2E9E5B;color:#fff}.o{width:22px;height:22px;background:#FFCC02;border-width:2px}</style>
</head><body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var pts=${JSON.stringify(points)};
var map=L.map('m',{zoomControl:false,attributionControl:true}).setView([41.7151,44.8271],12);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:19,attribution:'© OpenStreetMap © CARTO'}).addTo(map);
var ll=[],a=null,b=null;
pts.forEach(function(p){var s=p.kind==='O'?22:34;
 var m=L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',html:'<div class="pin '+p.kind.toLowerCase()+'">'+(p.kind==='O'?'':p.kind)+'</div>',iconSize:[s,s],iconAnchor:[s/2,s/2]})}).addTo(map).bindTooltip(p.label);
 ll.push([p.lat,p.lng]); if(p.kind==='A')a=[p.lat,p.lng]; if(p.kind==='B')b=[p.lat,p.lng];});
if(a&&b)L.polyline([a,b],{color:'#1A0D0B',weight:4,opacity:.75,dashArray:'2 9',lineCap:'round'}).addTo(map);
if(ll.length>1)map.fitBounds(ll,{paddingTopLeft:[40,110],paddingBottomRight:[40,330]});
else if(ll.length===1)map.setView(ll[0],15);
</script></body></html>`;
}

/** Real turn-by-turn route in the phone's maps app. */
export const routeUrl = (a: Pt, b: Pt) => `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&travelmode=driving`;
export const pointUrl = (p: Pt) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
