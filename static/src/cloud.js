/* ═══════════════════════════════════════════════════════════════
   云端同步（Streamlit 部署用）
   · 只在 Streamlit 的 /app/static/ 路径下启用；直接双击 index.html 时自动降级
   · 把当前「单位」的全部报表数据提交到服务器，或从服务器读回
   · 服务端接口见 asgi_app.py：POST /api/save、GET /api/load
   ═══════════════════════════════════════════════════════════════ */
window.MI = window.MI || {};

(function () {
  function parseQuery() {
    var o = {};
    var s = (location.search || '').replace(/^\?/, '');
    if (!s) return o;
    s.split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i));
      var v = decodeURIComponent(i < 0 ? '' : kv.slice(i + 1));
      o[k] = v;
    });
    return o;
  }

  var Q = parseQuery();
  var enabled = /^\/app\/static\//.test(location.pathname);

  MI.cloud = {
    enabled: enabled,
    apiOk: null,          /* null=检测中  true=后端可用  false=无后端（如 Community Cloud） */
    year: Q.year || '2026',
    task: Q.task || '预算',
    period: Q.period || '调整预算',
    ver: Q.ver || '对上报告版',
    submitter: Q.submitter || ''
  };

  /* 探测后端是否真的存在：Community Cloud 只跑普通 Streamlit 脚本，
     没有 st.App 的 /api 路由，此时要把提交/读取按钮降级掉。 */
  if (enabled) {
    fetch('/api/health', { method: 'GET' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        MI.cloud.apiOk = !!(j && j.ok);
        MI.cloud.onApiReady && MI.cloud.onApiReady(MI.cloud.apiOk);
      })
      .catch(function () {
        MI.cloud.apiOk = false;
        MI.cloud.onApiReady && MI.cloud.onApiReady(false);
      });
  }

  /* 序列化一个单位的全部表数据 */
  function serialize(unitId) {
    var d = MI.dataset && MI.dataset.units[unitId];
    if (!d) return null;
    var tables = {};
    MI.TABLES.forEach(function (t) {
      var box = d[t.id];
      if (!box) return;
      tables[t.id] = { end: box.end || {}, begin: box.begin || {} };
    });
    return { tables: tables, ov: d.ov || {} };
  }

  /* 把服务器数据合并回该单位 */
  function apply(unitId, data) {
    var d = MI.dataset && MI.dataset.units[unitId];
    if (!d || !data) return false;
    if (data.tables) {
      Object.keys(data.tables).forEach(function (tid) {
        if (!d[tid]) return;
        var src = data.tables[tid] || {};
        if (src.end) Object.keys(src.end).forEach(function (k) { d[tid].end[k] = src.end[k]; });
        if (src.begin) Object.keys(src.begin).forEach(function (k) { d[tid].begin[k] = src.begin[k]; });
      });
    }
    d.ov = data.ov || {};
    return true;
  }

  MI.cloud.serialize = serialize;
  MI.cloud.apply = apply;

  MI.cloud.save = function (unitId, unitName, submitter) {
    var payload = serialize(unitId);
    if (!payload) return Promise.reject(new Error('该单位没有数据'));
    return fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: MI.cloud.year, task: MI.cloud.task, period: MI.cloud.period,
        ver: MI.cloud.ver, unitId: unitId, unitName: unitName,
        submitter: submitter || MI.cloud.submitter || '',
        data: payload
      })
    }).then(function (r) { return r.json(); });
  };

  MI.cloud.load = function (unitId) {
    var q = '?year=' + encodeURIComponent(MI.cloud.year) +
            '&task=' + encodeURIComponent(MI.cloud.task) +
            '&period=' + encodeURIComponent(MI.cloud.period) +
            '&ver=' + encodeURIComponent(MI.cloud.ver) +
            '&unit=' + encodeURIComponent(unitId);
    return fetch('/api/load' + q).then(function (r) { return r.json(); });
  };

  /* ═══════════ 导出 Excel ═══════════
     把一个单位全部表导成 xlsx：每张表一个 sheet，列与界面一致。
     不依赖服务端，Community Cloud / 本地静态都能用。 */
  MI.exportExcel = function (unitId, unitName, meta) {
    if (typeof XLSX === 'undefined') throw new Error('SheetJS 未加载');
    var d = MI.dataset && MI.dataset.units[unitId];
    if (!d) throw new Error('没有该单位的数据');

    var wb = XLSX.utils.book_new();
    var used = {};

    function sheetName(n) {
      var s = String(n).replace(/[\\\/\?\*\[\]:]/g, '').slice(0, 28) || 'Sheet';
      var base = s, i = 2;
      while (used[s]) { s = (base.slice(0, 26) + '(' + i + ')'); i++; }
      used[s] = 1;
      return s;
    }

    MI.TABLES.forEach(function (t) {
      var panels = [{ lines: t.lines, cols: t.cols, title: (t.panels && t.panels[0]) || '' }];
      if (t.lines2) panels.push({ lines: t.lines2, cols: t.cols2 || t.cols, title: (t.panels && t.panels[1]) || '' });

      var aoa = [];
      aoa.push(['编制单位：' + (unitName || '')]);
      aoa.push(['期间：' + (meta ? meta.period : '') + '    版本：' + (meta ? meta.ver : '') + '    单位：元']);
      aoa.push([]);

      panels.forEach(function (p, pi) {
        if (panels.length > 1) {
          aoa.push([p.title || ('分栏' + (pi + 1))]);
        }
        var head = ['项目'];
        if (t.noCol) head.push(t.noCol);
        p.cols.forEach(function (c) { head.push(c); });
        aoa.push(head);

        p.lines.forEach(function (l) {
          var row = [l.n];
          if (t.noCol) row.push(l.r || '');
          p.cols.forEach(function (c, ci) {
            if (MI.isTextColName(c)) { row.push(''); return; }
            var v = MI.colOf(d, t, 'end', l.c, ci);
            var spec = MI.colCfgOf(t.id)[ci];
            var pct = (spec === 'rate') || (typeof spec === 'string' && /^r:/.test(spec));
            row.push(pct ? +((v * 100).toFixed(4)) : +(v.toFixed(2)));
          });
          aoa.push(row);
        });
        aoa.push([]);
      });

      var ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 34 }].concat(
        (t.noCol ? [{ wch: 6 }] : []),
        (t.cols || []).map(function (c) {
          if (MI.isTextColName(c)) return { wch: 28 };
          if (c.indexOf('率') >= 0) return { wch: 10 };
          return { wch: 15 };
        })
      );
      XLSX.utils.book_append_sheet(wb, ws, sheetName(t.id === 'IND' ? '主要指标' : t.name));
    });

    var fn = (unitName || unitId) + '_' + (meta ? meta.year + '_' + meta.period + '_' + meta.ver : '') + '.xlsx';
    XLSX.writeFile(wb, fn.replace(/[\\\/:]/g, '-'));
    return fn;
  };
})();
