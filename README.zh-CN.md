# vibe / ideas

[English](README.md) · **简体中文**

**认真做点不正经的。**

甩一坨小时候的软胶，拆掉一张网页，让写下的墨迹自由落体。vibe 是我们用 AI 一起做出来的点子游乐场：把好奇心、童年回忆和灵光一现，变成能亲手玩的网页。

**[进入游乐场 →](https://huccct.github.io/vibe/)** · [丢个新点子](https://github.com/huccct/vibe/issues)

## 今天玩什么？

不知道从哪开始，就去首页抽一张「今日试玩票」。也可以挑个心情：

- **想解压**：[啪叽。](https://huccct.github.io/vibe/toys/wall-slime/)甩一甩软胶，[网页拆迁办](https://huccct.github.io/vibe/toys/demolition/)砸完还能倒放复原。
- **想回到小时候**：[水中套圈机](https://huccct.github.io/vibe/toys/water-rings/)按到手酸，或者去[活字印刷桌](https://huccct.github.io/vibe/toys/movable-type/)亲手印一张字。
- **想做点自己的东西**：[重力书法](https://huccct.github.io/vibe/toys/gravity-calligraphy/)写一笔会掉下来的墨，[拼豆图纸生成器](https://huccct.github.io/vibe/toys/bead-pattern/)把图片变成手工图纸。

不用安装，打开浏览器就能探索。摄像头作品需要授权；部分效果依赖 WebGL 或外部资源。

## 点子陈列室

下面收录首页中的作品，按加入时间排列。点击名称查看源码，试玩从[在线合集](https://huccct.github.io/vibe/)进入。

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

## 关于制作模型

每个案例后标注已核实的 AI 模型，保留制作记录中的原始型号。它表示已确认的参与者，不保证涵盖全部历史贡献。

「后续整理」仅确认该模型参与过页面、主题或资料整理，不代表它创作了最初的作品。代码模型也不等于配图生成模型；查不到的型号不猜。取舍理由与核对依据见 [整理记录](CURATION.md)。

## 在本地玩

需要 Node.js 22 或更新版本：

```sh
node scripts/serve.mjs 4173
```

打开 [localhost:4173](http://localhost:4173/)。也可以用 `pnpm dev`；没有依赖安装或构建步骤，浏览器直接运行 ES modules。

## 把你的点子放进来

```sh
node scripts/new-toy.mjs my-idea
```

在 `toys/my-idea/` 里实现玩法，保留返回合集的入口。更新 `meta.json` 中的中英文标题、简介、标签、配色和日期；在 `models` 数组填写已确认的模型名称，未知则留空。

```sh
node scripts/sync.mjs
node scripts/check-gallery.mjs
```

同步命令会更新首页索引和中英文 README 的案例表，不要手改表格。设置 `hidden: true` 可把未准备好的作品移出合集，源码仍保留。

有点子但还没想好怎么做，也欢迎开 [Issue](https://github.com/huccct/vibe/issues)：说说你想玩的是什么，附上灵感来源就好。

## 发布与授权

推送到 `main` 后，GitHub Actions 检查索引与同步逻辑，再发布到 GitHub Pages。

代码采用 [MIT](LICENSE)。第三方模型、图片等素材遵循各自授权，使用前请查看对应案例的来源说明。
