const config = {
	//网页元数据
	metaData: {
		title: 'okuki 的主页',
		description: 'Link · Love · Peace',
		keywords: 'okuki,个人主页,个人网站',
		icon: '/favicon.ico'   //网页图标，支持外链
	},

	avatar: "/img/avatar.jpg", // 头像
	welcometitle: "Hi, I'm okuki", // 标题

	// 颜色配置（转盘两色取自壁纸的粉云与夜空）
	color: {
		themecolor: "#FFFFFF", // 主题颜色，推荐趋于亮白可带有轻微色调
		welcometitlecolor: "#FFFFFF", // 标题颜色
		turntablecolor1: "#FF8FA3",  // 转盘渐变色一
		turntablecolor2: "#7FB2FF"   // 转盘渐变色二
	},

	brightness: 70, // 背景亮度 --%（动态壁纸偏亮，压暗一点文字更清楚）
	blur: 6, // 毛玻璃模糊效果

	// 我的标签
	tags: ['Link', 'Love', 'Peace'],

	// 默认背景壁纸
	//  PC 用动态壁纸（阿尔托莉雅，4K 原片已压到 1080p/3.9MB）；移动端仍用静态壁纸省流量
	background: {
		"pc": {
			"type": "video",   //"pic":静态壁纸;"video":动态壁纸
			"datainfo": {
				"title": "阿尔托莉雅-潘德拉贡",
				"preview": "/img/wallpaper/dynamic/阿尔托莉雅/阿尔托莉雅-pre.mp4",
				"url": "/img/wallpaper/dynamic/阿尔托莉雅/阿尔托莉雅.mp4"
			}
		},
		"mobile": {
			"type": "pic",
			"datainfo": {
				"title": "星空下的黑猫",
				"preview": "/img/wallpaper/okuki/image-pre.jpg",
				"url": "/img/wallpaper/okuki/image.jpg"
			}
		}
	},

	//极坐标图数据（吃饭 100%，拆成五顿看起来更完整）
	polarChart: {
		skills: ['早饭', '午饭', '晚饭', '夜宵', '零食'],
		skillPoints: [100, 100, 100, 100, 100],
	},

	//社交按钮（微信没有网页主页，所以点它是"复制微信号"）
	socialPlatformIcons: [
		{ icon: "mdi-github", link: "https://github.com/okuki777", title: "GitHub：okuki777" },
		{ icon: "mdi-television-classic", link: "https://www.bilibili.com/", title: "哔哩哔哩" },
		{ icon: "mdi-wechat", copy: "Atyocenetye", title: "微信：Atyocenetye（点击复制）" },
		{ icon: "mdi-qqchat", link: "https://user.qzone.qq.com/3486093976", title: "QQ：3486093976" },
		{ icon: "mdi-steam", link: "https://store.steampowered.com/", title: "Steam" }
	],

	//打字机（多条会自动循环：打完 → 删掉 → 打下一句）
	typeWriterStrings: [
		"你一定是某人的太阳",
		"智慧，勇气，力量",
		"music so good, even devil may cry"
	],

	//音乐播放配置，采用MetingJS Api(https://github.com/metowolf/MetingJS)
	musicPlayer: {
		server: 'netease',  //服务提供商 --网易云音乐
		type: 'playlist',   //歌单类型
		id: '18575726923',    //歌单id ---> music.163.com/#/playlist?id=18575726923（40 首）
		randomFirstPlay: true,  //进入页面是否随机播放歌单中的某一首
		startIndex: 0,          //不随机时，进入页面播放第几首（索引从0开始）
	},

	//壁纸数据 —— 壁纸选择器里会列出这些
	wallpaper: {
		pic: [
			{ "title": "星空下的黑猫", "preview": "/img/wallpaper/okuki/image-pre.jpg", "url": "/img/wallpaper/okuki/image.jpg" },
		],
		picMobile: [
			{ "title": "星空下的黑猫", "preview": "/img/wallpaper/okuki/image-pre.jpg", "url": "/img/wallpaper/okuki/image.jpg" },
		],
		video: [
			{
				"title": "阿尔托莉雅-潘德拉贡",
				"preview": "/img/wallpaper/dynamic/阿尔托莉雅/阿尔托莉雅-pre.mp4",
				"url": "/img/wallpaper/dynamic/阿尔托莉雅/阿尔托莉雅.mp4"
			},
		],
		videoMobile: [],
	},

	//项目卡片 —— 初始为空：在页面上点"＋ 新增项目"现场添加（存在浏览器本地）
	projectcards: [],

	statement: ["Copyright © 2026 okuki"],
}

export default config
