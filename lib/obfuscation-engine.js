const path = require('path');
const fs = require('fs-extra');
const versionJson = require('../public/version.json'); // 引入 version.json 文件
const HtmlObfuscator = require('./core/html-obfuscator');
const CssObfuscator = require('./core/css-obfuscator');
const JsObfuscator = require('./core/js-obfuscator');
const FileStructureObfuscator = require('./core/file-structure-obfuscator'); // 添加文件结构混淆器
const KeywordObfuscator = require('./core/keyword-obfuscator'); // 添加关键词混淆器
const SentenceObfuscator = require('./core/sentence-obfuscator'); // 添加句子混淆器
const BackupManager = require('./utils/backup-manager');
const MappingManager = require('./utils/mapping-manager'); // 添加映射管理器
const RandomUtils = require('./utils/random-utils'); // 添加随机工具
const { walkDir } = require('./utils/file-utils');
const sh = require('shorthash');
const cheerio = require('cheerio');
const { MAX_SAFE_STRING_LENGTH, WARNING_SIZE } = require('./utils/const');

class ObfuscationEngine {
    constructor(options = {}) {
        // 调试输出：显示传入的参数
        console.log('🔧 ObfuscationEngine 构造参数:', JSON.stringify(options, null, 2));
        
        // targetDir 是必需的，其他参数都是可选的
        const { 
            targetDir, 
            outputDir = '.', 
            outCount = 1, 
            keywordObfuscationRate = 0.4, 
            enableKeywordObfuscation = false,
            sentenceObfuscationRate = 0.6,
            enableSentenceObfuscation = false,
            enhancedHtmlObfuscation = true,
            protectThirdParty = true,
            structureObfuscationLevel = 'medium' // 修正：HTML结构混淆级别
        } = options;
        this.targetDir = targetDir;
        this.outputDir = outputDir === '.' ? path.dirname(targetDir) : outputDir; // 如果输出目录是当前目录，则使用目标目录的父目录
        this.outCount = outCount; // 混淆结果数量

        this.options = {
            version: versionJson?.version || 'v1.0', // 获取当前版本号
            targetDir,
            outputDir,
            outCount,
            keywordObfuscationRate,
            enableKeywordObfuscation,
            sentenceObfuscationRate,
            enableSentenceObfuscation,
            enhancedHtmlObfuscation,
            protectThirdParty,
            structureObfuscationLevel, // 新增：文件结构混淆级别
            ...options
        };

        this.mappingManager = new MappingManager(); // 使用新的映射管理器
        this.fileStructureObfuscator = new FileStructureObfuscator(this.mappingManager); // 初始化文件结构混淆器

        // 初始化关键词混淆器
        if (enableKeywordObfuscation) {
            this.keywordObfuscator = new KeywordObfuscator();
            // 设置关键词混淆率
            this.keywordObfuscator.setObfuscationRate(keywordObfuscationRate);
            console.log(`🔤 关键词混淆已启用，混淆率: ${(keywordObfuscationRate * 100).toFixed(1)}%`);
        }

        // 初始化句子混淆器
        if (enableSentenceObfuscation) {
            this.sentenceObfuscator = new SentenceObfuscator();
            // 设置句子混淆率
            this.sentenceObfuscator.setObfuscationRate(sentenceObfuscationRate);
            console.log(`📝 句子混淆已启用，混淆率: ${(sentenceObfuscationRate * 100).toFixed(1)}%`);
        }

        // 生成随机混淆标记，确保同一次运行的一致性
        this.htmlMarker = RandomUtils.randomHtmlComment();
        this.codeMarker = RandomUtils.randomCodeComment();

        // 为了向后兼容，保留原有的 mapping 对象结构
        this.mapping = {
            globals: this.mappingManager.mappings.globals,
            classes: this.mappingManager.mappings.classes,    // 启用CSS类名混淆
            ids: this.mappingManager.mappings.ids,            // 启用CSS ID混淆
            classSelectors: new Map(),
            idSelectors: new Map(),
            complexSelectors: new Map()
        };
    }

    async run() {
        // 调试输出：显示混淆配置
        console.log('🔧 混淆配置信息:');
        console.log(`   关键词混淆: ${this.options.enableKeywordObfuscation ? '启用' : '禁用'}`);
        console.log(`   句子混淆: ${this.options.enableSentenceObfuscation ? '启用' : '禁用'}`);
        console.log(`   增强HTML混淆: ${this.options.enhancedHtmlObfuscation ? '启用' : '禁用'}`);
        console.log(`   CSS混淆: ${this.options.enableCssObfuscation ? '启用' : '禁用'}`);
        console.log(`   保持格式: ${this.options.preserveFormat ? '启用' : '禁用'}`);
        console.log(`   第三方保护: ${this.options.protectThirdParty ? '启用' : '禁用'}`);
        console.log(`   结构混淆级别: ${this.options.structureObfuscationLevel || 'medium'}`);
        
        // 进行源码备份和copy
        const backupManager = new BackupManager(this.options);
        const { isFirstRun } = await backupManager.prepare();
        this.workDirs = backupManager.workDirs; // 获取新的工作目录路径

        // 1. 收集全局映射关系
        // await this.collectMappings();

        // 1. 加载关键词（如果启用了关键词混淆）
        if (this.options.enableKeywordObfuscation) {
            console.log('🔤 加载关键词词典...');
            await this.keywordObfuscator.loadKeywords();
        } else {
            console.log('⏭️ 跳过关键词混淆（已禁用）');
        }

        // 这里一定要使用for 而不是 map + Promise.all, 要不顺序不对，影响混淆效果
        const len = this.workDirs.length;
        for (let i = 0; i < len; i++) {
            const workDir = this.workDirs[i];
            const count = i + 1;
            try {
                // 2. 静态资源随机化处理
                console.log(`🔄 开始执行第【${count}】次静态资源随机化处理...`);
                await this.fileStructureObfuscator.process(workDir);


                // 3. 执行混淆
                await this.processFiles(workDir);


                console.log(`🔄 开始执行第【${count}】次映射关系到文件...`);
                // 4. 保存映射关系到文件（可选，用于调试）
                const mappingFilePath = path.join(path.dirname(this.targetDir), `obfuscation-mapping_${path.basename(workDir)}.json`);
                await this.mappingManager.saveToFile(mappingFilePath);

                console.log(`🔄 开始执行第【${count}】次输出统计信息...`);
                // 5. 输出统计信息
                const stats = this.mappingManager.getStats();
                console.log(`📊 当前执行第【${count}】次混淆统计信息:`, stats);

            } catch (error) {
                console.error(`❌当前执行第【${count}】次混淆流程时失败:`, error.message);
                // throw error; // 如果需要在失败时就终止抛出异常可以放开注释
            }
        }

        console.log(`🎉 当前执行的【${this.outCount}】次混淆流程均已完成! ${isFirstRun ? '首次' : '后续'} 运行`);
    }

    async collectMappings() {
        console.log('🔍 开始收集全局映射关系...');

        // 扫描所有文件建立映射关系
        const files = await walkDir(this.workDir[0]);

        for (const file of files) {
            const ext = path.extname(file);

            // 保持原有逻辑：只对 JS 和 TS 文件收集全局变量映射
            if (['.js', '.ts', '.tsx'].includes(ext)) {
                try {
                    await JsObfuscator.collectMappings(file, this.mapping);
                } catch (error) {
                    console.warn(`⚠️ 收集映射失败 ${file}: ${error.message}`);
                }
            }
        }

        console.log('✅ 全局映射关系收集完成');
    }

    async processFiles(workDir) {
        console.log('🚀 开始处理文件混淆...');

        const files = await walkDir(workDir);

        // 第一步：收集所有HTML和CSS文件的类名和ID映射
        if (this.options.enableCssObfuscation) {
            console.log('📋 收集CSS类名和ID映射...');
            for (const file of files) {
                const ext = path.extname(file);
                
                if (ext === '.html' || ext === '.htm') {
                    try {
                        await HtmlObfuscator.collectMappings(file, this.mapping, {
                            protectThirdParty: this.options.protectThirdParty
                        });
                    } catch (error) {
                        console.warn(`⚠️ 收集HTML映射失败 ${file}: ${error.message}`);
                    }
                } else if (ext === '.css') {
                    try {
                        await CssObfuscator.collectMappings(file, this.mapping, {
                            protectThirdParty: this.options.protectThirdParty
                        });
                    } catch (error) {
                        console.warn(`⚠️ 收集CSS映射失败 ${file}: ${error.message}`);
                    }
                }
            }
        } else {
            console.log('⏭️ 跳过CSS类名和ID映射收集（CSS混淆已禁用）');
        }

        // 第二步：处理所有文件
        for (const file of files) {
            const ext = path.extname(file);

            // 只处理文本文件，跳过二进制文件
            if (!['.html', '.htm', '.css', '.js'].includes(ext)) {
                // console.log(`🔒 跳过二进制文件: ${path.relative(workDir, file)}`);
                continue;
            }

            const stats = await fs.stat(file);

            // 检查文件大小
            if (stats.size > MAX_SAFE_STRING_LENGTH) {
                console.warn(`🚫 Skipping large file (${(stats.size / 1024 / 1024).toFixed(2)}MB): ${file}`);
                continue;
            } else if (stats.size > WARNING_SIZE) {
                console.warn(`⚠️ Processing large file (${(stats.size / 1024).toFixed(2)}KB): ${file}`);
            }

            let content = await fs.readFile(file, 'utf8');

            if (this.isAlreadyObfuscated(content)) {
                console.log(`⏭️ Skipping already obfuscated: ${file}`);
                continue;
            }

            try {
                if (ext === '.html' || ext === '.htm') {
                    // 根据配置决定是否使用增强的HTML混淆
                    const htmlOptions = {
                        enhancedObfuscation: this.options.enhancedHtmlObfuscation,
                        htmlEntityEncoding: this.options.enhancedHtmlObfuscation,
                        structureObfuscation: this.options.enhancedHtmlObfuscation,
                        attributeObfuscation: this.options.enhancedHtmlObfuscation,
                        tagObfuscation: this.options.enhancedHtmlObfuscation,
                        domShuffle: this.options.enhancedHtmlObfuscation,
                        fakeComments: this.options.enhancedHtmlObfuscation,
                        randomWhitespace: this.options.enhancedHtmlObfuscation,
                        enableCssObfuscation: this.options.enableCssObfuscation,
                        preserveFormat: this.options.preserveFormat,
                        structureObfuscationLevel: this.options.structureObfuscationLevel
                    };
                    
                    content = await HtmlObfuscator.obfuscate(content, this.mapping, htmlOptions);

                    // 应用关键词混淆（如果启用）
                    if (this.options.enableKeywordObfuscation && this.keywordObfuscator) {
                        content = this.keywordObfuscator.obfuscateKeywords(content);
                    }

                    // 应用句子混淆（如果启用）- 在关键词混淆之后执行
                    if (this.options.enableSentenceObfuscation && this.sentenceObfuscator) {
                        content = this.sentenceObfuscator.obfuscateSentences(content);
                    }

                    // 只在非最小混淆模式下添加随机混淆标记
                    if (this.options.enhancedHtmlObfuscation || this.options.enableCssObfuscation) {
                        content = `${this.htmlMarker}\n${content}`;
                    }
                } else {
                    if (ext === '.css') {
                        if (this.options.enableCssObfuscation) {
                            content = await CssObfuscator.obfuscate(content, this.mapping);
                        } else {
                            console.log(`⏭️ 跳过CSS混淆: ${path.relative(workDir, file)}（CSS混淆已禁用）`);
                        }
                    } else if (ext === '.js') {
                        content = await JsObfuscator.obfuscate(content, this.mapping, file);
                    }
                    // 添加随机混淆标记
                    content = `${this.codeMarker}\n${content}`;
                }
            } catch (e) {
                console.error(`❌Error processing ${file}:`, e.message);
                continue;
            }

            await fs.writeFile(file, content);
            console.log(`✅ 处理完成: ${path.relative(workDir, file)}`);
        }

        console.log('🎯 所有文件混淆处理完成');
    }

    isAlreadyObfuscated(content) {
        // 检查是否包含各种混淆标记的模式
        const patterns = [
            /\/\*\s*[A-Z_]+_[A-Z_]+_\d+_[a-z0-9]+\s*\*\//,  // CSS/JS 随机标记
            /<!--\s*[A-Z_]+_[A-Z_]+_\d+_[a-z0-9]+\s*-->/,   // HTML 随机标记
            /\/\*\s*OBFUSCATED/,                               // 旧的固定标记（向后兼容）
            /<!--\s*OBFUSCATED/,                               // 旧的固定标记（向后兼容）
            /\/\/\s*OBFUSCATED/                                // 旧的固定标记（向后兼容）
        ];

        return patterns.some(pattern => pattern.test(content));
    }
}

module.exports = ObfuscationEngine;