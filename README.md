# dsh-theme-promax

DSH Desktop 的界面皮肤（skin）：把首屏、侧边栏、输入卡片、弹窗（重命名、删除确认、添加插件、索引源）和下拉菜单换成一套更克制的视觉。

它不是独立应用，而是一个 **Cordis bundle**——通过一层配置 patch 往客户端插件表里插一行，然后由 DSH 的加载器在运行时挂载。皮肤只改写 token、样式和少数插槽内容，不改上游包的任何源码，禁用后即可完全回退。

## 特性

- **配色与几何**：一次性覆盖别名 token（背景、文字、边框、圆角、阴影），亮/暗两套同时写入，跟随系统主题切换。
- **侧边栏**：行高、图标与分隔线按参考图重排；展开的会话搜索框收进 30px 行带内（上游是 32px，比行带高 2px，被行带的 `overflow: hidden` 削掉上下边框）。
- **输入卡片**：只做样式重绘，真正的 `InputBar` 仍挂载着——输入法、`@`、`/`、拖拽上传和排队逻辑全部不受影响。
- **重命名弹窗**：工作区和会话两个重命名对话框换成 420×185 卡片，含标题下的一行提示文案。
- **删除确认**：工作区的删除确认沿用同一张卡片（420 宽、16 圆角、20 内边距），说明文字降为 14px 灰色，确认按钮换成红底白字。
- **插件弹窗**：「添加插件」与「索引源」并入同一张卡片——420 宽、16 圆角、20 内边距、36 高白底输入框、32 高按钮，说明行降为 14px 灰色。
- **窗口顶边**：宿主只在若干装饰行上声明拖拽区，行与行之间留着缝（插件页头部两侧各 48px），双击想放大窗口时这些位置会被当成正文选中文字。皮肤补一条 48px 高的透明拖拽带铺在中间列顶部，双击也能放大；带子不接收鼠标事件，下面的按钮照常可点。
- **下拉菜单**：所有 `role="menu"` 的弹层（会话/工作区右键菜单、侧栏“更多”、视图选项、账号、模型选择器、添加插件方式）统一成 16px 圆角、28px 行高、16px 图标。
- **分段标签**：插件页的「已安装 / 发现」、预设引导弹窗的「模式说明 / 如何使用」把选中胶囊从与轨道同色的灰改成白面 + 1px 投影，选中状态重新可见。
- **图标覆盖**：以替换 sprite 中 `<symbol>` 的方式换图，不 fork 图标组件，未覆盖的字形保持原样。
- **文案双语**：皮肤自带 `theme.promax` 命名空间（zh / en），其他语言回落英文。

## 环境要求

- DSH Desktop，且**至少启动过一次**（profile 需要已初始化）。
- `pnpm` 在 PATH 上（`dsh plugin` 内部用 pnpm 管理 profile 依赖）。

## 安装（从 GitHub）

这个包没有发布到 npm（`package.json` 里是 `private: true`），只通过 GitHub 分发。

先**完全退出** DSH Desktop（profile 目录会被文件锁占用），然后：

```sh
dsh plugin --profile desktop add github:imlizi/dsh-theme-promax
```

装完重新打开 App 即可生效。仓库默认分支就是可用的皮肤分支，无需额外指定。

需要锁定到某个分支、tag 或提交时，在后面加 `#`：

```sh
# 分支
dsh plugin --profile desktop add github:imlizi/dsh-theme-promax#dsh-theme-promax

# tag 或 commit
dsh plugin --profile desktop add github:imlizi/dsh-theme-promax#<tag-or-commit>
```

也可以直接用 git 地址：

```sh
dsh plugin --profile desktop add git+https://github.com/imlizi/dsh-theme-promax.git
```

> `lib/`（构建产物）已随仓库提交，所以从 GitHub 安装不需要现场编译。若 pnpm 提示构建脚本被拦截，把它打印的 key 加进 `~/.dsh/profiles/desktop/pnpm-workspace.yaml` 的 `allowBuilds` 后重跑。

## 卸载

```sh
dsh plugin --profile desktop remove dsh-theme-promax
```

重新打开 App，界面回到默认皮肤。

## 从源码试用（不动 profile）

在 DSH 源码检出目录里直接挂载 patch，效果与安装一致但不写入 profile：

```sh
pnpm dsh web --patch /path/to/Promax/cordis.patch.yml
```

## 本地构建

修改 `src/` 后重新生成 `lib/`：

```sh
pnpm build      # 等价于 tsdown
pnpm watch      # 监听重建
```

仓库不带 `devDependencies`，`tsdown` 用现成的即可（`npx tsdown`，或 DSH 检出里的 `node_modules/.bin/tsdown`）。

产物两份：

| 文件 | 形态 | 说明 |
|---|---|---|
| `lib/index.js` | ESM / node | Host 半边，加载器需要能 import 它；本身不注册任何东西 |
| `lib/client.js` | CJS / browser | `window.__ModuleLoader__.load({ id, factory })` 闭包工厂 |

`lib/client.js` 里只有平台模块保持 external（`react`、`@deepseek-ai/cordis`、`ui-slots`、`ui-primitives`、`ui-dockkit`、`client-store`、`zod`、`@tanstack/react-virtual`），其余全部内联；`*.css` 也内联成字符串，由插件自己注入一个 `<style>` 标签，随 fiber 一起移除。

## 项目结构

```
src/
  index.ts              Host 半边（空实现，只为让加载器能 import）
  client/
    index.ts            挂载入口：样式表、token、字典、图标
    theme.ts            别名 token 表（亮/暗）
    locales.ts          theme.promax 字典
    icons.ts            sprite 图标覆盖表
    sprite-data.ts      图标路径数据
    styles/base.css     皮肤样式表
cordis.patch.yml        插入 theme-promax 插件行的配置层
scripts/                量取参考图、截图、像素比对的辅助脚本
```

## 各界面替换方式

| 界面 | 机制 |
|---|---|
| 配色、圆角、阴影 | `ctx.theme.overrideTokens('dsh-theme-promax', …)`，只改别名 token |
| 首屏 hero | 只做布局：`[data-content-phase='hero']` 作用域下的 CSS 把 hero 块上提、输入卡贴底；标题与鱼标由宿主渲染 |
| 输入卡片 | CSS 变量 + `[data-composer-card]` |
| 重命名弹窗 | `[role='dialog']:has(input[class*='_renameInput'])` 作用域下的 CSS |
| 删除确认 | 同一组规则，选择器扩成 `:is(:has(input…), :has(button[class*='_deleteAction']))`；只有删除弹窗专属的部分（说明行、红底按钮）单列 |
| 添加插件 / 索引源弹窗 | 同一组共享规则，选择器再扩两个钩子：`[class*='_installDialog']`（卡片自带类）与 `:has([class*='_sourceForm'])`；字段、说明行、提示块、安装源选择器单列 |
| 下拉菜单 | `[role='menu']` 作用域下的 CSS：卡片填充/圆角/阴影走变量，行、图标、分隔线走元素选择器 |
| 分段标签 | `[role='tablist'] > [class*='_indicator']`：只改选中胶囊的面色，不动轨道 token |
| 窗口拖拽区 | 两件事：① `[data-window-drag]` 作用域下加 `user-select: none`（输入框/可编辑区 `user-select: text` 放行），拖拽没命中时不再变成选中文字；② 客户端插一条 `<div class="skin-drag-band" data-window-drag>` 到中间列的首个子节点，48px 高、`pointer-events: none`，把宿主的行没有铺满的顶边补齐（插件页 pageHead 只有 925/1021，两侧留白不属于任何行）。带 `data-window-drag` 是为了让宿主那条唯一的 drag 规则和它的重采逻辑同时认这条带；首子节点是为了「后收集的盒子决定归属」——带下面的控件（会话头右上开关、插件工具栏）仍先被命中 |
| 侧边栏外壳 | 组合方式：禁用 `ui-sidebar` 行，由本 bundle 注册 `sidebar`（规划中） |

## 已知差异

- 首屏不再注入任何内容：宿主已移除 `conversation.hero.content` 座位（现只有 `hero.workspace` / `hero.brand.mark` / `hero.agentPreset` / `hero.options`），皮肤只重排 hero 阶段的布局，标题与鱼标仍由宿主绘制。
- 输入卡片是重绘而非重建：`InputBar.module.css` 里仍写死的数值会有几像素偏差，需要上游参数化才能对齐。
- 参考图只画了重命名弹窗；删除确认是照同一张卡片推出来的（420 宽、16 圆角、20 内边距、20px 标题、14px 灰色说明、32 高按钮），高度随内容为 156，没有参考图可对。
- 添加插件卡从上游的 560 宽收到 420（与其余弹窗同宽），只有安装**过程**里的向导屏保留 560：它滚动的是 pnpm 原始输出，行不折行，收窄会把日志挤碎。向导与表单共用 `_installDialog` 类，靠 `:has([class*='_wizard'])` 单独放行。
- 「索引源」弹窗（`ui-plugin-market` 的 `SourcesDialog`）在裸 harness 里挂不出来——市场 bundle 未装载，添加方式的插槽里也没有它的入口。这段样式是照上游 `DiscoverSection.module.css` 的结构写的，未能截图实测。
- 顶边的拖拽带是皮肤自己补的（`.skin-drag-band`，48px）：宿主的 `data-window-drag` 行没铺满中间列（插件页 pageHead 925/1021）。不能靠扩大 pageHead 解决——它的 `--plugin-part-x` 是相对头部 border box 量一次就缓存、只有 `body` resize 才重测，改盒模型会让粘顶时部件整体偏 48px；也不能靠 `body` 级的一整条——`body > :not(#root)` 的 no-drag 会把门面层全归零。这条带是 `pointer-events: none`，只贡献原生几何；设置页仍是宿主的居中弹窗，浮在列上方，没有接这条带；右侧栏也没接（它顶部是 dockkit 的 28px 标签条，再往下就是面板正文，盖住会吃掉正文的点击）。
- 删除按钮在亮色下是红底白字（`#EC1313`，与菜单里「删除工作区」的红一致），暗色下反成浅红底深字（`#F25A5A` / `#1A1A1A`），跟主按钮在暗色下的翻转规则保持一致；白字压在 `#F25A5A` 上对比度只有 2.9:1，所以没有采用。
- 重命名提示行是弹窗主体上的 `::before` 伪元素，属于纯绘制文案：不可选中，读屏软件也读不到。上游补一个 `description` prop 才能干净替换。
- 菜单行高是全局覆盖（`[role='menu'] [role='menuitem']`），上游的 `dense` 变体因此失去更紧的间距；`compact` 变体目前没有调用方，若将来启用会被一并放大，届时需要给这两类加 `:not()` 排除。
- 参考图的行内图标是 16px 满绘，宿主 sprite 的字形留白更多，实际墨迹约 12.5px，看起来比参考图细一档；改图标尺寸会挤动文字列，因此保持 16px 盒。
- 分段标签的选中胶囊原本靠 `--dsw-alias-bg-layer-3`，而皮肤把这个 token 和轨道用的 `--dsw-alias-bg-module-platform` 都映射成 `#F3F3F3`（暗色同为 `#2A2A2A`），选中态只剩 0.5px 描边。胶囊在 CSS 里单独改回白面（暗色 `#3C3C3C`），没有动这两个 token：`bg-layer-3` 同时是代码块底色和标签文字色，`bg-module-platform` 是外观/字号预览的底色。
- 皮肤的 `:root` 里曾写死 `--dsw-radius-sm/md: 16px`，实际从未生效：ui-theme 把整套别名 token 以行内样式写在 `<body>` 上，比 `:root` 更近，所以组件读到的仍是 `theme.ts` 里的 8/12。这两行已删除，弹窗与菜单改用字面 16px，其余控件保持 8/12。
- 验证脚本（`scripts/measure.mjs`、`scripts/shot-rename.mjs` 等）依赖 `reference/` 下的参考图，该目录未随仓库发布，需要自备。

## 验证脚本

```sh
node scripts/measure.mjs                                  # 从参考图重新量取 token 与盒模型
node scripts/shot-rename.mjs --log /tmp/dsh-web.log       # 截取两个重命名弹窗 + 删除确认（--dark 取暗色）
node scripts/compare-rename.mjs reference/rename.png .artifacts/dialog-session.png
node scripts/shot-menu.mjs --log /tmp/dsh-web.log         # 截取四类下拉菜单并回读几何（--dark 取暗色）
node scripts/measure-menu.mjs .artifacts/menu-session.png # 从 PNG 反推卡片、行距、图标列
node scripts/shot-tabs.mjs --log /tmp/dsh-web.log         # 截取分段标签的轨道与胶囊（--dark 取暗色）
node scripts/shot-plugin-dialogs.mjs --log /tmp/dsh-web.log  # 视图选项菜单 + 添加插件弹窗 + 添加方式菜单（--dark 取暗色）
node scripts/shot-search.mjs --log /tmp/dsh-web.log       # 展开的会话搜索框：截图 + 回读是否落在 30px 行带内（--dark 取暗色）
node scripts/shot-dragband.mjs --log /tmp/dsh-web.log     # 顶边拖拽带：核对它在中间列铺满、首子节点、声明 drag、不吃点击，带里的右上开关仍能点；设置弹窗里不带这条带
node scripts/prune-blank-sessions.mjs [--apply]           # 把「从未发过消息」的会话移出会话库（默认只列出，--apply 才动手）
```

捕获脚本每跑一次都会用全新的浏览器 profile 打开界面，宿主为此启动的会话会以「未命名」留在侧边栏里（一上午的样式调试能攒出几十条）。所以每个脚本都用 `scripts/lib/session-guard.mjs` 包一层：开跑前记下会话清单，结束时把本次新增、且一条消息都没有的会话移进 `~/.dsh/sessions-trash/<时间戳>/verify/`，并从工作区的会话列表里摘掉对应 id。历史遗留的同类空会话用 `prune-blank-sessions.mjs` 一次性收拾——它同样只移动、不删除，`workspace.json` 会先备份成 `.bak-<时间戳>`；跑之前请关掉 DSH（它会持着工作区列表，退出时把旧列表写回来）。