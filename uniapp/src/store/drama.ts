// uniapp/src/store/drama.ts

import { defineStore } from 'pinia';
import * as api from '../api/drama';
import type { Drama, Tag } from '../api/drama';

// 全局状态管理
export const useDramaStore = defineStore('drama', {
    state: () => ({
        dramas: [] as Drama[],
        tags: [] as Tag[],
        loading: false,
        error: null as string | null,
        suggestedDramas: [] as string[], // 用于 AI 推荐
    }),
    
    getters: {
        // 将 Tag 数组转换为 Map，方便通过名称查找 ID
        tagMapByName: (state) => {
            return new Map(state.tags.map(tag => [tag.name, tag.id]));
        },
    },

    actions: {
        // 1. 获取所有戏剧
        async loadDramas(query?: string) {
            this.loading = true;
            this.error = null;
            try {
                this.dramas = await api.fetchDramas(query);
            } catch (err: any) {
                this.error = err.message;
                uni.showToast({ title: '加载戏剧失败', icon: 'none' });
            } finally {
                this.loading = false;
            }
        },

        // 2. 获取所有标签
        async loadTags() {
            try {
                this.tags = await api.fetchTags();
            } catch (err: any) {
                uni.showToast({ title: '加载标签失败', icon: 'none' });
            }
        },

        // 3. AI 搜索联想
        async runSearchSuggest(query: string, searchResults: Drama[]) {
            if (!query) {
                this.suggestedDramas = [];
                return;
            }
            try {
                this.suggestedDramas = await api.searchSuggest(query, searchResults);
            } catch (err: any) {
                // 推荐失败不影响主流程
                console.error("AI 联想失败:", err);
                this.suggestedDramas = ['AI 推荐服务暂时不可用'];
            }
        },
        
        // 4. 清除 AI 推荐
        clearSuggestions() {
            this.suggestedDramas = [];
        }
    }
});