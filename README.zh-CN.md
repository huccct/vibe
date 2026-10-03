# vibe / ideas

[English](README.md) · 简体中文

把灵光一现，做成可以玩的东西。这里收集我们的 vibe ideas：互动实验、小工具，以及一些纯粹好玩的尝试。

[打开合集](https://huccct.github.io/vibe/)

## 案例

<!-- ideas:start -->
| 案例 | 简介 | 制作模型 |
| --- | --- | --- |
| [啪叽。](toys/wall-slime/) | 小时候往墙上甩的那坨软胶。抓起来、甩出去，看它黏住、拉长，再慢慢掉下来。 | gpt-6-astra |
| [网页拆迁办](toys/demolition/) | 输入网址，把网页变成像素拆迁关卡。移动、飞行、射击、扔手雷，再倒放复原。 | gpt-6-astra |
| [水中套圈机](toys/water-rings/) | 双按钮掌上水机。按下左右水泵，让彩色小圈在海底背景前翻滚，轻轻倾斜机身，把圈套上柱子。 | gpt-6-astra |
| [候风地动仪](toys/fly-cube/) | 八龙衔珠，八蟾承接。触发八方震动，透视内部机构，让课本里的地动仪动起来。演示性复原。 | gpt-6-astra |
| [西湖 · 湖上望雷峰](toys/west-lake/) | 依据官方尺寸、实景照片与公开地形重建雷峰塔，环看重檐与湖面倒影。 | gpt-6-astra |
| [夜间情绪数据科](toys/worry-paper-mill/) | 把一件烦恼登记、解体、编码并压成只属于它的像素纸印。 | gpt-5.6-sol |
| [RIPPLE MIRROR](toys/armor-up/) | 挥动双手，让实时摄像头画面泛起水波与漩涡。 | gpt-5.6-sol |
| [拼豆图纸生成器](toys/bead-pattern/) | 上传图片，自动生成可修改、可打印的拼豆图纸和颜色用量清单。 | gpt-5.6-sol |
| [活字印刷桌](toys/movable-type/) | 木活字反排入框，亲手滚墨、拉杆、揭纸。墨少会缺，墨多会洇，每一张都有自己的脾气。 | gpt-5.6-sol |
| [拓竹 A1 打印桌](toys/a1-printer/) | 一台会认真工作的 Three.js A1 非官方习作。转动视角，看波纹花器逐层长出来。 | gpt-5.6-sol |
| [山海异兽图鉴](toys/shan-hai-beasts/) | 翻一页，遇见一只没有被古书记下的异兽。 | gpt-5.6-sol |
| [重力书法](toys/gravity-calligraphy/) | 写下的墨迹不肯待在纸上。松手后整笔坠落，重力和风说了算。 | gpt-5.6-sol |
| [chladni](toys/chladni/) | 驻波方程解出来的节线。一万两千颗沙子自己找到不振动的地方待着。 | gpt-5.6-sol（后续整理） |
| [flow field](toys/flow-field/) | 几千个粒子跟着噪声场漂，拖尾积成流线。鼠标能把它们推开。 | gpt-5.6-sol（后续整理） |
| [pixel sort](toys/pixel-sort/) | 把像素按亮度排成拉丝故障感。能拖自己的图进去，能下载。 | gpt-5.6-sol（后续整理） |
<!-- ideas:end -->

制作模型指参与创作的 AI 模型；没有可靠记录的案例标为「待补充」，不以编辑器或技术栈代替模型名称。

## 本地运行

```sh
pnpm dev
```

打开 http://localhost:4173。原生 ES modules，无需安装或构建。

## 添加想法

```sh
pnpm new my-idea
```

在 `toys/my-idea/` 实现案例，填写 `meta.json` 中的中英文标题、简介、标签，以及 `models` 数组（填写已确认的准确模型名称；未知留空）。保留返回合集的入口。

```sh
pnpm sync
```

自动更新首页索引与两份 README 案例表。欢迎通过 [Issues](https://github.com/huccct/vibe/issues) 分享新点子。

## 部署与授权

推送到 `main` 后由 GitHub Pages 自动发布。

代码采用 [MIT](LICENSE)。第三方模型和素材遵循各自授权，详见案例中的来源说明。
