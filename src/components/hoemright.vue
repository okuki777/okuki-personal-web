<template>
      <div>
        <div>
          <div :style="xs||sm?{'display':'none'}:{'font-size':'4rem'}" class="leleo-left-welcome">{{ configdata.welcometitle }}</div>
        </div>
        <div>
          <v-row align="center">
            <v-col cols="12" md="8">
				<v-text-field class="v-card  search-field"
					:style="xs||sm?{'display':'none'}:{}"
					v-model="searchQuery"
					placeholder="搜索..."
					variant="outlined"
					rounded
					hide-details="true"
					@keyup.enter="performSearch"
					>
					<template v-slot:prepend-inner>
						<v-menu>
							<template v-slot:activator="{ props }">
							<v-btn
								variant="text"
								v-bind="props"
								class="engine-btn"
							>
								{{ selectedEngine.title }}
								<v-icon icon="mdi-chevron-down"></v-icon>
							</v-btn>
							</template>
							<v-list class="glass-list">
								<v-list-item
									v-for="engine in searchEngines"
									:key="engine.value"
									@click="selectedEngine = engine"
									density="compact"
								>
									{{ engine.title }}
								</v-list-item>
							</v-list>
						</v-menu>
					</template>

					<template v-slot:append-inner>
						<v-btn
						:icon="isUrl ? 'mdi-earth' : 'mdi-magnify'"
						variant="text"
						@click="performSearch"
						></v-btn>
					</template>
					</v-text-field>
            	<typewriter class="ma-3 d-flex align-center justify-center" style="min-height: 200px;"></typewriter>
            </v-col>
            <v-col cols="12" md="4" align="center">
              <v-card class="ma-3" hover
                >
                  <template v-slot:title >
                    <span class="leleo-card-title clock-font">{{formattedTime}}</span>
                  </template>
                  <template v-slot:subtitle>
                    <span style="font-weight: bold;">{{formattedDate}}</span>
                  </template>
                  <turntable :color1="configdata.color.turntablecolor1" :color2="configdata.color.turntablecolor2" />
              </v-card>
            </v-col>
          </v-row>
          
          <v-chip class="mt-3 ml-3" prepend-icon="mdi-webhook"  size="large" style="color: var(--leleo-vcard-color);">
            我的项目
          </v-chip>
          <v-btn
            class="mt-3 ml-2"
            size="small"
            variant="text"
            prepend-icon="mdi-code-json"
            style="color: var(--leleo-vcard-color);"
            @click="$emit('export-projects')"
          >导出 JSON</v-btn>
          <v-container>
            <v-row>
              <v-col
                v-for="(item,key) in projectcards"
                cols="6"
                md="4"
                lg="3"
                :style="xs?{'padding': '6px'}:{}"
              >
                <v-card class="">
                  <v-img
                    aspect-ratio="1.7778"
                    :src= item.img
                    cover
                    :style="{ opacity: 0.8 }"
                  ></v-img>
                  <v-card-title :style="xs?{'font-size': '0.9rem','padding': '0.15rem 0.5rem'}:{'font-size': '1.1rem','padding':'0.2rem 0.8rem'}">
                    {{item.title}}
                  </v-card-title>
                  <v-card-subtitle :style="xs?{'font-size': '0.6rem','padding': '0.1rem 0.5rem'}:{'font-size': '0.8rem','padding':'0.15rem 0.6rem'}">
                    {{ item.subtitle }}
                  </v-card-subtitle>

                  <v-card-actions :style="xs||sm||md?{'padding': '0','min-height': '0','height':'2.5rem'}:{'min-height': '0','height':'2.8rem'}">
                    <v-btn :href="item.url"
                    target="_blank"
                      :text= "item.go"
                    ></v-btn>
                    <v-spacer></v-spacer>
                    <v-btn
                      v-if="item.__custom"
                      icon="mdi-trash-can-outline"
                      size="small"
                      @click.stop="$emit('remove-project', item)"
                    ></v-btn>
                    <v-btn
                      :icon="item.show ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                      @click="item.show = !item.show;projectcardsShow(key);"
                    ></v-btn>
                  </v-card-actions>
                  <v-expand-transition>
                    <div v-show="item.show">
                      <v-divider></v-divider>
                      <v-card-text :style="xs?{'font-size': '0.7rem'}:{}">
                        {{item.text}}
                      </v-card-text>
                    </div>
                  </v-expand-transition>
                </v-card>
              </v-col>

              <!-- 现场新增项目 -->
              <v-col cols="6" md="4" lg="3" :style="xs?{'padding': '6px'}:{}">
                <v-card
                  variant="flat"
                  style="min-height: 196px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 1px dashed rgba(255,255,255,.45); background: rgba(255,255,255,.08); backdrop-filter: blur(8px);"
                  @click="openAdd"
                >
                  <div style="text-align:center; color:#fff;">
                    <v-icon icon="mdi-plus-circle-outline" size="40"></v-icon>
                    <div style="margin-top: 8px; font-size: .9rem; letter-spacing: .05em;">新增项目</div>
                    <div style="margin-top: 2px; font-size: .7rem; opacity: .65;">现场添加 · 存在本机</div>
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </v-container>

          <!-- 新增项目弹窗 -->
          <v-dialog v-model="addDialog" max-width="520">
            <v-card style="backdrop-filter: blur(10px);">
              <v-card-title style="font-size: 1.1rem;">新增项目</v-card-title>
              <v-card-text>
                <v-text-field v-model="form.title" label="标题" placeholder="比如：我的博客" variant="outlined" density="comfortable" hide-details class="mb-3"></v-text-field>
                <v-text-field v-model="form.subtitle" label="一句话" placeholder="它是什么 / 你做了什么" variant="outlined" density="comfortable" hide-details class="mb-3"></v-text-field>
                <v-text-field v-model="form.url" label="链接" placeholder="https://" variant="outlined" density="comfortable" hide-details class="mb-3"></v-text-field>
                <v-text-field v-model="form.text" label="展开后的说明（可留空）" variant="outlined" density="comfortable" hide-details class="mb-3"></v-text-field>

                <!-- 封面图：可以填链接，也可以直接选本机图片 -->
                <div class="d-flex align-center" style="gap: 8px;">
                  <v-text-field
                    v-model="form.img"
                    label="封面图（链接或本机图片，可留空）"
                    placeholder="https://… 或 /img/xxx.jpg"
                    variant="outlined" density="comfortable" hide-details
                    class="flex-grow-1"
                  ></v-text-field>
                  <v-btn variant="tonal" height="48" @click="pickImage">本地图片</v-btn>
                  <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onPickImage" />
                </div>
                <div v-if="form.img" class="d-flex align-center mt-2" style="gap:10px;">
                  <v-img :src="form.img" width="96" height="54" cover rounded="lg" style="flex:0 0 auto;"></v-img>
                  <span style="font-size:.72rem; opacity:.6;">16:9 显示，超出会被裁切</span>
                  <v-spacer></v-spacer>
                  <v-btn size="small" variant="text" @click="form.img = ''">清除</v-btn>
                </div>
                <div v-else style="font-size:.72rem; opacity:.6; margin-top:6px;">留空就用默认的仙人掌图</div>
              </v-card-text>
              <v-card-actions>
                <span style="font-size: .72rem; opacity: .6; margin-left: 8px;">先存到本机；要公开点「导出 JSON」</span>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="addDialog = false">取消</v-btn>
                <v-btn color="primary" variant="flat" :disabled="!form.title.trim()" @click="submitAdd">添加</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

        </div>
      </div>
</template> 

<script>
import typewriter from '../components/typewriter.vue';
import turntable from '../components/turntable.vue';
import { useDisplay } from 'vuetify'

export default {
    components: {
        typewriter,turntable
    },
    props: ['configdata','formattedTime','formattedDate','projectcards'],
	emits: ['add-project', 'remove-project', 'pick-error', 'export-projects'],
	data() {
		return {
			searchQuery: '',
			addDialog: false,
			form: { title: '', subtitle: '', url: '', text: '', img: '' },
			selectedEngine: { title: 'Bing', value: 'bing' },
      		searchEngines :[
				{ title: 'Bing', value: 'bing' },
				{ title: 'Google', value: 'google' },
				{ title: '百度', value: 'baidu' },
				{ title: 'Yandex', value: 'yandex' },
				{ title: 'DuckDuckGo', value: 'duckduckgo' },
			]
		}
	},
    setup() {
      const { xs,sm,md } = useDisplay();
      return {xs,sm,md};
    },
    mounted(){
      // 演示 / 截图用：?add=1 直接打开"新增项目"弹窗
      if (new URLSearchParams(location.search).get('add')) this.openAdd();
    },
	computed: {	
		isUrl(){
			const str = this.searchQuery.trim();
  			return this.isLikelyUrl(str);
		}
	},
    methods:{
      /* ---------- 封面图：选本机图片 → 压到 1280 宽 → 存成 dataURL ---------- */
      pickImage(){
        this.$refs.fileInput?.click();
      },
      onPickImage(e){
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          this.$emit('pick-error', '只能选图片文件');
          return;
        }
        if (file.size > 8 * 1024 * 1024) {
          this.$emit('pick-error', '图片太大（>8MB），先压缩一下');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const maxW = 1280;
            const scale = Math.min(1, maxW / img.width);
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const cv = document.createElement('canvas');
            cv.width = w; cv.height = h;
            cv.getContext('2d').drawImage(img, 0, 0, w, h);
            // 压成 jpeg，省 localStorage 空间
            this.form.img = cv.toDataURL('image/jpeg', 0.82);
          };
          img.onerror = () => this.$emit('pick-error', '这张图读不出来，换一张试试');
          img.src = reader.result;
        };
        reader.onerror = () => this.$emit('pick-error', '读取失败');
        reader.readAsDataURL(file);
        e.target.value = '';   // 允许重复选同一个文件
      },
      openAdd(){
        this.form = { title: '', subtitle: '', url: '', text: '', img: '' };
        this.addDialog = true;
      },
      submitAdd(){
        const title = this.form.title.trim();
        if(!title) return;
        this.$emit('add-project', {
          title,
          subtitle: this.form.subtitle.trim(),
          url: this.form.url.trim(),
          text: this.form.text.trim(),
          img: this.form.img.trim()
        });
        this.addDialog = false;
      },
      projectcardsShow(key){
        for(let i = 0;i < this.projectcards.length;i++){
          if(i != key){
            this.projectcards[i].show = false;
          }
        }
      },
	  performSearch() {
		const query = this.searchQuery.trim();
		if (!query) return;

		if (this.isUrl) {
			let url = query;
			// 自动补全协议（如果缺少）
			if (!/^[a-z]+:\/\//i.test(url)) {
				url = 'http://' + url; // 默认用http
			}
			
			window.open(url, '_blank');
		} else {
			const engineUrls = {
				google: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
				bing: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
				baidu: `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
				yandex: `https://yandex.com/search/?text=${encodeURIComponent(query)}`,
				duckduckgo: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
			};
			window.open(engineUrls[this.selectedEngine.value], '_blank');
		}
	  },
	  isLikelyUrl(input) {
		// 移除首尾空格
		const str = input.trim();
		
		// 情况1：明确包含协议头（http/https/ftp等）
		if (/^(https?|ftp):\/\//i.test(str)) return true;
		
		// 情况2：符合域名格式（支持国际化域名）
		const domainPattern = /^([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i;
		
		// 情况3：localhost或IP地址
		const localPattern = /^(localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?(\/.*)?$/i;
		
		
		return (
			domainPattern.test(str) || 
			localPattern.test(str)
		);
		}
    }
};
</script>

<style scoped>
@import url(/css/app.less);
@import url(/css/mobile.less);
.search-field {
	border-radius: 22px !important;
	overflow: hidden;
}

.glass-list {
	background: transparent !important;
	backdrop-filter: blur(var(--leleo-blur));
	border-radius: 5%;
	color: var(--leleo-vcard-color);
	overflow: hidden;
}
</style>