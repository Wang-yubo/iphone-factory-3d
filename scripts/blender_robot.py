"""
具身智能机器人（人形，1.62m），白色圆润外壳 + 球关节 + 面部细节。
分件导出，关节原点在髋/肩/颈，前端可直接旋转做动作。

坐标：Blender Z 向上，正面朝 -Y。导出后正面朝 +Z。

运行：
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender_robot.py
"""
import bpy
import bmesh
import math
import os

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "public", "models", "robot.glb")

SHELL = (0.90, 0.91, 0.92)      # 白色外壳
SHELL_SOFT = (0.82, 0.84, 0.86)
DARK = (0.09, 0.10, 0.12)       # 关节/深色件
METAL = (0.35, 0.37, 0.40)
GLASS = (0.012, 0.02, 0.028)    # 面罩
GLOW = (0.20, 0.85, 1.0)        # 眼睛与核心光

H_HIP = 0.86
H_SHOULDER = 1.34
H_NECK = 1.44
H_HEAD = 1.53


def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
        for b in list(block):
            if getattr(b, "users", 0) == 0:
                block.remove(b)


def mat(name, color, metallic=0.0, roughness=0.5, emission=None, strength=0.0):
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
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    return m


def ellipsoid(name, rx, ry, rz, x, y, z, material, seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(10, seg // 2),
                                         radius=1.0, location=(x, y, z))
    o = bpy.context.active_object
    o.name = name
    o.scale = (rx, ry, rz)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o


def rounded_box(name, sx, sy, sz, x, y, z, material, bevel=0.03):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, y, z))
    o = bpy.context.active_object
    o.name = name
    o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    md = o.modifiers.new("Bevel", 'BEVEL')
    md.width = bevel
    md.segments = 4
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=md.name)
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o


def cyl(name, r, h, x, y, z, material, axis='Z', seg=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=h, location=(x, y, z))
    o = bpy.context.active_object
    o.name = name
    if axis == 'X':
        o.rotation_euler = (0, math.radians(90), 0)
    elif axis == 'Y':
        o.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o


def set_origin(obj, x, y, z):
    # 注意：origin_set 作用于"所有选中对象"，必须先清掉别的选择，
    # 否则上一个 join 留下的选中对象会被重复改原点（会把腿拉长一倍）。
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.scene.cursor.location = (x, y, z)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    obj.select_set(False)


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    return o


def build():
    clear()

    m_shell = mat("Shell", SHELL, metallic=0.06, roughness=0.24)
    m_soft = mat("ShellSoft", SHELL_SOFT, metallic=0.05, roughness=0.35)
    m_dark = mat("Joint", DARK, metallic=0.65, roughness=0.34)
    m_metal = mat("Metal", METAL, metallic=0.9, roughness=0.28)
    m_glass = mat("Visor", GLASS, metallic=0.25, roughness=0.06)
    m_glow = mat("Glow", GLOW, metallic=0.0, roughness=0.2, emission=GLOW, strength=2.4)

    parts = []

    # ---------------- 头 ----------------
    head_parts = []
    head = ellipsoid("headShell", 0.098, 0.104, 0.108, 0, 0, H_HEAD, m_shell, seg=32)
    head_parts.append(head)
    # 面罩（前脸内凹的深色玻璃）
    visor = ellipsoid("visor", 0.082, 0.05, 0.062, 0, -0.062, H_HEAD + 0.012, m_glass, seg=28)
    head_parts.append(visor)
    # 眼睛
    for sx in (-1, 1):
        eye = ellipsoid(f"eye{sx}", 0.017, 0.012, 0.017, sx * 0.033, -0.095, H_HEAD + 0.02, m_glow, seg=16)
        head_parts.append(eye)
    # 嘴部指示条
    mouth = rounded_box("mouth", 0.045, 0.012, 0.008, 0, -0.098, H_HEAD - 0.035, m_glow, bevel=0.003)
    head_parts.append(mouth)
    # 头顶传感器环
    ring = cyl("headRing", 0.052, 0.012, 0, 0, H_HEAD + 0.098, m_metal, seg=28)
    head_parts.append(ring)
    # 耳部圆盘
    for sx in (-1, 1):
        ear = cyl(f"ear{sx}", 0.03, 0.014, sx * 0.096, 0.004, H_HEAD + 0.004, m_metal, axis='X', seg=20)
        head_parts.append(ear)
        earGlow = cyl(f"earGlow{sx}", 0.017, 0.006, sx * 0.104, 0.004, H_HEAD + 0.004, m_glow, axis='X', seg=18)
        head_parts.append(earGlow)
    # 后脑散热缝
    for i in range(3):
        slot = rounded_box(f"slot{i}", 0.006, 0.02, 0.075, 0, 0.088, H_HEAD + 0.03 - i * 0.05, m_dark, bevel=0.002)
        head_parts.append(slot)
    head_obj = join(head_parts, "head")
    set_origin(head_obj, 0, 0, H_NECK)
    parts.append(head_obj)

    # ---------------- 颈 ----------------
    neck = cyl("neck", 0.045, 0.09, 0, 0, H_NECK - 0.03, m_dark, seg=20)
    parts.append(neck)
    neckBall = ellipsoid("neckBall", 0.052, 0.052, 0.05, 0, 0, H_NECK - 0.075, m_metal, seg=20)
    parts.append(neckBall)

    # ---------------- 躯干 ----------------
    torso_parts = []
    torso = ellipsoid("torsoShell", 0.165, 0.115, 0.225, 0, 0, 1.15, m_shell, seg=32)
    torso_parts.append(torso)
    # 胸甲
    chest = ellipsoid("chestPlate", 0.135, 0.075, 0.12, 0, -0.07, 1.22, m_soft, seg=28)
    torso_parts.append(chest)
    # 核心光
    core = cyl("core", 0.032, 0.012, 0, -0.135, 1.2, m_glow, axis='Y', seg=24)
    torso_parts.append(core)
    coreRing = cyl("coreRing", 0.045, 0.014, 0, -0.128, 1.2, m_metal, axis='Y', seg=28)
    torso_parts.append(coreRing)
    # 腰
    waist = ellipsoid("waist", 0.13, 0.095, 0.06, 0, 0, 0.97, m_dark, seg=24)
    torso_parts.append(waist)
    # 骨盆
    pelvis = ellipsoid("pelvis", 0.145, 0.1, 0.085, 0, 0, 0.9, m_shell, seg=28)
    torso_parts.append(pelvis)
    # 背部电池包
    pack = rounded_box("pack", 0.18, 0.05, 0.2, 0, 0.105, 1.17, m_soft, bevel=0.02)
    torso_parts.append(pack)
    torso_obj = join(torso_parts, "body")
    parts.append(torso_obj)

    # ---------------- 四肢 ----------------
    for side, sx in (("L", -1), ("R", 1)):
        ax = sx * 0.175
        # 肩球
        shoulder = ellipsoid(f"shoulderBall{side}", 0.062, 0.062, 0.062,
                             ax, 0, H_SHOULDER - 0.02, m_dark, seg=20)
        parts.append(shoulder)

        # 手臂：按世界坐标建，join 后再把原点挪到肩关节
        arm_parts = []
        arm_parts.append(ellipsoid(f"upperArm{side}", 0.052, 0.055, 0.115, ax, 0, H_SHOULDER - 0.115, m_shell, seg=24))
        arm_parts.append(ellipsoid(f"elbow{side}", 0.048, 0.048, 0.048, ax, 0, H_SHOULDER - 0.235, m_dark, seg=20))
        arm_parts.append(ellipsoid(f"foreArm{side}", 0.045, 0.048, 0.1, ax, 0, H_SHOULDER - 0.345, m_shell, seg=24))
        arm_parts.append(ellipsoid(f"wrist{side}", 0.038, 0.04, 0.038, ax, 0, H_SHOULDER - 0.45, m_metal, seg=18))
        arm_parts.append(rounded_box(f"palm{side}", 0.07, 0.05, 0.05, ax, 0, H_SHOULDER - 0.49, m_soft, bevel=0.012))
        for i, (dx, dz) in enumerate(((0.0, -0.035), (-0.028, -0.03), (0.028, -0.03))):
            arm_parts.append(
                ellipsoid(f"finger{side}{i}", 0.013, 0.016, 0.045, ax + dx, 0, H_SHOULDER - 0.545 + dz, m_soft, seg=12)
            )
        arm_obj = join(arm_parts, f"arm{side}")
        set_origin(arm_obj, ax, 0, H_SHOULDER)
        parts.append(arm_obj)

        # 髋球
        lx = sx * 0.095
        hip = ellipsoid(f"hipBall{side}", 0.068, 0.068, 0.068, lx, 0, H_HIP, m_dark, seg=20)
        parts.append(hip)

        leg_parts = []
        leg_parts.append(ellipsoid(f"thigh{side}", 0.072, 0.078, 0.19, lx, 0, H_HIP - 0.19, m_shell, seg=26))
        leg_parts.append(ellipsoid(f"knee{side}", 0.062, 0.062, 0.062, lx, -0.006, H_HIP - 0.4, m_dark, seg=20))
        leg_parts.append(ellipsoid(f"shin{side}", 0.06, 0.066, 0.175, lx, 0, H_HIP - 0.575, m_shell, seg=26))
        leg_parts.append(ellipsoid(f"ankle{side}", 0.045, 0.045, 0.045, lx, 0, H_HIP - 0.74, m_metal, seg=18))
        leg_parts.append(rounded_box(f"foot{side}", 0.105, 0.2, 0.06, lx, -0.035, H_HIP - 0.8, m_shell, bevel=0.025))
        leg_parts.append(rounded_box(f"sole{side}", 0.1, 0.19, 0.014, lx, -0.035, H_HIP - 0.828, m_dark, bevel=0.006))
        leg_obj = join(leg_parts, f"leg{side}")
        set_origin(leg_obj, lx, 0, H_HIP)
        parts.append(leg_obj)

    # ---------------- 父子 ----------------
    bpy.ops.object.empty_add(location=(0, 0, 0))
    root = bpy.context.active_object
    root.name = "Robot"
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
