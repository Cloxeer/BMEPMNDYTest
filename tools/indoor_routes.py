"""
tools/indoor_routes.py - walking routes INSIDE a building, on one of our floor plans.

WHAT IT DOES : Used by tools/build_rooms.py. For one floor plan (SVG) it works
               out the shortest walk from where you come in to every room:
                 floor 1      -> from the nearest outside door (the door gaps
                                 marked class="door" in the plan)
                 other floors -> from the nearest stairs (class="stair")
               Only open floor is walkable: rooms, stair/lift cores and
               "open to below" areas are walls. The route stops at the room's
               edge, because the posted evacuation maps don't show room doors.
HOW          : 1. Lay a grid of small squares over the plan; mark each square
                  walkable (inside the building, outside every room) or not.
               2. Dijkstra's shortest-path search from every entrance at once
                  (the same algorithm family map apps use). Squares right next
                  to a wall cost a little more, so routes keep to the middle
                  of hallways instead of scraping corners.
               3. Straighten the zig-zag grid path: skip points while a
                  straight line stays on walkable squares.
DEPENDS ON   : Python 3 only.
USED BY      : tools/build_rooms.py
"""

import heapq
import math

STEP = 6  # grid square size, in floor-plan units
WALL_CLEARANCE = 3  # squares; closer than this to a wall costs extra
WALL_PENALTY = 2.0  # how much extra (x normal cost) a square touching a wall costs
BLOCKING_CLASSES = {'room', 'big', 'ours', 'core', 'void'}


def inside(points, x, y):
    """Is (x, y) inside the polygon? (ray casting)"""
    result = False
    for (x1, y1), (x2, y2) in zip(points, points[1:] + points[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            result = not result
    return result


def bounding_box(points):
    """(min x, min y, max x, max y) of a polygon, for a quick 'could it be inside?' test."""
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def distance_to_edge(points, x, y):
    """Shortest distance from (x, y) to the polygon's outline."""
    best = math.inf
    for (ax, ay), (bx, by) in zip(points, points[1:] + points[:1]):
        dx, dy = bx - ax, by - ay
        along = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / ((dx * dx + dy * dy) or 1)))
        best = min(best, math.hypot(x - (ax + along * dx), y - (ay + along * dy)))
    return best


class FloorGrid:
    """The plan as a grid of walkable / blocked squares."""

    def __init__(self, outlines, blockers):
        boxes = [bounding_box(o) for o in outlines]
        self.left = min(b[0] for b in boxes)
        self.top = min(b[1] for b in boxes)
        self.columns = int((max(b[2] for b in boxes) - self.left) / STEP) + 1
        self.rows = int((max(b[3] for b in boxes) - self.top) / STEP) + 1
        blocker_boxes = [(bounding_box(b), b) for b in blockers]

        self.walkable = [[False] * self.columns for _ in range(self.rows)]
        for row in range(self.rows):
            for column in range(self.columns):
                x, y = self.centre(row, column)
                if not any(inside(o, x, y) for o in outlines):
                    continue
                blocked = any(bx1 <= x <= bx2 and by1 <= y <= by2 and inside(b, x, y)
                              for (bx1, by1, bx2, by2), b in blocker_boxes)
                self.walkable[row][column] = not blocked
        self.wall_distance = self.measure_wall_distance()

    def centre(self, row, column):
        """Plan coordinates of a square's centre."""
        return self.left + (column + 0.5) * STEP, self.top + (row + 0.5) * STEP

    def neighbours(self, row, column):
        """The 8 squares around one square, with the step length (1 or ~1.41)."""
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                r, c = row + dr, column + dc
                if (dr or dc) and 0 <= r < self.rows and 0 <= c < self.columns:
                    yield r, c, math.hypot(dr, dc)

    def measure_wall_distance(self):
        """For every square: how many squares away the nearest blocked square is (capped)."""
        distance = [[0 if not self.walkable[r][c] else WALL_CLEARANCE for c in range(self.columns)]
                    for r in range(self.rows)]
        frontier = [(r, c) for r in range(self.rows) for c in range(self.columns) if not self.walkable[r][c]]
        for level in range(1, WALL_CLEARANCE):
            next_frontier = []
            for r, c in frontier:
                for nr, nc, _ in self.neighbours(r, c):
                    if distance[nr][nc] > level:
                        distance[nr][nc] = level
                        next_frontier.append((nr, nc))
            frontier = next_frontier
        return distance

    def nearest_walkable(self, x, y):
        """The walkable square closest to a plan point."""
        best, best_distance = None, math.inf
        for row in range(self.rows):
            for column in range(self.columns):
                if self.walkable[row][column]:
                    cx, cy = self.centre(row, column)
                    d = math.hypot(cx - x, cy - y)
                    if d < best_distance:
                        best, best_distance = (row, column), d
        return best

    def shortest_paths_from(self, starts):
        """Dijkstra from all start squares at once. Returns (cost, came_from) for every reached square."""
        cost = {square: 0.0 for square in starts}
        came_from = {square: None for square in starts}
        queue = [(0.0, square) for square in starts]
        while queue:
            so_far, (row, column) = heapq.heappop(queue)
            if so_far > cost[(row, column)]:
                continue
            for r, c, length in self.neighbours(row, column):
                if not self.walkable[r][c]:
                    continue
                near_wall = self.wall_distance[r][c] < WALL_CLEARANCE
                new_cost = so_far + length * (WALL_PENALTY if near_wall else 1.0)
                if new_cost < cost.get((r, c), math.inf):
                    cost[(r, c)] = new_cost
                    came_from[(r, c)] = (row, column)
                    heapq.heappush(queue, (new_cost, (r, c)))
        return cost, came_from

    def clear_line(self, a, b):
        """Can you walk in a straight line from square a to square b without touching a blocked square?"""
        (r1, c1), (r2, c2) = a, b
        steps = int(max(abs(r2 - r1), abs(c2 - c1)) * 2) + 1
        for i in range(steps + 1):
            t = i / steps
            r, c = round(r1 + (r2 - r1) * t), round(c1 + (c2 - c1) * t)
            if not self.walkable[r][c] or self.wall_distance[r][c] < 2:
                return False
        return True

    def straighten(self, squares):
        """Drop in-between squares wherever a straight line works ("string pulling")."""
        kept = [squares[0]]
        i = 0
        while i < len(squares) - 1:
            j = len(squares) - 1
            while j > i + 1 and not self.clear_line(squares[i], squares[j]):
                j -= 1
            kept.append(squares[j])
            i = j
        return kept


def routes_for_floor(outlines, blockers, entrances, rooms):
    """
    Shortest route to every room on one floor.
    outlines  : building outline polygons on this plan
    blockers  : every room / core / void polygon
    entrances : [(x, y), ...] doors (floor 1) or stairs (other floors)
    rooms     : [{'number', 'points'}, ...]
    Returns {room number: [[x, y], ...] from entrance to room edge} (rooms that can't be reached are left out).
    """
    if not entrances:
        return {}
    grid = FloorGrid(outlines, blockers)
    starts = {grid.nearest_walkable(x, y): (x, y) for x, y in entrances}
    cost, came_from = grid.shortest_paths_from(list(starts))

    routes = {}
    for room in rooms:
        # Squares just outside this room's edge are where the walk ends.
        goals = [square for square in cost
                 if distance_to_edge(room['points'], *grid.centre(*square)) <= STEP * 1.5]
        if not goals:
            continue
        square = min(goals, key=cost.get)
        squares = []
        while square is not None:
            squares.append(square)
            square = came_from[square]
        squares.reverse()  # entrance first

        path = [list(starts[squares[0]])] + [list(grid.centre(*s)) for s in grid.straighten(squares)]
        routes[room['number']] = [[round(x, 1), round(y, 1)] for x, y in path]
    return routes
