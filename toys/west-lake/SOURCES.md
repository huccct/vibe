# 西湖南岸 / 雷峰塔实景重建

## 实际采用的依据

- [雷峰塔景区官方《新塔介绍》](http://jing.leifengta.com/introduction.aspx?c_kind=4&c_kind2=16&c_kind3=22&c_kind4=34)：总高 71.679 m，台基 9.7 m，塔身 45.809 m，塔刹 16.10 m；台基对径 60 m，副阶对径 35.25 m，塔身对径 28 m；五层八角结构，铜瓦、铜斗拱、风铃、外挑平座。
- [实景航空照片](https://commons.wikimedia.org/wiki/File:Leifeng_Pagoda_DJI_0593_(2).jpg)：用于屋面曲率、墙柱配色、逐层收分及回廊栏杆的外观校准。照片仅作研究参考，不打包进产品。
- [实景正面照片](https://commons.wikimedia.org/wiki/File:Hangzhou_Leifeng_Pagoda_20161006.jpg)：用于五层立面、塔刹比例、树冠遮挡关系核对。照片仅作研究参考，不打包进产品。
- [公开 Terrarium 高程瓦片](https://registry.opendata.aws/terrain-tiles/)：采用 z13 / 6829–6830 / 3373，解码为米制高程。瓦片由 Mapzen / Tilezen 公开发布；来源可包含 SRTM 等混合高程数据，垂直误差和植被影响未实测校正。模型水面统一采用高程 10 m 的局部参考面，塔址地面相对水面约 35.58 m。
- [OpenStreetMap 西湖水域关系 2308774](https://www.openstreetmap.org/relation/2308774)：湖岸和内岛水域边界。© OpenStreetMap contributors，ODbL 1.0。提取数据保存在 assets/geo/shore.json。坐标原点 30.233889 N, 120.145 E，局部米制换算。
- Three.js 官方 Water、Sky、OrbitControls 组件，版本 0.185.0，MIT；水法线来自 Three.js 官方示例。代码中保留上游版权标记。

## 精度边界

这是依据实景照片和公开地理数据制作的可编辑三维重建，不是摄影测量、LiDAR 或测绘成果。

1. 官方公布的三部分高度相加为 71.609 m，与其公布总高相差 0.07 m。模型以总高 71.679 m 为控制尺寸，差额并入塔顶连接部位；不能将每个内部标高理解为实测数值。
2. 台基和塔身直径按公开数据设置。屋顶外沿、层高分配、构件截面、屋瓦、斗拱和门窗细节按照片推定；不提供毫米级准确性保证。
3. 高程采用公开粗分辨率瓦片；16 m 网格只是重采样，并不代表 16 m 测绘精度。岸线附近用 OSM 水域压低水下网格，解决 DEM 混合像元产生的水上陆地。
4. 植被为原创树枝叶片模型的确定性散布，实际树种、树木位置、密度、岸边小建筑及地面铺装未逐一测量。没有把照片作为场景背景假冒 3D。
5. 微观材质采用原创高度场烘出的切线空间法线，叶片图集为程序生成。未将程序材质称为实物扫描贴图。
6. 仅重建雷峰塔外观与湖面视角相关的地形、植被；不包含塔内空间、完整西湖城市建筑或实时天气。

## 文件和复现

- `assets/leifeng-realistic.blend`：米制可编辑场景，包含塔、地形、树木、湖面和相机。
- `assets/leifeng-realistic.glb`：网页三维几何资产。网页以真实平面反射水面替换源场景的湖面材质，并把共享树木网格转成 GPU 实例。
- `prepare_terrain.py`：解码已保存的高程瓦片，生成地形网格输入和原创材质。
- `build_realistic.py`：在 Blender 中重建与导出。
- `test_scene.py`：验证尺寸、资产结构和岸线数据。

```sh
python3 toys/west-lake/prepare_terrain.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python toys/west-lake/build_realistic.py
python3 toys/west-lake/test_scene.py
npm run dev
```
