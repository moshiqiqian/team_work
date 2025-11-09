#  戏剧管理系统 (Drama Management System)



##  项目简介



本项目是一个基于前后端分离的戏剧内容管理平台。前端采用 uni-app + Vue 3 + Pinia，实现一套代码多端运行（H5、微信小程序、App）；后端采用 Node.js + TypeScript + Express，提供 RESTful API 服务，并集成了 Gemini AI 能力，实现标签自动生成和智能搜索联想。



## 主要功能



- **戏剧 CRUD 管理：** 完整的戏剧信息（名称、流派、简介、封面 URL）的创建、读取、更新和删除。
- **标签管理：** 维护所有可用的戏剧标签，并与戏剧进行多对多关联。
- **智能标签生成 (AI)：** 后端调用 Gemini API，根据戏剧简介自动推荐 3-5 个相关标签。
- **搜索联想推荐 (AI)：** 根据用户搜索结果，AI 智能推荐相关的戏剧名称，增强用户体验。
- **跨平台支持：** 前端代码支持打包为 H5、微信小程序或 iOS/Android App。



##  技术栈



| **模块**            | **技术**              | **描述**                                           |
| ------------------- | --------------------- | -------------------------------------------------- |
| **前端 (uniapp/)**  | **uni-app / Vue 3**   | 跨平台应用框架，使用 Composition API。             |
|                     | **Pinia**             | 官方推荐的状态管理库，用于管理全局状态和业务逻辑。 |
|                     | **uni-ui**            | uni-app 官方 UI 组件库。                           |
| **后端 (backend/)** | **Node.js / Express** | 后端服务运行时和框架。                             |
|                     | **TypeScript**        | 提供静态类型检查，增强代码健壮性。                 |
|                     | **axios**             | 用于向 Gemini API 发送 HTTP 请求。                 |
| **数据库**          | **MySQL**             | 关系型数据库，用于持久化存储戏剧和标签数据。       |
| **AI 集成**         | **Google Gemini API** | 提供强大的内容生成能力。                           |



##  环境准备



在开始项目之前，请确保您的环境中安装了以下软件：

1. **Node.js** (推荐 v18 或更高版本)
2. **MySQL 数据库** (已安装并运行)
3. **代理工具：** 由于国内网络环境限制，需使用 SOCKS/HTTP 代理工具（如 Clash），并确保其在 `127.0.0.1:7897` 端口运行。

------



##  项目启动指南

### 步骤 1: 数据库设置



1. **连接数据库：** 使用 MySQL 客户端连接到您的 MySQL 服务。

2. **创建数据库和表：** 执行 `sql/schema.sql` 文件中的所有 SQL 语句。

3. **配置后端连接：** 检查 `backend/server.ts` 文件中的 `dbConfig` 部分，确保用户名和密码与您的 MySQL 配置一致。



### 步骤 2: 后端服务启动



1. **进入后端目录并安装依赖：**

   Bash

   ```
   cd backend
   npm install
   # 确保安装了代理所需的库
   npm install socks-proxy-agent
   ```

2. 配置 Gemini API Key：

   在 backend/server.ts 中找到以下行，并替换为您的实际 Key：

   TypeScript

   ```
   const GEMINI_API_KEY = ""; // 替换为您的 Key
   ```

3. **启动后端服务：**

   Bash

   ```
   npx ts-node server.ts
   ```

   如果成功，您将看到：

   🚀 后端服务器已在 http://localhost:3000 启动

   (注意：此时您的 SOCKS 代理必须在 7897 端口运行，否则 AI 接口将无法访问)



### 步骤 3: 前端应用启动



1. **进入前端目录并安装依赖：**

   Bash

   ```
   cd uniapp
   npm install
   ```

3. 启动前端项目：

   - **H5 模式 (推荐快速预览)：**

     Bash

     ```
     npm run dev:h5
     ```



##  项目结构概览



```
.
├── backend/                  # 后端服务
│   ├── server.ts             # 主服务文件 (Express, MySQL, Gemini, 代理配置)
│   └── package.json          # 后端依赖 (express, axios, mysql2, socks-proxy-agent)
├── sql/
│   └── schema.sql            # 数据库表结构定义文件
└── uniapp/                   # uni-app 前端项目
    ├── src/
    │   ├── pages/            # 页面视图文件
    │   ├── store/            # Pinia 状态管理模块 (待创建)
    │   ├── main.ts           # 应用入口，初始化 Vue 和 Pinia
    │   └── ...
    └── package.json          # 前端依赖 (vue, pinia, uni-ui)
```