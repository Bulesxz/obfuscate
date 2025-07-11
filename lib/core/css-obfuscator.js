const fs = require('fs-extra');
const postcss = require('postcss');
const valueParser = require('postcss-value-parser');
const cssnano = require('cssnano');
const RandomUtils = require('../utils/random-utils');

class CssObfuscator {
    static async collectMappings(filePath, mapping, options = {}) {
        // 读取CSS文件并收集类名和ID选择器
        const css = await fs.readFile(filePath, 'utf8');
        const { protectThirdParty = true } = options;
        
        console.log('🎨 从CSS文件收集类名和ID映射...');
        
        // 匹配CSS类选择器 .className
        const classRegex = /\.([a-zA-Z_][\w-]*)/g;
        let match;
        
        while ((match = classRegex.exec(css)) !== null) {
            const className = match[1];
            
            // 检查是否应该混淆这个类名（使用第三方保护逻辑）
            if (!mapping.classes.has(className) && this.shouldObfuscateClass(className, protectThirdParty)) {
                const obf = RandomUtils.randomIdentifier();
                mapping.classes.set(className, obf);
                mapping.classSelectors.set(`.${className}`, `.${obf}`);
            }
        }
        
        // 匹配CSS ID选择器 #idName
        const idRegex = /#([a-zA-Z_][\w-]*)/g;
        while ((match = idRegex.exec(css)) !== null) {
            const idName = match[1];
            
            // 检查是否应该混淆这个ID
            if (!mapping.ids.has(idName) && this.shouldObfuscateId(idName, protectThirdParty)) {
                const obf = RandomUtils.randomIdentifier();
                mapping.ids.set(idName, obf);
                mapping.idSelectors.set(`#${idName}`, `#${obf}`);
            }
        }
    }

    // 第三方保护逻辑（避免循环依赖）
    static shouldObfuscateClass(className, protectThirdParty = true) {
        // 如果禁用第三方保护，混淆所有类名
        if (!protectThirdParty) {
            return true;
        }
        
        // 第三方框架类名白名单（不混淆）
        const thirdPartyClasses = new Set([
            // Bootstrap 核心类名
            'container', 'container-fluid', 'row', 'col', 'col-auto',
            'btn', 'btn-primary', 'btn-secondary', 'btn-success', 'btn-danger',
            'card', 'card-body', 'navbar', 'nav', 'modal', 'form-control',
            'table', 'alert', 'dropdown', 'pagination',
            'd-none', 'd-block', 'd-flex', 'text-center',
            
            // Tailwind CSS 核心类名
            'flex', 'grid', 'block', 'inline', 'hidden',
            'text-center', 'text-left', 'text-right',
            'font-bold', 'font-medium', 'font-light',
            'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl',
            'p-1', 'p-2', 'p-4', 'p-8', 'm-1', 'm-2', 'm-4', 'm-8',
            'w-full', 'h-full', 'bg-white', 'text-white',
            
            // Font Awesome
            'fa', 'fas', 'far', 'fab',
            
            // 通用工具类
            'clearfix', 'float-left', 'float-right'
        ]);

        // 检查类名模式
        const thirdPartyPatterns = [
            /^col-\w+/, /^btn-outline-/, /^text-\w+/, /^bg-\w+/,
            /^fa-\w+/, /^ui-\w+/, /^wp-/, /^gtm-/, /^ga-/
        ];

        // 如果是白名单中的类名，不混淆
        if (thirdPartyClasses.has(className)) {
            return false;
        }

        // 如果匹配第三方模式，不混淆
        if (thirdPartyPatterns.some(pattern => pattern.test(className))) {
            return false;
        }

        return true;
    }

    static shouldObfuscateId(id, protectThirdParty = true) {
        // 如果禁用第三方保护，混淆所有ID
        if (!protectThirdParty) {
            return true;
        }
        
        // 第三方框架ID白名单
        const thirdPartyIds = new Set([
            'google-analytics', 'gtag', 'facebook-jssdk', 'stripe-checkout',
            'paypal-button', 'recaptcha', 'disqus_thread', 'fb-root',
            'wp-admin-bar', 'search-form', 'contact-form'
        ]);

        // 检查ID模式
        const thirdPartyPatterns = [
            /^gtm-/, /^ga-/, /^fb-/, /^wp-/, /^stripe-/, /^paypal-/
        ];

        if (thirdPartyIds.has(id)) {
            return false;
        }

        if (thirdPartyPatterns.some(pattern => pattern.test(id))) {
            return false;
        }

        return true;
    }

    static async obfuscate(css, mapping) {
        try {
            const result = await this._processCss(css, mapping);
            return result;
        } catch (error) {
            console.error("CSS处理失败:", error);
            // 失败时返回原始CSS作为回退
            return css;
        }
    }

    static async _processCss(css, mapping) {
        const plugins = [];
        // 这个处理一定要有，针对已编译的不正常内容处理
        // 没有的话可能会出现样式不正常问题
        const newCss = css.replace(/[\r\n]+/g, ' ');

        // 添加压缩插件
        plugins.push(cssnano({
            preset: ['default', {
                // 禁用所有可能改变类名/变量名的优化
                discardUnused: false,
                reduceIdents: false,
                mergeIdents: false,
                normalizeCharset: false,
                // 保留自定义属性（CSS变量）
                normalizeUrl: false,
                // 其他安全设置
                minifyFontValues: { removeQuotes: false },
                minifyParams: false,
                minifySelectors: false,

                // 保留关键结构
                cssDeclarationSorter: false,
                discardOverridden: false,
                discardDuplicates: false
            }]
        }));

        plugins.push(this._addDeadCode());
        
        // 添加类名和ID混淆插件
        plugins.push(this._obfuscateSelectors(mapping));

        try {
            // 处理 CSS
            const processor = postcss(plugins);
            const result = await processor.process(newCss, {
                from: undefined,
                map: false
            });

            return result.css;
        } catch (error) {
            console.error("PostCSS处理错误:", error);
            throw error;
        }
    }

    static _addDeadCode() {
        return {
            postcssPlugin: 'css-dead-code',
            OnceExit(root) {
                const deadSelector = `.${Date.now().toString(36)}_${RandomUtils.randomIdentifier()}`;
                
                // 使用随机隐藏方式，避免固定模式
                const hiddenStyles = [
                    `position:absolute;top:-${Math.floor(Math.random() * 5000 + 5000)}px;left:-${Math.floor(Math.random() * 5000 + 5000)}px;opacity:0;pointer-events:none;`,
                    `position:fixed;top:-100vh;left:-100vw;opacity:0;pointer-events:none;width:1px;height:1px;`,
                    `position:absolute;opacity:0;pointer-events:none;transform:scale(0);width:1px;height:1px;`,
                    `position:absolute;font-size:0;line-height:0;color:transparent;opacity:0;left:-${Math.floor(Math.random() * 3000 + 8000)}px;`,
                    `position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;clip-path:inset(50%);opacity:0;`
                ];
                
                const randomStyle = hiddenStyles[Math.floor(Math.random() * hiddenStyles.length)];
                root.append(`${deadSelector}{${randomStyle}}`);
            }
        };
    }

    // 新增：混淆CSS选择器中的类名和ID
    static _obfuscateSelectors(mapping) {
        return {
            postcssPlugin: 'obfuscate-selectors',
            Rule(rule) {
                if (!mapping || !mapping.classes || !mapping.ids) {
                    return;
                }

                let selector = rule.selector;
                let modified = false;

                // 混淆类选择器 - 只混淆mapping中存在的类名（已经过第三方检查）
                if (mapping.classes && mapping.classes.size > 0) {
                    for (const [originalClass, obfuscatedClass] of mapping.classes) {
                        // 匹配 .className 格式的类选择器
                        const classRegex = new RegExp(`\\.${CssObfuscator.escapeRegExp(originalClass)}\\b`, 'g');
                        if (classRegex.test(selector)) {
                            selector = selector.replace(classRegex, `.${obfuscatedClass}`);
                            modified = true;
                        }
                    }
                }

                // 混淆ID选择器 - 只混淆mapping中存在的ID（已经过第三方检查）
                if (mapping.ids && mapping.ids.size > 0) {
                    for (const [originalId, obfuscatedId] of mapping.ids) {
                        // 匹配 #idName 格式的ID选择器
                        const idRegex = new RegExp(`#${CssObfuscator.escapeRegExp(originalId)}\\b`, 'g');
                        if (idRegex.test(selector)) {
                            selector = selector.replace(idRegex, `#${obfuscatedId}`);
                            modified = true;
                        }
                    }
                }

                if (modified) {
                    rule.selector = selector;
                }
            }
        };
    }

    // 辅助方法：转义正则表达式特殊字符
    static escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

CssObfuscator._addDeadCode.postcss = true;
CssObfuscator._obfuscateSelectors.postcss = true;

module.exports = CssObfuscator;