<template>
  <view class="container">
    <!-- 头部导航和搜索框 -->
    <view class="header">
      <uni-search-bar
        @confirm="handleSearch"
        @input="onSearchInput"
        :value="searchQuery"
        placeholder="搜索戏剧名称、流派、标签..."
        focus
      ></uni-search-bar>
      <button class="manage-btn" @click="goToManagement">
        管理页面
      </button>
    </view>

    <!-- AI 联想推荐 -->
    <view v-if="store.suggestedDramas.length > 0 && searchQuery" class="ai-suggestion-card">
      <text class="ai-title">🧠 AI 推荐联想：</text>
      <view class="tag-list">
        <uni-tag
          v-for="(suggestion, index) in store.suggestedDramas"
          :key="index"
          :text="suggestion"
          type="primary"
          :custom-style="{ margin: '5px' }"
        />
      </view>
    </view>

    <!-- 戏剧列表 -->
    <view v-if="store.loading" class="loading-box">
      <text>加载中...</text>
    </view>
    <view v-else-if="store.dramas.length === 0" class="empty-box">
      <text>暂无戏剧内容，请前往管理页面添加。</text>
    </view>
    <view v-else class="drama-list">
      <text class="list-title">{{ searchQuery ? '搜索结果' : '随机推荐' }} ({{ store.dramas.length }}条)</text>
      <uni-card
        v-for="drama in store.dramas"
        :key="drama.id"
        :title="drama.name"
        :sub-title="'流派: ' + drama.genre"
        :extra="'ID: ' + drama.id.substring(0, 8) + '...'"
        :thumbnail="drama.coverUrl || 'https://placehold.co/80x80/EEEEEE/AAAAAA?text=Cover'"
        @click="viewDetail(drama)"
        is-shadow
      >
        <text class="synopsis-text">{{ drama.synopsis.substring(0, 50) + '...' }}</text>
        <view class="tag-list">
          <uni-tag
            v-for="(tag, tIndex) in drama.tags"
            :key="tIndex"
            :text="tag"
            size="small"
            :custom-style="{ margin: '2px' }"
          />
        </view>
      </uni-card>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useDramaStore } from '../../store/drama';
import type { Drama } from '../../api/drama';

// 导入 uni-app 组件，虽然 uni-app 自动识别，但为了TS类型和清晰度，保留
import uniSearchBar from '@dcloudio/uni-ui/lib/uni-search-bar/uni-search-bar.vue';
import uniCard from '@dcloudio/uni-ui/lib/uni-card/uni-card.vue';
import uniTag from '@dcloudio/uni-ui/lib/uni-tag/uni-tag.vue';

const store = useDramaStore();
const searchQuery = ref('');
let searchTimer: any = null; // 用于防抖和 AI 联想

onMounted(() => {
  // 首次加载，显示随机推荐/全部
  store.loadDramas();
});

/**
 * 搜索框输入事件（用于联想）
 */
const onSearchInput = (value: string) => {
  searchQuery.value = value;
  
  // 清除上一次的计时器
  clearTimeout(searchTimer);

  if (searchQuery.value.trim() === '') {
    // 如果清空，立即清空推荐和重新加载全部列表
    store.clearSuggestions();
    store.loadDramas();
    return;
  }

  // 1. 立即执行搜索，更新列表
  store.loadDramas(searchQuery.value);

  // 2. 500ms 后进行 AI 联想 (防抖)
  searchTimer = setTimeout(() => {
    // 确保在联想时，列表已经根据当前输入更新完毕
    // 这里传入当前的搜索结果给后端，让 AI 根据这些结果进行更精准的联想
    store.runSearchSuggest(searchQuery.value, store.dramas);
  }, 500);
};

/**
 * 搜索确认事件
 */
const handleSearch = (e: { value: string }) => {
  searchQuery.value = e.value;
  store.loadDramas(searchQuery.value);
  // 确认搜索后，也立即触发 AI 联想
  store.runSearchSuggest(searchQuery.value, store.dramas);
};

/**
 * 跳转到详情/编辑页 (这里简化为跳转到管理页面，并传递参数进行编辑)
 */
const viewDetail = (drama: Drama) => {
  uni.navigateTo({
    url: `/pages/management/management?id=${drama.id}`,
  });
};

/**
 * 跳转到管理页面
 */
const goToManagement = () => {
  uni.navigateTo({
    url: '/pages/management/management',
  });
};

// 监听 store.dramas 变化，在搜索结果更新后，如果搜索框有内容，自动触发 AI 联想
watch(
  () => store.dramas,
  (newDramas) => {
    if (searchQuery.value && !store.loading) {
        // 如果列表更新完毕且搜索框有内容，重新触发联想
        store.runSearchSuggest(searchQuery.value, newDramas);
    }
  },
  { deep: true }
);

</script>

<style>
/* 使用 uni-app 默认的样式变量 */
.container {
  padding: 15px;
  background-color: #f8f8f8;
  min-height: 100vh;
}
.header {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
}
.manage-btn {
    font-size: 14px;
    height: 35px;
    line-height: 35px;
    padding: 0 10px;
    margin-left: 10px;
    white-space: nowrap;
    background-color: #409eff;
    color: white;
}
.ai-suggestion-card {
    background-color: #ecf5ff;
    padding: 10px;
    margin-bottom: 15px;
    border-radius: 8px;
    border: 1px solid #d9ecff;
}
.ai-title {
    font-weight: bold;
    color: #409eff;
    display: block;
    margin-bottom: 5px;
    font-size: 14px;
}
.tag-list {
    display: flex;
    flex-wrap: wrap;
}
.drama-list {
    margin-top: 15px;
}
.list-title {
    font-size: 16px;
    font-weight: bold;
    color: #333;
    display: block;
    margin-bottom: 10px;
}
.synopsis-text {
    font-size: 13px;
    color: #666;
    line-height: 1.5;
    margin-bottom: 8px;
    display: block;
}
.loading-box, .empty-box {
    text-align: center;
    padding: 50px 0;
    color: #999;
}
</style>