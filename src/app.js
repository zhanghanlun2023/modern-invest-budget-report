/* ═══════════════════════════════════════════════════════════════
   界面层 —— 按《套表格式.xls》渲染

   布局：
     左侧组织单位树（不含金额）
     右侧 横排页签，一次显示一张表，全宽
        · 双栏表（资产负债表 / 现金流量表）左右两栏并排，与套表一致
        · 第一列「项目」左对齐，最后一列「变动原因」留宽以便写文字
   三种口径：
     单户填报 —— 套表原始列（上年实际 / 本年 / 变动原因），可录入
     汇  总   —— 汇总数
     合  并   —— 汇总数 | 抵销数 | 合并数（抵销数来自「大合并调整项」）
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var S = {
    curNode: 'GROUP',
    checked: {},
    mode: 'consolidated',       // single | summary | consolidated
    unitDiv: 10000,
    tableId: 'BS',
    collapsed: {},
    rollup: null,
    cons: null,
    notes: {},                  // notes[unit][table][colIdx][lineCode] = 文字
    dirty: {},
    treeW: 300,
    task: 'budget',             // budget 预算 | final 决算
    period: '调整预算',          // 预算：期初预算 | 调整预算；决算：月报|季报|半年报|年报
    ver: 'up',                  // up 对上报告版 | down 对下目标任务分解版
    year: '2026'
  };

  var VER_NAME = { up: '对上报告版', down: '对下目标任务分解版' };

  /* 年度区间：以后加年份只改这两个数（或改成从接口取） */
  var YEAR_FROM = 2020;
  var YEAR_TO = 2027;
  function renderYearOptions() {
    var a = [];
    for (var y = YEAR_FROM; y <= YEAR_TO; y++) {
      a.push('<option value="' + y + '"' + (String(y) === String(S.year) ? ' selected' : '') + '>' +
             y + ' 年</option>');
    }
    $('year').innerHTML = a.join('');
  }

  /* 报表期间取值 */
  var PERIODS = {
    budget: ['期初预算', '调整预算', '主要指标'],
    final:  ['月报', '季报', '半年报', '年报']
  };

  /* 期间 → 专属页签（不设则所有表共用） */
  var PERIOD_TABLE = { '主要指标': 'IND' };

  /* 当前「报表期间」对应到表里哪一列（该列即可录入 / 导入的主列）。
     决算体系尚未建表，暂时回落到预算列。 */
  function activeCi(t) {
    var cols = t.cols || [];
    var i;
    if (S.task === 'budget') {
      if (S.period === '期初预算') {
        for (i = 0; i < cols.length; i++) if (cols[i].indexOf('期初') >= 0 || cols[i].indexOf('上年') >= 0) return i;
      } else if (S.period === '调整预算') {
        for (i = 0; i < cols.length; i++) if (cols[i].indexOf('调整') >= 0) return i;
      }
    }
    return (COLCFG[t.id] || COLCFG._).indexOf(1);
  }

  /* ── 错误横幅 ── */
  function showErr(m) {
    var b = $('errbar'); if (!b) return;
    b.hidden = false; b.innerHTML += '<div>' + m + '</div>';
  }
  window.onerror = function (msg, src, ln, col) {
    showErr('<b>JS 异常：</b>' + esc(msg) + ' <span style="color:#991b1b">@ ' +
      esc(String(src || '').split('/').pop()) + ':' + ln + ':' + col + '</span>');
  };

  /* ── 初始化 ── */
  MI.allUnits().forEach(function (u) { S.checked[u.id] = 1; });

  function scopeIds() {
    return MI.unitsUnder(S.curNode)
      .filter(function (u) { return S.checked[u.id] && u.id !== MI.ELIM_NODE_ID; })
      .map(function (u) { return u.id; });
  }
  function note(u, t, ci, code) {
    var a = S.notes[u] = S.notes[u] || {};
    var b = a[t] = a[t] || {};
    var c = b[ci] = b[ci] || {};
    return c[code];
  }
  function setNote(u, t, ci, code, v) {
    var a = S.notes[u] = S.notes[u] || {};
    var b = a[t] = a[t] || {};
    var c = b[ci] = b[ci] || {};
    c[code] = v;
  }
  function recompute() {
    if (S.mode === 'single') { S.rollup = null; S.cons = null; return; }
    var ids = scopeIds();
    S.rollup = MI.rollup(ids);
    S.cons = (S.mode === 'consolidated') ? MI.consolidate(ids, S.rollup) : null;
  }

  /* ══════════════ 组织树（无金额） ══════════════ */
  function nodeRow(n) {
    var isRep = MI.isReportable(n), isSeg = n.type === 'segment', isAdj = n.type === 'adjust';
    var cls = ['tnode'];
    if (isSeg) cls.push('tseg');
    if (n.type === 'group') cls.push('troot');
    if (isAdj) cls.push('tadj');
    if (n.nature === 'assoc') cls.push('tassoc');
    if (S.curNode === n.id) cls.push('cur');
    var kids = n.children || [];
    var h = [];
    h.push('<div class="' + cls.join(' ') + '" data-id="' + n.id + '" style="padding-left:' +
           (4 + n.depth * 12) + 'px">');
    h.push('<span class="tw' + (kids.length ? '' : ' hide') + '">' +
           (kids.length ? (S.collapsed[n.id] ? '▶' : '▼') : '') + '</span>');
    var units = isRep ? [n.id] : MI.unitsUnder(n.id).map(function (u) { return u.id; });
    var hit = units.filter(function (i) { return !!S.checked[i]; }).length;
    if (isRep) {
      h.push('<input type="checkbox" class="tcb" data-unit="' + n.id + '"' + (hit ? ' checked' : '') + '>');
    } else {
      h.push('<input type="checkbox" class="tcb" data-node="' + n.id + '"' +
             (units.length && hit === units.length ? ' checked' : '') + '>');
    }
    if (isAdj) h.push('<i class="dot d-adjust"></i>');
    else if (isRep) h.push('<i class="dot d-' + (n.st || 'filled') + '"></i>');
    else h.push('<i class="dot d-virtual"></i>');
    h.push('<span class="tname" title="' + esc(n.name + '　【' + MI.natureLabel(n) + '】') + '">' +
           esc(n.short || n.name) + '</span>');
    if (isRep && S.dirty[n.id]) h.push('<span class="tdirty">改</span>');
    h.push('<span class="tmeta">' + (isRep ? (isAdj ? '调整' : (n.ratio ? n.ratio + '%' : '—'))
                                           : units.length + '户') + '</span>');
    h.push('</div>');
    return h.join('');
  }
  function renderTree() {
    var h = [nodeRow(MI.org)];
    (function walk(n) {
      if (S.collapsed[n.id]) return;
      (n.children || []).forEach(function (c) { h.push(nodeRow(c)); walk(c); });
    })(MI.org);
    $('tree').innerHTML = h.join('');
    var boxes = $('tree').querySelectorAll('input.tcb[data-node]');
    for (var i = 0; i < boxes.length; i++) {
      var us = MI.unitsUnder(boxes[i].getAttribute('data-node')).map(function (u) { return u.id; });
      var hit = us.filter(function (x) { return !!S.checked[x]; }).length;
      boxes[i].indeterminate = (hit > 0 && hit < us.length);
    }
    var sc = scopeIds();
    $('treeCount').textContent = '范围 ' + sc.length + ' / ' + MI.allUnits().length + ' 个';
  }

  /* ══════════════ 页签（横排） ══════════════ */
  function renderTabs() {
    $('tabs').innerHTML = MI.TABLES.map(function (t) {
      return '<div class="tab' + (S.tableId === t.id ? ' on' : '') + '" data-t="' + t.id + '">' +
             esc(t.name) + '</div>';
    }).join('');
  }

  /* ══════════════ 表体 ══════════════ */
  /* 当前口径下的列定义 */
  function colsOf(t, panelIdx) {
    if (S.mode === 'single') return (panelIdx === 1 && t.cols2) ? t.cols2 : t.cols;
    return null;   // 汇总/合并用固定三列
  }

  function cellValue(t, code, colKey, d) {
    if (S.mode === 'single') {
      return (d && d[t.id] && d[t.id][colKey]) ? (d[t.id][colKey][code] || 0) : 0;
    }
    if (colKey === 'sum') return (S.rollup && S.rollup.end[t.id][code]) || 0;
    if (!S.cons) return 0;
    if (colKey === 'elim') return S.cons.elim.end[t.id][code] || 0;
    if (colKey === 'merged') return S.cons.merged.end[t.id][code] || 0;
    return 0;
  }

  /* 各表数值列的派生规则：主列系数 1，其余按比例派生，增减率/变动在渲染时算。
     三种口径（单户 / 汇总 / 合并）都渲染套表的**全部列**，不改数据模型。 */
  /* 列口径统一由引擎提供（engine.js 的 MI.COLCFG），界面不再自己定义 */
  var COLCFG = MI.COLCFG;
  function isTextCol(n) { return MI.isTextColName(n); }

  function panelHtml(t, lines, panelIdx) {
    var d = (S.mode === 'single') ? MI.dataset.units[S.curNode] : null;
    var cols = (panelIdx === 1 && t.cols2) ? t.cols2 : t.cols;
    var single = S.mode === 'single';
    var cfg = COLCFG[t.id] || COLCFG._;
    var isAdj = (S.curNode === MI.ELIM_NODE_ID);
    var showEdit = single;   /* 单户态一律可录入（含大合并调整项，它是抵销录入位） */
    var aCi = activeCi(t);          /* 报表期间对应的列 = 当前可录入/可导入的主列 */

    /* 该行第 ci 列显示的值：
       单户 → 该单位该列的取值（含手工录入）
       汇总/合并 → rollup 里逐列汇总好的值 */
    function colVal(l, ci) {
      if (single) {
        return d ? MI.colOf(d, t, 'end', l.c, ci) : 0;
      }
      if (isAdj) {
        var adjd = MI.dataset.units[MI.ELIM_NODE_ID];
        return adjd ? MI.colOf(adjd, t, 'end', l.c, ci) : 0;
      }
      var box = S.rollup && S.rollup.col && S.rollup.col.end && S.rollup.col.end[t.id];
      return (box && box[ci]) ? (box[ci][l.c] || 0) : 0;
    }

    var h = [];
    h.push('<table class="sheet' + (single ? ' edit' : '') + '">');
    h.push('<colgroup><col style="width:262px">');
    if (t.noCol) h.push('<col style="width:42px">');
    cols.forEach(function (c) {
      if (isTextCol(c)) h.push('<col>');
      else if (c.indexOf('率') >= 0) h.push('<col style="width:88px">');
      else h.push('<col style="width:112px">');
    });
    h.push('</colgroup><thead><tr>');
    h.push('<th class="k-name">项目</th>');
    if (t.noCol) h.push('<th class="k-code">' + esc(t.noCol) + '</th>');
    cols.forEach(function (c) { h.push('<th>' + esc(c) + '</th>'); });
    h.push('</tr></thead><tbody>');

    lines.forEach(function (l) {
      var cls = [];
      if (l.k === 'grp') cls.push('k-grp');
      if (l.k === 'sum') cls.push('k-sum');
      if (l.k === 'main') cls.push('k-main');
      if (l.k === 'blank') cls.push('k-blank');
      if (l.lv === 1) cls.push('lv1');
      if (l.lv === 2) cls.push('lv2');
      if (l.lv === 3) cls.push('lv3');
      h.push('<tr class="' + cls.join(' ') + '" data-line="' + l.c + '">');
      h.push('<td class="c-name" title="' + esc(l.n) + '">' + esc(l.n) + '</td>');
      if (t.noCol) h.push('<td class="c-code">' + esc(l.r || '') + '</td>');

      cols.forEach(function (c, ci) {
        if (isTextCol(c)) {
          var nv = note(S.curNode, t.id, panelIdx * 100 + ci, l.c) || '';
          h.push('<td class="cellnote"' + (single ? ' data-note="1"' : '') +
                 ' data-panel="' + panelIdx + '" data-col="' + ci +
                 '" data-table="' + t.id + '" data-line="' + l.c +
                 '" title="' + esc(nv) + '">' + esc(nv) + '</td>');
          return;
        }
        var v = colVal(l, ci);
        /* 凡是「数值列」且非公式行，都可以录入；差异/增长率这类计算列只读 */
        var can = showEdit && MI.isEditableLine(t.id, l.c) && !MI.isCalcCol(t.id, ci);
        var spec = cfg[ci];
        var isPct = (spec === 'rate') || (typeof spec === 'string' && /^r:/.test(spec));
        var disp = isPct ? (v * 100).toFixed(2) + '%' : MI.fmt(v, S.unitDiv);
        var nc = 'num' + (v < -0.005 ? ' neg' : (Math.abs(v) < 0.005 ? ' zero' : '')) +
                 (can ? ' editable' : (single ? ' readonly' : ''));
        var attrs = ' data-panel="' + panelIdx + '" data-col="' + ci +
                    '" data-table="' + t.id + '" data-line="' + l.c + '"' +
                    (can ? ' data-edit="1"' : '');
        h.push('<td class="' + nc + '"' + attrs + '>' +
               (disp === '0.00' ? '<span class="zero">0.00</span>' : esc(disp)) + '</td>');
      });
      h.push('</tr>');
    });
    h.push('</tbody></table>');
    return h.join('');
  }

  function renderTable() {
    var t = MI.TABLE_MAP[S.tableId];
    if (!t) return;
    var single = S.mode === 'single';
    var n = MI.index[S.curNode];
    var h = [];
    h.push('<div class="tablewrap">');
    h.push('<div class="thead">');
    h.push('<span class="tt">' + esc(t.name) + '</span>');
    h.push('<span class="tc">' + esc(t.code) + '</span>');
    h.push('<span class="torg">' + esc(single ? (n.short || n.name) : (n.short || n.name) + '（' + modeName() + '）') + '</span>');
    h.push('<span class="tper">' + esc(taskName()) + ' · ' + esc(S.year) + ' · ' + esc(S.period) +
           ' · ' + esc(VER_NAME[S.ver] || '') + '</span>');
    h.push('<span class="tunit">单位：' + (S.unitDiv === 1 ? '元' : '万元') + '</span>');
    if (!single) h.push('<span class="torg">范围 ' + scopeIds().length + ' 个</span>');
    h.push('</div>');

    if (t.lines2) {
      /* 双栏表：左右并排，与套表一致 */
      h.push('<div class="panels2">');
      h.push('<div class="panel"><div class="ph">' + esc((t.panels && t.panels[0]) || '') + '</div>' +
             '<div class="gwrap">' + panelHtml(t, t.lines, 0) + '</div></div>');
      h.push('<div class="panel"><div class="ph">' + esc((t.panels && t.panels[1]) || '') + '</div>' +
             '<div class="gwrap">' + panelHtml(t, t.lines2, 1) + '</div></div>');
      h.push('</div>');
    } else {
      h.push('<div class="gwrap full">' + panelHtml(t, t.lines, 0) + '</div>');
    }
    h.push('</div>');
    $('panes').innerHTML = h.join('');
  }

  function modeName() {
    return S.mode === 'single' ? '单户填报' : S.mode === 'summary' ? '汇总' : '合并';
  }
  function taskName() { return S.task === 'budget' ? '预算' : '决算'; }

  /* 报表任务 / 报表期间：期间选项随任务联动 */
  function renderPeriodOptions() {
    var sel = $('period');
    var opts = PERIODS[S.task] || [];
    if (opts.indexOf(S.period) < 0) S.period = opts[opts.length - 1];
    sel.innerHTML = opts.map(function (p) {
      return '<option value="' + esc(p) + '"' + (p === S.period ? ' selected' : '') + '>' + esc(p) + '</option>';
    }).join('');
  }

  /* ══════════════ 状态栏 ══════════════ */
  function renderStatus() {
    var sc = scopeIds();
    $('sbScope').innerHTML = '汇总范围：<b>' + sc.length + '</b> 个';
    var t = MI.TABLE_MAP[S.tableId];
    if (S.mode === 'single') {
      $('sbSum').innerHTML = '单户：' + esc(t.name);
      $('sbElim').innerHTML = '抵销：<span class="sb-warn">未执行</span>';
    } else {
      var r = S.rollup;
      var pick = t.lines.filter(function (l) { return l.k === 'main'; })[0] || t.lines[0];
      $('sbSum').innerHTML = '汇总：' + esc(pick.n) + ' <b>' + MI.fmt(r.end[t.id][pick.c], S.unitDiv) + '</b>';
      if (S.cons) {
        $('sbElim').innerHTML = '抵销：<b>' + MI.fmt(S.cons.elim.end[t.id][pick.c], S.unitDiv) + '</b>';
      } else {
        $('sbElim').innerHTML = '抵销：<span class="sb-warn">未执行</span>';
      }
    }
    /* 关键勾稽 */
    var msgs = [];
    var bs = MI.TABLE_MAP.BS;
    if (bs) {
      var a, b;
      if (S.mode === 'single') { var d = MI.dataset.units[S.curNode]; a = d ? d.BS.end.BSL52 : 0; b = d ? d.BS.end.BSR104 : 0; }
      else if (S.cons) { a = S.cons.merged.end.BS.BSL52; b = S.cons.merged.end.BS.BSR104; }
      else { a = S.rollup.end.BS.BSL52; b = S.rollup.end.BS.BSR104; }
      if (Math.abs(a - b) > 0.01) msgs.push('<span class="sb-bad">✖ 资产负债表不平 ' + MI.fmt(a - b, S.unitDiv) + '</span>');
      else msgs.push('<span class="sb-ok">✔ 资产负债表平衡</span>');
    }
    var cft = MI.TABLE_MAP.CF;
    if (cft) {
      var x, y;
      if (S.mode === 'single') { var d2 = MI.dataset.units[S.curNode]; x = d2 ? d2.CF.end[cft.lines[0].c] : 0; y = d2 ? d2.CF.end[cft.lines2[0].c] : 0; }
      else if (S.cons) { x = S.cons.merged.end.CF[cft.lines[0].c]; y = S.cons.merged.end.CF[cft.lines2[0].c]; }
      else { x = S.rollup.end.CF[cft.lines[0].c]; y = S.rollup.end.CF[cft.lines2[0].c]; }
      if (Math.abs(x - y) > 0.01) msgs.push('<span class="sb-bad">✖ 现金流量表不平 ' + MI.fmt(x - y, S.unitDiv) + '</span>');
      else msgs.push('<span class="sb-ok">✔ 现金流量表平衡</span>');
    }
    $('sbCheck').innerHTML = msgs.join(' ｜ ');
    $('pillScope').textContent = '范围 ' + sc.length + ' 个';
    $('pillMode').textContent = modeName() + '态';
    ['btnFill', 'btnSum', 'btnCons'].forEach(function (id) { $(id).classList.remove('active'); });
    $(S.mode === 'single' ? 'btnFill' : S.mode === 'summary' ? 'btnSum' : 'btnCons').classList.add('active');
  }

  function renderAll() { renderTree(); renderTabs(); renderTable(); renderStatus(); }

  /* ══════════════ 单元格录入 ══════════════ */
  function applyEdit(t, code, v, ci) {
    var uid = S.curNode, d = MI.dataset.units[uid];
    if (!d) return;
    /* 每列独立存储：key 格式与 MI.colOf 一致 → 'end|列号|行号' */
    d.ov = d.ov || {};
    d.ov[t.id] = d.ov[t.id] || {};
    d.ov[t.id]['end|' + ci + '|' + code] = v;
    var cfg = MI.colCfgOf(t.id);
    if (cfg[ci] === 1) d[t.id].end[code] = v;
    MI.recalcUnit(uid);
    S.dirty[uid] = 1;
    var n = MI.index[uid];
    if (n && n.st === 'draft') n.st = 'filled';
    recompute();
  }
  function startEdit(td) {
    if (td.querySelector('input')) return;
    var tid = td.getAttribute('data-table'), code = td.getAttribute('data-line');
    var ci = parseInt(td.getAttribute('data-col'), 10) || 0;
    var d = MI.dataset.units[S.curNode];
    if (!d) return;
    var t = MI.TABLE_MAP[tid];
    /* 显示什么就编辑什么（含已手工录入的值） */
    var raw = MI.colOf(d, t, 'end', code, ci);
    var inp = document.createElement('input');
    inp.className = 'cellinput';
    inp.value = (Math.round(raw * 100) / 100).toFixed(2);
    td.innerHTML = ''; td.appendChild(inp); inp.focus(); inp.select();
    var done = false;
    function fin(commit, dir) {
      if (done) return; done = true;
      if (commit) {
        var v = parseFloat(String(inp.value).replace(/[,，\s]/g, ''));
        if (isNaN(v)) v = 0;
        applyEdit(MI.TABLE_MAP[tid], code, v, ci);
      }
      /* 延迟重建：不能在 blur / keydown 处理器里同步替换 DOM，
         否则 focus() 引发的嵌套 blur 会让 innerHTML 赋值抛 NotFoundError */
      setTimeout(function () {
        var sp2 = [];
        Array.prototype.forEach.call(document.querySelectorAll('.gwrap'), function (g) { sp2.push(g.scrollTop); });
        renderAll();
        Array.prototype.forEach.call(document.querySelectorAll('.gwrap'), function (g, i) {
          if (sp2[i] !== undefined) g.scrollTop = sp2[i];
        });
        if (dir) moveCell(tid, code, dir);
      }, 0);
    }
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); fin(true, 'down'); }
      else if (e.key === 'Escape') { e.preventDefault(); fin(false); }
    });
    inp.addEventListener('blur', function () { fin(true); });
  }
  function editList(tid) {
    var t = MI.TABLE_MAP[tid], out = [];
    [t.lines, t.lines2 || []].forEach(function (arr, pi) {
      arr.forEach(function (l) { if (MI.isEditableLine(tid, l.c)) out.push({ c: l.c, p: pi }); });
    });
    return out;
  }
  function moveCell(tid, code, dir) {
    var list = editList(tid), i = -1;
    for (var k = 0; k < list.length; k++) if (list[k].c === code) { i = k; break; }
    var nx = list[i + (dir === 'down' ? 1 : -1)];
    if (!nx) return;
    var td = $('panes').querySelector('td.editable[data-table="' + tid + '"][data-line="' + nx.c + '"]');
    if (td) startEdit(td);
  }
  function startNote(td) {
    if (td.querySelector('input')) return;
    var cur = td.textContent;
    var inp = document.createElement('input');
    inp.className = 'cellinput note';
    inp.value = cur;
    td.innerHTML = ''; td.appendChild(inp); inp.focus(); inp.select();
    var done = false;
    function fin(commit) {
      if (done) return; done = true;
      if (commit) setNote(S.curNode, td.getAttribute('data-table'),
                          parseInt(td.getAttribute('data-panel'), 10) * 100 + parseInt(td.getAttribute('data-col'), 10),
                          td.getAttribute('data-line'), inp.value);
      /* 同上：把重建推到事件之后，避免 blur 中替换 DOM 抛 NotFoundError */
      setTimeout(function () { renderAll(); }, 0);
    }
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); fin(true); }
      else if (e.key === 'Escape') { e.preventDefault(); fin(false); }
    });
    inp.addEventListener('blur', function () { fin(true); });
  }

  /* ══════════════ Excel 导入 ══════════════
     · SheetJS 纯前端解析，.xls / .xlsx / .xlsm 都支持
     · 单文件：导入到当前选中的单位
     · 多文件：自动按「编制单位」识别（识别不到再退回文件名），批量导入
  */
  function normName(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/[\s　]/g, '')
      .replace(/[（(]/g, '(').replace(/[）)]/g, ')')
      .replace(/[：:]/g, ':')
      .replace(/[\u201c\u201d\u2018\u2019]/g, '"');
  }

  /* 主列别名：系统表样用 5 列版列名，单位实际填报常用 9 列版，
     同一个「本年」在不同文件里可能叫「2026年调整预算」。 */
  var MAIN_ALIAS = {
    '本年':     ['本年', '调整预算', '2026年调整预算'],
    '本年预算': ['本年预算', '调整预算', '2026年调整预算'],
    '调整预算': ['调整预算', '2026年调整预算', '本年预算'],
    '合计':     ['合计', '本年预算', '调整预算'],
    '_':        []
  };

  /* 按表名找工作表（依次尝试：全名 → 去掉「表」→ 「表」之前的主体词） */
  function findSheet(wb, t) {
    var cands = [t.name, t.name.replace(/表$/, ''), t.name.split('表')[0]];
    for (var i = 0; i < cands.length; i++) {
      var c = String(cands[i] || '').replace(/\s/g, '');
      if (!c) continue;
      for (var j = 0; j < wb.SheetNames.length; j++) {
        var nn = String(wb.SheetNames[j]).replace(/\s/g, '');
        if (nn.indexOf(c) >= 0) return wb.SheetNames[j];
      }
    }
    return null;
  }

  /* 把一张工作表里能匹配上的行写进数据盒；返回写入格数 */
  function importSheetInto(ws, t, d) {
    var grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    var hr = -1, hdr = null;
    for (var r = 0; r < Math.min(grid.length, 12); r++) {
      var row = grid[r] || [];
      if (row.some(function (c) { return typeof c === 'string' && /项\s*目/.test(c); })) { hr = r; hdr = row; break; }
    }
    if (hr < 0) return { n: 0, msg: '找不到表头行（含"项目"）' };

    var starts = [];
    hdr.forEach(function (c, i) { if (typeof c === 'string' && /项\s*目/.test(c)) starts.push(i); });

    var cfg = COLCFG[t.id] || COLCFG._;
    var mainCi = activeCi(t);
    var total = 0, msgs = [];

    starts.forEach(function (c0, pi) {
      var lines = (pi === 1 && t.lines2) ? t.lines2 : (pi === 0 ? t.lines : null);
      if (!lines) return;
      var cols = (pi === 1 && t.cols2) ? t.cols2 : t.cols;
      var cEnd = (starts[pi + 1] !== undefined) ? starts[pi + 1] : (hdr.length + 8);
      var mainName = normName(cols[mainCi]);
      var alias = (MAIN_ALIAS[cols[mainCi]] || MAIN_ALIAS._).concat([cols[mainCi]]);
      var cMain = -1;
      for (var ai = 0; ai < alias.length && cMain < 0; ai++) {
        var am = normName(alias[ai]);
        if (!am) continue;
        for (var c = c0; c < cEnd; c++) {
          var h = normName(hdr[c]);
          if (h && h !== mainName && h.indexOf(am) >= 0) { cMain = c; break; }
          if (h && h === mainName && h === am) { cMain = c; break; }
        }
      }
      /* 再兜底：分栏内最后一个不像「原因/说明/备注/差额」的列 */
      if (cMain < 0) {
        for (var c2 = cEnd - 1; c2 > c0; c2--) {
          var h2 = normName(hdr[c2]);
          if (!h2) continue;
          if (/原因|说明|备注|差额|变动率|增减率/.test(h2)) continue;
          cMain = c2; break;
        }
      }
      if (cMain < 0) { msgs.push('分栏' + (pi + 1) + '缺主列「' + cols[mainCi] + '」'); return; }

      var byName = {};
      lines.forEach(function (l) { var k = normName(l.n); if (k && !byName[k]) byName[k] = l; });

      var hit = 0;
      for (var rr = hr + 1; rr < grid.length; rr++) {
        var rw = grid[rr] || [];
        var raw0 = rw[c0];
        if (typeof raw0 === 'string' && /项\s*目/.test(raw0)) continue;
        var nm = normName(raw0);
        if (!nm) continue;
        var l = byName[nm];
        if (!l) continue;
        var v = rw[cMain];
        if (typeof v !== 'number') v = parseFloat(String(v === null ? '' : v).replace(/[,，\s]/g, ''));
        if (isNaN(v)) v = 0;
        d[t.id].end[l.c] = v;
        hit++; total++;
      }
      msgs.push('栏' + (pi + 1) + ':' + hit);
    });
    return { n: total, msg: msgs.join(' ') };
  }

  /* 从工作簿里读「编制单位」 */
  function readUnitLabel(wb) {
    for (var si = 0; si < wb.SheetNames.length; si++) {
      var g = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[si]], { header: 1, raw: false, defval: '' });
      for (var r = 0; r < Math.min(g.length, 8); r++) {
        var row = g[r] || [];
        for (var c = 0; c < row.length; c++) {
          var v = String(row[c] === null ? '' : row[c]);
          if (v.indexOf('编制单位') < 0) continue;
          var t = v.replace(/^[\s\S]*?编制单位\s*[：:]\s*/, '').trim();
          if (t && t !== v) return t;
          var t2 = String(row[c + 1] === null ? '' : row[c + 1]).trim();
          if (t2) return t2;
        }
      }
    }
    return '';
  }

  /* 文本 → 单位节点（精确 > 包含 > 被包含） */
  function matchUnit(text) {
    var key = normName(text);
    if (!key) return null;
    var best = null, score = 0;
    MI.allUnits().forEach(function (u) {
      if (u.type === 'adjust') return;
      [u.name, u.short].forEach(function (nm) {
        var k = normName(nm);
        if (!k) return;
        var sc = 0;
        if (k === key) sc = 1000 + k.length;
        else if (key.indexOf(k) >= 0) sc = 500 + k.length;
        else if (k.indexOf(key) >= 0) sc = 400 + key.length;
        if (sc > score) { score = sc; best = u; }
      });
    });
    return score >= 400 ? best : null;
  }

  /* 导入一个工作簿到一个单位 */
  function importWorkbookToUnit(wb, unit) {
    var d = MI.dataset.units[unit.id], res = [];
    MI.TABLES.forEach(function (t) {
      var sn = findSheet(wb, t);
      if (!sn) { res.push(t.name + '：无对应工作表'); return; }
      var r = importSheetInto(wb.Sheets[sn], t, d);
      res.push(t.name + '：' + (r.n ? r.n + ' 格 (' + r.msg + ')' : '0 格 ' + r.msg));
    });
    MI.recalcUnit(unit.id);
    S.dirty[unit.id] = 1;
    var n = MI.index[unit.id];
    if (n && n.st === 'draft') n.st = 'filled';
    return res;
  }

  function handleFiles(files) {
    if (!files || !files.length) return;
    if (typeof XLSX === 'undefined') { alert('解析库未加载：assets/sheetjs.min.js'); return; }
    var list = Array.prototype.slice.call(files);
    var out = [], pending = list.length;

    list.forEach(function (f) {
      var fr = new FileReader();
      fr.onload = function (e) {
        try {
          var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          var unit = null;
          if (list.length === 1) {
            unit = MI.isReportable(MI.index[S.curNode]) && MI.index[S.curNode].type !== 'adjust'
                 ? MI.index[S.curNode] : null;
          }
          var label = readUnitLabel(wb);
          var matched = matchUnit(label) || matchUnit(f.name.replace(/\.(xlsx?|xlsm)$/i, ''));
          if (!matched && list.length > 1) { out.push('✖ ' + f.name + '：识别不到单位（编制单位="' + label + '"）'); return; }
          if (!matched) matched = unit;
          if (!matched) { out.push('✖ ' + f.name + '：识别不到单位，请先在左侧选中该单位'); return; }
          if (list.length === 1) matched = unit || matched;
          var lines = importWorkbookToUnit(wb, matched);
          out.push('✔ ' + f.name + '  →  ' + (matched.short || matched.name) +
                   (label ? '（编制单位：' + label + '）' : '') + '\n    ' + lines.join('\n    '));
        } catch (err) {
          out.push('✖ ' + f.name + '：解析失败 ' + (err && err.message ? err.message : err));
        }
        if (--pending === 0) done();
      };
      fr.onerror = function () { out.push('✖ ' + f.name + '：读取失败'); if (--pending === 0) done(); };
      fr.readAsArrayBuffer(f);
    });

    function done() {
      recompute();
      renderAll();
      alert('导入完成（' + list.length + ' 个文件）\n\n' + out.join('\n\n'));
    }
  }

  /* ══════════════ 事件 ══════════════ */
  $('tree').addEventListener('change', function (e) {
    var cb = e.target;
    if (!cb.classList || !cb.classList.contains('tcb')) return;
    var uid = cb.getAttribute('data-unit'), nid = cb.getAttribute('data-node');
    if (uid) { if (cb.checked) S.checked[uid] = 1; else delete S.checked[uid]; }
    else if (nid) MI.unitsUnder(nid).forEach(function (u) {
      if (cb.checked) S.checked[u.id] = 1; else delete S.checked[u.id];
    });
    recompute(); renderAll();
  });
  $('tree').addEventListener('click', function (e) {
    if (e.target.tagName === 'INPUT') return;
    var row = e.target.closest && e.target.closest('.tnode');
    if (!row) return;
    var id = row.getAttribute('data-id');
    if (e.target.classList.contains('tw')) { S.collapsed[id] = !S.collapsed[id]; renderTree(); return; }
    S.curNode = id;
    var n = MI.index[id];
    if (MI.isReportable(n)) { if (S.mode !== 'single') S.mode = 'single'; }
    else if (S.mode === 'single') S.mode = 'summary';
    recompute(); renderAll();
  });
  $('tabs').addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.tab');
    if (!t) return;
    S.tableId = t.getAttribute('data-t');
    renderTabs(); renderTable(); renderStatus();
  });
  $('panes').addEventListener('click', function (e) {
    var ntd = e.target.closest && e.target.closest('td.cellnote[data-note]');
    if (ntd && S.mode === 'single') { startNote(ntd); return; }
    var td = e.target.closest && e.target.closest('td.editable[data-edit]');
    if (td && S.mode === 'single') { startEdit(td); return; }

    /* 点了不可录入的格子 → 给出明确原因，避免"点了没反应" */
    var anyTd = e.target.closest && e.target.closest('td.num');
    if (anyTd) {
      if (S.mode !== 'single') {
        $('sbTip').textContent = '当前是' + modeName() + '态，只读。点工具栏「单户填报」或左侧选一个填报单位后可录入';
        return;
      }
      var ln = MI.lineMap[S.tableId + '.' + anyTd.getAttribute('data-line')];
      var tt = MI.TABLE_MAP[S.tableId];
      var mainCol = tt ? tt.cols[activeCi(tt)] : '';
      if (ln && ln.f && ln.f.length) {
        $('sbTip').textContent = '「' + ln.n + '」是公式行（由下级明细自动汇总），不能直接录入';
      } else {
        $('sbTip').textContent = '该列只读；本表可录入的是「' + mainCol + '」列（随报表期间变化）';
      }
      return;
    }

    var tr = e.target.closest && e.target.closest('tr');
    if (!tr) return;
    var l = MI.lineMap[S.tableId + '.' + tr.getAttribute('data-line')];
    if (l && l.k === 'grp') { /* 折叠留空 */ }
  });
  $('btnFill').onclick = function () {
    var n = MI.index[S.curNode];
    /* 当前节点不能填报（合计/板块/分组）或选中了调整项时，
       自动挑一个「真正的填报单位」——跳过调整项，否则会落到大合并调整项上导致整表只读 */
    if (!MI.isReportable(n) || n.type === 'adjust') {
      var list = MI.unitsUnder(S.curNode).filter(function (u) { return u.type === 'unit'; });
      if (!list.length) list = MI.allUnits().filter(function (u) { return u.type === 'unit'; });
      if (list.length) S.curNode = list[0].id;
    }
    S.mode = 'single'; recompute(); renderAll();
    var tt = MI.TABLE_MAP[S.tableId];
    $('sbTip').textContent = '单户填报：单击「' + (tt ? tt.cols[activeCi(tt)] : '') +
      '」列的数值格录入，Enter 确认 / Esc 取消；合计与小计是公式行，不可录入';
  };
  $('btnSum').onclick = function () { S.mode = 'summary'; S.cons = null; recompute(); renderAll(); };
  $('btnCons').onclick = function () { S.mode = 'consolidated'; recompute(); renderAll(); };
  $('btnElim').onclick = function () { S.curNode = MI.ELIM_NODE_ID; S.mode = 'single'; recompute(); renderAll(); };
  $('btnImport').onclick = function () { $('fileXls').click(); };
  $('fileXls').onchange = function () { handleFiles(this.files); this.value = ''; };
  $('btnCheck').onclick = function () {
    var m = [];
    var bs = MI.TABLE_MAP.BS, cft = MI.TABLE_MAP.CF;
    var get = function (tid, code) {
      if (S.mode === 'single') { var d = MI.dataset.units[S.curNode]; return d ? (d[tid].end[code] || 0) : 0; }
      if (S.cons) return S.cons.merged.end[tid][code] || 0;
      return S.rollup.end[tid][code] || 0;
    };
    m.push('口径：' + modeName() + '　范围：' + scopeIds().length + ' 个');
    m.push('');
    m.push('资产负债表  资产总计 ' + MI.fmt(get('BS', 'BSL52'), S.unitDiv) +
           '　负债和所有者权益总计 ' + MI.fmt(get('BS', 'BSR104'), S.unitDiv) +
           '　差 ' + MI.fmt(get('BS', 'BSL52') - get('BS', 'BSR104'), S.unitDiv));
    m.push('现金流量表  资金来源 ' + MI.fmt(get('CF', cft.lines[0].c), S.unitDiv) +
           '　资金运用 ' + MI.fmt(get('CF', cft.lines2[0].c), S.unitDiv) +
           '　差 ' + MI.fmt(get('CF', cft.lines[0].c) - get('CF', cft.lines2[0].c), S.unitDiv));
    m.push('利润表      营业总收入 ' + MI.fmt(get('IS', MI.TABLE_MAP.IS.lines[0].c), S.unitDiv));
    alert(m.join('\n'));
  };
  $('btnExport').onclick = function () {
    var n = MI.index[S.curNode];
    if (!n || n.type !== 'unit') { alert('请先在左侧选中一个「填报单位」再导出'); return; }
    try {
      var fn = MI.exportExcel(n.id, n.short || n.name, {
        year: S.year, period: S.period, ver: (VER_NAME || {})[S.ver] || S.ver
      });
      $('sbTip').textContent = '✔ 已导出 ' + fn + '（每张表一个工作表，可直接发给集团）';
    } catch (e) {
      alert('导出失败：' + (e && e.message ? e.message : e));
    }
  };
  /* 演示数据开关：默认空白报表，点此载入/清除虚构演示数据 */
  $('btnDemo').onclick = function () {
    MI.DEMO = !MI.DEMO;
    MI.buildDataset();
    S.notes = {}; S.dirty = {};
    recompute(); renderAll();
    this.classList.toggle('active', MI.DEMO);
    this.textContent = MI.DEMO ? '清除演示数据' : '载入演示数据';
    $('sbTip').textContent = MI.DEMO
      ? '已载入演示数据（虚构，仅供查看汇总/合并效果；正式使用请点「清除演示数据」后导入真实数据）'
      : '已切换为空白报表：各表无数据，由各单位录入或导入 Excel';
  };
  $('btnReset').onclick = function () {
    if (!confirm('丢弃本次录入，恢复初始状态？')) return;
    MI.buildDataset(); S.notes = {}; S.dirty = {}; recompute(); renderAll();
  };
  $('tAll').onclick = function () { MI.allUnits().forEach(function (u) { S.checked[u.id] = 1; }); recompute(); renderAll(); };
  $('tNone').onclick = function () { S.checked = {}; recompute(); renderAll(); };
  $('tLeaf').onclick = function () {
    S.checked = {};
    MI.allUnits().forEach(function (u) { if (u.st !== 'draft') S.checked[u.id] = 1; });
    recompute(); renderAll();
  };
  $('tExp').onclick = function () { S.collapsed = {}; renderTree(); };
  $('tCol').onclick = function () {
    MI.order.forEach(function (id) { if ((MI.index[id].children || []).length) S.collapsed[id] = 1; });
    renderTree();
  };
  $('unit').onchange = function () { S.unitDiv = parseInt(this.value, 10) || 1; renderTable(); renderStatus(); };
  $('task').onchange = function () {
    S.task = this.value;
    renderPeriodOptions();
    renderAll();
    $('sbTip').textContent = (S.task === 'final')
      ? '决算体系（月报/季报/半年报/年报）的表样尚未建立，当前仍按预算表样展示 —— 待后续完善'
      : '期间「' + S.period + '」对应套表里的同名列，该列可录入 / 可导入';
  };
  $('period').onchange = function () {
    S.period = this.value;
    /* 某些期间有专属表（如「主要指标」），选中时自动切到该页签 */
    var pt = PERIOD_TABLE[S.period];
    if (pt && MI.TABLE_MAP[pt]) S.tableId = pt;
    else if (S.tableId === 'IND') S.tableId = 'BS';
    renderAll();
    $('sbTip').textContent = pt
      ? '期间「' + S.period + '」使用专用报表《' + MI.TABLE_MAP[pt].name + '》，组织树与口径与其它表共用'
      : '期间「' + S.period + '」对应套表里的同名列，该列可录入 / 可导入';
  };
  $('year').onchange = function () { S.year = this.value; renderTable(); renderStatus(); };
  $('ver').onchange = function () {
    S.ver = this.value;
    renderTable(); renderStatus();
    $('sbTip').textContent = '版本「' + (VER_NAME[S.ver] || '') + '」——' +
      (S.ver === 'up' ? '各分子公司上报汇总口径' : '集团下达给各分子公司的目标分解口径');
  };
  $('gutterTree').addEventListener('mousedown', function (e) {
    var x0 = e.clientX, w0 = $('treewrap').getBoundingClientRect().width;
    function mv(ev) { $('treewrap').style.flexBasis = Math.max(160, Math.min(700, w0 + ev.clientX - x0)) + 'px'; }
    function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up); e.preventDefault();
  });

  /* ── 云端同步（Streamlit 部署时可用）── */
  if (MI.cloud && MI.cloud.enabled) {
    var cloudDisable = function (msg) {
      ['btnCloudSave', 'btnCloudLoad'].forEach(function (id) {
        var b = $(id);
        if (b) { b.disabled = true; b.title = msg; }
      });
    };
    /* 后端探测结果出来后决定按钮是否可用 */
    MI.cloud.onApiReady = function (ok) {
      if (!ok) {
        cloudDisable('当前部署没有服务端存储（如 Streamlit Community Cloud），请用「导出 Excel」后回传');
        $('sbTip').textContent = '提示：当前部署无服务端存储，填报完成后请用「导出 Excel」把文件发回集团';
      }
    };
    if (MI.cloud.apiOk === false) MI.cloud.onApiReady(false);
    $('btnCloudSave').onclick = function () {
      var n = MI.index[S.curNode];
      if (!n || n.type !== 'unit') { alert('请先在左侧选中一个「填报单位」再提交'); return; }
      var sub = prompt('提交人（可留空，方便汇总时追溯）', MI.cloud.submitter || '');
      if (sub === null) return;
      MI.cloud.submitter = sub;
      $('sbTip').textContent = '正在提交…';
      MI.cloud.save(n.id, n.short || n.name, sub).then(function (r) {
        $('sbTip').textContent = r.ok
          ? '✔ 已提交「' + (n.short || n.name) + '」　' + (r.action === 'updated' ? '已覆盖旧记录' : '首次提交') + '　' + r.updated_at
          : '✖ 提交失败：' + (r.error || '未知错误');
      }).catch(function (e) { $('sbTip').textContent = '✖ 提交失败：' + e.message; });
    };
    $('btnCloudLoad').onclick = function () {
      var n = MI.index[S.curNode];
      if (!n || n.type !== 'unit') { alert('请先在左侧选中一个「填报单位」再读取'); return; }
      $('sbTip').textContent = '正在读取…';
      MI.cloud.load(n.id).then(function (r) {
        if (!r.ok) { $('sbTip').textContent = '服务器上没有「' + (n.short || n.name) + '」的提交记录'; return; }
        MI.cloud.apply(n.id, r.data);
        MI.recalcUnit(n.id);
        recompute(); renderAll();
        $('sbTip').textContent = '✔ 已读取「' + (n.short || n.name) + '」　提交时间 ' + r.updatedAt;
      }).catch(function (e) { $('sbTip').textContent = '✖ 读取失败：' + e.message; });
    };
  } else {
    ['btnCloudSave', 'btnCloudLoad'].forEach(function (id) {
      var b = $(id);
      if (b) { b.disabled = true; b.title = '仅在 Streamlit 部署下可用（本地静态文件无服务器）'; }
    });
  }

  /* ── 启动 ── */
  try {
    if (!MI.dataset || !MI.dataset.units || !Object.keys(MI.dataset.units).length) {
      throw new Error('数据未生成（MI.dataset 为空）——请查看上方 seed 报错，或按 Ctrl+Shift+R 强刷清缓存');
    }
    /* 从 URL 参数接收 Streamlit 侧边栏选定的口径 */
    if (MI.cloud && MI.cloud.enabled) {
      if (/^\d{4}$/.test(MI.cloud.year)) S.year = MI.cloud.year;
      S.task = (MI.cloud.task === '决算') ? 'final' : 'budget';
      if ((PERIODS[S.task] || []).indexOf(MI.cloud.period) >= 0) S.period = MI.cloud.period;
      S.ver = (String(MI.cloud.ver).indexOf('对下') >= 0) ? 'down' : 'up';
      var q$ = { year: S.year, task: S.task === 'final' ? '决算' : '预算', period: S.period, ver: S.ver === 'down' ? '对下目标任务分解版' : '对上报告版' };
      var sel = { task: q$.task, period: q$.period, ver: q$.ver };
      if ($('task')) $('task').value = S.task;
      if ($('ver')) $('ver').value = S.ver;
    }
    renderPeriodOptions();
    renderYearOptions();
    recompute();
    renderAll();
    $('sbTip').textContent = '期间「' + S.period + '」对应套表里的同名列，该列可录入 / 可导入';
    var nBS = MI.TABLE_MAP.BS, nCF = MI.TABLE_MAP.CF, nIS = MI.TABLE_MAP.IS;
    $('sbTip').textContent = '表样：《套表格式.xls》· ' + MI.TABLES.length + ' 张表 · 横排页签' +
      (nBS && nCF && nIS ? '（含双栏资产负债表/现金流量表）' : '');
  } catch (e) {
    showErr('<b>初始化失败：</b>' + esc(e && e.message ? e.message : e));
    var bar = $('errbar');
    if (bar && window.__DSH_ERRS && window.__DSH_ERRS.length) {
      bar.innerHTML += '<div style="font-size:11px;color:#7f1d1d">底层错误：' +
        window.__DSH_ERRS.map(esc).join('；') + '</div>';
    }
  }
})();
