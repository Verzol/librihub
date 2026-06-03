from math import asin, cos, radians, sin, sqrt

FREE_COURIER_RADIUS_KM = 3.0
SUPPORTED_CAMPUS_POINT_RADIUS_KM = 0.15
UET_CENTER_LAT = 21.03823
UET_CENTER_LNG = 105.78292

SUPPORTED_CAMPUS_DELIVERY_POINTS = (
    ("Sảnh E3 UET", "Tòa nhà E3, 144 đường Xuân Thủy, Cầu Giấy, Hà Nội", 21.03823, 105.78292),
    ("Khu GĐ3", "Số 8a, Tôn Thất Thuyết, Cầu Giấy, Hà Nội", 21.03696, 105.78333),
    ("Khu GĐ4", "Phố Kiều Mai, phường Bắc Từ Liêm, Hà Nội", 21.03649, 105.78476),
    (
        "VNU - LIC (PHÒNG DỊCH VỤ TRI THỨC TỔNG HỢP)",
        "Nhà C1T, 144 Xuân Thủy, Cầu Giấy, Hà Nội",
        21.03792,
        105.78219,
    ),
    ("Sảnh G2", "Tòa nhà G2, 144 đường Xuân Thủy, Cầu Giấy, Hà Nội", 21.03718, 105.78126),
)


def distance_from_uet_km(lat: float, lng: float) -> float:
    return haversine_km(UET_CENTER_LAT, UET_CENTER_LNG, lat, lng)


def is_within_free_courier_area(lat: float, lng: float) -> bool:
    return distance_from_uet_km(lat, lng) <= FREE_COURIER_RADIUS_KM


def is_supported_campus_delivery_point(lat: float, lng: float) -> bool:
    if not is_within_free_courier_area(lat, lng):
        return False
    return any(
        haversine_km(lat, lng, point_lat, point_lng) <= SUPPORTED_CAMPUS_POINT_RADIUS_KM
        for _, _, point_lat, point_lng in SUPPORTED_CAMPUS_DELIVERY_POINTS
    )


def is_courier_area_compatible(
    delivery_area: str,
    pickup_address: str | None,
    pickup_lat: float | None,
    pickup_lng: float | None,
    receiver_address: str,
    receiver_lat: float | None,
    receiver_lng: float | None,
) -> bool:
    selected_labels = _labels_in_delivery_area(delivery_area)
    if not selected_labels:
        return True

    pickup_label = campus_point_label(pickup_address, pickup_lat, pickup_lng)
    receiver_label = campus_point_label(receiver_address, receiver_lat, receiver_lng)
    if pickup_label is None or receiver_label is None:
        return False
    return pickup_label in selected_labels and receiver_label in selected_labels


def campus_point_label(address: str | None, lat: float | None, lng: float | None) -> str | None:
    normalized_address = _normalize_text(address or "")
    if normalized_address:
        for label, point_address, _, _ in SUPPORTED_CAMPUS_DELIVERY_POINTS:
            if _normalize_text(label) in normalized_address or _normalize_text(point_address) in normalized_address:
                return label

    if lat is not None and lng is not None:
        nearest = min(
            (
                (haversine_km(lat, lng, point_lat, point_lng), label)
                for label, _, point_lat, point_lng in SUPPORTED_CAMPUS_DELIVERY_POINTS
            ),
            default=None,
        )
        if nearest is not None and nearest[0] <= SUPPORTED_CAMPUS_POINT_RADIUS_KM:
            return nearest[1]
    return None


def _labels_in_delivery_area(delivery_area: str) -> set[str]:
    normalized_area = _normalize_text(delivery_area)
    return {
        label
        for label, _, _, _ in SUPPORTED_CAMPUS_DELIVERY_POINTS
        if _normalize_text(label) in normalized_area
    }


def _normalize_text(value: str) -> str:
    return " ".join(value.casefold().split())


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_km = 6371.0
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)
    r_lat1 = radians(lat1)
    r_lat2 = radians(lat2)
    value = sin(d_lat / 2) ** 2 + cos(r_lat1) * cos(r_lat2) * sin(d_lng / 2) ** 2
    return 2 * earth_radius_km * asin(sqrt(value))
