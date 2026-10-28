# -*- coding: utf-8 -*-
"""提交数据存储（SQLite）—— 公网多人填报的共享落盘层

一张 submissions 表，按 (年度, 任务, 期间, 版本, 单位) 唯一。
payload 存该单位全部报表的 JSON。
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from datetime import datetime, timezone, timedelta
from typing import Any

DB_PATH = os.environ.get(
    "REPORT_DB",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "submissions.db"),
)

_LOCK = threading.Lock()
_CST = timezone(timedelta(hours=8))


def _now() -> str:
    return datetime.now(_CST).strftime("%Y-%m-%d %H:%M:%S")


def _conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=20)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    """建表（幂等）。"""
    with _LOCK, _conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS submissions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                year        TEXT NOT NULL,
                task        TEXT NOT NULL,
                period      TEXT NOT NULL,
                ver         TEXT NOT NULL,
                unit_id     TEXT NOT NULL,
                unit_name   TEXT,
                submitter   TEXT,
                payload     TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                UNIQUE (year, task, period, ver, unit_id)
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sub_scope ON submissions (year, task, period, ver)"
        )


def save(payload_in: dict[str, Any]) -> dict[str, Any]:
    """新增或覆盖一条提交。"""
    key = {
        "year": str(payload_in.get("year") or ""),
        "task": str(payload_in.get("task") or ""),
        "period": str(payload_in.get("period") or ""),
        "ver": str(payload_in.get("ver") or ""),
        "unit_id": str(payload_in.get("unitId") or ""),
    }
    if not key["unit_id"]:
        raise ValueError("缺少 unitId")

    payload = json.dumps(payload_in.get("data") or {}, ensure_ascii=False)
    now = _now()
    with _LOCK, _conn() as conn:
        row = conn.execute(
            "SELECT id FROM submissions WHERE year=? AND task=? AND period=? AND ver=? AND unit_id=?",
            (key["year"], key["task"], key["period"], key["ver"], key["unit_id"]),
        ).fetchone()
        if row:
            conn.execute(
                """UPDATE submissions SET unit_name=?, submitter=?, payload=?, updated_at=?
                   WHERE id=?""",
                (
                    payload_in.get("unitName"),
                    payload_in.get("submitter"),
                    payload,
                    now,
                    row["id"],
                ),
            )
            action = "updated"
        else:
            conn.execute(
                """INSERT INTO submissions
                   (year, task, period, ver, unit_id, unit_name, submitter, payload, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (
                    key["year"], key["task"], key["period"], key["ver"], key["unit_id"],
                    payload_in.get("unitName"), payload_in.get("submitter"),
                    payload, now, now,
                ),
            )
            action = "created"
    return {"ok": True, "action": action, "updated_at": now, **key}


def load(year: str, task: str, period: str, ver: str, unit_id: str) -> dict[str, Any] | None:
    """读一条提交。"""
    with _LOCK, _conn() as conn:
        row = conn.execute(
            """SELECT unit_name, payload, updated_at FROM submissions
               WHERE year=? AND task=? AND period=? AND ver=? AND unit_id=?""",
            (str(year), str(task), str(period), str(ver), str(unit_id)),
        ).fetchone()
    if not row:
        return None
    return {
        "unitName": row["unit_name"],
        "updatedAt": row["updated_at"],
        "data": json.loads(row["payload"]),
    }


def list_submissions(year: str | None = None, task: str | None = None,
                     period: str | None = None, ver: str | None = None) -> list[dict[str, Any]]:
    """列出提交（不含 payload）。"""
    sql = "SELECT year,task,period,ver,unit_id,unit_name,submitter,updated_at FROM submissions WHERE 1=1"
    args: list[Any] = []
    for col, val in (("year", year), ("task", task), ("period", period), ("ver", ver)):
        if val:
            sql += f" AND {col}=?"
            args.append(str(val))
    sql += " ORDER BY updated_at DESC"
    with _LOCK, _conn() as conn:
        rows = conn.execute(sql, args).fetchall()
    return [dict(r) for r in rows]


def progress(units: list[dict[str, str]], year: str, task: str,
             period: str, ver: str) -> list[dict[str, Any]]:
    """按给定单位清单，标出哪些已提交。"""
    submitted = {r["unit_id"]: r for r in list_submissions(year, task, period, ver)}
    out = []
    for u in units:
        r = submitted.get(u["id"])
        out.append({
            "unit_id": u["id"],
            "unit_name": u.get("name", ""),
            "submitted": r is not None,
            "submitter": (r or {}).get("submitter") or "",
            "updated_at": (r or {}).get("updated_at") or "",
        })
    return out


if __name__ == "__main__":
    init_db()
    print("DB:", DB_PATH)
    print("rows:", len(list_submissions()))
