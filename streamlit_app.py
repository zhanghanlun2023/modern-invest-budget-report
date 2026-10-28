# -*- coding: utf-8 -*-
"""现代投资股份有限公司 —— 合并预算报表系统（Streamlit 版）

页面结构：
    1. 顶部：口径选择（年度 / 报表任务 / 报表期间 / 版本）
    2. 填报区：内嵌完整的报表页面（/app/static/index.html）
    3. 进度区：各单位提交状态

数据落盘：data/submissions.db（SQLite），按 年度+任务+期间+版本+单位 唯一。
"""
from __future__ import annotations

import pandas as pd
import streamlit as st

import data_store

st.set_page_config(
    page_title="现代投资 · 合并预算报表系统",
    page_icon=":material/table_chart:",
    layout="wide",
)

data_store.init_db()

# ── 侧边栏：口径 ────────────────────────────────────────────
with st.sidebar:
    st.subheader(":material/filter_alt: 报表口径")
    year = st.selectbox("年度", [str(y) for y in range(2020, 2028)][::-1], index=1)
    task = st.selectbox("报表任务", ["预算", "决算"], index=0)
    if task == "预算":
        period = st.selectbox("报表期间", ["期初预算", "调整预算", "主要指标"], index=1)
    else:
        period = st.selectbox("报表期间", ["月报", "季报", "半年报", "年报"], index=3)
    ver = st.selectbox("版本", ["对上报告版", "对下目标任务分解版"], index=0)

    st.divider()
    st.caption(
        "填报人在下方页面左侧选中自己的单位，录入后点 **提交到服务器**。"
        "提交按「年度 + 任务 + 期间 + 版本 + 单位」唯一，重复提交会覆盖。"
    )

# ── 顶部标题 ────────────────────────────────────────────────
st.title("现代投资股份有限公司 · 合并预算报表系统")
st.caption(
    f"当前口径：**{year} 年 · {task} · {period} · {ver}**　｜　"
    "左侧组织树选单位 → 录入 → 提交；集团层可看汇总与合并"
)

# ── 填报区（内嵌完整报表页面）────────────────────────────────
st.subheader(":material/edit_note: 填报")

iframe_url = (
    "/app/static/index.html"
    f"?year={year}&task={task}&period={period}&ver={ver}"
)
st.iframe(iframe_url, height=880)

# ── 提交进度 ────────────────────────────────────────────────
st.subheader(":material/checklist: 提交进度")

units = data_store.progress(
    [
        {"id": "HQ", "name": "总部"},
        {"id": "CYCT", "name": "长永长潭"},
        {"id": "HL", "name": "衡耒"},
        {"id": "CSL", "name": "长韶娄"},
        {"id": "XH", "name": "湘衡"},
        {"id": "XUHUAI", "name": "溆怀"},
        {"id": "XHX", "name": "溆怀项目部"},
        {"id": "HZ", "name": "怀芷"},
        {"id": "DY", "name": "大有期货"},
        {"id": "BL", "name": "巴陵农商行"},
        {"id": "CG", "name": "参股农商行"},
        {"id": "HY", "name": "弘远"},
        {"id": "SZ_CF", "name": "数智（财富）"},
        {"id": "HK", "name": "环境"},
        {"id": "ZC", "name": "资产"},
        {"id": "KL", "name": "凯莱"},
        {"id": "XNY", "name": "新能源"},
        {"id": "SZ_BB", "name": "数智·本部"},
        {"id": "SZ_CM", "name": "数智·材贸"},
        {"id": "SZ_WL", "name": "数智·物流"},
    ],
    year, task, period, ver,
)

done = sum(1 for u in units if u["submitted"])
c1, c2, c3 = st.columns(3)
c1.metric("应填单位", len(units))
c2.metric("已提交", done)
c3.metric("完成率", f"{done / len(units) * 100:.0f}%" if units else "—")

df = pd.DataFrame(
    [
        {
            "单位": u["unit_name"],
            "状态": "✅ 已提交" if u["submitted"] else "⬜ 未提交",
            "提交人": u["submitter"],
            "更新时间": u["updated_at"],
        }
        for u in units
    ]
)
st.dataframe(df, width="stretch", hide_index=True)

if st.button(":material/refresh: 刷新进度", type="secondary"):
    st.rerun()

st.caption(
    "数据保存于服务器 `data/submissions.db`。公网部署时请配置反向代理与访问控制，"
    "避免无关人员修改他人数据。"
)
