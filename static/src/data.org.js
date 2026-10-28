/* ═══════════════════════════════════════════════════════════════
   组织单位树（正式口径 · 第三次修订）

   层级：合计 → 大合并调整项 → 板块小计 → 各分子公司
     ·「调整项」节点已删除
     · 大合并调整项 位于「合计」与「板块」之间（集团层唯一抵销录入位）
     · 总部 放在高速公路板块下，与各分子公司平级
     · 长永长潭 为一个单位（附件1 印证）；潭衡西 即附件1 的「3.湘衡」

   合计
   ├─ 大合并调整项                    ◆可填数（集团合并层抵销）
   ├─ 高速公路板块小计
   │  ├─ 总部                        ●分公司
   │  ├─ 长沙分公司                  ◇汇总分组
   │  │  ├─ 长永长潭                 ●分公司
   │  │  ├─ 衡耒                     ●分公司
   │  │  └─ 长韶娄                   ●分公司
   │  ├─ 湘衡                        ★子公司 65%
   │  └─ 怀化分公司                  ◇汇总分组
   │     ├─ 溆怀                     ●分公司
   │     ├─ 溆怀项目部               ●分公司
   │     └─ 怀芷                     ●分公司
   ├─ 金融板块小计
   │  ├─ 大有期货   ★100%   ├─ 巴陵农商行 ★51%   ├─ 参股农商行 ☆20%
   │  ├─ 弘远       ★100%   └─ 数智（财富）★100%
   └─ 实业投资板块小计
      ├─ 环境 ★100%  ├─ 资产 ★100%  ├─ 凯莱 ★70%  ├─ 新能源 ★100%
      └─ 数智（不含财富）             ◇汇总分组
         ├─ 本部    ★52%
         ├─ 材贸公司 ★52%
         └─ 物流公司 ★52%

   合计 = 大合并调整项 + 三个板块小计（等价于根节点下全部末级节点之和）
   ═══════════════════════════════════════════════════════════════ */
window.MI = window.MI || {};

MI.org = {
  id: 'GROUP', name: '现代投资股份有限公司（合计）', short: '合计',
  type: 'group', nature: 'total',
  children: [

    /* ═══ 集团层抵销（位于合计与板块之间）═══ */
    { id: 'BIGADJ', name: '大合并调整项', short: '大合并调整项', type: 'adjust', nature: 'adjust',
      biz: '集团合并层抵销录入位', prof: 'adj' },

    /* ═══ 高速公路板块 ═══ */
    { id: 'SEG_HS', name: '高速公路板块小计', short: '高速公路板块小计',
      type: 'segment', children: [

      { id: 'HQ', name: '总部', short: '总部', type: 'unit', nature: 'branch',
        biz: '公司总部／高速公路运营', prof: 'hw', scale: 46, turn: 0.11, debt: 0.62, st: 'audited' },

      { id: 'CS', name: '长沙分公司', short: '长沙分公司', type: 'branch', children: [
        { id: 'CYCT', name: '长永长潭', short: '长永长潭', type: 'unit', nature: 'branch',
          biz: '高速公路运营', prof: 'hw', scale: 58, turn: 0.11, debt: 0.62, st: 'audited' },
        { id: 'HL', name: '衡耒', short: '衡耒', type: 'unit', nature: 'branch',
          biz: '高速公路运营', prof: 'hw', scale: 40, turn: 0.10, debt: 0.64, st: 'audited' },
        { id: 'CSL', name: '长韶娄', short: '长韶娄', type: 'unit', nature: 'branch',
          biz: '高速公路运营', prof: 'hw', scale: 72, turn: 0.09, debt: 0.68, st: 'audited' }
      ]},

      { id: 'XH', name: '湘衡', short: '湘衡', type: 'unit', nature: 'sub',
        ratio: 65, biz: '高速公路运营（子公司）', prof: 'hw', scale: 44, turn: 0.10, debt: 0.66, st: 'filled' },

      { id: 'HH', name: '怀化分公司', short: '怀化分公司', type: 'branch', children: [
        { id: 'XUHUAI', name: '溆怀', short: '溆怀', type: 'unit', nature: 'branch',
          biz: '高速公路运营', prof: 'hw', scale: 58, turn: 0.10, debt: 0.67, st: 'audited' },
        { id: 'XHX', name: '溆怀项目部', short: '溆怀项目部', type: 'unit', nature: 'branch',
          biz: '在建工程管理', prof: 'hw', scale: 6, turn: 0.02, debt: 0.55, st: 'filled' },
        { id: 'HZ', name: '怀芷', short: '怀芷', type: 'unit', nature: 'branch',
          biz: '高速公路运营', prof: 'hw', scale: 48, turn: 0.08, debt: 0.69, st: 'filled' }
      ]}
    ]},

    /* ═══ 金融板块 ═══ */
    { id: 'SEG_JR', name: '金融板块小计', short: '金融板块小计',
      type: 'segment', children: [
      { id: 'DY', name: '大有期货', short: '大有期货', type: 'unit', nature: 'sub',
        ratio: 100, biz: '期货经纪', prof: 'jr', scale: 32, turn: 0.28, debt: 0.62, st: 'audited' },
      { id: 'BL', name: '巴陵农商行', short: '巴陵农商行', type: 'unit', nature: 'sub',
        ratio: 51, biz: '银行业', prof: 'jr', scale: 38, turn: 0.22, debt: 0.88, st: 'audited' },
      { id: 'CG', name: '参股农商行', short: '参股农商行', type: 'unit', nature: 'assoc',
        ratio: 20, biz: '参股（权益法）', prof: 'jr', scale: 12, turn: 0.20, debt: 0.90, st: 'filled' },
      { id: 'HY', name: '弘远', short: '弘远', type: 'unit', nature: 'sub',
        ratio: 100, biz: '私募股权投资基金管理', prof: 'jr', scale: 8.5, turn: 0.15, debt: 0.40, st: 'audited' },
      { id: 'SZ_CF', name: '数智（财富）', short: '数智（财富）', type: 'unit', nature: 'sub',
        ratio: 100, biz: '信息技术服务', prof: 'my', scale: 14, turn: 0.90, debt: 0.58, st: 'filled' }
    ]},

    /* ═══ 实业投资板块 ═══ */
    { id: 'SEG_SY', name: '实业投资板块小计', short: '实业投资板块小计',
      type: 'segment', children: [
      { id: 'HK', name: '环境', short: '环境', type: 'unit', nature: 'sub',
        ratio: 100, biz: '环保项目投资与运营', prof: 'hb', scale: 26, turn: 0.30, debt: 0.60, st: 'audited' },
      { id: 'ZC', name: '资产', short: '资产', type: 'unit', nature: 'sub',
        ratio: 100, biz: '资产管理', prof: 'jr', scale: 22, turn: 0.10, debt: 0.45, st: 'audited' },
      { id: 'KL', name: '凯莱', short: '凯莱', type: 'unit', nature: 'sub',
        ratio: 70, biz: '酒店服务业', prof: 'fc', scale: 6, turn: 0.55, debt: 0.58, st: 'filled' },
      { id: 'XNY', name: '新能源', short: '新能源', type: 'unit', nature: 'sub',
        ratio: 100, biz: '太阳能发电技术服务', prof: 'hb', scale: 11, turn: 0.18, debt: 0.55, st: 'audited' },
      { id: 'SZ', name: '数智（不含财富）', short: '数智（不含财富）',
        type: 'branch', children: [
        { id: 'SZ_BB', name: '本部', short: '本部', type: 'unit', nature: 'sub',
          ratio: 52, biz: '信息技术服务', prof: 'my', scale: 6.0, turn: 0.85, debt: 0.56, st: 'filled' },
        { id: 'SZ_CM', name: '材贸公司', short: '材贸公司', type: 'unit', nature: 'sub',
          ratio: 52, biz: '建筑材料贸易', prof: 'my', scale: 5.4, turn: 1.50, debt: 0.72, st: 'audited' },
        { id: 'SZ_WL', name: '物流公司', short: '物流公司', type: 'unit', nature: 'sub',
          ratio: 52, biz: '道路货物运输', prof: 'my', scale: 6.2, turn: 1.10, debt: 0.66, st: 'audited' }
      ]}
    ]}
  ]
};

/* ── 树工具函数 ───────────────────────────────────────────── */

/** 参与汇总/填报的末级节点：填报单位 + 调整项 */
MI.isReportable = function (n) {
  return !!n && (n.type === 'unit' || n.type === 'adjust');
};

MI.walk = function (node, fn, depth, parent) {
  depth = depth === undefined ? 0 : depth;
  parent = parent || null;
  fn(node, depth, parent);
  (node.children || []).forEach(function (c) { MI.walk(c, fn, depth + 1, node); });
};

MI.buildIndex = function () {
  MI.index = {}; MI.parentOf = {}; MI.order = [];
  MI.walk(MI.org, function (n, d, p) {
    MI.index[n.id] = n;
    MI.parentOf[n.id] = p ? p.id : null;
    n.depth = d;
    MI.order.push(n.id);
  });
  MI.counts = { total: 0, unit: 0, branchUnit: 0, subUnit: 0, assocUnit: 0,
                adjust: 0, segment: 0, branch: 0, group: 0 };
  MI.order.forEach(function (id) {
    var n = MI.index[id];
    MI.counts.total++;
    if (n.type === 'unit') {
      MI.counts.unit++;
      if (n.nature === 'branch') MI.counts.branchUnit++;
      else if (n.nature === 'sub') MI.counts.subUnit++;
      else if (n.nature === 'assoc') MI.counts.assocUnit++;
    } else if (n.type === 'adjust') MI.counts.adjust++;
    else if (n.type === 'segment') MI.counts.segment++;
    else if (n.type === 'branch') MI.counts.branch++;
    else if (n.type === 'group') MI.counts.group++;
  });
  return MI.index;
};
MI.buildIndex();

MI.allUnits = function () {
  return MI.order.map(function (id) { return MI.index[id]; })
                 .filter(function (n) { return MI.isReportable(n); });
};

MI.descendants = function (id) {
  var out = [];
  (function rec(n) {
    (n.children || []).forEach(function (c) {
      if (MI.isReportable(c)) out.push(c);
      rec(c);
    });
  })(MI.index[id]);
  return out;
};

MI.unitsUnder = function (id) {
  var n = MI.index[id];
  if (!n) return [];
  if (MI.isReportable(n)) return [n];
  return MI.descendants(id);
};

MI.ancestors = function (id) {
  var out = [], p = MI.parentOf[id];
  while (p) { out.push(MI.index[p]); p = MI.parentOf[p]; }
  return out;
};

MI.natureLabel = function (n) {
  if (!n) return '';
  if (n.type === 'group') return '合计';
  if (n.type === 'segment') return '板块小计';
  if (n.type === 'adjust') return '集团合并抵销';
  if (n.type === 'branch') return '汇总分组';
  if (n.nature === 'sub') return '子公司' + (n.ratio ? ' ' + n.ratio + '%' : '');
  if (n.nature === 'assoc') return '参股' + (n.ratio ? ' ' + n.ratio + '%' : '');
  return '分公司';
};
