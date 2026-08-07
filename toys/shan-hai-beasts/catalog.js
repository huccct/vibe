export const BEASTS = [
  {
    zh: ['岚角', '西北风穴', '其角先闻雷，雨未至而群鸟已归。'],
    en: ['Lan-horn', 'Northwestern Wind Caves', 'Its horn hears thunder first. Before rain arrives, every bird has gone home.'],
  },
  {
    zh: ['青翎', '云梦泽', '昼食水光，夜宿月影，鸣声能使旧路重现。'],
    en: ['Azure Plume', 'Yunmeng Marsh', 'It feeds on waterlight by day and sleeps in moon shadows. Its cry reveals forgotten paths.'],
  },
  {
    zh: ['纹狰', '赤石林', '见人不逐，只把影子叼回洞中。'],
    en: ['Patterned Prowler', 'Redstone Forest', 'It never chases travelers—only carries their shadows back to its den.'],
  },
  {
    zh: ['九绡', '丹丘', '每换一尾，便忘记一件旧事。'],
    en: ['Nine Veils', 'Cinnabar Hills', 'Whenever it sheds a tail, it forgets one thing from long ago.'],
  },
  {
    zh: ['玄甲螭', '北海浅渊', '负山而眠，醒时岸线向东三尺。'],
    en: ['Shell Wyrm', 'Northern Shallows', 'It sleeps beneath a mountain. When it wakes, the shore shifts three feet east.'],
  },
  {
    zh: ['羽麓', '昆仑南麓', '踏地无声，唯落羽处会生白草。'],
    en: ['Winged Hart', 'Southern Kunlun', 'Its steps make no sound. White grass grows wherever a feather falls.'],
  },
  {
    zh: ['回潮', '归墟外海', '逆潮而游，鳞间藏着未发生的风暴。'],
    en: ['Tidecoil', 'Outer Sea of Guixu', 'It swims against the tide, carrying unborn storms between its scales.'],
  },
  {
    zh: ['独峦', '无名山', '闭目便成山，睁眼时草木皆向它倾斜。'],
    en: ['One-Eyed Crag', 'The Nameless Mountain', 'With its eye shut it becomes a mountain. Open, every tree leans toward it.'],
  },
  {
    zh: ['虎鹤', '日落之野', '晨为鹤，暮为虎，正午不知自己是谁。'],
    en: ['Tiger Crane', 'Fields of Sunset', 'A crane at dawn and a tiger at dusk; at noon, it forgets what it is.'],
  },
]

export const nextIndex = (index) => (index + 1) % BEASTS.length
