// uniapp/src/api/drama.ts

// 【关键修正】：使用 declare const uni: any; 声明全局 uni 对象，
// 这是解决编辑器中对全局对象（如 uni）报错的最简单稳定方法，同时避免了模块冲突。
declare const uni: any; 

// 接口定义（与后端结构保持一致）
export interface Drama {
    id: string;
    name: string;
    genre: string;
    synopsis: string;
    coverUrl: string;
    tags: string[]; // 标签名称数组
}

export interface Tag {
    id: number;
    name: string;
}

const BASE_URL = 'http://localhost:3000/api'; // 后端服务地址

/**
 * 统一的请求函数
 * 注意：由于使用了 declare const uni: any;，这里我们只保留了 uni.request 所需的参数类型，
 * 以便在 IDE 中正确提示，同时保证运行时稳定。
 * @param url API路径
 * @param options uni.request配置
 * @returns Promise<T>
 */
async function request<T>(url: string, options: any = {}): Promise<T> {
    const defaultHeaders = { 'Content-Type': 'application/json' };
    
    return new Promise((resolve, reject) => {
        // 使用声明的 uni.request 发起请求
        uni.request({
            url: BASE_URL + url,
            method: options.method || 'GET',
            data: options.data,
            header: { ...defaultHeaders, ...options.header },
            success: (res: any) => { 
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    // 假设后端返回的数据结构就是 T
                    resolve(res.data as T);
                } else {
                    const errMsg = res.data?.message || '未知错误';
                    reject(new Error(`请求失败: ${res.statusCode} - ${errMsg}`));
                }
            },
            fail: (err: any) => {
                reject(new Error(`网络请求错误: ${err.errMsg}`));
            }
        });
    });
}

// --- 戏剧 CRUD API ---

export async function fetchDramas(query?: string): Promise<Drama[]> {
    const url = query ? `/dramas?q=${encodeURIComponent(query)}` : '/dramas';
    return request<Drama[]>(url);
}

/**
 * 根据ID获取单个戏剧的详情
 */
export async function fetchDramaById(id: string): Promise<Drama> {
    return request<Drama>(`/dramas/${id}`); 
}

export async function createDrama(drama: Omit<Drama, 'id' | 'tags'> & { tags: string[] }): Promise<Drama> {
    return request<Drama>('/dramas', { method: 'POST', data: drama });
}

export async function updateDrama(id: string, drama: Partial<Drama>): Promise<Drama> {
    return request<Drama>(`/dramas/${id}`, { method: 'PUT', data: drama });
}

export async function deleteDrama(id: string): Promise<void> {
    return request<void>(`/dramas/${id}`, { method: 'DELETE' });
}

// --- 标签 CRUD API ---

export async function fetchTags(): Promise<Tag[]> {
    return request<Tag[]>('/tags');
}

export async function createTag(name: string): Promise<Tag> {
    return request<Tag>('/tags', { method: 'POST', data: { name } });
}

export async function deleteTag(id: number): Promise<void> {
    return request<void>(`/tags/${id}`, { method: 'DELETE' });
}

// --- AI API ---

export async function generateTags(synopsis: string): Promise<string[]> {
    const res = await request<{ generatedTags: string[] }>('/ai/tag-generation', { 
        method: 'POST', 
        data: { synopsis } 
    });
    return res.generatedTags;
}

export async function searchSuggest(query: string, searchResults: Drama[]): Promise<string[]> {
    const res = await request<{ suggestedDramas: string[] }>('/ai/search-suggest', { 
        method: 'POST', 
        data: { query, searchResults } 
    });
    return res.suggestedDramas;
}