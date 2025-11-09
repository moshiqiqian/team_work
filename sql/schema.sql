-- --------------------------------------------------------
-- 1. 数据库创建和选择
-- --------------------------------------------------------

-- 创建数据库 (如果不存在)，并设置 UTF-8 编码以支持中文和其他字符
CREATE DATABASE IF NOT EXISTS drama_management_db
DEFAULT CHARACTER SET utf8mb4 
DEFAULT COLLATE utf8mb4_unicode_ci;

-- 切换到新创建的数据库，确保后续的 CREATE TABLE 命令在该数据库中执行
USE drama_management_db;

-- --------------------------------------------------------
-- 2. 戏剧管理系统表结构
-- --------------------------------------------------------

-- 1. 戏剧表 (Dramas)
-- 存储所有戏剧的基本信息
CREATE TABLE IF NOT EXISTS dramas (
    -- 使用CHAR(36)存储UUID，保证唯一性，对应 Node.js 中的 uuidv4()
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT '戏剧名称',
    genre VARCHAR(100) COMMENT '戏剧流派',
    synopsis TEXT COMMENT '内容简介',
    coverUrl VARCHAR(255) COMMENT '封面图片URL',
    -- 记录创建时间，自动设置为当前时间
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- 记录更新时间，每次更新时自动更改
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. 标签表 (Tags)
-- 存储所有可用的标签
CREATE TABLE IF NOT EXISTS tags (
    -- 使用自增ID作为主键
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE COMMENT '标签名称'
);

-- 3. 戏剧-标签关联表 (Drama_Tags)
-- 用于实现戏剧和标签之间的多对多关系
CREATE TABLE IF NOT EXISTS drama_tags (
    drama_id CHAR(36) NOT NULL COMMENT '戏剧ID (外键)',
    tag_id INT NOT NULL COMMENT '标签ID (外键)',
    PRIMARY KEY (drama_id, tag_id), -- 联合主键，确保一个戏剧/标签组合只存在一次

    -- 外键约束：如果戏剧被删除，对应的关联记录也删除 (CASCADE)
    FOREIGN KEY (drama_id) REFERENCES dramas(id) ON DELETE CASCADE,
    -- 外键约束：如果标签被删除，对应的关联记录也删除 (CASCADE)
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);