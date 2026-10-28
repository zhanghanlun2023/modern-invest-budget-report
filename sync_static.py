# -*- coding: utf-8 -*-
"""把根目录的报表页面同步到 static/（Streamlit 只托管 static/ 目录）

改完 src/*.js 或 index.html 后跑一次：
    python sync_static.py
"""
import os
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
DST = os.path.join(ROOT, "static")


def main() -> None:
    os.makedirs(os.path.join(DST, "src"), exist_ok=True)
    os.makedirs(os.path.join(DST, "assets"), exist_ok=True)

    shutil.copy2(os.path.join(ROOT, "index.html"), os.path.join(DST, "index.html"))
    print("  index.html")

    for name in os.listdir(os.path.join(ROOT, "assets")):
        s = os.path.join(ROOT, "assets", name)
        if os.path.isfile(s):
            shutil.copy2(s, os.path.join(DST, "assets", name))
            print("  assets/" + name)

    for name in os.listdir(os.path.join(ROOT, "src")):
        if name.endswith(".js"):
            shutil.copy2(os.path.join(ROOT, "src", name), os.path.join(DST, "src", name))
            print("  src/" + name)

    total = sum(
        os.path.getsize(os.path.join(dp, f))
        for dp, _, fs in os.walk(DST)
        for f in fs
    )
    print(f"完成：{DST}  合计 {total/1024:.0f} KB")


if __name__ == "__main__":
    main()
