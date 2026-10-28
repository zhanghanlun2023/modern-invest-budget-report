# -*- coding: utf-8 -*-
"""现代投资股份有限公司 —— 合并预算报表系统（Streamlit Cloud 入口）

这个脚本只做一件事：把打包好的静态报表页面全屏内嵌，并隐藏 Streamlit 自带的
标题栏、侧边栏、工具栏，让打开根地址看到的就是原样的报表系统。

报表本体同时也可以直接访问（完全没有任何 Streamlit 外壳）：
    https://<你的应用名>.streamlit.app/app/static/index.html

口径通过 URL 参数传入，例如：
    ?year=2026&task=预算&period=调整预算&ver=对上报告版
"""
from __future__ import annotations

import streamlit as st

st.set_page_config(
    page_title="现代投资 · 合并预算报表系统",
    page_icon=":material/table_chart:",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── 隐藏 Streamlit 外壳，让报表铺满整个视口 ──────────────────
st.markdown(
    """
    <style>
    [data-testid="stHeader"],
    [data-testid="stToolbar"],
    [data-testid="stDecoration"],
    [data-testid="stStatusWidget"],
    [data-testid="stSidebar"],
    [data-testid="stSidebarCollapsedControl"],
    #MainMenu, footer { display: none !important; }

    [data-testid="stAppViewContainer"] > .main { padding: 0 !important; }
    [data-testid="stMainBlockContainer"],
    .block-container { padding: 0 !important; max-width: 100% !important; }
    [data-testid="stVerticalBlock"] { gap: 0 !important; }
    [data-testid="stIFrame"], iframe { display: block; width: 100% !important; }
    </style>
    """,
    unsafe_allow_html=True,
)

# ── 口径参数（可被 URL 覆盖）─────────────────────────────────
qp = st.query_params
year = qp.get("year", "2026")
task = qp.get("task", "预算")
period = qp.get("period", "调整预算")
ver = qp.get("ver", "对上报告版")

src = (
    "/app/static/index.html"
    f"?year={year}&task={task}&period={period}&ver={ver}"
)

st.iframe(src, height="stretch")
