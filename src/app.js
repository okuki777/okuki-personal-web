import homeright from '../src/components/hoemright.vue';
import typewriter from './components/typewriter.vue';
import tab1 from './components/tabs/tab1.vue';
import tab2 from './components/tabs/tab2.vue';
import tab3 from './components/tabs/tab3.vue';
import loader from './components/loader.vue';
import polarchart from './components/polarchart.vue';
import config from './config.js';
import { getCookie } from './utils/cookieUtils.js';
import { setMeta,getFormattedTime,getFormattedDate,dataConsole } from './utils/common.js';
import { useDisplay } from 'vuetify'

export default {
  components: {
    tab1,tab2,tab3,loader,homeright,typewriter,polarchart
  },
  setup() {
    const { xs,sm,md } = useDisplay();
    return { xs,sm,md };
  },
  data() {
    return {
      isloading:false,
      isClearScreen: false,
      formattedTime:"",
      formattedDate:"",
      configdata: config,
      dialog1: false,
      dialog2: false,
      personalizedtags: null,
      videosrc: '',
      videoposter: '',
      ismusicplayer: false,
      isPlaying:false,
      playlistIndex: 0,
      audioLoading: false,
      audioLastTime: 0,
      musicinfo: null,
      musicinfoLoading:false,
      lyrics:{},
      socialPlatformIcons: null,
      isExpanded: false,
      stackicons:[
        {icon:"mdi-vuejs",color:"green", model: false,tip: 'vue'},
        {icon:"mdi-language-javascript",color:"#CAD300", model: false,tip: 'javascript'},
        {icon:"mdi-language-css3",color:"blue", model: false,tip: 'css'},
        {icon:"mdi-language-html5",color:"red", model: false,tip: 'html'},
        {icon:"$vuetify",color:"#1697F6", model: false,tip: 'vuetify'},
      ],
      projectcards:null,
      snackbar: false,
      snackbarText: '',
      tab: null,
      tabs: [
        {
          icon: 'mdi-pencil-plus',
          text: '样式预览',
          value: 'tab-1',
          component: "tab1",
        },
        {
          icon: 'mdi-wallpaper',
          text: '背景预览',
          value: 'tab-2',
          component: "tab2",
        },
        {
          icon: 'mdi-music-circle-outline',
          text: '音乐播放',
          value: 'tab-3',
          component: "tab3",
        },
      ],

    };
  },
  async mounted() {
    if(import.meta.env.VITE_CONFIG){
      this.configdata = JSON.parse(import.meta.env.VITE_CONFIG);
    }
    this.projectcards = [...(this.configdata.projectcards || [])];this.socialPlatformIcons = this.configdata.socialPlatformIcons;

    // 合并「仓库里公开」的项目（public/projects.json，所有人都能看到）
    try{
      const r = await fetch('/projects.json', { cache: 'no-store' });
      if(r.ok){
        const shared = await r.json();
        if(Array.isArray(shared) && shared.length){
          const exists = new Set(this.projectcards.map(x => (x.title || '') + '|' + (x.url || '')));
          const extra = shared.filter(x => !exists.has((x.title || '') + '|' + (x.url || '')));
          this.projectcards = [...this.projectcards, ...extra];
        }
      }
    }catch(e){ console.warn('公开项目读取失败', e); }

    // 合并「现场新增」的项目（localStorage，只有自己看得到）
    try{
      const saved = JSON.parse(localStorage.getItem('okuki.projects') || '[]');
      if(Array.isArray(saved) && saved.length){
        this.projectcards = [...this.projectcards, ...saved];
      }
    }catch(e){ console.warn('本地项目读取失败', e); }
    this.personalizedtags = this.configdata.tags;
    this.isloading = true;
    let imageurl = "";
    this.dataConsole();
    this.setMeta(this.configdata.metaData.title,this.configdata.metaData.description,this.configdata.metaData.keywords,this.configdata.metaData.icon);
    
    imageurl = this.setMainProperty(imageurl);

    //异步等待背景壁纸包括视频壁纸加载完成后再显示页面
    const loadImage = () => {
        const imageUrls = [
          config.avatar,
          ...config.projectcards.map(item => item.img)
        ];
        return new Promise((resolve, reject) => {
          const imagePromises = imageUrls.map((url) => {
            return new Promise((resolve, reject) => {
                const imgs = new Image();
                imgs.src = url;
                imgs.onload = () => resolve();
                imgs.onerror = (err) => reject(err);
            });
          })

          // 设置超时机制：2.5秒
          const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
              resolve();
            }, 2500);
          });
          
          // 等待所有图片加载完成或超时
          Promise.race([Promise.all(imagePromises), timeoutPromise]).then(()=>{
            if(imageurl){
              const img = new Image();
              img.onload = () => resolve();
              img.onerror = () => resolve();
              img.src = imageurl;
              if (img.complete) resolve();     // 缓存命中时 load 可能已错过
            }else if(this.bgPoster){
              // 动态壁纸改成了延迟加载：等 poster 静帧就够，不等几 MB 的视频
              const posterImg = new Image();
              posterImg.onload = () => resolve();
              posterImg.onerror = () => resolve();
              posterImg.src = this.bgPoster;
              if (posterImg.complete) resolve();
            }else{
              resolve();                        // 兜底：绝不能让 loader 卡住
            }
          })
        });
     };

    loadImage().then(() => {
        this.formattedTime =  this.getFormattedTime(new Date());
        this.formattedDate =  this.getFormattedDate(new Date());
        setTimeout(() => {
          this.isloading = false;
        }, "500");          
      }).catch((err) => {
        console.error('壁纸加载失败:', err);
        setTimeout(() => {
          this.isloading = false;
        }, "100");  
      });
 
      setInterval(() => {
        this.formattedTime =  this.getFormattedTime(new Date()) ;
      }, 1000);

      await this.getMusicInfo();  //获取音乐数据
      this.setupAudioListener();  //设置 ended 事件监听器，当歌曲播放结束时自动调用 nextTrack 方法。
  },

  beforeDestroy() {     //在组件销毁前移除事件监听器，防止内存泄漏。
    this.$refs.audioPlayer.removeEventListener('ended',  this.nextTrack);
  },

  watch:{
    isClearScreen(val){
      if(!this.videosrc){
        return
      }
      if(val){
        this.$refs.VdPlayer.style.zIndex = 0; 
        this.$refs.VdPlayer.controls = true;
      }else{
        this.$refs.VdPlayer.style.zIndex = -100; 
        this.$refs.VdPlayer.controls = false;
      }
    },

    audioLoading(val){
      this.isPlaying = !val;
    }

  //若弹出框使得页面播放卡顿，可以先停止背景播放
  //   dialog1(val){
  //     if(val){
  //       this.$refs.VdPlayer.pause();
  //     }else{
  //       this.$refs.VdPlayer.play();
  //     }
  //  }
  },

  computed: {
    /**
     * 动态壁纸的静帧（poster）：
     * 直接从配置取，不依赖 setMainProperty 的执行路径，
     * 保证首屏一定先有画面，再等视频慢慢加载。
     */
    bgPoster() {
      if (this.videoposter) return this.videoposter;
      try {
        const bg = this.configdata.background;
        const info = (this.xs || this.sm) ? bg.mobile.datainfo : bg.pc.datainfo;
        return info && info.poster ? info.poster : '';
      } catch (e) {
        return '';
      }
    },

    currentSong() {
		  return this.musicinfo?.[this.playlistIndex];
    },

    audioPlayer() {
      return this.$refs.audioPlayer;
    }
  },
  
  methods: {
    getCookie,setMeta,getFormattedTime,getFormattedDate,dataConsole,

    /* ---------- 现场新增项目（存在浏览器 localStorage，不写回代码） ---------- */
    addProject(p){
      const item = {
        go: '🔗 前往',
        img: p.img || '/img/sunshine.jpg',
        title: p.title,
        subtitle: p.subtitle || '',
        text: p.text || '',
        url: p.url || '',
        show: false,
        __custom: true
      };
      this.projectcards.push(item);
      this.saveProjects();
    },

    removeProject(item){
      const i = this.projectcards.indexOf(item);
      if(i > -1) this.projectcards.splice(i, 1);
      this.saveProjects();
    },

    saveProjects(){
      try{
        const custom = (this.projectcards || []).filter(x => x.__custom);
        localStorage.setItem('okuki.projects', JSON.stringify(custom));
      }catch(e){
        // 常见原因：封面图是 base64，存太多会超 localStorage 配额（约 5MB）
        this.snackbarText = e && /quota/i.test(e.name + e.message)
          ? '本地空间满了：换更小的封面图，或用图片链接代替'
          : '项目保存失败，刷新后可能丢失';
        this.snackbar = true;
        console.warn('项目保存失败', e);
      }
    },

    onPickError(msg){
      this.snackbarText = msg || '图片读取失败';
      this.snackbar = true;
    },

    /** 导出成 public/projects.json 的内容（去掉内部字段），复制到剪贴板 */
    async exportProjects(){
      const list = (this.projectcards || []).map(p => ({
        go: p.go || '🔗 前往',
        img: p.img || '',
        title: p.title || '',
        subtitle: p.subtitle || '',
        text: p.text || '',
        url: p.url || ''
      }));
      const json = JSON.stringify(list, null, 2);
      try{
        await navigator.clipboard.writeText(json);
        this.snackbarText = `已复制 ${list.length} 个项目 → 粘贴到 public/projects.json 后推送`;
      }catch(e){
        console.warn('复制失败', e);
        this.snackbarText = '复制失败，请在控制台查看导出内容';
        console.log(json);
      }
      this.snackbar = true;
    },

    /* ---------- 微信这种没有网页主页的联系方式：点击复制 ---------- */
    async copySocial(item){
      const text = item.copy || '';
      try{
        await navigator.clipboard.writeText(text);
        this.snackbarText = `已复制 ${item.title || text}`;
      }catch(e){
        this.snackbarText = `微信号：${text}`;
      }
      this.snackbar = true;
    },

    /**
     * 动态壁纸延迟加载：
     *   先把 poster（几百 KB 的静帧）画上去，让页面立刻有画面；
     *   等首屏资源都跑完、浏览器空闲了，再真正请求那个几 MB 的视频。
     */
    queueVideoBackground(url, poster){
      this.videoposter = poster || '';
      clearTimeout(this._videoTimer);
      const start = () => {
        this._videoTimer = setTimeout(() => {
          this.videosrc = url;
          // 关键：换 src 后必须显式 load()，否则浏览器不会重新取流，画面会一直停在 poster
          this.$nextTick(() => {
            const v = this.$refs.VdPlayer;
            if (!v) return;
            try { v.load(); } catch (e) { }
            const p = v.play();
            if (p && p.catch) p.catch(() => { });
            // ?debugbg=1 时在控制台打一行状态，方便排查
            if (location.search.includes('debugbg')) {
              setTimeout(() => {
                console.log('[bg] ready=' + v.readyState + ' paused=' + v.paused +
                  ' t=' + v.currentTime.toFixed(2) + ' err=' + (v.error && v.error.code) +
                  ' net=' + v.networkState);
              }, 3000);
            }
          });
        }, 600);
      };
      if (document.readyState === 'complete') {
        start();
      } else {
        window.addEventListener('load', start, { once: true });
        // 兜底：load 迟迟不来（有大资源卡住）也不要无限等
        setTimeout(() => { if (!this.videosrc) start(); }, 2500);
      }
    },

    setMainProperty(imageurl){
      const root = document.documentElement;
      let leleodata = this.getCookie("leleodata");
      if(leleodata){
        root.style.setProperty('--leleo-welcomtitle-color', `${leleodata.color.welcometitlecolor}`);
        root.style.setProperty('--leleo-vcard-color', `${leleodata.color.themecolor}`);
        root.style.setProperty('--leleo-brightness', `${leleodata.brightness}%`);
        root.style.setProperty('--leleo-blur', `${leleodata.blur}px`); 
      }else{
        root.style.setProperty('--leleo-welcomtitle-color', `${this.configdata.color.welcometitlecolor}`);
        root.style.setProperty('--leleo-vcard-color', `${this.configdata.color.themecolor}`);  
        root.style.setProperty('--leleo-brightness', `${this.configdata.brightness}%`);  
        root.style.setProperty('--leleo-blur', `${this.configdata.blur}px`);
      }
  
      let leleodatabackground = this.getCookie("leleodatabackground");
      // 不能在这里调 useDisplay()：Vuetify 3 要求 composable 只能在 setup 内调用，否则会抛错并中断 mounted
      const xs = { value: this.xs || this.sm };
      if(leleodatabackground){
        if(xs.value){
          if(leleodatabackground.mobile.type == "pic"){
            root.style.setProperty('--leleo-background-image-url', `url('${leleodatabackground.mobile.datainfo.url}')`);
            imageurl = leleodatabackground.mobile.datainfo.url;
            return imageurl;
          }else{
            this.queueVideoBackground(leleodatabackground.mobile.datainfo.url, leleodatabackground.mobile.datainfo.poster);
          }
        }else{
          if(leleodatabackground.pc.type == "pic"){
            root.style.setProperty('--leleo-background-image-url', `url('${leleodatabackground.pc.datainfo.url}')`);
            imageurl = leleodatabackground.pc.datainfo.url;
            return imageurl;
          }else{
            this.queueVideoBackground(leleodatabackground.pc.datainfo.url, leleodatabackground.pc.datainfo.poster);
          }
        }
          
      }else{
        if(xs.value){
          if(this.configdata.background.mobile.type == "pic"){
            root.style.setProperty('--leleo-background-image-url', `url('${this.configdata.background.mobile.datainfo.url}')`);
            imageurl = this.configdata.background.mobile.datainfo.url;
            return imageurl;
          }else{
            this.queueVideoBackground(this.configdata.background.mobile.datainfo.url, this.configdata.background.mobile.datainfo.poster);
          }
        }else{
          if(this.configdata.background.pc.type == "pic"){
            root.style.setProperty('--leleo-background-image-url', `url('${this.configdata.background.pc.datainfo.url}')`);
            imageurl = this.configdata.background.pc.datainfo.url;
            return imageurl;
          }else{
            this.queueVideoBackground(this.configdata.background.pc.datainfo.url, this.configdata.background.pc.datainfo.poster);
          }
          
        }
      }
    },

    projectcardsShow(key){
      this.projectcards.forEach((item,index)=>{
        if(index!= key){
          item.show = false;
        }
      })
    },

    handleCancel(){
      this.dialog1 = false;
    },

    jump(url){
      window.open(url, '_blank').focus();
    },
    
    async getMusicInfo(){
      this.musicinfoLoading = true;
      const q = `server=${this.configdata.musicPlayer.server}&type=${this.configdata.musicPlayer.type}&id=${this.configdata.musicPlayer.id}`;
      // 优先用站内自建接口（同域、无第三方依赖），失败再退回公共 Meting 服务
      const sources = [`/api/meting?${q}`, `https://api.i-meto.com/meting/api?${q}`];
      for (const url of sources) {
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          if (!Array.isArray(data) || !data.length) throw new Error('歌单为空');
          this.musicinfo = data;
          this.musicinfoLoading = false;
          this.initPlaylistStart();
          return;
        } catch (error) {
          console.warn('[music] 源不可用，换下一个：', url, error.message);
        }
      }
      this.musicinfoLoading = false;
      console.error('请求失败：自建接口与公共接口都不可用');
    },

	initPlaylistStart() {
		if (!this.musicinfo || !this.musicinfo.length) return;
		const len = this.musicinfo.length;
		let target = 0;
		const { randomFirstPlay, startIndex } = this.configdata.musicPlayer || {};
		if (randomFirstPlay) {
			target = Math.floor(Math.random() * len);
		} else if (typeof startIndex === 'number' && Number.isFinite(startIndex)) {
			const s = Math.floor(startIndex);
			target = s >= 0 && s < len ? s : 0;
		}
		this.playlistIndex = target;
		this.isPlaying = false;
	},

    musicplayershow(val) {
        this.ismusicplayer = val;
    },

    setupAudioListener() {
      const a = this.$refs.audioPlayer;
      if (!a) return;
      a.addEventListener('ended', this.nextTrack);
      a.addEventListener('error', this.onAudioError);
      a.addEventListener('timeupdate', () => { this.audioLastTime = a.currentTime; });
      a.addEventListener('canplay', () => {
        this._failStreak = 0;
        const s = this.musicinfo?.[this.playlistIndex];
        if (s) s._refreshed = false;
      });
    },

    togglePlay() {
      if (!this.isPlaying) {
        const song = this.musicinfo?.[this.playlistIndex];
        // 还没有播放地址（首次播放 / 上一首刚跳过）就先取地址再播
        if (song && !song.url) return this.updateAudio();
        const p = this.audioPlayer?.play();
        if (p && p.catch) p.catch(() => { });
        this.isVdMuted = true;
        this.isPlaying = true;
      } else {
        this.audioPlayer?.pause();
        this.isVdMuted = false;
        this.isPlaying = false;
      }
    },

    previousTrack() {
      this._failStreak = 0;
      this.playlistIndex = this.playlistIndex > 0 ? this.playlistIndex - 1 : this.musicinfo.length - 1;
      this.updateAudio();
    },

    nextTrack() {
      this.playlistIndex = this.playlistIndex < this.musicinfo.length - 1 ? this.playlistIndex + 1 : 0;
      this.updateAudio();
    },

    /**
     * 播放地址：播到哪首才取哪首。
     * 网易云的地址带时间戳会过期，预取 40 首的话，等播到第 20 首早就失效了。
     */
    async ensureSongUrl(song, force = false) {
      if (!song) return '';
      if (song.url && !force) return song.url;
      const id = song.id || (song.lrc ? (song.lrc.match(/id=(\d+)/) || [])[1] : null);
      if (!id) return song.url || '';
      try {
        // 8 秒拿不到就放弃：宁可跳过这一首，也不要让播放器干等十几秒
        const r = await fetch(`/api/songurl?id=${id}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(8000)
        });
        if (r.ok) {
          const d = await r.json();
          if (d && d.url) { song.url = d.url; return d.url; }
        }
      } catch (e) {
        console.warn('[music] 取播放地址失败：', e.message);
      }
      return '';
    },

    /** 下一首的地址提前取好，切歌不卡（不影响当前播放） */
    prefetchNext() {
      clearTimeout(this._prefetchTimer);
      this._prefetchTimer = setTimeout(() => {
        const list = this.musicinfo || [];
        if (!list.length) return;
        const next = list[(this.playlistIndex + 1) % list.length];
        if (next && !next.url) this.ensureSongUrl(next);
      }, 1500);
    },

    /** 连续失败计数，防止死循环跳过 */
    skipUnplayable(song) {
      const total = this.musicinfo?.length || 1;
      this._failStreak = (this._failStreak || 0) + 1;
      if (this._failStreak > total) {
        this._failStreak = 0;
        this.isPlaying = false;
        console.warn('[music] 整张歌单都无法播放，停止。');
        return;
      }
      console.warn('[music] 跳过无法播放：', song?.title || '');
      this.nextTrack();
    },

    /** 播放出错（链接过期 / 无地址）：强制重取一次并从原位置继续，再不行就跳过 */
    async onAudioError() {
      const a = this.$refs.audioPlayer;
      const song = this.musicinfo?.[this.playlistIndex];
      if (!a || !song) return;
      // 启动时 src 为空也会报 error，那不是真的失败，别在这里瞎跳歌
      if (!this.isPlaying || !song.url) return;
      if (song._refreshed) {
        song._refreshed = false;
        return this.skipUnplayable(song);
      }
      song._refreshed = true;
      const at = this.audioLastTime || 0;
      const url = await this.ensureSongUrl(song, true);
      if (!url) return this.skipUnplayable(song);
      this.$nextTick(() => {
        const onMeta = () => {
          a.removeEventListener('loadedmetadata', onMeta);
          try { if (at > 0) a.currentTime = at; } catch (e) { }
          if (this.isPlaying) {
            const p = a.play();
            if (p && p.catch) p.catch(() => { });
          }
          song._refreshed = false;
        };
        a.addEventListener('loadedmetadata', onMeta);
        try { a.load(); } catch (e) { }
      });
    },

    async updateAudio() {
      const song = this.musicinfo?.[this.playlistIndex];
      if (!song) return;
      this.isPlaying = true;
      const url = await this.ensureSongUrl(song);
      if (!url) return this.skipUnplayable(song);
      this.$nextTick(() => {
        const p = this.audioPlayer?.play();
        if (p && p.catch) p.catch(() => { });
        this.prefetchNext();
      });
    },

    updateCurrentIndex(index) {
      this.playlistIndex = index;
      this.updateAudio();
    },

    updateIsPlaying(isPlaying) {
      this.isPlaying = isPlaying;
    },

    updateLyrics(lyrics){
      this.lyrics = lyrics;
    },

    // 监听等待事件（缓冲不足）
    onWaiting() {
      this.audioLoading = true;
    },

    // 监听可以播放事件（缓冲足够）
    onCanPlay() {
      this.audioLoading = false;
	  if (this.isPlaying) {
		  const p = this.audioPlayer.play();
		  if (p && p.catch) p.catch(() => { });
	  }
    },

    expandSwitch() {
      this.isExpanded = true;
    },

    collapseSwitch() {
      this.isExpanded = false;
    },
  }
};