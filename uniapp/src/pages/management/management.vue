<template>
  <view class="container">
    <uni-segmented-control 
      :current="currentTab" 
      :values="['新增/编辑戏剧', '标签管理']" 
      @clickItem="onClickItem" 
      style-type="button" 
      active-color="#409eff"
    ></uni-segmented-control>
    
    <!-- 1. 新增/编辑戏剧区域 -->
    <view v-show="currentTab === 0" class="drama-form-area">
      <uni-card :title="isEditMode ? '编辑戏剧内容' : '新增戏剧内容'" margin="10px 0">
        
        <!-- 表单 -->
        <uni-forms ref="dramaFormRef" :modelValue="dramaForm" :rules="dramaRules">
          
          <!-- 封面 URL -->
          <uni-forms-item label="封面 URL" name="coverUrl">
            <uni-easyinput 
              v-model="dramaForm.coverUrl" 
              placeholder="请输入封面图片链接"
              :clearable="false"
            />
          </uni-forms-item>
          
          <!-- 戏剧名称 -->
          <uni-forms-item label="戏剧名称" name="name">
            <uni-easyinput v-model="dramaForm.name" placeholder="请输入戏剧名称" />
          </uni-forms-item>

          <!-- 戏剧流派 -->
          <uni-forms-item label="流派" name="genre">
            <uni-easyinput v-model="dramaForm.genre" placeholder="例如：喜剧、悲剧、音乐剧" />
          </uni-forms-item>

          <!-- 简介 -->
          <uni-forms-item label="内容简介" name="synopsis">
            <uni-easyinput type="textarea" v-model="dramaForm.synopsis" placeholder="请输入戏剧的详细简介" />
          </uni-forms-item>

          <!-- AI 标签生成 -->
          <uni-forms-item label="AI 智能标签" name="aiTags">
            <view class="ai-tag-section">
              <button 
                class="ai-tag-btn" 
                :disabled="!dramaForm.synopsis || isGeneratingTags" 
                @click="handleGenerateTags"
                :loading="isGeneratingTags"
              >
                {{ isGeneratingTags ? '生成中...' : '🧠 AI 自动打标签' }}
              </button>
              <text class="ai-tag-tip">（基于简介和现有标签生成）</text>
            </view>
          </uni-forms-item>

          <!-- 标签选择 (多选) -->
          <uni-forms-item label="选择标签" name="tags">
            <view class="tag-selection">
              <view 
                v-for="(tag) in store.tags" 
                :key="tag.id" 
                class="tag-item"
                :class="{ 'tag-selected': dramaForm.tags.includes(tag.name) }"
                @click="toggleTag(tag.name)"
              >
                {{ tag.name }}
              </view>
            </view>
            <view v-if="dramaForm.tags.length > 0" class="current-tags-tip">
                已选标签：{{ dramaForm.tags.join(' / ') }}
            </view>
          </uni-forms-item>
          
          <view class="button-group">
            <button 
              type="primary" 
              class="submit-btn" 
              @click="submitForm"
              :disabled="isSubmitting"
              :loading="isSubmitting"
            >
              {{ isEditMode ? '保存修改' : '新增戏剧' }}
            </button>
            <button v-if="isEditMode" type="default" @click="resetForm">取消编辑</button>
          </view>
        </uni-forms>
      </uni-card>

      <!-- 戏剧列表 (下半部分) -->
      <uni-card title="全部戏剧列表" margin="10px 0" :extra="'共 ' + store.dramas.length + ' 条'">
        <uni-list v-if="store.dramas.length > 0">
          <uni-list-item 
            v-for="drama in store.dramas" 
            :key="drama.id"
            :title="drama.name" 
            :note="drama.genre + ' | ' + drama.tags.join(', ')"
            :show-extra-icon="true"
            :extra-icon="{color: '#409eff', size: '22', type: 'forward'}"
            :clickable="true"
            @click="editDrama(drama)"
          >
            <template #footer>
                <view class="item-actions">
                    <button class="action-btn edit" @click.stop="editDrama(drama)">编辑</button>
                    <button class="action-btn delete" @click.stop="deleteDrama(drama)">删除</button>
                </view>
            </template>
          </uni-list-item>
        </uni-list>
        <view v-else class="empty-list-tip">
          <text>暂无戏剧，请在上半部分新增。</text>
        </view>
      </uni-card>
    </view>
    
    <!-- 2. 标签管理区域 -->
    <view v-show="currentTab === 1" class="tag-management-area">
      <uni-card title="标签管理 (增/删)" margin="10px 0">
        <view class="add-tag-form">
          <uni-easyinput v-model="newTagName" placeholder="输入新的标签名称" />
          <button 
            type="primary" 
            size="mini" 
            @click="handleAddTag"
            :disabled="!newTagName.trim() || isAddingTag"
            :loading="isAddingTag"
          >
            新增标签
          </button>
        </view>
        
        <view class="tag-list-display">
          <text class="tag-count-title">现有标签 ({{ store.tags.length }})：</text>
          <view class="tag-list-box">
            <view 
              v-for="tag in store.tags" 
              :key="tag.id" 
              class="tag-pill"
            >
              <text>{{ tag.name }}</text>
              <uni-icons 
                type="closeempty" 
                size="16" 
                color="#fff" 
                class="delete-icon" 
                @click="handleDeleteTag(tag)"
              />
            </view>
          </view>
        </view>
      </uni-card>
    </view>
    
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, getCurrentInstance } from 'vue';
import { useDramaStore } from '../../store/drama';
import * as api from '../../api/drama';
import type { Drama, Tag } from '../../api/drama';

// 导入 uni-ui 组件
import uniSearchBar from '@dcloudio/uni-ui/lib/uni-search-bar/uni-search-bar.vue';
import uniCard from '@dcloudio/uni-ui/lib/uni-card/uni-card.vue';
import uniTag from '@dcloudio/uni-ui/lib/uni-tag/uni-tag.vue';
import uniEasyinput from '@dcloudio/uni-ui/lib/uni-easyinput/uni-easyinput.vue';
import uniForms from '@dcloudio/uni-ui/lib/uni-forms/uni-forms.vue';
import uniFormsItem from '@dcloudio/uni-ui/lib/uni-forms-item/uni-forms-item.vue';
import uniList from '@dcloudio/uni-ui/lib/uni-list/uni-list.vue';
import uniListItem from '@dcloudio/uni-ui/lib/uni-list-item/uni-list-item.vue';
import uniSegmentedControl from '@dcloudio/uni-ui/lib/uni-segmented-control/uni-segmented-control.vue';
import uniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue';

// 获取全局属性
const { proxy } = getCurrentInstance()!;
const $showMsg = proxy!.$showMsg as (title: string, icon?: 'success' | 'loading' | 'none') => void;

const store = useDramaStore();
const dramaFormRef = ref<InstanceType<typeof uniForms> | null>(null);

// 表单状态
const initialForm: Omit<Drama, 'id'> & { id: string | null } = {
  id: null,
  name: '',
  genre: '',
  synopsis: '',
  coverUrl: '',
  tags: [],
};
const dramaForm = reactive({ ...initialForm });
const isEditMode = ref(false);
const isSubmitting = ref(false);
const isGeneratingTags = ref(false);

// 标签管理状态
const currentTab = ref(0);
const newTagName = ref('');
const isAddingTag = ref(false);

// 切换 Tab
const onClickItem = (e: { currentIndex: number }) => {
  if (currentTab.value !== e.currentIndex) {
    currentTab.value = e.currentIndex;
  }
};

// 表单校验规则
const dramaRules = {
  name: { rules: [{ required: true, errorMessage: '戏剧名称不能为空' }] },
  synopsis: { rules: [{ required: true, errorMessage: '内容简介不能为空' }] },
};

onMounted(() => {
  store.loadDramas();
  store.loadTags();
  
  // 检查是否从首页跳转过来进行编辑
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options;
  if (options && options.id) {
      editDramaById(options.id);
  }
});

/**
 * 填充表单以进入编辑模式
 */
const editDrama = (drama: Drama) => {
  isEditMode.value = true;
  Object.assign(dramaForm, drama);
  // 滚动到顶部表单
  uni.pageScrollTo({
    scrollTop: 0,
    duration: 300,
  });
};

/**
 * 根据 ID 获取戏剧详情并填充表单
 */
const editDramaById = async (id: string) => {
  try {
    const drama = await api.fetchDramas(id); // 简单起见，利用查询接口
    if (drama && drama.length > 0) {
      editDrama(drama[0]);
    } else {
        $showMsg('未找到该戏剧', 'none');
    }
  } catch (error) {
    console.error('加载戏剧详情失败:', error);
    $showMsg('加载戏剧详情失败', 'none');
  }
};

/**
 * 取消编辑，重置表单
 */
const resetForm = () => {
  isEditMode.value = false;
  Object.assign(dramaForm, initialForm);
  dramaFormRef.value?.clearValidate();
};

/**
 * 切换标签选择状态
 */
const toggleTag = (tagName: string) => {
  const index = dramaForm.tags.indexOf(tagName);
  if (index > -1) {
    dramaForm.tags.splice(index, 1);
  } else {
    dramaForm.tags.push(tagName);
  }
};

/**
 * AI 自动打标签
 */
const handleGenerateTags = async () => {
  if (!dramaForm.synopsis) {
    $showMsg('请先填写内容简介', 'none');
    return;
  }
  isGeneratingTags.value = true;
  try {
    const generatedTags = await api.generateTags(dramaForm.synopsis);
    
    // 将 AI 生成的新标签添加到当前已选标签中（去重）
    const newTags = new Set([...dramaForm.tags, ...generatedTags]);
    dramaForm.tags = Array.from(newTags).filter(t => t.trim() !== '');

    $showMsg('AI 标签生成完毕', 'success');
  } catch (error) {
    console.error('AI 标签生成失败:', error);
    $showMsg('AI 标签生成失败', 'none');
  } finally {
    isGeneratingTags.value = false;
  }
};

/**
 * 提交表单 (新增或更新)
 */
const submitForm = async () => {
  try {
    await dramaFormRef.value?.validate();
    isSubmitting.value = true;

    const dramaData: Partial<Drama> = {
      name: dramaForm.name,
      genre: dramaForm.genre,
      synopsis: dramaForm.synopsis,
      coverUrl: dramaForm.coverUrl,
      tags: dramaForm.tags,
    };
    
    if (isEditMode.value && dramaForm.id) {
      await api.updateDrama(dramaForm.id, dramaData);
      $showMsg('修改成功', 'success');
    } else {
      // 检查必填项
      if (!dramaData.name || !dramaData.synopsis) {
          $showMsg('请填写必填项', 'none');
          return;
      }
      await api.createDrama(dramaData as any); // 类型断言，确保符合 Omit 后的结构
      $showMsg('新增成功', 'success');
    }

    // 成功后：重新加载数据，并重置表单
    await store.loadDramas();
    resetForm();

  } catch (error: any) {
    console.error('表单提交失败:', error);
    if (error.errMsg) {
      $showMsg(`提交失败: ${error.errMsg}`, 'none'); // uni-forms 验证失败
    } else if (error.message) {
      $showMsg(`提交失败: ${error.message}`, 'none'); // API 错误
    } else {
      $showMsg('提交失败，请检查输入', 'none');
    }
  } finally {
    isSubmitting.value = false;
  }
};

/**
 * 删除戏剧
 */
const deleteDrama = (drama: Drama) => {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除戏剧《${drama.name}》吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await api.deleteDrama(drama.id);
          await store.loadDramas();
          $showMsg('删除成功', 'success');
          
          // 如果删除的是当前正在编辑的项，则重置表单
          if (dramaForm.id === drama.id) {
              resetForm();
          }
          
        } catch (error: any) {
          console.error('删除失败:', error);
          $showMsg(`删除失败: ${error.message}`, 'none');
        }
      }
    }
  });
};


// --- 标签管理逻辑 ---

/**
 * 新增标签
 */
const handleAddTag = async () => {
    const tagName = newTagName.value.trim();
    if (!tagName) return;

    isAddingTag.value = true;
    try {
        await api.createTag(tagName);
        await store.loadTags();
        newTagName.value = '';
        $showMsg(`标签 "${tagName}" 新增成功`, 'success');
    } catch (error: any) {
        console.error('新增标签失败:', error);
        $showMsg(`新增失败: ${error.message}`, 'none');
    } finally {
        isAddingTag.value = false;
    }
};

/**
 * 删除标签
 */
const handleDeleteTag = (tag: Tag) => {
  uni.showModal({
    title: '确认删除标签',
    content: `确定要删除标签 "${tag.name}" 吗？删除后，关联的戏剧将失去该标签！`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await api.deleteTag(tag.id);
          await store.loadTags();
          $showMsg('标签删除成功', 'success');
        } catch (error: any) {
          console.error('删除标签失败:', error);
          $showMsg(`删除失败: ${error.message}`, 'none');
        }
      }
    }
  });
};
</script>

<style>
.container {
  padding: 10px;
  min-height: 100vh;
  background-color: #f8f8f8;
}
.drama-form-area, .tag-management-area {
    margin-top: 10px;
}
.button-group {
    display: flex;
    justify-content: space-between;
    padding-top: 10px;
}
.submit-btn {
    flex: 1;
    margin-right: 10px;
}
.ai-tag-section {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 0;
}
.ai-tag-btn {
    height: 35px;
    line-height: 35px;
    font-size: 14px;
    padding: 0 10px;
    white-space: nowrap;
    background-color: #e6a23c; /* 警告色用于AI */
    color: white;
}
.ai-tag-tip {
    font-size: 12px;
    color: #999;
}
.tag-selection {
    display: flex;
    flex-wrap: wrap;
    padding: 5px 0;
}
.tag-item {
    padding: 5px 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    margin: 5px;
    font-size: 14px;
    cursor: pointer;
    background-color: #fff;
}
.tag-selected {
    background-color: #409eff;
    color: white;
    border-color: #409eff;
}
.current-tags-tip {
    font-size: 12px;
    color: #666;
    margin-top: 5px;
    padding: 0 5px;
}

/* 列表样式 */
.item-actions {
    display: flex;
    align-items: center;
}
.action-btn {
    font-size: 12px;
    height: 30px;
    line-height: 30px;
    padding: 0 8px;
    margin-left: 5px;
    border-radius: 4px;
    white-space: nowrap;
}
.action-btn.edit {
    background-color: #67c23a;
    color: white;
}
.action-btn.delete {
    background-color: #f56c6c;
    color: white;
}
.empty-list-tip {
    text-align: center;
    padding: 20px 0;
    color: #999;
    font-size: 14px;
}

/* 标签管理区域样式 */
.add-tag-form {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 15px;
}
.tag-list-display {
    padding: 10px 0;
    border-top: 1px solid #eee;
}
.tag-count-title {
    font-weight: bold;
    display: block;
    margin-bottom: 10px;
}
.tag-list-box {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.tag-pill {
    display: flex;
    align-items: center;
    background-color: #409eff;
    color: white;
    border-radius: 15px;
    padding: 4px 10px;
    font-size: 13px;
    white-space: nowrap;
}
.delete-icon {
    margin-left: 5px;
}
</style>