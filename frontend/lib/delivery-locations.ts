export type DeliveryLocation = {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
};

export const FREE_COURIER_RADIUS_LABEL = "Trong bán kính 3km quanh UET";
export const UET_CENTER = {
  lat: 21.03823,
  lng: 105.78292
};

export const DELIVERY_LOCATIONS: DeliveryLocation[] = [
  {
    id: "uet-e3",
    label: "Sảnh E3 UET",
    address: "Tòa nhà E3, 144 đường Xuân Thủy, Cầu Giấy, Hà Nội",
    lat: 21.03823,
    lng: 105.78292
  },
  {
    id: "gd3",
    label: "Khu GĐ3",
    address: "Số 8a, Tôn Thất Thuyết, Cầu Giấy, Hà Nội",
    lat: 21.03696,
    lng: 105.78333
  },
  {
    id: "gd4",
    label: "Khu GĐ4",
    address: "Phố Kiều Mai, phường Bắc Từ Liêm, Hà Nội",
    lat: 21.03649,
    lng: 105.78476
  },
  {
    id: "uet-library",
    label: "VNU - LIC (PHÒNG DỊCH VỤ TRI THỨC TỔNG HỢP)",
    address: "Nhà C1T, 144 Xuân Thủy, Cầu Giấy, Hà Nội",
    lat: 21.03792,
    lng: 105.78219
  },
  {
    id: "vnu-g2",
    label: "Sảnh G2",
    address: "Tòa nhà G2, 144 đường Xuân Thủy, Cầu Giấy, Hà Nội",
    lat: 21.03718,
    lng: 105.78126
  }
];

export function getDeliveryLocation(id: string | null | undefined) {
  return DELIVERY_LOCATIONS.find((location) => location.id === id) ?? DELIVERY_LOCATIONS[0];
}

export function distanceFromUetKm(location: DeliveryLocation) {
  return haversineKm(UET_CENTER.lat, UET_CENTER.lng, location.lat, location.lng);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(value));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
