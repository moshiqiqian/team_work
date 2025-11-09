// uniapp/src/main.ts

import { createSSRApp } from 'vue';
import App from './App.vue';
import { createPinia } from 'pinia';

export function createApp() {
  const app = createSSRApp(App);
  const pinia = createPinia();
  
  app.use(pinia);

  // 假设后端服务运行在 localhost:3000
  const BASE_URL = 'http://localhost:3000/api'; 
  
  // 挂载一个简单的全局工具，方便在组件中调用
  app.config.globalProperties.$apiBaseUrl = BASE_URL;
  app.config.globalProperties.$showMsg = (title: string, icon: 'success' | 'loading' | 'none' = 'none') => {
      uni.showToast({
          title,
          icon,
          duration: 2000
      });
  };

  return {
    app,
  };
}