from math import asin, cos, radians, sin, sqrt

FREE_COURIER_RADIUS_KM = 3.0
UET_CENTER_LAT = 21.03823
UET_CENTER_LNG = 105.78292


def distance_from_uet_km(lat: float, lng: float) -> float:
    return haversine_km(UET_CENTER_LAT, UET_CENTER_LNG, lat, lng)


def is_within_free_courier_area(lat: float, lng: float) -> bool:
    return distance_from_uet_km(lat, lng) <= FREE_COURIER_RADIUS_KM


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_km = 6371.0
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)
    r_lat1 = radians(lat1)
    r_lat2 = radians(lat2)
    value = sin(d_lat / 2) ** 2 + cos(r_lat1) * cos(r_lat2) * sin(d_lng / 2) ** 2
    return 2 * earth_radius_km * asin(sqrt(value))
