# Design Language Brief — 夜间情绪数据科

> One world. Every artifact is drawn from it.
> Deliverable: website
> Audience & feeling: 想暂时安放一件烦恼的人，应感到自己的情绪被认真受理、转换并留下独有记录。

## 1. Core metaphor
**这是一间把烦恼编码、加工成个人像素纸印的九十年代夜班机关——所以它像一间沉静、可信、略带荒诞的市政数据科。**

## 2. Visual universe

| World element | Becomes |
|---|---|
| 灰绿铁柜与工位铭牌 | 页面框架、区块边界与图标 |
| 米黄受理表格 | 输入面板与结果纸张 |
| 红色公章 | 主操作、完成状态与强调色 |
| 号码牌与档案编号 | 工序进度与记录编码 |
| 打孔卡 | 输入的可视化、唯一像素印记 |
| 地下传送轨与卡槽 | 四道工序的布局和转场 |
| 针式打印机与出纸口 | 结果生成与下载入口 |
| 老式指示灯 | 当前工位、成功与错误反馈 |
| 公文黑体、等宽编号 | 清晰中文正文与机器标签 |

## 3. Design DNA
- **Shapes (2–3):** 直角公文框、方形孔位矩阵、水平卡槽与轨道。
- **Colors (3–5, named + hex):**
  - `#465A50` — 档案绿
  - `#D8C99B` — 旧纸黄
  - `#A33B32` — 公章红
  - `#D88A3D` — 灯泡橙
  - `#202523` — 打字墨黑
- **Motion (one philosophy):** 沉稳而机械；状态切换 180–320ms，按压与出纸使用短促 ease-out，不做弹跳或装饰性漂浮。
- **Texture (one language):** 低分辨率像素边缘、复印噪点、纸纤维和轻微使用磨损；中文正文保持清晰。

## 4. Mascot system
- **Included?** no
- **Who/what:** 无具象角色；机器本身通过灯光、噪声、停顿与盖章表达性格。
- **Personality (3 adjectives):** 克制、可靠、夜班感。
- **Where it appears:** 当前工位亮灯、机械音、压机反馈、打印回执。

## 5. Signature constraint
**在这个世界里，所有操作都必须发生在真实机关物件上；我们永不使用脱离场景的悬浮控件。**

## 6. Cross-domain inspiration
- Domains explored: 二十世纪打孔数据处理、地下邮政分拣、历史任务控制室。
- Transferable “steals”:
  - 用 80 列打孔卡的规则网格表达“情绪被编码”。
  - 用卡槽与传送轨代替普通进度条，让材料在科室内部真实流转。
  - 只点亮当前工位，其他控制台休眠，减少无意义视觉噪声。
  - 用文件夹、铅笔、咖啡杯印等少量使用痕迹增加可信度。
- Reference links / boards:
  - https://www.ibm.com/history/punched-card
  - https://www.computerhistory.org/revolution/punched-cards/2/2
  - https://www.postalmuseum.org/collections/mail-rail/
  - https://spacecenter.org/restoring-historic-mission-control/

## 7. Chosen direction
- **Primary world:** 夜间情绪数据科——烦恼进入九十年代夜班数据机关，被四个实体工位制成唯一纸印。
- **Backups:** 内耗清算所；无名烦恼认证局。

## 8. Originality Test
- [x] Q1 — Explainable in one sentence? **YES**
- [x] Q2 — Every element from the same metaphor? **YES**
- [x] Q3 — Identifiable with the logo removed? **YES**
- [x] Q4 — A child would draw the same language? **YES**
- [x] Q5 — Looks like a world, not a UI? **YES**

## 9. Production notes
- Medium: 原生 HTML/CSS/Canvas 网站；沿用项目零依赖结构。
- Production skill: `anti-ui-slop` 的 major redesign playbook。
- 交互顺序：在受理单输入 → 追扫描线打孔 → 绕槽完成三次旋流连击 → 在甜区释放压力键 → 向右拖出回执。
- 每个控件必须是机关物件；键盘操作与 `prefers-reduced-motion` 必须保留。
- 输入只在浏览器中处理；同一文本稳定生成同一对称孔位纸印与记录编号。
