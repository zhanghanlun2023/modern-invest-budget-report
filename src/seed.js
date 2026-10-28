/* ═══════════════════════════════════════════════════════════════
   数据生成器 —— 与表样无关：读 MI.TABLES 的任意结构自动生成模拟数
   替换/新增表样后本文件无需改动

   保证的不变量：
     · 资产负债表  资产总计(52) = 负债和所有者权益总计(104)
     · 现金流量表  资金来源合计 = 资金运用合计
     · 所有公式行（小计/合计）恒等于其下级行之和
   ═══════════════════════════════════════════════════════════════ */
window.MI = window.MI || {};

/* 默认不造数：报表初始为空白，由各单位录入或导入 Excel。
   想看汇总/合并效果时，点工具栏「演示数据」按钮切到 true 重建。 */
MI.DEMO = false;

(function () {
  var YI = 1e8;

  function hash(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t) >>> 0;
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 各表相对「单位资产规模」的量级系数 */
  var SCALE = { IS: 0.34, CF: 0.40, CBHW: 0.11, CBFS: 0.30,
                MFHW: 0.045, MFFS: 0.055, SF: 0.018, RD: 0.010, CAP: 0.07 };
  var DEBT = { hq: 0.50, branch: 0.64, sub: 0.62, assoc: 0.90 };

  function blankOne() {
    var D = {};
    MI.TABLES.forEach(function (t) {
      D[t.id] = { end: {}, begin: {} };
      MI.allLines(t).forEach(function (l) {
        D[t.id].end[l.c] = 0; D[t.id].begin[l.c] = 0;
      });
    });
    return D;
  }

  function leaves(t) {
    return MI.allLines(t).filter(function (l) {
      return !l.f && l.k !== 'grp' && l.k !== 'blank';
    });
  }

  /* ── 通用表：把 amount 摊到叶子行 ── */
  function fillPlain(t, b, r, amount) {
    var ls = leaves(t), w = {}, tw = 0;
    ls.forEach(function (l) { var x = 0.20 + 1.6 * r(); w[l.c] = x; tw += x; });
    if (tw <= 0) return;
    ls.forEach(function (l) { b[l.c] = amount * w[l.c] / tw; });
  }

  /* ── 资产负债表：资产 → 负债 → 权益（未分配利润轧差） ── */
  function fillBS(t, b, r, totalAssets, debt) {
    var L = t.lines, R = t.lines2;
    var aL = L.filter(function (l) { return !l.f && l.k !== 'grp' && l.k !== 'blank'; });
    var w = {}, tw = 0;
    aL.forEach(function (l) { var x = 0.20 + 1.6 * r(); w[l.c] = x; tw += x; });
    aL.forEach(function (l) { b[l.c] = totalAssets * w[l.c] / tw; });

    var lL = R.filter(function (l) {
      return !l.f && l.k !== 'grp' && l.k !== 'blank' && (parseInt(l.r, 10) || 0) <= 88;
    });
    var liab = totalAssets * debt;
    var w2 = {}, t2 = 0;
    lL.forEach(function (l) { var x = 0.20 + 1.6 * r(); w2[l.c] = x; t2 += x; });
    lL.forEach(function (l) { b[l.c] = liab * w2[l.c] / t2; });

    /* 权益：实收资本/资本公积/盈余公积按比例，未分配利润轧差，其余置零 */
    var byNo = {};
    R.forEach(function (l) { if (l.r && parseInt(l.r, 10) > 88) byNo[l.r] = l.c; });
    var eq = totalAssets - liab;
    var set = function (no, v) { if (byNo[no]) b[byNo[no]] = v; else if (no) { /* 无此行的表跳过 */ } };
    set('90', eq * 0.30); set('91', 0); set('94', eq * 0.20); set('95', 0);
    set('96', eq * 0.01); set('97', 0); set('98', eq * 0.06); set('99', 0); set('102', 0);
    var acc = 0;
    ['90','91','94','96','97','98','99'].forEach(function (no) { if (byNo[no]) acc += b[byNo[no]]; });
    if (byNo['95']) acc -= b[byNo['95']];
    if (byNo['100']) b[byNo['100']] = eq - acc;
  }

  /* ── 单表自下而上重算 ──
     注意：套表里公式行可能是「倒序依赖」（现金流量表的合计行在最上方，
     依赖其下各小计；利润表的营业总收入在第 1 行），单遍计算会取到旧值，
     因此迭代到收敛为止。 */
  function recalcTable(t, b) {
    var lines = MI.allLines(t);
    for (var pass = 0; pass < 8; pass++) {
      var moved = false;
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        if (!l.f) continue;
        var v = 0;
        for (var j = 0; j < l.f.length; j++) {
          var p = l.f[j];
          v += (p[1] === undefined ? 1 : p[1]) * (b[p[0]] || 0);
        }
        if (v !== b[l.c]) { b[l.c] = v; moved = true; }
      }
      if (!moved) break;
    }
  }

  /* ── 自下而上重算公式行 ── */
  function recalc(D, colKey) {
    MI.TABLES.forEach(function (t) { recalcTable(t, D[t.id][colKey]); });
  }

  /* ── 现金流量表：期末现金轧差，使 资金来源合计 = 资金运用合计 ── */
  function balanceCF(t, b) {
    if (!t.lines2) return;
    var lTot = t.lines[0].c, rTot = t.lines2[0].c;
    if (!t.map[lTot] || !t.map[lTot].f) return;
    recalcTable(t, b);
    var inflow = b[lTot] || 0;
    var rf = t.map[rTot].f;
    var last = rf[rf.length - 1][0];               // 期末现金及现金等价物余额
    var rest = 0;
    for (var i = 0; i < rf.length; i++) {
      if (rf[i][0] !== last) rest += (rf[i][1] || 1) * (b[rf[i][0]] || 0);
    }
    b[last] = inflow - rest;
  }

  function recalcAll(D, colKey) { recalc(D, colKey); }

  /* ═══════════ 组装 ═══════════ */
  function build() {
    var U = {};
    var units = MI.allUnits();

    units.forEach(function (u) {
      var r = rng(hash(u.id + '|v3'));
      var D = blankOne();
      var isAdj = u.type === 'adjust';
      var scale = (u.scale || 30) * YI;
      var debt = DEBT[u.nature] || 0.62;

      ['end', 'begin'].forEach(function (k) {
        var f = (k === 'begin') ? (0.86 + 0.16 * r()) : (0.96 + 0.10 * r());
        /* 演示数据关闭时 ta=0 → 所有填报单位全空 */
        var ta = (isAdj || !MI.DEMO) ? 0 : scale * f;
        MI.TABLES.forEach(function (t) {
          var b = D[t.id][k];
          if (t.id === 'BS') fillBS(t, b, r, ta, debt);
          else fillPlain(t, b, r, ta * (SCALE[t.id] || 0.1));
        });
        recalcAll(D, k);
        if (!isAdj) {
          var cfb = D.CF[k];
          balanceCF(MI.TABLE_MAP.CF, cfb);
          recalcAll(D, k);
        }
      });
      U[u.id] = D;
    });

    /* ═══ 统一轧差：期末现金 = 资金来源合计 − 其余资金运用 ═══
       放在全部生成之后做，保证「资金来源合计 = 资金运用合计」 */
    var CFT = MI.TABLE_MAP.CF;
    if (CFT && CFT.lines2) {
      var cL = CFT.lines[0].c, cR = CFT.lines2[0].c;
      var rf = CFT.map[cR] && CFT.map[cR].f;
      if (rf) {
        var lastCode = rf[rf.length - 1][0];
        units.forEach(function (u) {
          if (u.type === 'adjust') return;
          ['end', 'begin'].forEach(function (k) {
            var b = U[u.id].CF[k];
            recalcTable(CFT, b);
            var inflow = b[cL] || 0, rest = 0;
            for (var i = 0; i < rf.length; i++) {
              if (rf[i][0] !== lastCode) rest += (rf[i][1] || 1) * (b[rf[i][0]] || 0);
            }
            b[lastCode] = inflow - rest;
            recalcTable(CFT, b);
          });
        });
      }
    }

    /* ═══ 集团层大合并抵销：全部记在「大合并调整项」节点上 ═══
       合并数 = 汇总数 + 调整数（与套表「各分部相加 − 抵销额」同一口径） */
    if (U.BIGADJ) {
      var big = { BS: U.BIGADJ.BS.end, IS: U.BIGADJ.IS.end, CF: U.BIGADJ.CF.end };
      var bL = {}, bR = {};
      MI.TABLE_MAP.BS.lines.forEach(function (l) { bL[l.r] = l.c; });
      MI.TABLE_MAP.BS.lines2.forEach(function (l) { bR[l.r] = l.c; });
      var iNo = {};
      MI.TABLE_MAP.IS.lines.forEach(function (l) { iNo[l.r] = l.c; });

      var subs = units.filter(function (x) { return x.nature === 'sub'; });
      var investSum = 0, innerRecv = 0, innerPay = 0, innerRev = 0;

      subs.forEach(function (s) {
        var sb = U[s.id].BS.end, sIs = U[s.id].IS.end;
        var re = (s.ratio || 0) / 100;
        var E = sb[bR['103']] || 0;                    /* 该子公司所有者权益合计 */
        if (E <= 0) return;
        /* 借：子公司权益各行全额；贷：长投 rE；贷：少数股东权益 (1-r)E */
        ['90','91','94','96','97','98','99','100'].forEach(function (no) {
          if (bR[no]) big.BS[bR[no]] -= (sb[bR[no]] || 0);
        });
        if (bR['95']) big.BS[bR['95']] += (sb[bR['95']] || 0);   /* 库存股 反向 */
        big.BS[bL['28']] -= E * re;                     /* 长期股权投资 */
        big.BS[bR['102']] += E * (1 - re);              /* 少数股东权益 */
        investSum += E * re;
        innerRecv += (sb[bL['15']] || 0) * 0.30;
        innerPay += (sb[bR['69']] || 0) * 0.30;
        innerRev += (sIs[iNo['2']] || 0) * 0.05;
      });

      /* 内部往来：借 其他应付款 / 贷 其他应收款，按较小方 */
      var inner = Math.min(innerRecv, innerPay);
      if (bR['69']) big.BS[bR['69']] -= inner;
      if (bL['15']) big.BS[bL['15']] -= inner;

      /* 内部购销：抵 营业收入(序2) 与 营业成本(序9) */
      if (iNo['2']) big.IS[iNo['2']] -= innerRev;
      if (iNo['9']) big.IS[iNo['9']] -= innerRev;

      recalc(U.BIGADJ, 'end');
      recalc(U.BIGADJ, 'begin');
    }

    MI.dataset = {
      units: U,
      vouchers: [],
      stats: { units: units.length, vouchers: 0, byType: {} }
    };
    return MI.dataset;
  }

  MI.buildDataset = build;

  /** 单户编辑后重算（app.js 录入用） */
  MI.recalcUnit = function (unitId) {
    var d = MI.dataset.units[unitId];
    if (!d) return;
    ['end', 'begin'].forEach(function (k) { recalc(d, k); });
  };

  /* 初始化：失败时把真实原因暴露出来，并给出空数据集兜底，
     避免后续脚本只报「Cannot read properties of undefined」这类次生错误 */
  try {
    build();
  } catch (e) {
    var msg = 'seed 初始化失败: ' + (e && e.message ? e.message : e);
    if (window.onerror) window.onerror(msg, 'seed.js', 0, 0);
    else if (window.console) console.error(msg, e);
    MI.dataset = MI.dataset || { units: {}, vouchers: [], stats: { units: 0, vouchers: 0, byType: {} } };
  }
})();
