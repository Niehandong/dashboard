"""生成驾驶舱底图数据（public/geo/ 下的文件）。

输入（build_geo.sh 用 mapshaper 预处理后的临时目录）：
  - adm0.json    国家面（Natural Earth 中国视角版本），带 NAME_ZH / LABEL_X / LABEL_Y / LABELRANK
  - inner.json   各国内部省/州分界线
  - adm1.json    省/州（只用到名称和标注点 latitude / longitude）
  - <输出目录>/china.json   ECharts 中国省级地图（替换 Natural Earth 中的中国、台湾、港澳）
输出：
  - world.json       ECharts geo 底图：
                       面：其他国家按国家一块 + 中国按省份
                       线（名称以 _ 开头，样式在前端按名称设置）：
                         _graticule 经纬网、_inner 各国省/州分界线、_border_glow / _border 国界及光晕、_china_border 中国国界
  - countries.json   国家中文名标注点 [{name, coord, rank}]
  - provinces.json   各国省/州中文名标注点 [{name, coord}]（放大到省级时显示）

性能说明：
  - 线条放在 geo 底图里，而不是用 lines 系列单独画：拖动、缩放时 geo 只是整体平移缩放，
    lines 系列则要逐点重新计算屏幕坐标（10 万多个点），实测是卡顿的主要来源。
  - 其他国家不拆省/州面，只画分界线：区域数从 4500 多降到 300 以内。

用法：
  python3 build_geo.py <临时目录> <输出目录>
"""
import json
import sys
from pathlib import Path

REPLACED_BY_ECHARTS_CHINA = {"CHN", "TWN", "HKG", "MAC"}
DROP = {"ATA"}  # 南极洲
# Natural Earth 的部分中文名是全称，标注时换成常用简称
SHORT_NAMES = {
    "中华人民共和国": "中国", "朝鲜民主主义人民共和国": "朝鲜", "大韩民国": "韩国", "美利坚合众国": "美国",
    "俄罗斯联邦": "俄罗斯", "大不列颠及北爱尔兰联合王国": "英国", "老挝人民民主共和国": "老挝",
    "越南社会主义共和国": "越南", "刚果民主共和国": "刚果（金）", "刚果共和国": "刚果（布）",
}


def r3(v):
    return round(v, 3)


def decode_echarts(geo: dict) -> list[dict]:
    """解码 ECharts 压缩格式（UTF8Encoding）的 GeoJSON。"""
    scale = geo.get("UTF8Scale", 1024)

    def ring(s, off):
        px, py = off
        out = []
        for i in range(0, len(s), 2):
            x = ord(s[i]) - 64
            y = ord(s[i + 1]) - 64
            x = (x >> 1) ^ (-(x & 1))
            y = (y >> 1) ^ (-(y & 1))
            x += px
            y += py
            px, py = x, y
            out.append([r3(x / scale), r3(y / scale)])
        return out

    feats = []
    for f in geo["features"]:
        g = f["geometry"]
        offs = g["encodeOffsets"]
        if g["type"] == "Polygon":
            coords = [ring(r, offs[i]) for i, r in enumerate(g["coordinates"])]
        else:
            coords = [[ring(r, offs[i][j]) for j, r in enumerate(poly)] for i, poly in enumerate(g["coordinates"])]
        feats.append({
            "type": "Feature",
            "properties": {"name": f["properties"]["name"], "cn": True},
            "geometry": {"type": g["type"], "coordinates": coords},
        })
    return feats


def lines_of(geom) -> list:
    if geom["type"] == "LineString":
        return [geom["coordinates"]]
    if geom["type"] == "MultiLineString":
        return geom["coordinates"]
    return []


def line_feature(name: str, lines: list) -> dict:
    return {"type": "Feature", "properties": {"name": name}, "geometry": {"type": "MultiLineString", "coordinates": lines}}


# 经纬网：每 15° 一条（纬线只画到南北纬 75°）
GRATICULE = [[[lng, lat] for lat in range(-75, 76, 5)] for lng in range(-180, 181, 15)] + \
            [[[lng, lat] for lng in range(-180, 181, 5)] for lat in range(-75, 76, 15)]


def dump(obj, path: Path):
    json.dump(obj, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


def main(tmp_dir: str, out_dir: str):
    tmp, out = Path(tmp_dir), Path(out_dir)
    adm0 = json.load(open(tmp / "adm0.json", encoding="utf-8"))
    inner = json.load(open(tmp / "inner.json", encoding="utf-8"))
    adm1 = json.load(open(tmp / "adm1.json", encoding="utf-8"))
    china = json.load(open(out / "china.json", encoding="utf-8"))

    regions, labels, world_lines, china_lines, seen = [], [], [], [], set()
    for f in adm0["features"]:
        p, g = f["properties"], f["geometry"]
        a3 = p["ADM0_A3"]
        if a3 in DROP or not g:
            continue
        zh = p.get("NAME_ZH") or p["NAME"]
        name = SHORT_NAMES.get(zh, zh)
        # 国界：只取每个多边形的外环
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        target = china_lines if a3 in REPLACED_BY_ECHARTS_CHINA else world_lines
        target += [[[r3(x), r3(y)] for x, y in poly[0]] for poly in polys]
        labels.append({"name": name, "coord": [p["LABEL_X"], p["LABEL_Y"]], "rank": p.get("LABELRANK", 9)})
        if a3 in REPLACED_BY_ECHARTS_CHINA:
            continue
        # 区域名在 ECharts 中必须唯一
        while name in seen:
            name += "＇"
        seen.add(name)
        regions.append({"type": "Feature", "properties": {"name": name}, "geometry": g})
    regions += decode_echarts(china)  # 中国放在面的最后，绘制在其他国家之上

    # mapshaper 输出可能是 FeatureCollection 或 GeometryCollection
    inner_geoms = [f.get("geometry") for f in inner["features"]] if "features" in inner else inner.get("geometries", [])
    inner_lines = [[[r3(x), r3(y)] for x, y in line] for g in inner_geoms if g for line in lines_of(g)]
    # 线画在所有面之上，按从暗到亮的顺序叠放
    regions += [
        line_feature("_graticule", GRATICULE),
        line_feature("_inner", inner_lines),
        line_feature("_border_glow", world_lines),
        line_feature("_border", world_lines),
        line_feature("_china_border", china_lines),
    ]
    dump({"type": "FeatureCollection", "features": regions}, out / "world.json")

    labels.sort(key=lambda x: x["rank"])  # 重要国家在前，标签重叠时优先保留
    dump(labels, out / "countries.json")

    provinces = [
        {"name": (p.get("name_zh") or p.get("name") or "").strip(), "coord": [r3(p["longitude"]), r3(p["latitude"])]}
        for p in (f["properties"] for f in adm1["features"])
        if p.get("longitude") is not None and (p.get("name_zh") or p.get("name"))
    ]
    dump(provinces, out / "provinces.json")

    print(f"区域 {len(regions)} 个，国界 {len(world_lines)} 条，中国国界 {len(china_lines)} 条，"
          f"省/州分界线 {len(inner_lines)} 条，国家标注 {len(labels)} 个，省/州标注 {len(provinces)} 个")


if __name__ == "__main__":
    main(*sys.argv[1:3])
