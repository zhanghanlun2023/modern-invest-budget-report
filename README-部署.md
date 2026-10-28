# 部署说明 · 现代投资合并预算报表系统（Streamlit 版）

## 一、这套东西是什么

原来的报表页面是纯静态网页（HTML + JS，无后端）。现在套了一层 Streamlit：

```
浏览器  ──►  Streamlit 页面（口径选择 + 提交进度）
                 └─► iframe 内嵌 /app/static/index.html  ← 原报表页面，原样保留
                 └─► /api/save、/api/load  ← 新增：多人共享的服务端存取
                          └─► data/submissions.db（SQLite）
```

**一行代码都没丢**：组织树、11 张表、汇总合并、多列录入、Excel 导入全部保留。

---

## 二、文件说明

| 文件 | 作用 |
|---|---|
| `asgi_app.py` | **启动入口**。`st.App` 包装 + `/api/*` 路由（健康检查、提交、读取、进度） |
| `streamlit_app.py` | Streamlit 界面：口径选择、嵌入报表页面、提交进度看板 |
| `data_store.py` | SQLite 存取层，按 `年度+任务+期间+版本+单位` 唯一 |
| `static/` | 报表页面部署包（`index.html` + `assets/` + `src/`） |
| `sync_static.py` | 改完 `src/*.js` 后跑一次，同步到 `static/` |
| `启动Streamlit.cmd` | 双击启动 |
| `data/submissions.db` | 自动创建，所有提交都存在这里 |

---

## 三、本机 / 局域网运行

```bash
# 方式一：双击
启动Streamlit.cmd

# 方式二：命令行
python -m streamlit run asgi_app.py --server.port 8501 --server.address 0.0.0.0
```

- 本机：http://127.0.0.1:8501/
- 局域网：http://172.18.4.100:8501/ （把 IP 换成你机器的）

需要 Python 3.10+ 和 `streamlit`：
```bash
pip install streamlit pandas
```

---

## 四、发到公网给人填写的三种方式

### 方式 A：内网穿透（最快，5 分钟）
不动服务器，直接把本机 8501 暴露到公网：

```bash
# 任选其一
cloudflared tunnel --url http://localhost:8501
ngrok http 8501
```

得到形如 `https://xxx.trycloudflare.com` 的地址，发给各单位即可。
**缺点**：你的电脑必须一直开着。

### 方式 B：云服务器（推荐，稳定）
一台 2 核 4G 的云主机（阿里云/腾讯云）即可：

```bash
# 1. 装环境
pip install streamlit pandas

# 2. 上传整个 modern-invest-report 目录

# 3. 起服务（后台常驻）
nohup python -m streamlit run asgi_app.py \
      --server.port 8501 --server.address 0.0.0.0 \
      --server.headless true > streamlit.log 2>&1 &

# 4. nginx 反代 + HTTPS（85 端口对外，8501 只监听内网）
```

nginx 关键配置（**必须**，否则 iframe 内嵌会被拦）：

```nginx
location / {
    proxy_pass http://127.0.0.1:8501;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 3600s;
    proxy_buffering off;
}
```

### 方式 C：Streamlit Community Cloud（免费托管）
把整个目录推到 GitHub，然后在 https://share.streamlit.io 里选 `asgi_app.py` 启动。

⚠️ **重要限制**：Community Cloud 的磁盘是临时的，**应用重启后 `data/submissions.db` 会丢**。
如果走这条路，必须把存储换成外部数据库（Supabase / Postgres / 云盘挂载），
改 `data_store.py` 里的 `DB_PATH` 与读写实现即可。生产用途建议用方式 B。

---

## 五、多人填报怎么用

1. 各单位打开链接
2. 侧边栏确认年度/任务/期间/版本
3. 在页面左侧组织树**选中自己的单位**
4. 录入（淡黄底纹的格子都能填，「差异/增长率」这类计算列自动算）
5. 点工具栏 **「提交到服务器」**，填一下提交人
6. 集团在下方「提交进度」看哪些单位交了；点「刷新进度」更新

提交是 **覆盖式**：同一个 `年度+任务+期间+版本+单位` 重复提交会覆盖上一条，
`data/submissions.db` 里只保留最新一版。

---

## 六、已知限制（部署前请知悉）

1. **没有登录鉴权**：任何人拿到链接都能选任意单位提交、覆盖别人数据。
   正式启用前建议加一层：
   - nginx Basic Auth（最简单）
   - 或 `streamlit-authenticator` 组件
2. **SQLite 单文件**：几十人同时提交没问题，几百人并发建议换 Postgres。
3. **iframe 与父页面口径同步**：父页面改了年度/期间，需要刷新页面才传给内嵌报表页
   （通过 URL 参数传递，未做实时联动）。
4. **`/api/*` 无 CORS 保护**：同源使用没问题，若要被其它站点调用需加 CORS 中间件。
5. **导出 Excel 仍未实现**（原静态版就缺），需要的话下一步补。

---

## 七、改代码之后

```bash
# 改完 src/*.js 或 index.html，必须同步到 static/ 才会生效
python sync_static.py
```

然后重启 Streamlit（或刷新浏览器）。
