const fs = require('fs-extra');
const path = require('path');
const RandomUtils = require('../utils/random-utils');

class KeywordObfuscator {
    constructor() {
        this.keywords = [];
        this.keywordsLoaded = false;
        this.debug = false; // 调试模式
        this.obfuscationRate = 0.4; // 默认40%概率混淆关键词本身（60%不混淆）
    }
    
    // 设置关键词混淆率
    setObfuscationRate(rate) {
        this.obfuscationRate = rate;
        if (this.debug) {
            console.log(`🔤 关键词混淆率设置为: ${(rate * 100).toFixed(1)}%`);
        }
    }

    // 加载关键词列表
    async loadKeywords() {
        if (this.keywordsLoaded) {
            return;
        }

        try {
            const keywordFilePath = path.join(__dirname, '../../key.txt');
            if (await fs.pathExists(keywordFilePath)) {
                const content = await fs.readFile(keywordFilePath, 'utf8');
                this.keywords = content.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);
                this.keywordsLoaded = true;
                console.log(`📝 加载了 ${this.keywords.length} 个关键词`);
            }
        } catch (error) {
            console.warn('⚠️ 关键词文件加载失败:', error.message);
            this.keywordsLoaded = true; // 防止重复尝试
        }
    }

    // 混淆HTML内容中的关键词
    obfuscateKeywords(htmlContent) {
        if (this.keywords.length === 0) {
            return htmlContent;
        }

        let result = htmlContent;
        let obfuscatedCount = 0;

        // 按长度降序排序，优先处理长关键词避免子串问题
        const sortedKeywords = [...this.keywords].sort((a, b) => b.length - a.length);

        // 记录已处理的位置，避免重复处理
        const processedRanges = [];

        for (const keyword of sortedKeywords) {
            // 处理所有关键词，不跳过短关键词
            if (keyword.length === 0) continue; // 只跳过空字符串

            // 使用全局匹配查找所有位置
            const regex = new RegExp(this.escapeRegExp(keyword), 'gi');
            let match;
            const matches = [];
            
            // 收集所有匹配
            while ((match = regex.exec(result)) !== null) {
                matches.push({
                    match: match[0],
                    offset: match.index,
                    length: match[0].length
                });
                
                // 防止无限循环
                if (regex.lastIndex === match.index) {
                    regex.lastIndex++;
                }
            }

            // 从后往前处理（避免索引变化）
            for (let i = matches.length - 1; i >= 0; i--) {
                const matchInfo = matches[i];
                const { match: matchText, offset, length } = matchInfo;
                
                // 检查是否与已处理的范围重叠
                const overlaps = processedRanges.some(range => 
                    (offset >= range.start && offset < range.end) ||
                    (offset + length > range.start && offset + length <= range.end) ||
                    (offset < range.start && offset + length > range.end)
                );
                
                if (overlaps) {
                    continue; // 跳过重叠的匹配
                }
                
                // 检查匹配位置是否在HTML标签内
                if (this.isInsideHtmlTag(result, offset, length)) {
                    continue; // 在标签内，不进行混淆
                }
                
                // 100%使用关键词周围隔离混淆，关键词本身根据设置的概率混淆
                const shouldObfuscateKeyword = RandomUtils.randomBool(this.obfuscationRate); // 根据设置的概率混淆关键词本身
                
                let keywordText;
                if (shouldObfuscateKeyword) {
                    // 40%概率：混淆关键词本身
                    keywordText = this.obfuscateKeyword(matchText);
                } else {
                    // 60%概率：保持关键词不变
                    keywordText = matchText;
                }
                
                // 100%在关键词周围添加隔离混淆代码
                const obfuscatedText = this.addAroundObfuscation(keywordText);
                
                const beforeChange = result;
                result = result.slice(0, offset) + obfuscatedText + result.slice(offset + length);
                
                // 调试信息
                if (this.debug) {
                    console.log(`  处理关键词: "${matchText}" → "${obfuscatedText}" (位置: ${offset})`);
                    console.log(`  变化前: "${beforeChange}"`);
                    console.log(`  变化后: "${result}"`);
                }
                
                // 记录已处理的范围
                processedRanges.push({
                    start: offset,
                    end: offset + obfuscatedText.length
                });
                
                obfuscatedCount++;
            }
        }

        if (obfuscatedCount > 0) {
            console.log(`🔤 处理了 ${obfuscatedCount} 个关键词`);
        }

        return result;
    }

    // 检查位置是否在HTML标签内
    isInsideHtmlTag(content, offset, length) {
        // 向前查找最近的 < 和 >
        let openTag = content.lastIndexOf('<', offset);
        let closeTag = content.lastIndexOf('>', offset);
        
        // 如果在标签内（最近的<在最近的>之后）
        if (openTag > closeTag && openTag !== -1) {
            // 继续查找标签结束
            let tagEnd = content.indexOf('>', offset + length);
            if (tagEnd !== -1) {
                // 进一步检查是否在标签属性中
                const tagContent = content.substring(openTag, tagEnd + 1);
                
                // 检查是否在引号内的属性值中
                const beforeMatch = content.substring(openTag, offset);
                const quotesBefore = (beforeMatch.match(/"/g) || []).length;
                const singleQuotesBefore = (beforeMatch.match(/'/g) || []).length;
                
                // 如果引号数量是奇数，说明在属性值内
                if (quotesBefore % 2 === 1 || singleQuotesBefore % 2 === 1) {
                    return true;
                }
                
                // 检查是否在脚本或样式标签内
                const scriptMatch = /<(script|style)[^>]*>/i.exec(tagContent);
                if (scriptMatch) {
                    return false; // 脚本和样式标签内的内容不算标签内
                }
                
                return true; // 在其他标签内
            }
        }
        
        return false;
    }

    // 对单个关键词进行混淆（只使用不可见字符）
    obfuscateKeyword(keyword) {
        // 只使用不可见字符混淆方式
        return this.obfuscateWithInvisibleChars(keyword);
    }

    // 使用span标签混淆
    obfuscateWithSpan(keyword) {
        // 检测是否为西班牙语或其他拉丁语系，使用词汇级拆分
        const words = this.splitKeywordByLanguage(keyword);
        const spanCount = RandomUtils.randomInt(1, Math.max(1, words.length));
        let result = '';
        let hasSpan = false; // 确保至少有一个span

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            
            // 随机决定是否用span包装，或者确保至少有一个span
            const shouldWrap = (i < spanCount && RandomUtils.randomBool(0.7)) || 
                              (!hasSpan && i === words.length - 1);
            
            if (shouldWrap) {
                const attrs = RandomUtils.randomBool(0.6) ? ` ${RandomUtils.randomAttribute()}` : '';
                result += `<span${attrs}>${word}</span>`;
                hasSpan = true;
            } else {
                result += word;
            }
        }

        return result;
    }

    // 使用不可见字符混淆
    obfuscateWithInvisibleChars(keyword) {
        const words = this.splitKeywordByLanguage(keyword);
        if (words.length <= 1) {
            // 对于单词汇，直接添加不可见字符
            return words[0] + RandomUtils.randomInvisibleChar();
        }
        
        const insertCount = RandomUtils.randomInt(1, Math.max(1, words.length - 1));
        let result = '';
        let hasInvisible = false; // 确保至少有一个不可见字符

        for (let i = 0; i < words.length; i++) {
            result += words[i];
            
            // 随机插入不可见字符（不在最后一个词汇后）
            const shouldInsert = (i < words.length - 1 && i < insertCount && RandomUtils.randomBool(0.5)) ||
                                (!hasInvisible && i === words.length - 2); // 倒数第二个词汇确保插入
            
            if (i < words.length - 1 && shouldInsert) {
                result += RandomUtils.randomInvisibleChar();
                hasInvisible = true;
            }
        }

        return result;
    }

    // 混合模式：span + 不可见字符
    obfuscateWithMixed(keyword) {
        // 使用语言感知的拆分方式
        const words = this.splitKeywordByLanguage(keyword);
        const spanCount = RandomUtils.randomInt(1, Math.max(1, Math.ceil(words.length / 2)));
        const invisibleCount = RandomUtils.randomInt(1, Math.max(1, Math.ceil(words.length / 3)));
        let result = '';
        let hasSpan = false;
        let hasInvisible = false;

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            
            // 随机决定是否用span包装，确保至少有一个span
            const shouldSpan = (i < spanCount && RandomUtils.randomBool(0.4)) ||
                              (!hasSpan && i === words.length - 1);
            
            if (shouldSpan) {
                const attrs = RandomUtils.randomBool(0.5) ? ` ${RandomUtils.randomAttribute()}` : '';
                result += `<span${attrs}>${word}</span>`;
                hasSpan = true;
            } else {
                result += word;
            }
            
            // 随机插入不可见字符，确保至少有一个不可见字符
            const shouldInsert = (i < words.length - 1 && i < invisibleCount && RandomUtils.randomBool(0.3)) ||
                                (!hasInvisible && i === words.length - 2 && words.length > 1);
            
            if (i < words.length - 1 && shouldInsert) {
                result += RandomUtils.randomInvisibleChar();
                hasInvisible = true;
            }
        }

        // 如果两种方式都没有应用，强制应用一种
        if (!hasSpan && !hasInvisible && words.length > 0) {
            if (RandomUtils.randomBool()) {
                // 应用span到第一个词汇
                const firstWord = words[0];
                const attrs = RandomUtils.randomBool(0.5) ? ` ${RandomUtils.randomAttribute()}` : '';
                result = `<span${attrs}>${firstWord}</span>` + result.slice(firstWord.length);
            } else {
                // 在词汇之间插入不可见字符
                const pos = RandomUtils.randomInt(0, Math.max(0, words.length - 1));
                let insertPos = 0;
                for (let j = 0; j < pos; j++) {
                    insertPos += words[j].length;
                }
                result = result.slice(0, insertPos) + RandomUtils.randomInvisibleChar() + result.slice(insertPos);
            }
        }

        return result;
    }

    // 特殊处理：为整个关键词添加干扰元素（不添加文本内容）
    addNoiseElements(keyword) {
        const noiseElements = [
            RandomUtils.randomInvisibleChar(),
            RandomUtils.randomInvisibleChar() + RandomUtils.randomInvisibleChar(),
            RandomUtils.randomInvisibleChar() + RandomUtils.randomInvisibleChar() + RandomUtils.randomInvisibleChar(),
        ];

        const noise = noiseElements[Math.floor(Math.random() * noiseElements.length)];
        const position = RandomUtils.randomInt(0, keyword.length);
        
        return keyword.slice(0, position) + noise + keyword.slice(position);
    }

    // 在关键词周围添加混淆代码进行隔离
    obfuscateAroundKeyword(keyword, content, offset, length) {
        let result = '';
        
        // 在关键词前插入混淆代码
        const beforeObfuscationCount = RandomUtils.randomInt(1, 3); // 1-3个混淆元素
        for (let i = 0; i < beforeObfuscationCount; i++) {
            result += this.createObfuscationElement();
        }
        
        // 保持关键词不变
        result += keyword;
        
        // 在关键词后插入混淆代码
        const afterObfuscationCount = RandomUtils.randomInt(1, 3); // 1-3个混淆元素
        for (let i = 0; i < afterObfuscationCount; i++) {
            result += this.createObfuscationElement();
        }
        
        return result;
    }
    
    // 100%在关键词周围添加隔离混淆代码（新的核心方法）
    addAroundObfuscation(keyword) {
        let result = '';
        
        // 在关键词前插入混淆代码
        const beforeObfuscationCount = RandomUtils.randomInt(1, 3); // 1-3个混淆元素
        for (let i = 0; i < beforeObfuscationCount; i++) {
            result += this.createObfuscationElement();
        }
        
        // 添加关键词（可能已经被混淆，也可能保持原样）
        result += keyword;
        
        // 在关键词后插入混淆代码
        const afterObfuscationCount = RandomUtils.randomInt(1, 3); // 1-3个混淆元素
        for (let i = 0; i < afterObfuscationCount; i++) {
            result += this.createObfuscationElement();
        }
        
        return result;
    }
    
    // 创建混淆元素（只使用不可见字符）
    createObfuscationElement() {
        // 只使用不可见字符混淆方式
        return this.createInvisibleChars();
    }
    
    // 创建混淆元素（不添加文本内容）
    createObfuscatedSpan() {
        // 只使用不可见字符进行混淆
        return this.createInvisibleChars();
    }
    
    // 创建不可见字符
    createInvisibleChars() {
        const count = RandomUtils.randomInt(1, 3); // 1-3个不可见字符
        let result = '';
        
        for (let i = 0; i < count; i++) {
            result += RandomUtils.randomInvisibleChar();
        }
        
        return result;
    }
    
    // 创建混合混淆（span + 不可见字符）
    createMixedObfuscation() {
        const span = this.createObfuscatedSpan();
        const invisible = this.createInvisibleChars();
        
        // 随机决定顺序
        return RandomUtils.randomBool() ? span + invisible : invisible + span;
    }

    // 转义正则表达式特殊字符
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // 语言感知的关键词拆分方法
    splitKeywordByLanguage(keyword) {
        // 检测是否包含拉丁字符（西班牙语、葡萄牙语、法语等）
        const hasLatinChars = /[a-zA-ZÀ-ÿ]/.test(keyword);
        // 检测是否包含中文、日文、韩文字符
        const hasAsianChars = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(keyword);
        
        if (hasLatinChars && !hasAsianChars) {
            // 拉丁语系：按空格拆分成词汇
            const words = keyword.split(/(\s+)/); // 保留空格
            return words.filter(word => word.length > 0); // 移除空字符串
        } else if (hasAsianChars) {
            // 亚洲语言：按字符拆分（原有逻辑）
            return [...keyword];
        } else {
            // 混合或其他语言：按字符拆分
            return [...keyword];
        }
    }
}

module.exports = KeywordObfuscator; 