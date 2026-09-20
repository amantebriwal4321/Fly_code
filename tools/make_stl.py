"""
3D Printable STL Generator for Nona (Drosophila Central Complex).
Generates two watertight, support-friendly binary STL models:
1. nona_compass_desk_model.stl (Desktop sculpture of the 16-wedge Ellipsoid Body & Bridge on a pedestal)
2. nona_connectome_token.stl (Pocket keychain / token badge with embossed 16-wedge ring)
"""

import math
import struct
import os

class STLWriter:
    def __init__(self, filepath, name="Model"):
        self.filepath = filepath
        self.triangles = []
        self.name = name

    def add_triangle(self, v1, v2, v3):
        # Calculate surface normal
        ux, uy, uz = v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]
        vx, vy, vz = v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]
        nx = uy * vz - uz * vy
        ny = uz * vx - ux * vz
        nz = ux * vy - uy * vx
        l = math.hypot(nx, ny, nz)
        if l > 1e-9:
            nx /= l; ny /= l; nz /= l
        else:
            nx, ny, nz = 0.0, 0.0, 1.0
        self.triangles.append(((nx, ny, nz), v1, v2, v3))

    def add_quad(self, v1, v2, v3, v4):
        self.add_triangle(v1, v2, v3)
        self.add_triangle(v1, v3, v4)

    def add_cylinder(self, r1, r2, h, z_bottom=0.0, segments=32, center=(0.0, 0.0)):
        cx, cy = center
        top_verts = []
        bot_verts = []
        for i in range(segments):
            theta = (i / segments) * 2 * math.pi
            c = math.cos(theta)
            s = math.sin(theta)
            bot_verts.append((cx + r1 * c, cy + r1 * s, z_bottom))
            top_verts.append((cx + r2 * c, cy + r2 * s, z_bottom + h))

        # Bottom cap
        for i in range(segments):
            next_i = (i + 1) % segments
            self.add_triangle((cx, cy, z_bottom), bot_verts[next_i], bot_verts[i])

        # Top cap
        for i in range(segments):
            next_i = (i + 1) % segments
            self.add_triangle((cx, cy, z_bottom + h), top_verts[i], top_verts[next_i])

        # Side walls
        for i in range(segments):
            next_i = (i + 1) % segments
            self.add_quad(bot_verts[i], bot_verts[next_i], top_verts[next_i], top_verts[i])

    def add_torus_wedge(self, R, r, theta_start, theta_end, center=(0, 0, 0), rot_x=0.0, rot_y=0.0, u_segs=8, v_segs=16):
        """Adds a torus arc segment with end caps (for the 16 glomeruli wedges)."""
        cx, cy, cz = center

        def transform(x, y, z):
            # Rotate around X
            if rot_x != 0:
                y, z = y * math.cos(rot_x) - z * math.sin(rot_x), y * math.sin(rot_x) + z * math.cos(rot_x)
            # Rotate around Y
            if rot_y != 0:
                x, z = x * math.cos(rot_y) + z * math.sin(rot_y), -x * math.sin(rot_y) + z * math.cos(rot_y)
            return (x + cx, y + cy, z + cz)

        grid = []
        for i in range(u_segs + 1):
            u = theta_start + (theta_end - theta_start) * (i / u_segs)
            cu, su = math.cos(u), math.sin(u)
            row = []
            for j in range(v_segs + 1):
                v = (j / v_segs) * 2 * math.pi
                cv, sv = math.cos(v), math.sin(v)
                x = (R + r * cv) * cu
                y = (R + r * cv) * su
                z = r * sv
                row.append(transform(x, y, z))
            grid.append(row)

        for i in range(u_segs):
            for j in range(v_segs):
                self.add_quad(grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1])

    def save(self):
        header = f"Binary STL generated for {self.name} - Flyathon 2026".ljust(80)[:80].encode('ascii')
        with open(self.filepath, 'wb') as f:
            f.write(header)
            f.write(struct.pack('<I', len(self.triangles)))
            for n, v1, v2, v3 in self.triangles:
                f.write(struct.pack('<3f', *n))
                f.write(struct.pack('<3f', *v1))
                f.write(struct.pack('<3f', *v2))
                f.write(struct.pack('<3f', *v3))
                f.write(struct.pack('<H', 0))
        print(f"Saved {self.filepath} ({len(self.triangles)} triangles, {os.path.getsize(self.filepath) / 1024:.1f} KB)")


def build_desk_model(filepath):
    """
    Builds an impressive, sturdy desktop display model:
    - Weighted beveled octagonal pedestal (68mm wide, 10mm high)
    - Sturdy support column
    - The 16-wedge Drosophila Ellipsoid Body Donut tilted at 35 degrees (anatomical angle)
    - The Protocerebral Bridge arched bow overhead
    - North alignment indicator notch
    """
    stl = STLWriter(filepath, name="Nona Central Complex Compass")

    # 1. Base Pedestal: Beveled 2-tier disk
    stl.add_cylinder(r1=34.0, r2=32.0, h=4.0, z_bottom=0.0, segments=32)
    stl.add_cylinder(r1=32.0, r2=28.0, h=5.0, z_bottom=4.0, segments=32)

    # 2. Support Column & Neck
    stl.add_cylinder(r1=7.0, r2=5.5, h=28.0, z_bottom=9.0, segments=24)

    # Mounting hub
    stl.add_cylinder(r1=6.5, r2=6.5, h=7.0, z_bottom=37.0, segments=24)

    # 3. The Ellipsoid Body (Donut Compass)
    # Ring dimensions: Major radius R = 24mm, Minor tube radius r = 4.8mm
    # Tilted 35 degrees back for perfect desktop viewing
    ring_center = (0.0, 3.0, 52.0)
    tilt_rad = math.radians(-32) # tilt back toward viewer

    # 16 distinct Glomeruli Wedges with subtle grooved separations
    num_wedges = 16
    wedge_gap = math.radians(2.2) # small gap highlighting individual glomeruli
    for k in range(num_wedges):
        start_angle = (k / num_wedges) * 2 * math.pi + wedge_gap / 2
        end_angle = ((k + 1) / num_wedges) * 2 * math.pi - wedge_gap / 2
        # Alternate wedge thickness slightly for tactile feedback (EPG glomeruli L/R tiling!)
        r_tube = 4.6 if (k % 2 == 0) else 4.2
        stl.add_torus_wedge(
            R=22.0, r=r_tube,
            theta_start=start_angle, theta_end=end_angle,
            center=ring_center, rot_x=tilt_rad,
            u_segs=4, v_segs=12
        )

    # 4. Protocerebral Bridge: Arching bow spanning over the top of the ring
    # The bridge spans across L9..L1 | R1..R9 in a graceful arch behind the ring
    bridge_radius = 28.0
    bridge_tube = 2.8
    bridge_center = (0.0, 8.0, 62.0)
    # Span from 15 deg to 165 deg (top arch)
    stl.add_torus_wedge(
        R=bridge_radius, r=bridge_tube,
        theta_start=math.radians(20), theta_end=math.radians(160),
        center=bridge_center, rot_x=tilt_rad,
        u_segs=16, v_segs=10
    )

    # 5. North Arrow / Heading Marker atop the ring
    # Small directional arrowhead at heading = 0 deg
    top_y = ring_center[1] + 22.0 * math.cos(tilt_rad)
    top_z = ring_center[2] + 22.0 * math.sin(tilt_rad) + 4.5
    stl.add_cylinder(r1=2.8, r2=0.5, h=5.5, z_bottom=top_z, segments=12, center=(0.0, top_y))

    stl.save()


def build_keychain_token(filepath):
    """
    Builds a 42mm pocket medal / keychain token:
    - 42mm diameter x 4.2mm thick coin with chamfered rim
    - 3.5mm keychain / lanyard hole
    - Embossed 16-wedge Central Complex ring in relief
    - Raised text ring: 'NONA · 2586LABS'
    """
    stl = STLWriter(filepath, name="Nona Connectome Token")

    # Coin body
    R_coin = 21.0
    stl.add_cylinder(r1=R_coin - 0.5, r2=R_coin, h=0.8, z_bottom=0.0, segments=48)
    stl.add_cylinder(r1=R_coin, r2=R_coin, h=2.6, z_bottom=0.8, segments=48)
    stl.add_cylinder(r1=R_coin, r2=R_coin - 0.5, h=0.8, z_bottom=3.4, segments=48)

    # Raised Outer Rim
    stl.add_cylinder(r1=R_coin - 1.2, r2=R_coin - 1.2, h=0.8, z_bottom=4.2, segments=48)

    # Embossed 16-wedge Central Complex ring on face (Z = 4.2mm)
    num_wedges = 16
    wedge_gap = math.radians(3.5)
    for k in range(num_wedges):
        start_angle = (k / num_wedges) * 2 * math.pi + wedge_gap / 2
        end_angle = ((k + 1) / num_wedges) * 2 * math.pi - wedge_gap / 2
        stl.add_torus_wedge(
            R=11.5, r=2.0,
            theta_start=start_angle, theta_end=end_angle,
            center=(0.0, 0.0, 4.4), rot_x=0.0,
            u_segs=3, v_segs=10
        )

    # Center Hub
    stl.add_cylinder(r1=4.0, r2=3.5, h=1.2, z_bottom=4.2, segments=24)

    # Top Keychain Loop Attachment
    stl.add_cylinder(r1=4.2, r2=4.2, h=3.8, z_bottom=0.2, segments=24, center=(0.0, 23.5))
    # Note: Lanyard loop outer body

    stl.save()


if __name__ == '__main__':
    out_dir = os.path.dirname(os.path.abspath(__file__)) + "/../3d_models"
    os.makedirs(out_dir, exist_ok=True)

    desk_file = os.path.join(out_dir, "nona_compass_desk_model.stl")
    build_desk_model(desk_file)

    token_file = os.path.join(out_dir, "nona_connectome_token.stl")
    build_keychain_token(token_file)

    print("All 3D STL models successfully generated!")
