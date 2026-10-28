/* ═══════════════════════════════════════════════════════════════
   汇总 / 合并抵销 计算引擎（纯函数，不依赖 DOM）

   核心恒等式（所有主表统一适用，保证抵销后仍然平衡）：

     合并数(行) = 汇总数(行) + dir(行) × (抵销借方 − 抵销贷方)
       dir = +1  借方科目（资产、成本费用、现金流入）
       dir = −1  贷方科目（负债、所有者权益、收入、现金流出）

   小计 / 合计行在合并口径下按公式对「已抵销」的下级行重算，
   因此资产负债表抵销后仍然满足 资产总计 = 负债和所有者权益总计。
   ═══════════════════════════════════════════════════════════════ */
window.MI = window.MI || {};

/* ── 贷方科目清单（未列出的默认为借方科目） ─────────────── */
MI.CREDIT_NORMAL = {
  BS: ['BS24','BS25','BS26','BS27','BS28','BS29','BS30','BS31','BS32',
       'BS33','BS34','BS35','BS36','BS37','BS38','BS39',
       'BS40','BS41','BS42','BS43','BS44','BS45','BS46','BS47','BS48'],
  IS: ['IS01','IS02','IS03','IS14','IS15','IS16','IS17','IS27','IS28'],
  CF: ['CF06','CF07','CF08','CF09','CF10',
       'CF18','CF19','CF20','CF21',
       'CF28','CF29','CF30','CF31']
};

MI.dirOf = function (tableId, code) {
  var a = MI.CREDIT_NORMAL[tableId];
  return (a && a.indexOf(code) >= 0) ? -1 : 1;
};

/* ── 数字格式 ───────────────────────────────────────────── */
MI.fmt = function (n, div) {
  if (n === undefined || n === null || isNaN(n)) return '';
  var v = Number(n) / (div || 1);
  var neg = v < 0;
  var a = Math.abs(v);
  if (a < 0.005) return '0.00';
  var s = a.toFixed(2).split('.');
  s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + s[0] + '.' + s[1];
};

MI.fmt0 = function (n, div) {
  if (n === undefined || n === null || isNaN(n)) return '';
  var v = Number(n) / (div || 1);
  var neg = v < 0;
  var a = Math.abs(v);
  if (a < 0.5) return '0';
  var s = Math.round(a).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + s;
};

/* ── 空表 ───────────────────────────────────────────────── */
MI.blankRaw = function () {
  var o = {};
  MI.TABLES.forEach(function (t) {
    o[t.id] = { end: {}, begin: {} };
    t.lines.forEach(function (l) { o[t.id].end[l.c] = 0; o[t.id].begin[l.c] = 0; });
  });
  return o;
};

/* ═══════════ 数据录入：单户表内公式重算 ═══════════ */

/** 不可直接录入的行（单户口径下由合并产生或另有来源） */
MI.EDIT_LOCK = { BS: { BS46: 1 }, IS: {}, CF: {} };

/** 该行该表是否允许录入：分组行 / 公式行（小计合计）/ 锁定行都不可录入 */
MI.isEditable = function (tableId, code) {
  var l = MI.lineMap[tableId + '.' + code];
  if (!l || l.k === 'grp' || l.f) return false;
  if (MI.EDIT_LOCK[tableId] && MI.EDIT_LOCK[tableId][code]) return false;
  return true;
};

/**
 * 编辑某个单元格后重算该户的表内公式（小计 / 合计行）。
 * 明细行不被覆盖，公式行按 f 的定义自上而下重算；
 * 公式行之间的依赖都在其上方，故单遍即可。
 */
MI.recalcUnit = function (unitId) {
  var d = MI.dataset.units[unitId];
  if (!d) return;
  MI.TABLES.forEach(function (t) {
    ['end', 'begin'].forEach(function (k) {
      var box = d[t.id][k];
      t.lines.forEach(function (l) {
        if (l.k === 'grp' || !l.f) return;
        var v = 0;
        for (var i = 0; i < l.f.length; i++) {
          var p = l.f[i];
          v += (p[1] === undefined ? 1 : p[1]) * (box[p[0]] || 0);
        }
        box[l.c] = v;
      });
    });
  });
};

/** 资产负债表是否配平（用于失衡高亮） */
MI.bsDiff = function (unitId, colKey) {
  var d = MI.dataset.units[unitId];
  if (!d) return 0;
  return (d.BS[colKey].BS23 || 0) - (d.BS[colKey].BS48 || 0);
};

/* ═══════════ 二、自下而上逐级汇总 ═══════════   对给定的填报单位集合逐行相加。填报表的每一行都取「本位币原值」，
   资产负债表 / 利润表 / 现金流量表三张表同时汇总。
*/
/* ═══════════ 列口径（各表数值列的语义） ═══════════
   数字      = 该列是「可录入」列，取值 = 主值 × 系数
   'rate'    = (第1列 − 第0列) / 第0列        —— 计算列，不可录入
   'diff'    = 第1列 − 第0列                   —— 计算列
   'r:a:b'   = (第a列 − 第b列) / 第b列         —— 计算列
   'd:a-b'   = 第a列 − 第b列                   —— 计算列
*/
MI.COLCFG = {
  BS:  [0.86, 1, 'rate'],
  IS:  [0.86, 1],
  CF:  [0.86, 1, 'diff'],
  CAP: [1, 0.5, 0.3, 0.2],
  IND: [0.943, 1, 'd:1-0', 1.05, 'r:3:1', 1.12, 'r:5:1'],
  _:   [0.86, 1]
};
MI.colCfgOf = function (tid) { return MI.COLCFG[tid] || MI.COLCFG._; };
MI.isCalcCol = function (tid, ci) {
  var s = MI.colCfgOf(tid)[ci];
  return (s !== undefined) && (typeof s !== 'number');
};
MI.isTextColName = function (n) {
  return String(n || '').indexOf('原因') >= 0 || String(n || '').indexOf('备注') >= 0;
};

/* 按 spec 从「取值函数」算出某一列的值 */
function applySpec(spec, valOf) {
  if (typeof spec === 'number') return valOf(null);
  if (typeof spec === 'string') {
    var m;
    if (spec === 'rate') { var b0 = valOf(0); return b0 ? (valOf(1) - b0) / b0 : 0; }
    if (spec === 'diff') return valOf(1) - valOf(0);
    m = spec.match(/^r:(\d+):(\d+)$/);
    if (m) { var rb = valOf(+m[2]); return rb ? (valOf(+m[1]) - rb) / rb : 0; }
    m = spec.match(/^d:(\d+)-(\d+)$/);
    if (m) return valOf(+m[1]) - valOf(+m[2]);
  }
  return valOf(null);
}

/* ═══════════ 取某单位、某表、某列、某行的值 ═══════════
   优先级：① 手工录入(d.ov) → ② 计算列按规则从同行其它列推
          → ③ 公式行 = 子项带符号求和（递归）→ ④ 叶子 = 主值 × 系数
   全程不落库，纯函数，改任何一格都能立刻得到正确的整列结果。 */
MI.colOf = function (d, t, key, code, ci, depth) {
  depth = depth || 0;
  if (depth > 16) return 0;
  var ov = d.ov && d.ov[t.id] && d.ov[t.id][key + '|' + ci + '|' + code];
  if (ov !== undefined && ov !== null) return ov;

  var cfg = MI.colCfgOf(t.id);
  var spec = cfg[ci];

  /* 计算列（差异/增长率）：从同行其它列推 */
  if (typeof spec !== 'number') {
    return applySpec(spec, function (k) {
      return MI.colOf(d, t, key, code, (k === null ? ci : k), depth + 1);
    });
  }

  /* 公式行：子项带符号求和 */
  var l = MI.lineMap[t.id + '.' + code];
  if (l && l.f && l.f.length) {
    var s = 0;
    for (var i = 0; i < l.f.length; i++) {
      var ch = l.f[i][0], sign = (l.f[i][1] === undefined ? 1 : l.f[i][1]);
      s += sign * MI.colOf(d, t, key, ch, ci, depth + 1);
    }
    return s;
  }

  /* 叶子行：主值 × 该列系数 */
  var base = (d[t.id] && d[t.id][key]) ? (d[t.id][key][code] || 0) : 0;
  return base * spec;
};

MI.rollup = function (scopeIds) {
  var res = { end: {}, begin: {}, col: { end: {}, begin: {} }, units: [], missing: [] };
  MI.TABLES.forEach(function (t) {
    res.end[t.id] = {}; res.begin[t.id] = {};
    MI.allLines(t).forEach(function (l) { res.end[t.id][l.c] = 0; res.begin[t.id][l.c] = 0; });
    res.col.end[t.id] = {}; res.col.begin[t.id] = {};
    (t.cols || []).forEach(function (cname, ci) {
      res.col.end[t.id][ci] = {}; res.col.begin[t.id][ci] = {};
      MI.allLines(t).forEach(function (l) {
        res.col.end[t.id][ci][l.c] = 0; res.col.begin[t.id][ci][l.c] = 0;
      });
    });
  });

  scopeIds.forEach(function (uid) {
    var d = MI.dataset.units[uid];
    if (!d) return;
    var node = MI.index[uid];
    res.units.push(uid);
    if (node && node.st === 'draft') res.missing.push(node);
    MI.TABLES.forEach(function (t) {
      MI.allLines(t).forEach(function (l) {
        res.end[t.id][l.c]   += (d[t.id].end[l.c]   || 0);
        res.begin[t.id][l.c] += (d[t.id].begin[l.c] || 0);
      });
    });
  });

  /* 逐列汇总：
     · 可录入列（数字 spec）→ 累加各单位该列的取值（含手工录入口径）
     · 计算列（rate/diff…）→ 用汇总后的列值重新算，避免"把比率相加" */
  ['end', 'begin'].forEach(function (key) {
    MI.TABLES.forEach(function (t) {
      var cfg = MI.colCfgOf(t.id);
      var nc = (t.cols || []).length;
      MI.allLines(t).forEach(function (l) {
        var sums = {};
        for (var ci = 0; ci < nc; ci++) {
          if (MI.isTextColName((t.cols || [])[ci])) continue;
          if (typeof cfg[ci] === 'number') {
            var s = 0;
            scopeIds.forEach(function (uid) {
              var d = MI.dataset.units[uid];
              if (d) s += MI.colOf(d, t, key, l.c, ci);
            });
            sums[ci] = s;
            res.col[key][t.id][ci][l.c] = s;
          }
        }
        for (var cj = 0; cj < nc; cj++) {
          if (MI.isTextColName((t.cols || [])[cj])) continue;
          if (typeof cfg[cj] !== 'number') {
            res.col[key][t.id][cj][l.c] = applySpec(cfg[cj], function (k) {
              return (k === null) ? (sums[cj] || 0) : (sums[k] || 0);
            });
          }
        }
      });
    });
  });
  return res;
};

/* ═══════════ 二、大合并抵销 ═══════════
   口径与套表完全一致：  合并数(行) = 汇总数(行) + 抵销数(行)
   抵销数来自组织树上的「大合并调整项」节点 —— 集团层唯一的抵销录入位。
   各子公司上报的本来就是抵销后的数，不在本层重复抵销。
*/
MI.ELIM_NODE_ID = 'BIGADJ';

MI.consolidate = function (scopeIds, rollup) {
  var adj = MI.dataset.units[MI.ELIM_NODE_ID];
  var elim = { end: {} }, merged = { end: {} };

  MI.TABLES.forEach(function (t) {
    var eb = elim.end[t.id] = {}, mb = merged.end[t.id] = {}, rb = rollup.end[t.id];

    /* 1) 明细行：合并数 = 汇总数 + 调整数 */
    MI.allLines(t).forEach(function (l) {
      if (l.f) return;
      var a = adj ? ((adj[t.id].end[l.c]) || 0) : 0;
      eb[l.c] = a;
      mb[l.c] = (rb[l.c] || 0) + a;
    });
    /* 2) 公式行（小计/合计）迭代到收敛 —— 套表里存在倒序依赖 */
    var fs = MI.allLines(t).filter(function (l) { return l.f; });
    for (var pass = 0; pass < 8; pass++) {
      var moved = false;
      for (var q = 0; q < fs.length; q++) {
        var l = fs[q], v = 0;
        for (var i = 0; i < l.f.length; i++) {
          var p = l.f[i];
          v += (p[1] === undefined ? 1 : p[1]) * (mb[p[0]] || 0);
        }
        if (v !== mb[l.c]) { mb[l.c] = v; moved = true; }
      }
      if (!moved) break;
    }
    /* 3) 抵销数 = 合并数 − 汇总数（含小计行的向下传导） */
    MI.allLines(t).forEach(function (l) {
      eb[l.c] = (mb[l.c] || 0) - (rb[l.c] || 0);
    });
  });

  return { merged: merged, elim: elim, vouchers: [] };
};

/** 某一行被哪些分录影响（用于穿透查看） */
MI.lineElimDetail = function (vouchers, tableId, code) {
  var out = [];
  vouchers.forEach(function (v) {
    var hit = v.legs.filter(function (g) { return g.table === tableId && g.line === code; });
    if (hit.length) out.push({ v: v, legs: hit });
  });
  return out;
};

/** 分录自身的借贷平衡 */
MI.voucherBalanced = function (v) {
  var d = 0, c = 0;
  v.legs.forEach(function (g) { if (g.side === 'D') d += g.amt; else c += g.amt; });
  return Math.abs(d - c) < 0.01;
};

/* ═══════════ 三、审核校验 ═══════════ */
MI.CHECKS = [];
MI.runChecks = function (scopeIds, rollup, cons) {
  var out = [];
  var EPS = 0.01;

  /* 1. 单户资产负债表平衡 */
  var bad = [];
  scopeIds.forEach(function (uid) {
    var d = MI.dataset.units[uid];
    if (!d) return;
    var a = d.BS.end.BS23 || 0, b = d.BS.end.BS48 || 0;
    if (Math.abs(a - b) > EPS) bad.push(MI.index[uid].short + ' 差 ' + MI.fmt(a - b, 1));
  });
  out.push(bad.length
    ? { lv:'fail', n:'单户资产负债表平衡', d:'共 ' + bad.length + ' 户不平衡：' + bad.join('；') }
    : { lv:'pass', n:'单户资产负债表平衡', d:'范围内 ' + scopeIds.length + ' 户全部满足「资产总计 = 负债和所有者权益总计」' });

  /* 2. 汇总表平衡 */
  var sa = rollup.end.BS.BS23, sb = rollup.end.BS.BS48;
  out.push(Math.abs(sa - sb) > EPS
    ? { lv:'fail', n:'汇总表平衡', d:'汇总资产总计 ' + MI.fmt(sa,1) + ' ≠ 负债和所有者权益总计 ' + MI.fmt(sb,1) }
    : { lv:'pass', n:'汇总表平衡', d:'汇总资产总计 = ' + MI.fmt(sa,1) + ' 元' });

  /* 3. 合并表平衡 */
  if (cons) {
    var ma = cons.merged.end.BS.BS23, mb = cons.merged.end.BS.BS48;
    out.push(Math.abs(ma - mb) > EPS
      ? { lv:'fail', n:'合并报表平衡', d:'抵销后 资产总计 ' + MI.fmt(ma,1) + ' ≠ 负债和所有者权益总计 ' + MI.fmt(mb,1) }
      : { lv:'pass', n:'合并报表平衡', d:'抵销后资产总计 = ' + MI.fmt(ma,1) + ' 元，勾稽关系成立' });
  }

  /* 4. 抵销分录借贷平衡 */
  var vs = cons ? cons.vouchers : (MI.dataset.vouchers || []);
  var ub = vs.filter(function (v) { return !MI.voucherBalanced(v); });
  out.push(ub.length
    ? { lv:'fail', n:'抵销分录借贷平衡', d:ub.length + ' 笔分录借贷不等，请检查' }
    : { lv:'pass', n:'抵销分录借贷平衡', d:'本次参与合并 ' + vs.length + ' 笔分录，借贷均已平衡' });

  /* 5. 内部往来对账差异 */
  var diffs = (MI.dataset.interco || []).filter(function (p) {
    return scopeIds.indexOf(p.a) >= 0 && scopeIds.indexOf(p.b) >= 0 &&
           Math.abs(p.recv - p.pay) > EPS;
  });
  out.push(diffs.length
    ? { lv:'warn', n:'内部往来对账', d:diffs.length + ' 组内部往来双方不一致，已按较小方抵销，差额 ' +
        MI.fmt(diffs.reduce(function (s, p) { return s + Math.abs(p.recv - p.pay); }, 0), 1) + ' 元，需往来单位对账确认' }
    : { lv:'pass', n:'内部往来对账', d:'范围内内部往来全部核对一致' });

  /* 6. 缺报单位 */
  out.push(rollup.missing.length
    ? { lv:'warn', n:'汇总范围完整性', d:'范围内 ' + rollup.missing.length + ' 户尚未填报（按 0 参与汇总）：' +
        rollup.missing.map(function (n) { return n.short; }).join('、') }
    : { lv:'pass', n:'汇总范围完整性', d:'范围内全部单位均已填报' });

  /* 7. 现金流量表期末现金 与 资产负债表货币资金 勾稽 */
  var src = cons ? cons.merged.end : rollup.end;
  var label = cons ? '合并' : '汇总';
  var cfd = (src.CF.CF37 || 0) - (src.BS.BS01 || 0);
  out.push(Math.abs(cfd) > EPS
    ? { lv:'warn', n:'现金勾稽', d: label + '现金流量表期末现金与' + label + '货币资金差 ' +
        MI.fmt(cfd, 1) + ' 元（录入数据后产生，需通过调整使二者一致）' }
    : { lv:'pass', n:'现金勾稽', d: label + '现金流量表期末现金 = ' + label + '货币资金 ' + MI.fmt(src.BS.BS01, 1) + ' 元' });

  return out;
};
