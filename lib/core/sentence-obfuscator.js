const RandomUtils = require('../utils/random-utils');
const cheerio = require('cheerio');

class SentenceObfuscator {
    constructor() {
        this.debug = false;
        this.obfuscationRate = 0.99; // 默认60%概率混淆句子
        this.sentenceMinLength = 11; // 最小句子长度
        this.sentenceMaxLength = 2000; // 最大句子长度，避免处理过长内容
    }

    // 设置句子混淆率
    setObfuscationRate(rate) {
        this.obfuscationRate = rate;
        if (this.debug) {
            console.log(`📝 句子混淆率设置为: ${(rate * 100).toFixed(1)}%`);
        }
    }

    // 设置句子长度限制
    setSentenceLengthLimits(minLength, maxLength) {
        this.sentenceMinLength = minLength;
        this.sentenceMaxLength = maxLength;
    }

    // 混淆HTML内容中的句子
    obfuscateSentences(htmlContent) {
        if (!htmlContent || typeof htmlContent !== 'string') {
            return htmlContent;
        }

        try {
            const $ = cheerio.load(htmlContent, {
                xmlMode: false,
                decodeEntities: false,
                normalizeWhitespace: false
            });

            let obfuscatedCount = 0;

            // 遍历所有元素，但只处理那些直接包含文本的元素
            $('*').each((i, elem) => {
                const $elem = $(elem);
                
                // 跳过script、style等标签
                const tagName = elem.tagName ? elem.tagName.toLowerCase() : '';
                if (['script', 'style', 'code', 'pre', 'textarea'].includes(tagName)) {
                    return;
                }

                // 检查元素是否已经被关键词混淆处理过
                if (this.isElementAlreadyObfuscated($elem)) {
                    if (this.debug) {
                        console.log(`⏭️ 跳过已混淆的元素: ${tagName}`);
                    }
                    return;
                }

                // 只处理直接的文本节点，不包括子元素的文本
                const directTextNodes = $elem.contents().filter(function() {
                    return this.nodeType === 3; // 文本节点
                });

                directTextNodes.each((j, textNode) => {
                    const text = $(textNode).text();
                    const trimmedText = text.trim();
                    
                    if (trimmedText && 
                        trimmedText.length >= this.sentenceMinLength && 
                        trimmedText.length <= this.sentenceMaxLength) {
                        
                        // 检查文本是否已经被关键词混淆处理过
                        if (this.isAlreadyObfuscated(text)) {
                            if (this.debug) {
                                console.log(`⏭️ 跳过已混淆的文本: "${text.substring(0, 20)}..."`);
                            }
                            return; // 跳过已经混淆的文本
                        }

                        // 100% 混淆所有符合条件的句子
                        const obfuscatedText = this.obfuscateTextNode(text);
                        $(textNode).replaceWith(obfuscatedText);
                        obfuscatedCount++;
                    }
                });
            });

            if (obfuscatedCount > 0) {
                console.log(`📝 混淆了 ${obfuscatedCount} 个句子片段`);
            }

            return $.html();
        } catch (error) {
            console.warn('⚠️ 句子混淆过程中出现错误:', error.message);
            return htmlContent; // 返回原始内容
        }
    }

    // 混淆文本节点（只使用不可见字符）
    obfuscateTextNode(text) {
        // 只使用不可见字符混淆，不使用span标签
        return this.insertInvisibleChars(text);
    }

    // 方法1：将文本拆分为多个span标签
    splitTextWithSpans(text) {
        const trimmedText = text.trim();
        if (!trimmedText) return text;

        // 保留原始的前后空白
        const leadingSpace = text.match(/^\s*/)[0];
        const trailingSpace = text.match(/\s*$/)[0];
        
        const chars = [...trimmedText];
        const spanProbability = 0.3; // 30%的字符被包装成span
        let result = '';

        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            
            if (RandomUtils.randomBool(spanProbability) && char !== ' ') {
                // 添加随机属性的span标签
                const attrs = this.generateRandomAttributes();
                result += `<span${attrs}>${char}</span>`;
            } else {
                result += char;
            }
        }

        return leadingSpace + result + trailingSpace;
    }

    // 方法2：插入不可见字符
    insertInvisibleChars(text) {
        const trimmedText = text.trim();
        if (!trimmedText) return text;

        const leadingSpace = text.match(/^\s*/)[0];
        const trailingSpace = text.match(/\s*$/)[0];
        
        const chars = [...trimmedText];
        const insertProbability = 0.8; // 80%的位置插入不可见字符，提高混淆效果
        let result = '';

        for (let i = 0; i < chars.length; i++) {
            result += chars[i];
            
            // 在字符后随机插入不可见字符
            if (i < chars.length - 1 && RandomUtils.randomBool(insertProbability)) {
                result += RandomUtils.randomInvisibleChar();
            }
        }

        return leadingSpace + result + trailingSpace;
    }

    // 方法3：混合混淆（span + 不可见字符）
    mixedTextObfuscation(text) {
        const trimmedText = text.trim();
        if (!trimmedText) return text;

        const leadingSpace = text.match(/^\s*/)[0];
        const trailingSpace = text.match(/\s*$/)[0];
        
        const chars = [...trimmedText];
        const spanProbability = 0.2;
        const invisibleProbability = 0.15;
        let result = '';

        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            
            // 随机决定是否用span包装
            if (RandomUtils.randomBool(spanProbability) && char !== ' ') {
                const attrs = this.generateRandomAttributes();
                result += `<span${attrs}>${char}</span>`;
            } else {
                result += char;
            }
            
            // 随机插入不可见字符
            if (i < chars.length - 1 && RandomUtils.randomBool(invisibleProbability)) {
                result += RandomUtils.randomInvisibleChar();
            }
        }

        return leadingSpace + result + trailingSpace;
    }



    // 生成随机HTML属性
    generateRandomAttributes() {
        const attributeTypes = [
            () => ` class="${RandomUtils.randomString(6)}"`,
            () => ` data-key="${RandomUtils.randomString(8)}"`,
            () => ` data-value="${RandomUtils.randomString(7)}"`,
            () => ` style="opacity:${0.98 + Math.random() * 0.02}"`, // 几乎透明
            () => ` id="${RandomUtils.randomString(5)}"`,
            () => ` data-obf="${RandomUtils.randomString(6)}"`,
        ];

        const numAttributes = RandomUtils.randomInt(0, 2); // 0-2个属性
        let attrs = '';

        for (let i = 0; i < numAttributes; i++) {
            const attrGenerator = attributeTypes[RandomUtils.randomInt(0, attributeTypes.length - 1)];
            attrs += attrGenerator();
        }

        return attrs;
    }

    // 检查元素是否已经被关键词混淆处理过
    isElementAlreadyObfuscated($elem) {
        // 检查元素HTML内容是否包含关键词混淆的标记
        const html = $elem.html();
        if (!html) return false;

        // 只检查是否包含真正的混淆生成的span标签（带有data-key, data-value等特定混淆属性）
        const hasObfuscatedSpans = $elem.find('span[data-key], span[data-value], span[data-item], span[data-elem], span[data-obf]').length > 0;
        
        // 检查HTML内容是否包含不可见字符的实体编码（真正的混淆标记）
        const hasInvisibleEntities = /&#(8203|8204|8205|8288|65279);/.test(html);

        // 检查纯文本内容是否包含不可见字符（关键词混淆产生的）
        const text = $elem.text();
        const hasInvisibleChars = this.isAlreadyObfuscated(text);

        // 只有明确包含混淆标记时才跳过
        return hasObfuscatedSpans || hasInvisibleEntities || hasInvisibleChars;
    }

    // 检查文本是否已经被关键词混淆处理过
    isAlreadyObfuscated(text) {
        // 检查是否包含关键词混淆产生的不可见字符
        const invisibleChars = [
            '\u200B', // 零宽空格 &#8203;
            '\u200C', // 零宽非连字符 &#8204;
            '\u200D', // 零宽连字符 &#8205;
            '\u2060', // 单词连接符 &#8288;
            '\uFEFF', // 零宽不间断空格 &#65279;
            '\u00A0'  // 非间断空格 &nbsp;
        ];

        // 检查文本中是否包含这些不可见字符
        for (const char of invisibleChars) {
            if (text.includes(char)) {
                return true;
            }
        }

        return false;
    }

    // 检查文本是否可以被混淆（排除脚本、样式等特殊内容）
    isTextObfuscatable(text, parentElement) {
        // 排除空白内容
        if (!text || !text.trim()) {
            return false;
        }

        // 排除脚本和样式内容
        if (parentElement) {
            const tagName = parentElement.tagName ? parentElement.tagName.toLowerCase() : '';
            if (['script', 'style', 'code', 'pre', 'textarea'].includes(tagName)) {
                return false;
            }
        }

        // 排除看起来像代码的内容
        if (/^[\{\[\(].*[\}\]\)]$/.test(text.trim()) || 
            /function\s*\(/.test(text) || 
            /var\s+\w+\s*=/.test(text)) {
            return false;
        }

        return true;
    }

    // 启用调试模式
    enableDebug() {
        this.debug = true;
    }

    // 禁用调试模式
    disableDebug() {
        this.debug = false;
    }
}

module.exports = SentenceObfuscator; 