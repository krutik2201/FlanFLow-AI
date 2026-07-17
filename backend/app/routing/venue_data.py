"""
Venue Topology — FanFlow AI
Hardcoded graph representing a FIFA World Cup 2026-scale stadium.

Node layout (SVG coordinate space 0–1000 × 0–800):
- Center field at ~(500, 400)
- Concourse ring at ~300m radius
- Entry gates on the outer perimeter
- Amenities within the concourse ring

In production this would be loaded from a GIS data store.
"""

from __future__ import annotations

from app.routing.graph import Edge, Node, NodeType, VenueGraph


def build_venue_graph() -> VenueGraph:
    """Construct and return the FanFlow AI venue graph."""
    g = VenueGraph()

    # ------------------------------------------------------------------ #
    # NODES                                                                 #
    # ------------------------------------------------------------------ #

    # Entry Gates (outer ring)
    gates = [
        Node("gate_a",  "Gate A (Main Entry)",          NodeType.GATE,      x=500, y=30),
        Node("gate_b",  "Gate B (West Entry)",           NodeType.GATE,      x=60,  y=400),
        Node("gate_c",  "Gate C (East Entry)",           NodeType.GATE,      x=940, y=400),
        Node("gate_d",  "Gate D (South Entry)",          NodeType.GATE,      x=500, y=770),
        Node("gate_d2", "Gate D2 (South Overflow)",      NodeType.GATE,      x=620, y=770),
    ]

    # Concourse junctions (mid-ring)
    concourses = [
        Node("conc_north", "North Concourse",   NodeType.CONCOURSE, x=500, y=160),
        Node("conc_south", "South Concourse",   NodeType.CONCOURSE, x=500, y=640),
        Node("conc_east",  "East Concourse",    NodeType.CONCOURSE, x=780, y=400),
        Node("conc_west",  "West Concourse",    NodeType.CONCOURSE, x=220, y=400),
        Node("conc_ne",    "NE Concourse",      NodeType.CONCOURSE, x=680, y=220),
        Node("conc_nw",    "NW Concourse",      NodeType.CONCOURSE, x=320, y=220),
        Node("conc_se",    "SE Concourse",      NodeType.CONCOURSE, x=680, y=580),
        Node("conc_sw",    "SW Concourse",      NodeType.CONCOURSE, x=320, y=580),
    ]

    # Seating sections (inner ring — grouped blocks)
    sections = [
        Node("sec_101", "Section 101",  NodeType.SECTION, x=500, y=250),
        Node("sec_102", "Section 102",  NodeType.SECTION, x=620, y=270),
        Node("sec_103", "Section 103",  NodeType.SECTION, x=720, y=340),
        Node("sec_104", "Section 104",  NodeType.SECTION, x=720, y=460),
        Node("sec_105", "Section 105",  NodeType.SECTION, x=620, y=530),
        Node("sec_106", "Section 106",  NodeType.SECTION, x=500, y=550),
        Node("sec_107", "Section 107",  NodeType.SECTION, x=380, y=530),
        Node("sec_108", "Section 108",  NodeType.SECTION, x=280, y=460),
        Node("sec_109", "Section 109",  NodeType.SECTION, x=280, y=340),
        Node("sec_110", "Section 110",  NodeType.SECTION, x=380, y=270),
    ]

    # Amenities
    amenities = [
        Node("restroom_n",    "Restrooms (North)",          NodeType.AMENITY, x=450, y=200),
        Node("restroom_s",    "Restrooms (South)",          NodeType.AMENITY, x=450, y=600),
        Node("restroom_e",    "Restrooms (East)",           NodeType.AMENITY, x=750, y=400),
        Node("restroom_w",    "Restrooms (West)",           NodeType.AMENITY, x=250, y=400),
        Node("quiet_room",    "Quiet / Sensory Room",       NodeType.AMENITY, x=160, y=280),
        Node("medical_station","Medical Station",           NodeType.AMENITY, x=500, y=110),
        Node("food_court_main","Food Court (Main)",         NodeType.AMENITY, x=580, y=160),
        Node("food_court_west","Food Court (West)",         NodeType.AMENITY, x=160, y=500),
        Node("elevator_north","Elevator (North)",           NodeType.AMENITY, x=420, y=175),
        Node("elevator_south","Elevator (South)",           NodeType.AMENITY, x=420, y=625),
    ]

    # Transport / Parking access
    transport_nodes = [
        Node("transit_rail", "Rail / Metro Station",  NodeType.TRANSPORT, x=500, y=0),
        Node("transit_bus",  "Bus Terminal",           NodeType.TRANSPORT, x=700, y=15),
        Node("parking_p1",   "Parking Lot P1 (North)",NodeType.TRANSPORT, x=350, y=0),
        Node("parking_p2",   "Parking Lot P2 (South)",NodeType.TRANSPORT, x=650, y=800),
    ]

    for node in gates + concourses + sections + amenities + transport_nodes:
        g.add_node(node)

    # ------------------------------------------------------------------ #
    # EDGES                                                                 #
    # ------------------------------------------------------------------ #
    # Format: Edge(from, to, dist_m, has_stairs, has_elevator)
    # All edges are undirected (add_edge stores both directions).

    edges = [
        # ---- Transport → Gates ----------------------------------------
        Edge("transit_rail", "gate_a",      30,  False, False),
        Edge("transit_bus",  "gate_a",      80,  False, False),
        Edge("parking_p1",   "gate_a",     120,  False, False),
        Edge("parking_p2",   "gate_d",      90,  False, False),
        Edge("parking_p2",   "gate_d2",     60,  False, False),

        # ---- Gates → Concourses (main entry corridors) ----------------
        Edge("gate_a",  "conc_north",   80,  False, False),
        Edge("gate_b",  "conc_west",    80,  False, False),
        Edge("gate_c",  "conc_east",    80,  False, False),
        Edge("gate_d",  "conc_south",   80,  False, False),
        Edge("gate_d2", "conc_south",   60,  False, False),

        # ---- Concourse ring (outer loop — no stairs) ------------------
        Edge("conc_north", "conc_ne",   120, False, False),
        Edge("conc_north", "conc_nw",   120, False, False),
        Edge("conc_ne",    "conc_east", 120, False, False),
        Edge("conc_nw",    "conc_west", 120, False, False),
        Edge("conc_east",  "conc_se",   120, False, False),
        Edge("conc_west",  "conc_sw",   120, False, False),
        Edge("conc_se",    "conc_south",120, False, False),
        Edge("conc_sw",    "conc_south",120, False, False),

        # ---- Concourses → Sections ------------------------------------
        # Upper (north) side — stairs to reach upper bowl
        Edge("conc_north", "sec_101",   60,  True,  False),
        Edge("conc_ne",    "sec_102",   55,  True,  False),
        Edge("conc_ne",    "sec_103",   55,  True,  False),
        Edge("conc_east",  "sec_104",   60,  True,  False),
        Edge("conc_se",    "sec_105",   55,  True,  False),
        Edge("conc_south", "sec_106",   60,  True,  False),
        Edge("conc_sw",    "sec_107",   55,  True,  False),
        Edge("conc_west",  "sec_108",   60,  True,  False),
        Edge("conc_nw",    "sec_109",   55,  True,  False),
        Edge("conc_nw",    "sec_110",   55,  True,  False),

        # ---- Elevator routes (step-free alternatives) -----------------
        # North elevator: gate_a → concourse → elevator_north → sec_101 area
        Edge("conc_north",   "elevator_north", 40, False, False),
        Edge("elevator_north","sec_101",        50, False, True),   # elevator leg
        Edge("elevator_north","sec_102",        70, False, True),
        # South elevator: conc_south → elevator_south → sec_106 area
        Edge("conc_south",   "elevator_south", 40, False, False),
        Edge("elevator_south","sec_106",        50, False, True),
        Edge("elevator_south","sec_105",        70, False, True),

        # ---- Amenities connected to nearest concourse/corridor --------
        Edge("conc_north",  "restroom_n",     35,  False, False),
        Edge("conc_south",  "restroom_s",     35,  False, False),
        Edge("conc_east",   "restroom_e",     35,  False, False),
        Edge("conc_west",   "restroom_w",     35,  False, False),
        Edge("conc_west",   "quiet_room",     80,  False, False),
        Edge("gate_a",      "medical_station",45,  False, False),
        Edge("conc_north",  "food_court_main",60,  False, False),
        Edge("conc_west",   "food_court_west",50,  False, False),
    ]

    for edge in edges:
        g.add_edge(edge)

    return g


# Module-level singleton — imported by routers and the simulator.
VENUE_GRAPH: VenueGraph = build_venue_graph()
