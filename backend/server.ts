// 导入必要的库
import express from 'express';
import type { Request, Response } from 'express'; // 修复：使用 import type 导入 Express 类型
import cors from 'cors';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
// 引入 mysql2 的 Promise 接口，用于异步操作
import mysql from 'mysql2/promise';
import type { Pool, RowDataPacket } from 'mysql2/promise';

// --- 代理配置 (使用您 Clash 的 7897 端口) ---
// 依赖：请确保已运行 npm install socks-proxy-agent
import { SocksProxyAgent } from 'socks-proxy-agent'; 
// 关键修复：协议从 'http://' 改为 'socks://'
const CLASH_PROXY = 'socks://127.0.0.1:7897'; 
const agent = new SocksProxyAgent(CLASH_PROXY); 
// ----------------------------------------


// --- 配置信息 ---
// 【已根据用户要求修改为硬编码Key，请注意在生产环境中始终使用环境变量！】
const GEMINI_API_KEY = "AIzaSyBeGMxrP4RDWd0y5uARxocdLeL2AJ71WUQ";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";
const PORT = 3000;

// MySQL 数据库配置 (请根据您的环境修改！)
const dbConfig = {
    host: 'localhost',
    user: 'root', // 您的 MySQL 用户名
    password: '', // 您的 MySQL 密码
    database: 'drama_management_db', // 数据库名称
};

// 创建数据库连接池
let pool: Pool;

try {
    pool = mysql.createPool(dbConfig);
    console.log("MySQL 连接池已创建.");
} catch (error) {
    console.error("创建 MySQL 连接池失败，请检查配置和 MySQL 服务是否运行:", error);
    process.exit(1); // 如果无法连接，终止应用
}

// --- 数据接口定义 ---
interface DramaBase {
    id: string;
    name: string;
    genre: string;
    synopsis: string;
    coverUrl: string;
}

interface Drama extends DramaBase {
    tags: string[];
}

interface Tag {
    id: number;
    name: string;
}

// --- Express 应用初始化 ---
const app = express();
app.use(cors());
app.use(express.json());

// --- 辅助函数：调用 Gemini API (文本处理) ---
async function callGeminiApi(systemInstruction: string, userPrompt: string): Promise<string> {
    if (!GEMINI_API_KEY) {
        console.error("Gemini API Key is missing.");
        return "无法调用AI服务：缺少API Key";
    }

    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    generated_content: {
                        type: "STRING",
                        description: "The requested output, such as a comma-separated list of tags or suggested drama names."
                    }
                }
            }
        }
    };

    let lastError: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await axios.post(
                `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
                payload,
                { 
                    headers: { 'Content-Type': 'application/json' },
                    // --- 关键配置：增加超时和代理 ---
                    timeout: 30000, // 30秒超时
                    httpAgent: agent,
                    httpsAgent: agent,
                    // ------------------------------------
                }
            );

            const resultText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (resultText) {
                const parsed = JSON.parse(resultText);
                return parsed.generated_content || "";
            }
            return "";

        } catch (error) {
            lastError = error;
            
            // 详细打印错误信息
            console.error(`Gemini API调用失败 (尝试 ${attempt + 1}/3):`, 
                (axios.isAxiosError(error) && (error.code === 'ETIMEDOUT' || error.message.includes('timeout'))) ? '网络连接超时 (ETIMEDOUT)，请检查 Clash 状态' : 
                (axios.isAxiosError(error) && error.response) ? `API错误 ${error.response.status}` : 
                '未知错误');

            if (attempt === 2) break; // 最后一次尝试不等待
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    console.error("Gemini API调用失败，重试后仍然失败:", lastError);
    return "AI服务调用失败，请检查API Key、代理设置和网络连接。";
}

// --- 数据库辅助函数 ---

async function getAllTagNames(): Promise<string[]> {
    const [rows] = await pool.query<RowDataPacket[]>("SELECT name FROM tags");
    return rows.map(row => row.name);
}

async function getTagIdByName(name: string): Promise<number | null> {
    const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM tags WHERE name = ?", [name]);
    return rows.length > 0 ? rows[0].id : null;
}

async function getTagsByDramaId(dramaId: string): Promise<string[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT t.name FROM tags t JOIN drama_tags dt ON t.id = dt.tag_id WHERE dt.drama_id = ?",
        [dramaId]
    );
    return rows.map(row => row.name);
}

async function processDramaResults(dramaRows: DramaBase[]): Promise<Drama[]> {
    const dramasWithTags: Drama[] = [];
    for (const drama of dramaRows) {
        const tags = await getTagsByDramaId(drama.id);
        dramasWithTags.push({ ...drama, tags });
    }
    return dramasWithTags;
}


// =================================================================
// --- 戏剧管理 (Drama CRUD) 接口 ---
// =================================================================

// GET /api/dramas - 获取所有戏剧或根据关键词搜索
app.get('/api/dramas', async (req: Request, res: Response) => {
    try {
        const query = (req.query.q as string || '').toLowerCase();
        
        let sql: string;
        let params: (string | number)[] = [];
        
        if (query) {
            sql = `
                SELECT DISTINCT d.* FROM dramas d
                LEFT JOIN drama_tags dt ON d.id = dt.drama_id
                LEFT JOIN tags t ON dt.tag_id = t.id
                WHERE d.name LIKE ? OR d.genre LIKE ? OR t.name LIKE ?
            `;
            const likeQuery = `%${query}%`;
            params = [likeQuery, likeQuery, likeQuery];
        } else {
            sql = "SELECT * FROM dramas ORDER BY createdAt DESC";
        }

        const [dramaRows] = await pool.query<RowDataPacket[]>(sql, params);
        
        const dramas = await processDramaResults(dramaRows as DramaBase[]);
        res.json(dramas);
    } catch (error) {
        console.error("获取戏剧列表失败:", error);
        res.status(500).json({ message: '获取数据失败' });
    }
});

// GET /api/dramas/:id - 获取单个戏剧
app.get('/api/dramas/:id', async (req: Request, res: Response) => {
    try {
        const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM dramas WHERE id = ?", [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: '戏剧未找到' });
        }
        const drama = rows[0] as DramaBase;
        const tags = await getTagsByDramaId(drama.id);
        res.json({ ...drama, tags });
    } catch (error) {
        console.error("获取单个戏剧失败:", error);
        res.status(500).json({ message: '获取数据失败' });
    }
});

// POST /api/dramas - 新增戏剧 (使用事务)
app.post('/api/dramas', async (req: Request, res: Response) => {
    const { name, genre, synopsis, coverUrl, tags: dramaTags } = req.body;
    if (!name || !synopsis) {
        return res.status(400).json({ message: '戏剧名称和简介不能为空' });
    }
    
    const newId = uuidv4();
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. 插入戏剧基本信息
        const insertDramaSql = "INSERT INTO dramas (id, name, genre, synopsis, coverUrl) VALUES (?, ?, ?, ?, ?)";
        await connection.query(insertDramaSql, [newId, name, genre || null, synopsis, coverUrl || null]);

        // 2. 插入标签关联
        if (dramaTags && dramaTags.length > 0) {
            for (const tagName of dramaTags) {
                const tagId = await getTagIdByName(tagName);

                if (tagId) {
                    await connection.query("INSERT INTO drama_tags (drama_id, tag_id) VALUES (?, ?)", [newId, tagId]);
                } else {
                    console.warn(`标签 "${tagName}" 不存在于 tags 表中，跳过关联。`);
                }
            }
        }

        await connection.commit();
        const tags = await getTagsByDramaId(newId);
        res.status(201).json({ id: newId, name, genre, synopsis, coverUrl, tags });

    } catch (error) {
        await connection.rollback();
        console.error("新增戏剧失败:", error);
        res.status(500).json({ message: '新增戏剧失败' });
    } finally {
        connection.release();
    }
});

// PUT /api/dramas/:id - 更新戏剧 (使用事务)
app.put('/api/dramas/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, genre, synopsis, coverUrl, tags: dramaTags } = req.body;
    
    if (!name || !synopsis) {
        return res.status(400).json({ message: '戏剧名称和简介不能为空' });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. 更新戏剧基本信息
        const updateDramaSql = "UPDATE dramas SET name=?, genre=?, synopsis=?, coverUrl=? WHERE id=?";
        const [updateResult] = await connection.query(updateDramaSql, [name, genre || null, synopsis, coverUrl || null, id]);

        if ('affectedRows' in updateResult && updateResult.affectedRows === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ message: '戏剧未找到' });
        }

        // 2. 删除旧的标签关联
        await connection.query("DELETE FROM drama_tags WHERE drama_id = ?", [id]);

        // 3. 插入新的标签关联
        if (dramaTags && dramaTags.length > 0) {
            for (const tagName of dramaTags) {
                const tagId = await getTagIdByName(tagName);
                if (tagId) {
                    await connection.query("INSERT INTO drama_tags (drama_id, tag_id) VALUES (?, ?)", [id, tagId]);
                } else {
                     console.warn(`标签 "${tagName}" 不存在于 tags 表中，跳过关联。`);
                }
            }
        }

        await connection.commit();
        const updatedTags = await getTagsByDramaId(id);
        res.json({ id, name, genre, synopsis, coverUrl, tags: updatedTags });

    } catch (error) {
        await connection.rollback();
        console.error("更新戏剧失败:", error);
        res.status(500).json({ message: '更新戏剧失败' });
    } finally {
        connection.release();
    }
});

// DELETE /api/dramas/:id - 删除戏剧
app.delete('/api/dramas/:id', async (req: Request, res: Response) => {
    try {
        const [result] = await pool.query("DELETE FROM dramas WHERE id = ?", [req.params.id]);

        if ('affectedRows' in result && result.affectedRows > 0) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: '戏剧未找到' });
        }
    } catch (error) {
        console.error("删除戏剧失败:", error);
        res.status(500).json({ message: '删除失败' });
    }
});


// =================================================================
// --- 标签管理 (Tag CRUD) 接口 ---
// =================================================================

// GET /api/tags - 获取所有标签
app.get('/api/tags', async (req: Request, res: Response) => {
    try {
        const [rows] = await pool.query("SELECT id, name FROM tags ORDER BY name");
        res.json(rows);
    } catch (error) {
        console.error("获取标签失败:", error);
        res.status(500).json({ message: '获取标签失败' });
    }
});

// POST /api/tags - 新增标签
app.post('/api/tags', async (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') return res.status(400).json({ message: '标签名称不能为空' });

    try {
        const [result] = await pool.query("INSERT INTO tags (name) VALUES (?)", [name.trim()]);
        const insertId = 'insertId' in result ? result.insertId : null;
        res.status(201).json({ id: insertId, name: name.trim() });
    } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: '标签已存在' });
        }
        console.error("新增标签失败:", error);
        res.status(500).json({ message: '新增标签失败' });
    }
});

// DELETE /api/tags/:id - 删除标签
app.delete('/api/tags/:id', async (req: Request, res: Response) => {
    const tagId = parseInt(req.params.id, 10);
    if (isNaN(tagId)) {
        return res.status(400).json({ message: '无效的标签ID' });
    }
    
    try {
        const [result] = await pool.query("DELETE FROM tags WHERE id = ?", [tagId]);

        if ('affectedRows' in result && result.affectedRows > 0) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: '标签未找到' });
        }
    } catch (error) {
        console.error("删除标签失败:", error);
        res.status(500).json({ message: '删除失败' });
    }
});


// =================================================================
// --- AI 赋能接口 (Gemini Integration) ---
// =================================================================

/**
 * POST /api/ai/tag-generation
 * 功能：根据简介和现有标签，AI自动打标签 (纯文本处理)
 */
app.post('/api/ai/tag-generation', async (req: Request, res: Response) => {
    const { synopsis } = req.body;
    
    if (!synopsis) {
        return res.status(400).json({ message: "缺少戏剧简介 (synopsis)！" });
    }

    const availableTags = await getAllTagNames();
    const availableTagsString = availableTags.join(', ');

    const systemInstruction = `你是一个专业的戏剧内容分析师。你的任务是根据提供的戏剧简介，从给定的可用标签列表中，或基于简介生成全新的标签，推荐3到5个最相关的关键词。请以逗号分隔的字符串形式返回这些关键词。`;
    
    const userPrompt = `戏剧简介是: "${synopsis}"。当前可用的标签列表是: [${availableTagsString}]。请生成3-5个最相关的标签。`;

    const generatedTagsString = await callGeminiApi(systemInstruction, userPrompt);
    
    const generatedTags = generatedTagsString.split(',').map(tag => tag.trim()).filter(tag => tag);

    res.json({ generatedTags });
});

/**
 * POST /api/ai/search-suggest
 * 功能：根据搜索结果和用户输入，AI生成联想推荐 (纯文本处理)
 */
app.post('/api/ai/search-suggest', async (req: Request, res: Response) => {
    const { query, searchResults } = req.body;

    if (!query) {
        return res.status(400).json({ message: "缺少原始查询词 (query)！" });
    }

    const resultNames = (searchResults as Drama[]).map(d => d.name).join(', ');
    
    const systemInstruction = `你是一个专业的戏剧推荐引擎。你的任务是根据用户输入的搜索词和已经找到的结果，推荐3个与它们高度相关但未被列出的戏剧名称。请以逗号分隔的字符串形式返回这3个推荐的戏剧名称。`;
    
    const userPrompt = `用户搜索词是: "${query}"。已经搜索到的相关戏剧名称有: [${resultNames}]。请给出3个用户可能感兴趣的联想推荐戏剧名称。`;

    const suggestedDramasString = await callGeminiApi(systemInstruction, userPrompt);
    
    const suggestedDramas = suggestedDramasString.split(',').map(d => d.trim()).filter(d => d);

    res.json({ suggestedDramas });
});


// --- 启动服务器 ---
app.listen(PORT, () => {
    console.log(`🚀 后端服务器已在 http://localhost:${PORT} 启动`);
    console.log("请确保 MySQL 服务运行，并已创建数据库和表结构！");
});