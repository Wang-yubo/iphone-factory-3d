"""
用 Blender 无头模式程序化生成 1:1 手机模型并导出 GLB。

尺寸按 iPhone Pro 系列的公开规格取整（单位：米）：
  长 149.8mm × 宽 71.8mm × 厚 8.25mm，四角圆角 11.5mm
坐标约定（Blender）：
  X = 机身长边，Y = 短边，Z = 厚度（屏幕朝 +Z）
导出为 glTF 后：X = 长边，Y = 厚度，Z = 短边 —— 与项目里在制品的朝向一致。

运行：
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender_phone.py
"""
import bpy
import bmesh
import math
import os
import sys

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "public", "models", "iphone18pro.glb")

# ---------------- 尺寸 ----------------
W = 0.1498      # 长边 (X)
H = 0.0718      # 短边 (Y)
T = 0.00825     # 厚度 (Z)
R = 0.0115      # 轮廓圆角
BEVEL = 0.0011  # 边缘倒角


def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials):
        for b in list(block):
            if b.users == 0:
                block.remove(b)


def mat(name, color, metallic=0.0, roughness=0.5, emission=None, emission_strength=0.0):
    m = bpy.data.materials.new(name)
    if not m.node_tree:
        m.use_nodes = True
    bsdf = None
    for n in m.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            bsdf = n
            break
    if bsdf is None:  # 极旧/极新的节点布局兜底
        for n in m.node_tree.nodes:
            if n.type == 'OUTPUT_MATERIAL' and n.inputs['Surface'].links:
                bsdf = n.inputs['Surface'].links[0].from_node
                break
    if bsdf is None:
        raise RuntimeError('找不到 Principled BSDF 节点: ' + name)
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return m


def rounded_rect_points(w, h, r, seg=10):
    """逆时针走一圈圆角矩形轮廓（XY 平面）"""
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    corners = [
        (w / 2 - r, h / 2 - r, 0.0),
        (-w / 2 + r, h / 2 - r, 90.0),
        (-w / 2 + r, -h / 2 + r, 180.0),
        (w / 2 - r, -h / 2 + r, 270.0),
    ]
    pts = []
    for cx, cy, a0 in corners:
        for i in range(seg + 1):
            a = math.radians(a0 + 90.0 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def solid_from_outline(name, pts, z0, thickness, material, bevel=None):
    """把 2D 轮廓挤出成实体，可选边缘倒角"""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    verts = [bm.verts.new((x, y, z0)) for (x, y) in pts]
    face = bm.faces.new(verts)
    bmesh.ops.recalc_face_normals(bm, faces=[face])

    res = bmesh.ops.extrude_face_region(bm, geom=[face])
    up = [v for v in res["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, thickness), verts=up)

    bm.normal_update()
    if bevel:
        edges = [e for e in bm.edges if e.calc_length() > 1e-6]
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=2,
                        affect='EDGES', clamp_overlap=True, profile=0.5)

    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(material)
    return obj


def rounded_slab(name, w, h, r, z, t, material, bevel=0.0004):
    return solid_from_outline(name, rounded_rect_points(w, h, r), z, t, material, bevel=bevel)


def cylinder(name, radius, depth, x, y, z, material, axis='Z', verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth,
                                        location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    if axis == 'X':
        obj.rotation_euler = (0, math.radians(90), 0)
    elif axis == 'Y':
        obj.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(material)
    return obj


def box(name, sx, sy, sz, x, y, z, material, rot_y=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx, sy, sz)
    obj.rotation_euler = (0, rot_y, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(material)
    return obj


def build():
    clear()

    # ---------------- 材质 ----------------
    titanium = mat("Titanium", (0.42, 0.43, 0.45), metallic=1.0, roughness=0.26)
    back_glass = mat("BackGlass", (0.10, 0.11, 0.13), metallic=0.15, roughness=0.14)
    screen = mat("Screen", (0.015, 0.03, 0.045), metallic=0.0, roughness=0.06,
                 emission=(0.05, 0.28, 0.42), emission_strength=1.4)
    lens = mat("LensGlass", (0.012, 0.014, 0.02), metallic=0.2, roughness=0.03)
    dark = mat("Plastic", (0.03, 0.035, 0.04), metallic=0.1, roughness=0.6)
    flash = mat("Flash", (0.85, 0.83, 0.72), metallic=0.0, roughness=0.35,
                emission=(1.0, 0.95, 0.8), emission_strength=0.6)

    parts_ti, parts_glass, parts_screen, parts_lens, parts_dark, parts_flash = [], [], [], [], [], []

    # ---------------- 机身（钛金属中框） ----------------
    body = rounded_slab("Body", W, H, R, -T / 2, T, titanium, bevel=BEVEL)
    parts_ti.append(body)

    # ---------------- 屏幕（前面板玻璃 + 显示区） ----------------
    front = rounded_slab("FrontGlass", W - 0.0016, H - 0.0016, R - 0.0008,
                         T / 2 - 0.0004, 0.0005, dark, bevel=0.0002)
    parts_dark.append(front)
    disp = rounded_slab("Display", W - 0.0042, H - 0.0042, R - 0.0021,
                        T / 2 + 0.00012, 0.00035, screen, bevel=0.0002)
    parts_screen.append(disp)

    # 灵动岛
    island = rounded_slab("Island", 0.0255, 0.0074, 0.0037,
                          T / 2 + 0.0005, 0.0003, dark, bevel=0.0001)
    island.location = (W / 2 - 0.026, 0, 0)
    parts_dark.append(island)

    # ---------------- 背板玻璃 ----------------
    back = rounded_slab("BackGlass", W - 0.0022, H - 0.0022, R - 0.0011,
                        -T / 2 - 0.0003, 0.0006, back_glass, bevel=0.0003)
    parts_glass.append(back)

    # ---------------- 相机模组（背面左上） ----------------
    plat_w, plat_h = 0.0372, 0.0384
    px = W / 2 - plat_w / 2 - 0.0062
    py = H / 2 - plat_h / 2 - 0.0058
    plateau = rounded_slab("Plateau", plat_w, plat_h, 0.0092,
                           -T / 2 - 0.0024, 0.0024, titanium, bevel=0.0008)
    plateau.location = (px, py, 0)
    parts_ti.append(plateau)

    # 三颗镜头（三角排布）
    lens_pts = [(-0.0088, 0.0092), (-0.0088, -0.0092), (0.0088, 0.0)]
    for i, (dx, dy) in enumerate(lens_pts):
        # 镜筒环
        ring = cylinder(f"LensRing{i}", 0.0092, 0.0016, px + dx, py + dy,
                        -T / 2 - 0.0026, titanium, verts=40)
        parts_ti.append(ring)
        # 镜片
        gl = cylinder(f"Lens{i}", 0.0074, 0.0010, px + dx, py + dy,
                      -T / 2 - 0.0031, lens, verts=40)
        parts_lens.append(gl)
        # 高光点
        hl = cylinder(f"LensHL{i}", 0.0022, 0.0004, px + dx + 0.0022, py + dy + 0.0022,
                      -T / 2 - 0.0035, flash, verts=16)
        parts_flash.append(hl)

    # 闪光灯 + 激光雷达
    fl = cylinder("Flash", 0.0034, 0.0008, px + 0.0092, py + 0.0128, -T / 2 - 0.0030, flash, verts=20)
    parts_flash.append(fl)
    lidar = cylinder("LiDAR", 0.0030, 0.0008, px + 0.0092, py - 0.0132, -T / 2 - 0.0030, lens, verts=20)
    parts_lens.append(lidar)

    # ---------------- 侧键 ----------------
    # 音量键（-Y 侧）
    for i, oy in enumerate((-0.0105, -0.0045)):
        b = box(f"VolBtn{i}", 0.0175, 0.0016, 0.0013, 0.012, -H / 2 - 0.0004, 0, titanium)
        b.location.y = -H / 2 + 0.0002
        parts_ti.append(b)
    # 静音/操作键（-Y 侧靠上）
    ab = box("ActionBtn", 0.0095, 0.0016, 0.0013, 0.028, -H / 2, 0, titanium)
    parts_ti.append(ab)
    # 电源键（+Y 侧）
    pb = box("PowerBtn", 0.0205, 0.0016, 0.0013, 0.012, H / 2, 0, titanium)
    parts_ti.append(pb)

    # ---------------- 底部接口 ----------------
    # USB-C 开口（端面上的圆角长槽）
    usb = box("USBSlot", 0.0012, 0.0086, 0.0026, W / 2 - 0.0004, 0, 0, dark)
    parts_dark.append(usb)

    # 扬声器孔
    for i in range(6):
        hole = cylinder(f"Speaker{i}", 0.00062, 0.0012,
                        W / 2 - 0.0004, -0.0205 + i * 0.0021, 0, dark, axis='X', verts=12)
        parts_dark.append(hole)
    # 麦克风孔
    mic = cylinder("Mic", 0.0006, 0.0012, W / 2 - 0.0004, 0.0205, 0, dark, axis='X', verts=12)
    parts_dark.append(mic)

    # ---------------- 按材质合并 ----------------
    def join(objs, name):
        for o in bpy.context.selected_objects:
            o.select_set(False)
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        obj = bpy.context.active_object
        obj.name = name
        return obj

    groups = [
        (parts_ti, "Frame"),
        (parts_glass, "Back"),
        (parts_screen, "Display"),
        (parts_lens, "Lenses"),
        (parts_dark, "Details"),
        (parts_flash, "Lights"),
    ]
    finals = [join(objs, name) for objs, name in groups if objs]

    # 统一加个轻微平滑，避免硬邦邦
    for o in finals:
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.shade_auto_smooth(angle=math.radians(38)) if hasattr(bpy.ops.object, "shade_auto_smooth") else None
        o.select_set(False)

    # 所有部件统一中心到原点
    bpy.ops.object.empty_add(location=(0, 0, 0))
    root = bpy.context.active_object
    root.name = "iPhone18Pro"
    for o in finals:
        o.parent = root

    return finals


def export():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True,
    )


if __name__ == "__main__":
    build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    export()
    print("EXPORTED:", OUT, os.path.getsize(OUT), "bytes")
