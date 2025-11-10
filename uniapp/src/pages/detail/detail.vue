<template>
  <view class="container">
    <view v-if="loading" class="loading-box">
      <text>加载戏剧详情中...</text>
    </view>
    <view v-else-if="!drama" class="empty-box">
      <text>未找到该戏剧的详细信息。</text>
    </view>
    <view v-else class="detail-content">
      
      <view class="header-section">
        <image class="cover-image" :src="drama.coverUrl || 'https://placehold.co/150x200/EEEEEE/AAAAAA?text=No+Cover'" mode="aspectFill"></image>
        <view class="info-box">
          <text class="title">{{ drama.name }}</text>
          <text class="genre">流派：{{ drama.genre || '未填写' }}</text>
          <text class="id-text">ID: {{ drama.id.substring(0, 8) }}...</text>
          </view>
      </view>

      <uni-card title="📖 内容简介" margin="15px 0" is-shadow>
        <text class="synopsis-text">{{ drama.synopsis }}</text>
      </uni-card>
      
      <uni-card title="🏷️ 标签" margin="15px 0" is-shadow>
        <view v-if="drama.tags && drama.tags.length > 0" class="tag-list">
          <uni-tag
            v-for="(tag, index) in drama.tags"
            :key="index"
            :text="tag"
            type="primary"
            :custom-style="{ margin: '5px' }"
          />
        </view>
        <view v-else>
          <text class="no-tag-tip">暂无标签。</text>
        </view>
      </uni-card>
      
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import * as api from '../../api/drama'; 
import type { Drama } from '../../api/drama';

// 导入 uni-ui 组件
import uniCard from '@dcloudio/uni-ui/lib/uni-card/uni-card.vue';
import uniTag from '@dcloudio/uni-ui/lib/uni-tag/uni-tag.vue';

const drama = ref<Drama | null>(null);
const loading = ref(true);

onMounted(() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1] as unknown as { options: { id: string } }; 
  const options = currentPage.options;
  const dramaId = options?.id;

  if (dramaId) {
    fetchDramaDetail(dramaId);
  } else {
    loading.value = false;
  }
});

/**
 * 根据 ID 加载戏剧详情
 */
const fetchDramaDetail = async (id: string) => {
  loading.value = true;
  console.log('Fetching details for ID:', id); 
  try {
    const fetchedDrama = await api.fetchDramaById(id); 
    
    if (fetchedDrama && fetchedDrama.id) {
        drama.value = fetchedDrama;
        console.log('Fetched Drama Data:', drama.value);
    } else {
        drama.value = null; // 未找到
        console.warn('未找到 ID 对应的戏剧数据。');
    }

  } catch (error) {
    console.error('加载戏剧详情失败:', error); 
    drama.value = null;
  } finally {
    loading.value = false;
  }
};

/**
 * 跳转到管理页进行编辑 (由于按钮移除，此函数已不再被调用)
 */
// const goToEdit = (id: string) => {
//     uni.navigateTo({
//         url: `/pages/management/management?id=${id}`,
//     });
// };
</script>

<style>
/* ... (样式保持不变) ... */
.container {
  padding: 15px;
  background-color: #f8f8f8;
  min-height: 100vh;
}
.header-section {
    display: flex;
    margin-bottom: 20px;
    padding: 10px;
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}
.cover-image {
    width: 150px;
    height: 200px;
    border-radius: 6px;
    margin-right: 15px;
}
.info-box {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 5px 0;
}
.title {
    font-size: 24px;
    font-weight: bold;
    color: #333;
    line-height: 1.2;
}
.genre {
    font-size: 14px;
    color: #606266;
    margin-top: 5px;
}
.id-text {
    font-size: 12px;
    color: #909399;
}
.edit-btn {
    font-size: 14px;
    height: 35px;
    line-height: 35px;
    padding: 0 10px;
    margin: 10px 0 0;
    white-space: nowrap;
    background-color: #409eff;
    color: white;
}
.synopsis-text {
    font-size: 14px;
    color: #303133;
    line-height: 1.8;
}
.tag-list {
    display: flex;
    flex-wrap: wrap;
}
.no-tag-tip {
    font-size: 14px;
    color: #999;
}
.loading-box, .empty-box {
    text-align: center;
    padding: 50px 0;
    color: #999;
}
</style>