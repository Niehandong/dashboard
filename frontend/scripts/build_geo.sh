#!/usr/bin/env bash
# 重新生成 public/geo 下的底图数据。
# 用法：scripts/build_geo.sh <下载目录>
#   下载目录中需要有 Natural Earth 的两个文件：
#   ne_10m_admin_1_states_provinces.geojson、ne_10m_admin_0_countries_chn.geojson
#   下载地址：https://github.com/nvkelso/natural-earth-vector/tree/master/geojson
set -e
SRC="$1"; [ -d "$SRC" ] || { echo "用法：$0 <下载目录>"; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../public/geo"
TMP="$(mktemp -d)"
MS="npx --yes mapshaper@0.6.102"
# 中国（含台湾、港澳）用 ECharts 中国省级地图替换；南极洲不画
SKIP='["CHN","TWN","HKG","MAC","ATA"].indexOf(adm0_a3) < 0'

# 简化边界：保留 6% 的顶点（keep-shapes 保证小岛不被删掉），坐标保留 3 位小数（约 100 米）
# 1) 国家面（底图填色、国界）
$MS -i "$SRC/ne_10m_admin_0_countries_chn.geojson" \
    -filter-fields NAME,NAME_ZH,ADM0_A3,LABEL_X,LABEL_Y,LABELRANK \
    -simplify dp 6% keep-shapes \
    -o "$TMP/adm0.json" format=geojson precision=0.001
# 2) 各国省/州之间的分界线（同一国家内部），以及省/州名标注点
$MS -i "$SRC/ne_10m_admin_1_states_provinces.geojson" \
    -filter-fields name,name_zh,adm0_a3,latitude,longitude \
    -filter "$SKIP" \
    -simplify dp 6% keep-shapes \
    -innerlines where='A.adm0_a3 == B.adm0_a3' \
    -o "$TMP/inner.json" format=geojson precision=0.001
$MS -i "$SRC/ne_10m_admin_1_states_provinces.geojson" \
    -filter-fields name,name_zh,adm0_a3,latitude,longitude \
    -filter "$SKIP" \
    -o "$TMP/adm1.json" format=geojson precision=0.001

python3 "$HERE/build_geo.py" "$TMP" "$OUT"
rm -rf "$TMP"
ls -la "$OUT"
