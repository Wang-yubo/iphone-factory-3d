"""
程序化生成一名中年男性保安（1.72m），导出 GLB 给项目用。

做法：不雕不绑，用参数化几何做"比例正确 + 制服细节"的中模。
关键部件单独成对象并把原点放在关节上（髋/肩/颈），
这样在 three.js 里直接按节点名旋转就能走路。

坐标：Blender Z 向上，人物面朝 -Y。
导出 glTF（Y-up）后：人物面朝 +Z，与项目里其它角色的朝向一致。

运行：
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender_guard.py
"""
import bpy
import bmesh
import math
import os

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "public", "models", "guard.glb")

# ---------------- 关键尺寸 ----------------
H_HIP = 0.92        # 髋关节高度
H_SHOULDER = 1.40   # 肩关节高度
H_NECK = 1.46
H_HEAD = 1.60
W_SHOULDER = 0.44   # 肩宽
W_HIP = 0.33

NAVY = (0.055, 0.075, 0.105)
NAVY_DARK = (0.035, 0.048, 0.068)
SKIN = (0.72, 0.52, 0.38)
SKIN_DARK = (0.58, 0.40, 0.29)
HAIR = (0.22, 0.21, 0.20)
GOLD = (0.72, 0.58, 0.22)
LEATHER = (0.045, 0.045, 0.05)
STEEL = (0.55, 0.57, 0.6)
WHITE = (0.82, 0.84, 0.86)
PLASTIC = (0.08, 0.09, 0.1)


def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
        for b in list(block):
            if getattr(b, "users", 0) == 0:
                block.remove(b)


def mat(name, color, metallic=0.0, roughness=0.6):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    if not m.node_tree:
        m.use_nodes = True
    bsdf = None
    for n in m.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            bsdf = n
            break
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return m


def tapered(name, w0, d0, w1, d1, z0, z1, material, y_off0=0.0, y_off1=0.0):
    """上下截面不同的方块（躯干、四肢用）"""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    verts = []
    for (w, d, z, yo) in ((w0, d0, z0, y_off0), (w1, d1, z1, y_off1)):
        for sx in (-1, 1):
            for sy in (-1, 1):
                verts.append(bm.verts.new((sx * w / 2, sy * d / 2 + yo, z)))
    # 0..3 底面，4..7 顶面（顺序：-x-y, -x+y, +x-y, +x+y）
    bm.faces.new((verts[0], verts[1], verts[3], verts[2]))
    bm.faces.new((verts[4], verts[6], verts[7], verts[5]))
    bm.faces.new((verts[0], verts[2], verts[6], verts[4]))
    bm.faces.new((verts[2], verts[3], verts[7], verts[6]))
    bm.faces.new((verts[3], verts[1], verts[5], verts[7]))
    bm.faces.new((verts[1], verts[0], verts[4], verts[5]))
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(material)
    return obj


def cube(name, sx, sy, sz, x, y, z, material):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, y, z))
    o = bpy.context.active_object
    o.name = name
    o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    return o


def sphere(name, rx, ry, rz, x, y, z, material, seg=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(8, seg // 2),
                                         radius=1.0, location=(x, y, z))
    o = bpy.context.active_object
    o.name = name
    o.scale = (rx, ry, rz)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o


def cyl(name, r, h, x, y, z, material, axis='Z', seg=24, rx_scale=1.0, ry_scale=1.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=h, location=(x, y, z))
    o = bpy.context.active_object
    o.name = name
    o.scale = (rx_scale, ry_scale, 1.0)
    if axis == 'X':
        o.rotation_euler = (0, math.radians(90), 0)
    elif axis == 'Y':
        o.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o


def bevel(obj, width=0.008, segments=2):
    m = obj.modifiers.new("Bevel", 'BEVEL')
    m.width = width
    m.segments = segments
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(40)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=m.name)


def set_origin(obj, x, y, z):
    bpy.context.scene.cursor.location = (x, y, z)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    obj.select_set(False)


def build():
    clear()

    # ---------------- 材质 ----------------
    m_navy = mat("UniformNavy", NAVY, roughness=0.72)
    m_navy_dark = mat("UniformDark", NAVY_DARK, roughness=0.75)
    m_skin = mat("Skin", SKIN, roughness=0.62)
    m_skin_d = mat("SkinDark", SKIN_DARK, roughness=0.65)
    m_hair = mat("Hair", HAIR, roughness=0.85)
    m_gold = mat("Badge", GOLD, metallic=1.0, roughness=0.32)
    m_leather = mat("Leather", LEATHER, roughness=0.55)
    m_steel = mat("Steel", STEEL, metallic=0.9, roughness=0.35)
    m_white = mat("Shirt", WHITE, roughness=0.7)
    m_plastic = mat("Radio", PLASTIC, roughness=0.5)

    parts = []

    # ================= 腿 =================
    for side, sx in (("L", -1), ("R", 1)):
        x = sx * 0.088
        leg = tapered(f"leg{side}", 0.152, 0.19, 0.128, 0.155, 0.10, H_HIP, m_navy)
        leg.location.x = x
        bevel(leg, 0.01, 2)
        set_origin(leg, x, 0, H_HIP)
        parts.append(leg)

        # 皮鞋（略微前伸）
        shoe = tapered(f"shoe{side}", 0.125, 0.26, 0.115, 0.24, 0.0, 0.075, m_leather, 0.0, -0.03)
        shoe.location.x = x
        shoe.location.y = -0.035
        bevel(shoe, 0.012, 2)
        set_origin(shoe, x, 0, H_HIP)
        parts.append(shoe)

        # 裤脚线
        cuff = cube(f"cuff{side}", 0.14, 0.165, 0.02, x, 0, 0.115, m_navy_dark)
        set_origin(cuff, x, 0, H_HIP)
        parts.append(cuff)

    # ================= 髋 / 腰带 =================
    hips = tapered("hips", W_HIP, 0.215, 0.345, 0.225, 0.86, 1.02, m_navy)
    bevel(hips, 0.012, 2)
    parts.append(hips)

    belt = cube("belt", 0.352, 0.238, 0.055, 0, 0, 0.985, m_leather)
    bevel(belt, 0.006, 1)
    parts.append(belt)
    buckle = cube("buckle", 0.062, 0.02, 0.048, 0, -0.122, 0.985, m_gold)
    bevel(buckle, 0.004, 1)
    parts.append(buckle)
    # 腰带上的对讲机 / 手电
    radio = cube("radioBelt", 0.05, 0.04, 0.13, 0.19, -0.02, 0.93, m_plastic)
    bevel(radio, 0.005, 1)
    parts.append(radio)
    torch = cyl("torch", 0.022, 0.16, -0.185, 0.0, 0.91, m_steel)
    parts.append(torch)

    # ================= 躯干 =================
    torso = tapered("torso", 0.335, 0.215, W_SHOULDER, 0.245, 1.0, 1.40, m_navy)
    bevel(torso, 0.014, 2)
    parts.append(torso)

    # 衬衣领口（V 形白衬衫 + 领带）
    collar = tapered("collar", 0.16, 0.08, 0.19, 0.1, 1.38, 1.44, m_white)
    parts.append(collar)
    tie = tapered("tie", 0.045, 0.02, 0.06, 0.02, 1.12, 1.4, m_navy_dark, -0.1, -0.115)
    parts.append(tie)

    # 门襟与口袋
    placket = cube("placket", 0.03, 0.012, 0.36, 0, -0.117, 1.2, m_navy_dark)
    parts.append(placket)
    for sx in (-1, 1):
        pocket = cube(f"pocket{sx}", 0.11, 0.012, 0.09, sx * 0.115, -0.118, 1.13, m_navy_dark)
        parts.append(pocket)
        # 肩章
        ep = cube(f"epaulette{sx}", 0.1, 0.05, 0.016, sx * 0.17, -0.03, 1.405, m_navy_dark)
        parts.append(ep)
    # 胸牌 + 警徽
    badge = cube("badge", 0.055, 0.012, 0.065, -0.13, -0.125, 1.28, m_gold)
    bevel(badge, 0.004, 1)
    parts.append(badge)
    nameplate = cube("nameplate", 0.09, 0.012, 0.03, 0.13, -0.125, 1.26, m_white)
    parts.append(nameplate)
    # 肩部对讲机
    radio2 = cube("radioShoulder", 0.055, 0.045, 0.12, 0.2, -0.06, 1.34, m_plastic)
    bevel(radio2, 0.006, 1)
    parts.append(radio2)
    antenna = cyl("antenna", 0.006, 0.14, 0.2, -0.06, 1.47, m_plastic, seg=8)
    parts.append(antenna)

    # ================= 手臂 =================
    for side, sx in (("L", -1), ("R", 1)):
        x = sx * (W_SHOULDER / 2 - 0.045)
        arm = tapered(f"arm{side}", 0.115, 0.145, 0.095, 0.12, 0.98, H_SHOULDER, m_navy)
        arm.location.x = x
        bevel(arm, 0.012, 2)
        set_origin(arm, sx * (W_SHOULDER / 2 - 0.045), 0, H_SHOULDER)
        parts.append(arm)

        hand = sphere(f"hand{side}", 0.048, 0.055, 0.062, x, -0.01, 0.955, m_skin, seg=16)
        set_origin(hand, x, 0, H_SHOULDER)
        parts.append(hand)

    # ================= 头颈 =================
    neck = cyl("neck", 0.055, 0.1, 0, 0, H_NECK - 0.02, m_skin, seg=18)
    parts.append(neck)

    head = sphere("head", 0.088, 0.098, 0.112, 0, 0, H_HEAD, m_skin, seg=24)
    parts.append(head)
    # 下颌
    jaw = sphere("jaw", 0.078, 0.086, 0.07, 0, -0.012, H_HEAD - 0.075, m_skin_d, seg=20)
    parts.append(jaw)
    # 鼻
    nose = cube("nose", 0.026, 0.034, 0.045, 0, -0.092, H_HEAD - 0.012, m_skin)
    bevel(nose, 0.006, 2)
    parts.append(nose)
    # 耳
    for sx in (-1, 1):
        ear = sphere(f"ear{sx}", 0.018, 0.026, 0.04, sx * 0.088, 0.005, H_HEAD - 0.005, m_skin, seg=12)
        parts.append(ear)
    # 眉骨 + 眼（简单体块，远看有结构就行）
    brow = cube("brow", 0.13, 0.03, 0.022, 0, -0.082, H_HEAD + 0.035, m_skin_d)
    parts.append(brow)
    for sx in (-1, 1):
        eye = sphere(f"eye{sx}", 0.017, 0.012, 0.012, sx * 0.036, -0.086, H_HEAD + 0.012, m_plastic, seg=10)
        parts.append(eye)
    # 鬓角与后脑的头发
    hair = sphere("hair", 0.091, 0.1, 0.09, 0, 0.008, H_HEAD + 0.045, m_hair, seg=20)
    parts.append(hair)

    # ================= 大檐帽 =================
    cap = cyl("cap", 0.105, 0.075, 0, 0.005, H_HEAD + 0.105, m_navy_dark, seg=28)
    parts.append(cap)
    band = cyl("capBand", 0.108, 0.022, 0, 0.005, H_HEAD + 0.072, m_leather, seg=28)
    parts.append(band)
    # 帽檐：压扁的圆柱前半
    brim = cyl("brim", 0.135, 0.012, 0, -0.06, H_HEAD + 0.075, m_leather, seg=28,
               rx_scale=1.0, ry_scale=0.72)
    parts.append(brim)
    capbadge = cyl("capBadge", 0.026, 0.008, 0, -0.1, H_HEAD + 0.09, m_gold, axis='Y', seg=16)
    parts.append(capbadge)

    # ---------------- 合并静态部件（按材质）----------------
    animated = {"legL", "legR", "armL", "armR"}
    groups = {}
    for o in parts:
        if o.name in animated:
            continue
        key = o.data.materials[0].name if o.data.materials else "misc"
        groups.setdefault(key, []).append(o)

    for key, objs in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        bpy.context.active_object.name = "body_" + key[:12]

    # ---------------- 父子关系 ----------------
    bpy.ops.object.empty_add(location=(0, 0, 0))
    root = bpy.context.active_object
    root.name = "SecurityGuard"

    for o in bpy.data.objects:
        if o is root or o.type != 'MESH':
            continue
        o.parent = root
        o.matrix_parent_inverse = root.matrix_world.inverted()

    return root


def export():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
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
    export()
    print("EXPORTED:", OUT, os.path.getsize(OUT), "bytes")
