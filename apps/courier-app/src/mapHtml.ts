export interface Pt { lat: number; lng: number }

/** Small self-contained map page (Leaflet + OpenStreetMap): A = pick-up, B = delivery, straight line between. */
export function mapHtml(a: Pt, b: Pt, labelA: string, labelB: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#m{height:100%;margin:0;background:#2C1E1B}.pin{width:30px;height:30px;border-radius:50%;color:#1A0D0B;font:800 14px sans-serif;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)}</style>
</head><body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var a=[${a.lat},${a.lng}],b=[${b.lat},${b.lng}];
var map=L.map('m',{zoomControl:false,attributionControl:true});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
function pin(c,t){return L.divIcon({className:'',html:'<div class="pin" style="background:'+c+'">'+t+'</div>',iconSize:[30,30],iconAnchor:[15,15]});}
L.marker(a,{icon:pin('#FFCC02','A')}).addTo(map).bindTooltip(${JSON.stringify(labelA)});
L.marker(b,{icon:pin('#5CD08A','B')}).addTo(map).bindTooltip(${JSON.stringify(labelB)});
L.polyline([a,b],{color:'#D8141C',weight:4,dashArray:'8 8'}).addTo(map);
map.fitBounds([a,b],{padding:[36,36]});
</script></body></html>`;
}

/** Real turn-by-turn route in the phone's maps app. */
export const routeUrl = (a: Pt, b: Pt) => `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&travelmode=driving`;
export const pointUrl = (p: Pt) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
