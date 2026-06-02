export type DeliveryLocation = {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
};

export const FREE_COURIER_RADIUS_LABEL = "Trong bán kính 3km quanh UET";

export const DELIVERY_LOCATIONS: DeliveryLocation[] = [
  {
    id: "uet-e3",
    label: "Sảnh E3 UET",
    address: "Sảnh E3, Trường Đại học Công nghệ, 144 Xuân Thủy, Cầu Giấy",
    lat: 21.03823,
    lng: 105.78292
  },
  {
    id: "gd3",
    label: "Khu giảng đường GD3",
    address: "Khu giảng đường GD3, Đại học Quốc gia Hà Nội, Cầu Giấy",
    lat: 21.03696,
    lng: 105.78333
  },
  {
    id: "gd4",
    label: "Khu giảng đường GD4",
    address: "Khu giảng đường GD4, Đại học Quốc gia Hà Nội, Cầu Giấy",
    lat: 21.03649,
    lng: 105.78476
  },
  {
    id: "uet-library",
    label: "Thư viện UET",
    address: "Thư viện UET, 144 Xuân Thủy, Cầu Giấy",
    lat: 21.03792,
    lng: 105.78219
  },
  {
    id: "vnu-g2",
    label: "Sảnh G2 VNU",
    address: "Sảnh G2, Đại học Quốc gia Hà Nội, Cầu Giấy",
    lat: 21.03718,
    lng: 105.78126
  }
];

export function getDeliveryLocation(id: string | null | undefined) {
  return DELIVERY_LOCATIONS.find((location) => location.id === id) ?? DELIVERY_LOCATIONS[0];
}
