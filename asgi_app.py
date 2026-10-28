# -*- coding: utf-8 -*-
"""ASGI 入口：Streamlit UI + 自定义 /api 路由

启动：
    streamlit run asgi_app.py
或：
    python asgi_app.py

路由：
    POST /api/save          提交/覆盖某单位的报表数据
    GET  /api/load          读取某单位已提交的数据
    GET  /api/list          列出已提交记录
    GET  /api/progress      按单位清单返回提交进度
    GET  /api/health        健康检查

静态资源（现成的报表页面）由 Streamlit 自带机制提供：
    ./static/xxx  →  /app/static/xxx
"""
from __future__ import annotations

import json
import os

import streamlit as st
from starlette.responses import JSONResponse
from starlette.routing import Route

import data_store

data_store.init_db()

HERE = os.path.dirname(os.path.abspath(__file__))


def _units() -> list[dict[str, str]]:
    """可填报单位清单（与前端组织树保持一致）。"""
    path = os.path.join(HERE, "static", "src", "data.org.js")
    if not os.path.exists(path):
        return []
    import re

    text = open(path, encoding="utf-8").read()
    out = []
    for m in re.finditer(
        r"\{\s*id:\s*'([^']+)'\s*,\s*name:\s*'([^']+)'\s*,\s*short:\s*'([^']+)'\s*,\s*type:\s*'unit'",
        text,
    ):
        out.append({"id": m.group(1), "name": m.group(2), "short": m.group(3)})
    return out


async def api_health(request):
    return JSONResponse({"ok": True, "service": "report-budget"})


async def api_save(request):
    try:
        body = await request.json()
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": f"bad json: {exc}"}, status_code=400)
    try:
        return JSONResponse(data_store.save(body))
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=400)


async def api_load(request):
    q = request.query_params
    row = data_store.load(
        q.get("year", ""), q.get("task", ""), q.get("period", ""), q.get("ver", ""),
        q.get("unit") or q.get("unitId", ""),
    )
    if not row:
        return JSONResponse({"ok": False, "error": "not found"}, status_code=404)
    return JSONResponse({"ok": True, **row})


async def api_list(request):
    q = request.query_params
    return JSONResponse({
        "ok": True,
        "items": data_store.list_submissions(
            q.get("year"), q.get("task"), q.get("period"), q.get("ver")
        ),
    })


async def api_progress(request):
    q = request.query_params
    return JSONResponse({
        "ok": True,
        "items": data_store.progress(
            _units(), q.get("year", ""), q.get("task", ""),
            q.get("period", ""), q.get("ver", ""),
        ),
    })


app = st.App(
    "streamlit_app.py",
    routes=[
        Route("/api/health", api_health, methods=["GET"]),
        Route("/api/save", api_save, methods=["POST"]),
        Route("/api/load", api_load, methods=["GET"]),
        Route("/api/list", api_list, methods=["GET"]),
        Route("/api/progress", api_progress, methods=["GET"]),
    ],
)

if __name__ == "__main__":
    app.run(config={"server.port": 8501, "server.address": "0.0.0.0"})
