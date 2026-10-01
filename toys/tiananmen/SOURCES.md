# 天安门景观模型来源

当前网页采用现成 FBX 模型转换的 GLB，替换了之前的程序化重建。

- 资源：[中式 天安门](https://www.aigei.com/item/zhong_shi_tia_5.html)，爱给网，ID A127140214，上传者超维资源站。
- 页面标注：免费，**请勿用于任何形式的商业用途**。免费不代表公共领域，也不代表可重新分发；尚未核实源资源再分发授权，不应直接发布下载包或转换后的模型。
- 原资源包含 MAX、FBX、贴图与 V-Ray 专用文件。网页只使用 FBX 中的几何与可恢复的贴图；未运行资源中的插件或脚本。部分 V-Ray 程序材质不能等价转换成 glTF。
- 本地转换恢复 diffuse/opacity 连接，去掉远处的大场景，对高密度植被、石狮进行减面，将贴图最长边限制为 1024 像素，按原材质合并部件。屋瓦改为金色标准材质；源模型左右标语重复，左侧由网页 Canvas 重绘修正。倍率 1.7 为浏览器场景尺度调整，未经测绘验证。
- 天空、水面、石材法线复用本项目 `toys/west-lake/` 的已有资源；国庆烟花和广场国旗为网页效果。

`assets/tiananmen-imported.glb` 为当前网页模型，`assets/imported-model-check.json` 记录转换结果。转换命令：

```sh
Blender --background --python toys/tiananmen/import_model.py -- /path/to/extracted/source
node toys/tiananmen/check.mjs
```

下载原包本次位于 `/private/tmp/tiananmen-aigei.zip`，解压目录为 `/private/tmp/tiananmen-aigei-source/`，临时文件不保证长期保留。当前 GLB 已保存到项目。

旧 `build_realistic.py`、`assets/tiananmen-realistic.blend` 与 GLB 保留作为此前版本，网页不再加载。旧版参考照片为 [20200110 Tiananmen-3.jpg](https://commons.wikimedia.org/wiki/File:20200110_Tiananmen-3.jpg)（Balon Greyjoy，CC0）及 [Tiananmenpic2.jpg](https://commons.wikimedia.org/wiki/File:Tiananmenpic2.jpg)（splitbrain，CC BY-SA 2.0）；当前导入模型没有使用这些照片贴图。
