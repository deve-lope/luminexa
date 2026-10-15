"""OR-Tools VRP (haversine matrix) with angular-sweep fallback. Pure functions, no ORM."""

from __future__ import annotations

import math
import time
from typing import Any


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def travel_seconds(
    lat1: float,
    lng1: float,
    lat2: float,
    lng2: float,
    *,
    speed_kmh: float,
    road_factor: float,
) -> int:
    km = haversine_km(lat1, lng1, lat2, lng2) * float(road_factor)
    hours = km / max(1.0, float(speed_kmh))
    return max(0, int(round(hours * 3600)))


def _fallback_solve(
    depot: tuple[float, float],
    stops: list[dict],
    vehicles: int,
    speed_kmh: float,
    road_factor: float,
) -> dict[str, Any]:
    """Angular sweep into N clusters, nearest-neighbour within each."""
    if not stops:
        return {
            'routes': [[] for _ in range(vehicles)],
            'arrival_offsets_min': {},
            'totals': {'travel_min': 0, 'service_min': 0, 'span_min': 0},
            'solver': 'fallback',
            'solve_ms': 0,
        }
    dlat, dlng = depot
    ranked = sorted(
        stops,
        key=lambda s: math.atan2(float(s['lat']) - dlat, float(s['lng']) - dlng),
    )
    clusters: list[list[dict]] = [[] for _ in range(vehicles)]
    for i, stop in enumerate(ranked):
        clusters[i % vehicles].append(stop)

    routes: list[list[Any]] = []
    arrival: dict[Any, float] = {}
    total_travel = 0.0
    total_service = 0.0
    spans: list[float] = []

    for cluster in clusters:
        ordered: list[dict] = []
        remaining = list(cluster)
        cur_lat, cur_lng = dlat, dlng
        t = 0.0
        while remaining:
            nxt = min(
                remaining,
                key=lambda s: haversine_km(cur_lat, cur_lng, float(s['lat']), float(s['lng'])),
            )
            remaining.remove(nxt)
            travel = travel_seconds(
                cur_lat, cur_lng, float(nxt['lat']), float(nxt['lng']),
                speed_kmh=speed_kmh, road_factor=road_factor,
            ) / 60.0
            t += travel
            total_travel += travel
            arrival[nxt['id']] = t
            svc = float(nxt.get('service_min') or 0)
            t += svc
            total_service += svc
            ordered.append(nxt)
            cur_lat, cur_lng = float(nxt['lat']), float(nxt['lng'])
        routes.append([s['id'] for s in ordered])
        spans.append(t)

    return {
        'routes': routes,
        'arrival_offsets_min': arrival,
        'totals': {
            'travel_min': round(total_travel, 1),
            'service_min': round(total_service, 1),
            'span_min': round(max(spans) if spans else 0, 1),
        },
        'solver': 'fallback',
        'solve_ms': 0,
    }


def solve(
    depot: tuple[float, float],
    stops: list[dict],
    *,
    vehicles: int = 1,
    speed_kmh: float = 30.0,
    road_factor: float = 1.3,
    time_limit_s: float = 5.0,
) -> dict[str, Any]:
    """
    stops: [{id, lat, lng, service_min}]
    returns routes[[stop_id...]], arrival_offsets_min{id: minutes from start}, totals, solver
    """
    vehicles = max(1, min(int(vehicles), max(1, len(stops) or 1)))
    if len(stops) > 120:
        raise ValueError('Maximum 120 stops per run.')

    t0 = time.perf_counter()
    try:
        from ortools.constraint_solver import pywrapcp, routing_enums_pb2
    except Exception:
        out = _fallback_solve(depot, stops, vehicles, speed_kmh, road_factor)
        out['solve_ms'] = int((time.perf_counter() - t0) * 1000)
        return out

    if not stops:
        return {
            'routes': [[] for _ in range(vehicles)],
            'arrival_offsets_min': {},
            'totals': {'travel_min': 0, 'service_min': 0, 'span_min': 0},
            'solver': 'ortools',
            'solve_ms': 0,
        }

    nodes = [{'id': None, 'lat': depot[0], 'lng': depot[1], 'service_min': 0}] + list(stops)
    n = len(nodes)
    dist = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            dist[i][j] = travel_seconds(
                float(nodes[i]['lat']),
                float(nodes[i]['lng']),
                float(nodes[j]['lat']),
                float(nodes[j]['lng']),
                speed_kmh=speed_kmh,
                road_factor=road_factor,
            )

    manager = pywrapcp.RoutingIndexManager(n, vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    def transit_cb(from_index, to_index):
        frm = manager.IndexToNode(from_index)
        to = manager.IndexToNode(to_index)
        # Service time charged when leaving a stop (not depot).
        svc = int(nodes[frm].get('service_min') or 0) * 60 if frm != 0 else 0
        return dist[frm][to] + svc

    transit_idx = routing.RegisterTransitCallback(transit_cb)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_idx)

    routing.AddDimension(
        transit_idx,
        0,  # no slack
        24 * 3600 * 7,  # week horizon
        True,  # start cumul at zero
        'Time',
    )
    time_dim = routing.GetDimensionOrDie('Time')
    time_dim.SetGlobalSpanCostCoefficient(100)

    # Open routes: no force return to depot cost beyond empty.
    search = pywrapcp.DefaultRoutingSearchParameters()
    search.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search.time_limit.FromSeconds(max(1, int(time_limit_s)))

    solution = routing.SolveWithParameters(search)
    if not solution:
        out = _fallback_solve(depot, stops, vehicles, speed_kmh, road_factor)
        out['solve_ms'] = int((time.perf_counter() - t0) * 1000)
        return out

    routes: list[list[Any]] = []
    arrival: dict[Any, float] = {}
    total_travel = 0.0
    total_service = 0.0
    spans: list[float] = []

    for v in range(vehicles):
        index = routing.Start(v)
        ordered_ids: list[Any] = []
        prev_node = 0
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node != 0:
                ordered_ids.append(nodes[node]['id'])
                cumul = solution.Value(time_dim.CumulVar(index))
                # Arrival = cumul time before service at this node ≈ after travel to node
                svc = int(nodes[node].get('service_min') or 0)
                # Cumul includes service of previous nodes; approximate arrival as cumul/60
                arrival[nodes[node]['id']] = round(cumul / 60.0, 1)
                total_service += svc
                total_travel += dist[prev_node][node] / 60.0
                prev_node = node
            index = solution.Value(routing.NextVar(index))
        end_cumul = solution.Value(time_dim.CumulVar(index))
        spans.append(end_cumul / 60.0)
        routes.append(ordered_ids)

    return {
        'routes': routes,
        'arrival_offsets_min': arrival,
        'totals': {
            'travel_min': round(total_travel, 1),
            'service_min': round(total_service, 1),
            'span_min': round(max(spans) if spans else 0, 1),
        },
        'solver': 'ortools',
        'solve_ms': int((time.perf_counter() - t0) * 1000),
    }


def solo_detour_minutes(
    depot: tuple[float, float],
    base_stops: list[dict],
    candidate: dict,
    *,
    vehicles: int,
    speed_kmh: float,
    road_factor: float,
) -> float:
    """Extra minutes if candidate is inserted into an optimized seasonal-only plan."""
    base = solve(
        depot, base_stops,
        vehicles=vehicles, speed_kmh=speed_kmh, road_factor=road_factor, time_limit_s=2,
    )
    with_c = solve(
        depot, base_stops + [candidate],
        vehicles=vehicles, speed_kmh=speed_kmh, road_factor=road_factor, time_limit_s=2,
    )
    return max(
        0.0,
        float(with_c['totals']['span_min']) - float(base['totals']['span_min']),
    )
