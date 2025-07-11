const fs = require('fs-extra');
const cheerio = require('cheerio');
const crypto = require('crypto');
const shuffle = require('shuffle-array');
const RandomUtils = require('../utils/random-utils');
const CssObfuscator = require('./css-obfuscator');
const JsObfuscator = require('./js-obfuscator');
const KeywordObfuscator = require('./keyword-obfuscator'); // 添加关键词混淆器
// const BufferPolyfill = require('../utils/buffer-polyfill');

class HtmlObfuscator {
    static keywordObfuscator = null;

    // 初始化关键词混淆器
    static async initKeywordObfuscator() {
        if (!this.keywordObfuscator) {
            this.keywordObfuscator = new KeywordObfuscator();
            await this.keywordObfuscator.loadKeywords();
        }
    }

    static async collectMappings(filePath, mapping, options = {}) {
        // 重新启用类名和ID映射收集
        const html = await fs.readFile(filePath, 'utf8');
        const $ = cheerio.load(html);
        
        const { protectThirdParty = true } = options;

        // 首先收集内联CSS中的类名选择器
        console.log('🎨 扫描内联CSS中的类名...');
        $('style').each((i, el) => {
            const cssContent = $(el).text();
            this.collectCssClassNames(cssContent, mapping, protectThirdParty);
        });

        // 然后收集HTML元素中的类和ID
        console.log('🏷️ 扫描HTML元素中的类名和ID...');
        $('[class]').each((i, el) => {
            const classes = $(el).attr('class').split(/\s+/);
            classes.forEach(cls => {
                if (cls && !mapping.classes.has(cls) && this.shouldObfuscateClass(cls, protectThirdParty)) {
                    const obf = RandomUtils.randomIdentifier();
                    mapping.classes.set(cls, obf);
                    mapping.classSelectors.set(`.${cls}`, `.${obf}`);
                }
            });
        });

        $('[id]').each((i, el) => {
            const id = $(el).attr('id');
            if (id && !mapping.ids.has(id) && this.shouldObfuscateId(id, protectThirdParty)) {
                const obf = RandomUtils.randomIdentifier();
                mapping.ids.set(id, obf);
                mapping.idSelectors.set(`#${id}`, `#${obf}`);
            }
        });
    }

    // 新增：从CSS内容中收集类名
    static collectCssClassNames(cssContent, mapping, protectThirdParty = true) {
        // 匹配CSS类选择器 .className
        const classRegex = /\.([a-zA-Z_][\w-]*)/g;
        let match;
        
        while ((match = classRegex.exec(cssContent)) !== null) {
            const className = match[1];
            
            // 检查是否应该混淆这个类名
            if (!mapping.classes.has(className) && this.shouldObfuscateClass(className, protectThirdParty)) {
                const obf = RandomUtils.randomIdentifier();
                mapping.classes.set(className, obf);
                mapping.classSelectors.set(`.${className}`, `.${obf}`);
            }
        }
        
        // 匹配CSS ID选择器 #idName
        const idRegex = /#([a-zA-Z_][\w-]*)/g;
        while ((match = idRegex.exec(cssContent)) !== null) {
            const idName = match[1];
            
            // 检查是否应该混淆这个ID
            if (!mapping.ids.has(idName) && this.shouldObfuscateId(idName, protectThirdParty)) {
                const obf = RandomUtils.randomIdentifier();
                mapping.ids.set(idName, obf);
                mapping.idSelectors.set(`#${idName}`, `#${obf}`);
            }
        }
    }

    // 新增：检查类名是否应该被混淆
    static shouldObfuscateClass(className, protectThirdParty = true) {
        // 如果禁用第三方保护，混淆所有类名
        if (!protectThirdParty) {
            return true;
        }
        // 第三方框架类名白名单（不混淆）
        const thirdPartyClasses = new Set([
            // Bootstrap 5/4/3 核心类名
            'container', 'container-fluid', 'row', 'col', 'col-auto',
            'btn', 'btn-primary', 'btn-secondary', 'btn-success', 'btn-danger', 'btn-warning', 'btn-info', 'btn-light', 'btn-dark',
            'card', 'card-body', 'card-header', 'card-footer', 'card-title', 'card-text',
            'navbar', 'nav', 'nav-item', 'nav-link', 'navbar-brand', 'navbar-nav',
            'modal', 'modal-dialog', 'modal-content', 'modal-header', 'modal-body', 'modal-footer',
            'form-control', 'form-group', 'form-check', 'form-select',
            'table', 'table-striped', 'table-bordered', 'table-hover',
            'alert', 'alert-primary', 'alert-danger', 'alert-warning', 'alert-info', 'alert-success',
            'dropdown', 'dropdown-menu', 'dropdown-item', 'dropdown-toggle',
            'pagination', 'page-item', 'page-link',
            'd-none', 'd-block', 'd-inline', 'd-flex', 'justify-content-center', 'text-center',
            
            // Tailwind CSS 核心类名 (常用的工具类)
            'flex', 'grid', 'block', 'inline', 'hidden',
            'text-center', 'text-left', 'text-right', 'text-justify',
            'font-bold', 'font-medium', 'font-light', 'font-normal',
            'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl',
            'p-1', 'p-2', 'p-4', 'p-8', 'm-1', 'm-2', 'm-4', 'm-8',
            'w-full', 'h-full', 'w-auto', 'h-auto',
            'bg-white', 'bg-gray-100', 'bg-blue-500', 'text-white', 'text-black',
            
            // jQuery UI
            'ui-widget', 'ui-dialog', 'ui-button', 'ui-tabs', 'ui-accordion',
            'ui-datepicker', 'ui-slider', 'ui-progressbar',
            
            // Font Awesome
            'fa', 'fas', 'far', 'fab', 'fal', 'fad',
            
            // 常见插件类名
            'slider', 'carousel', 'tooltip', 'popover', 'lightbox',
            'datepicker', 'colorpicker', 'select2', 'chosen',
            'swiper', 'owl-carousel', 'slick', 'fancybox',
            
            // 常见分析和跟踪类名
            'google-analytics', 'gtm', 'facebook-pixel', 'mixpanel',
            'track-click', 'track-view', 'analytics-event',
            
            // 无障碍相关
            'sr-only', 'visually-hidden', 'screen-reader-text',
            
            // 通用工具类
            'clearfix', 'float-left', 'float-right', 'center-block'
        ]);

        // 检查类名模式（正则匹配）
        const thirdPartyPatterns = [
            /^col-\w+/,              // Bootstrap列: col-md-6, col-lg-4等
            /^btn-outline-/,         // Bootstrap按钮: btn-outline-primary等  
            /^text-\w+/,             // 文字工具类: text-primary, text-muted等
            /^bg-\w+/,               // 背景工具类: bg-primary, bg-light等
            /^border-\w+/,           // 边框工具类: border-primary等
            /^fa-\w+/,               // Font Awesome图标: fa-home, fa-user等
            /^ui-\w+/,               // jQuery UI: ui-state-default等
            /^swiper-/,              // Swiper插件: swiper-slide等
            /^owl-/,                 // Owl Carousel: owl-item等
            /^slick-/,               // Slick slider: slick-slide等
            /^wp-/,                  // WordPress: wp-content等
            /^woocommerce-/,         // WooCommerce: woocommerce-cart等
            /^elementor-/,           // Elementor: elementor-widget等
            /^vc_/,                  // Visual Composer: vc_row等
            /^gtm-/,                 // Google Tag Manager: gtm-click等
            /^ga-/,                  // Google Analytics: ga-track等
            /^fb-/,                  // Facebook: fb-like等
            /^twitter-/,             // Twitter: twitter-tweet等
            /^instagram-/,           // Instagram: instagram-media等
            /^recaptcha/,            // reCAPTCHA: recaptcha-v2等
            /^stripe-/,              // Stripe: stripe-button等
            /^paypal-/              // PayPal: paypal-button等
        ];

        // 如果是白名单中的类名，不混淆
        if (thirdPartyClasses.has(className)) {
            return false;
        }

        // 如果匹配第三方模式，不混淆
        if (thirdPartyPatterns.some(pattern => pattern.test(className))) {
            return false;
        }

        // 其他类名可以混淆
        return true;
    }

    // 新增：检查ID是否应该被混淆
    static shouldObfuscateId(id, protectThirdParty = true) {
        // 如果禁用第三方保护，混淆所有ID
        if (!protectThirdParty) {
            return true;
        }
        // 第三方框架ID白名单（不混淆）
        const thirdPartyIds = new Set([
            // 常见的第三方插件ID
            'google-analytics', 'gtag', 'facebook-jssdk', 'twitter-wjs',
            'stripe-checkout', 'paypal-button', 'recaptcha',
            'disqus_thread', 'fb-root', 'instagram-embed',
            
            // 常见的跟踪和分析ID
            'gtm-container', 'google-tag-manager', 'facebook-pixel',
            'mixpanel-script', 'amplitude-script', 'hotjar-script',
            
            // WordPress/CMS相关ID
            'wp-admin-bar', 'wpadminbar', 'wp-toolbar',
            'wordpress-embed', 'wp-custom-css',
            
            // 电商相关ID
            'woocommerce-cart', 'shopify-checkout', 'magento-cart',
            'add-to-cart', 'buy-now', 'checkout-button',
            
            // 通用功能ID
            'search-form', 'contact-form', 'newsletter-form',
            'login-form', 'registration-form', 'comment-form',
            'shopping-cart', 'user-menu', 'main-navigation',
            'footer-widgets', 'sidebar-primary', 'content-main'
        ]);

        // 检查ID模式（正则匹配）
        const thirdPartyPatterns = [
            /^gtm-/,                 // Google Tag Manager
            /^ga-/,                  // Google Analytics
            /^fb-/,                  // Facebook
            /^twitter-/,             // Twitter
            /^instagram-/,           // Instagram
            /^youtube-/,             // YouTube
            /^linkedin-/,            // LinkedIn
            /^pinterest-/,           // Pinterest
            /^wp-/,                  // WordPress
            /^woocommerce-/,         // WooCommerce
            /^stripe-/,              // Stripe
            /^paypal-/,              // PayPal
            /^mailchimp-/,           // MailChimp
            /^hubspot-/,             // HubSpot
            /^salesforce-/,          // Salesforce
            /^zendesk-/,             // Zendesk
            /^intercom-/,            // Intercom
            /^hotjar-/,              // Hotjar
            /^mixpanel-/,            // Mixpanel
            /^amplitude-/,           // Amplitude
            /^recaptcha/,            // reCAPTCHA
            /^disqus/               // Disqus
        ];

        // 如果是白名单中的ID，不混淆
        if (thirdPartyIds.has(id)) {
            return false;
        }

        // 如果匹配第三方模式，不混淆
        if (thirdPartyPatterns.some(pattern => pattern.test(id))) {
            return false;
        }

        // 其他ID可以混淆
        return true;
    }

    static async obfuscate(html, mapping, options = {}) {
        const {
            hexEncode = true,
            unicodeEncode = true,
            addWhitespace = true,
            shuffleElements = true,
            removeComments = false, // 改为false，我们要添加虚假注释
            compressWhitespace = false, // 改为false，我们要添加混淆空白
            enhancedObfuscation = true, // 新增：启用高级混淆
            htmlEntityEncoding = true, // 新增：HTML实体编码
            structureObfuscation = true, // 新增：结构混淆
            attributeObfuscation = true, // 新增：属性混淆
            tagObfuscation = true, // 新增：标签混淆
            domShuffle = true, // 新增：DOM结构打乱
            fakeComments = true, // 新增：虚假注释
            randomWhitespace = true, // 新增：随机空白字符
            enableCssObfuscation = true // 新增：启用CSS混淆
        } = options;

        // 如果是保持格式模式或最小混淆模式，只混淆JavaScript
        if (!enhancedObfuscation && !enableCssObfuscation) {
            console.log('🔄 最小混淆模式：只处理JavaScript，保持HTML完全不变...');
            return this.minimalObfuscate(html, mapping);
        }

        const $ = cheerio.load(html, {
            decodeEntities: false // 防止自动解码实体
        });

        console.log('🔄 开始高级HTML混淆处理...');
        
        // 1. 混淆类和ID（如果启用）
        if (enableCssObfuscation) {
            console.log('📋 混淆CSS类名和ID...');
            this.obfuscateClassesAndIds($, mapping);
        } else {
            console.log('⏭️ 跳过CSS类名和ID混淆（CSS混淆已禁用）');
        }

        // 2. 高级HTML结构混淆
        if (enhancedObfuscation && structureObfuscation) {
            console.log('🏗️ 执行HTML结构混淆...');
            this.obfuscateHtmlStructure($, options.structureObfuscationLevel || 'medium');
        }

        // 3. HTML属性混淆
        if (enhancedObfuscation && attributeObfuscation) {
            console.log('🏷️ 执行HTML属性混淆...');
            this.obfuscateHtmlAttributes($);
        }

        // 4. HTML标签混淆
        if (enhancedObfuscation && tagObfuscation) {
            console.log('🏗️ 执行HTML标签混淆...');
            this.obfuscateHtmlTags($);
        }

        // 5. DOM结构打乱
        if (enhancedObfuscation && domShuffle) {
            console.log('🔀 执行DOM结构打乱...');
            this.shuffleDomStructure($);
        }

        // 6. 添加虚假注释
        if (enhancedObfuscation && fakeComments) {
            console.log('💬 添加虚假HTML注释...');
            this.addFakeComments($);
        }

        // 混淆内联样式（如果启用）
        if (enableCssObfuscation) {
            console.log('🎨 混淆内联CSS...');
            const stylePromises = [];
            $('style').each((i, el) => {
                const $el = $(el);
                const originalCSS = $el.text();
                stylePromises.push(
                    CssObfuscator.obfuscate(originalCSS, mapping)
                        .then(obfuscatedCSS => {
                            $el.text(obfuscatedCSS);
                        })
                        .catch(error => {
                            console.error('CSS混淆失败:', error);
                            $el.text(originalCSS); // 出错时保留原始CSS
                        })
                );
            });
            // 等待所有混淆操作完成
            await Promise.all(stylePromises);
        } else {
            console.log('⏭️ 跳过内联CSS混淆（CSS混淆已禁用）');
        }

        $('script').each((i, el) => {
            const $el = $(el);
            const scriptContent = $el.text();
            const scriptSrc = $el.attr('src');
            
            // 跳过外部脚本
            if (scriptSrc) {
                return;
            }
            
            // 检查是否为Google Analytics或其他第三方分析脚本
            if (this.isAnalyticsScript(scriptContent, scriptSrc)) {
                console.log('🔒 跳过Google Analytics/第三方分析脚本混淆');
                return;
            }
            

            try {
                $(el).text(JsObfuscator.obfuscate(scriptContent, mapping));
            } catch (error) {
                console.warn('⚠️ HTML中脚本混淆失败:', error.message);
                // 保留原始脚本内容
            }
        });

        // 移除原始注释（如果启用）
        if (removeComments) {
            $('*').contents().each(function () {
                if (this.type === 'comment') {
                    $(this).remove();
                }
            });
        }

        // 获取HTML字符串
        let htmlResult = $.html();

        // 7. HTML实体编码
        if (enhancedObfuscation && htmlEntityEncoding) {
            console.log('🔤 执行HTML实体编码...');
            htmlResult = this.applyHtmlEntityEncoding(htmlResult);
        }

        // 8. 随机空白字符混淆
        if (enhancedObfuscation && randomWhitespace) {
            console.log('⚪ 添加随机空白字符...');
            htmlResult = this.addRandomWhitespace(htmlResult);
        }

        console.log('✅ 高级HTML混淆处理完成');
        return htmlResult;
    }

    // 新增：最小混淆模式 - 只混淆JavaScript，HTML完全不变
    static async minimalObfuscate(html, mapping) {
        const JsObfuscator = require('./js-obfuscator');
        
        // 使用更精确的正则表达式匹配所有内联脚本标签
        // 这个正则会捕获完整的script标签，包括属性
        const scriptRegex = /<script\b[^>]*?>([\s\S]*?)<\/script>/gi;
        let result = html;
        const matches = [];
        let match;

        // 重置正则表达式状态
        scriptRegex.lastIndex = 0;

        // 收集所有script标签的内容
        while ((match = scriptRegex.exec(html)) !== null) {
            const fullTag = match[0];
            const scriptContent = match[1];
            
            // 检查是否包含src属性（外部脚本）
            const srcMatch = fullTag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
            if (srcMatch) {
                // 跳过外部脚本
                continue;
            }
            
            // 检查是否为空脚本
            if (!scriptContent.trim()) {
                continue;
            }
            
            // 检查是否为分析脚本
            if (this.isAnalyticsScript(scriptContent, null)) {
                console.log('🔒 跳过分析脚本混淆');
                continue;
            }
            
            matches.push({
                fullTag: fullTag,
                originalContent: scriptContent,
                startIndex: match.index,
                endIndex: match.index + fullTag.length
            });
        }
        
        // 从后往前替换，避免索引变化
        for (let i = matches.length - 1; i >= 0; i--) {
            const matchInfo = matches[i];
            try {
                console.log(`🔄 混淆第${i + 1}个脚本标签...`);
                const obfuscatedJs = await JsObfuscator.obfuscate(matchInfo.originalContent, mapping);
                
                // 精确替换：只替换脚本内容，保持标签结构完全不变
                const beforeScript = result.substring(0, matchInfo.startIndex);
                const afterScript = result.substring(matchInfo.endIndex);
                
                // 获取开始和结束标签
                const startTagMatch = matchInfo.fullTag.match(/^(<script\b[^>]*?>)/i);
                const startTag = startTagMatch ? startTagMatch[1] : '<script>';
                const endTag = '</script>';
                
                // 重新组装，保持原始的标签格式
                const newTag = startTag + obfuscatedJs + endTag;
                result = beforeScript + newTag + afterScript;
                        
            } catch (error) {
                console.warn(`⚠️ 脚本混淆失败: ${error.message}`);
                // 保留原始脚本内容，不做任何修改
            }
        }
        
        console.log(`✅ 最小混淆完成，处理了 ${matches.length} 个脚本标签`);
        return result;
    }

    // 新增：混淆CSS类名和ID
    static obfuscateClassesAndIds($, mapping) {
        // 混淆类名
        $('[class]').each((i, el) => {
            const $el = $(el);
            const classes = $el.attr('class').split(/\s+/);
            const newClasses = classes
                .map(cls => cls ? (mapping.classes.get(cls) || cls) : cls)
                .join(' ');
            $el.attr('class', newClasses);
        });

        // 混淆ID
        $('[id]').each((i, el) => {
            const $el = $(el);
            const id = $el.attr('id');
            if (id && mapping.ids.has(id)) {
                $el.attr('id', mapping.ids.get(id));
            }
        });
    }

    // 增强：HTML结构混淆（全面升级）
    static obfuscateHtmlStructure($, level = 'medium') {
        console.log(`🏗️ 开始增强HTML结构混淆 (级别: ${level})...`);
        
        // 根据级别调整混淆强度
        const intensityConfig = this.getStructureIntensityConfig(level);
        
        // 1. 添加多层嵌套结构
        this.addNestedWrappers($, intensityConfig);
        
        // 2. 插入隐藏的装饰性元素
        this.insertHiddenElements($, intensityConfig);
        
        // 3. 添加语义混淆容器
        this.addSemanticObfuscation($, intensityConfig);
        
        // 4. 创建复杂的布局结构
        this.createComplexLayout($, intensityConfig);
        
        // 5. 添加无意义的列表和表格结构
        this.addStructuralNoise($, intensityConfig);
        
        // 6. 添加文本节点包装
        this.addTextNodeWrappers($, intensityConfig);
        
        // 7. 添加容器级别的包装
        this.addContainerWrappers($, intensityConfig);
        
        console.log('✅ HTML结构混淆完成');
    }

    // 新增：获取结构混淆强度配置
    static getStructureIntensityConfig(level) {
        const configs = {
            low: {
                nestedWrappers: 0.1,
                hiddenElements: 0.1,
                semanticObfuscation: 0.05,
                complexLayout: 0.05,
                structuralNoise: 0.03,
                textNodeWrappers: 0.05,
                containerWrappers: 0.1,
                maxDepth: 2
            },
            medium: {
                nestedWrappers: 0.3,
                hiddenElements: 0.25,
                semanticObfuscation: 0.2,
                complexLayout: 0.15,
                structuralNoise: 0.1,
                textNodeWrappers: 0.15,
                containerWrappers: 0.25,
                maxDepth: 4
            },
            high: {
                nestedWrappers: 0.5,
                hiddenElements: 0.4,
                semanticObfuscation: 0.35,
                complexLayout: 0.3,
                structuralNoise: 0.2,
                textNodeWrappers: 0.3,
                containerWrappers: 0.4,
                maxDepth: 6
            },
            extreme: {
                nestedWrappers: 0.7,
                hiddenElements: 0.6,
                semanticObfuscation: 0.5,
                complexLayout: 0.45,
                structuralNoise: 0.35,
                textNodeWrappers: 0.5,
                containerWrappers: 0.6,
                maxDepth: 8
            }
        };
        
        return configs[level] || configs.medium;
    }

    // 新增：添加多层嵌套包装器
    static addNestedWrappers($, config) {
        $('body').children().each((i, el) => {
            const $el = $(el);
            
            // 跳过关键元素
            if ($el.is('script, style, head, meta, link, title')) {
                return;
            }
            
            // 根据配置概率添加复杂嵌套结构
            if (RandomUtils.randomBool(config.nestedWrappers)) {
                const depth = RandomUtils.randomInt(2, Math.min(config.maxDepth, 8)); // 限制最大深度
                let wrapper = $el;
                
                for (let i = 0; i < depth; i++) {
                    const containerTypes = ['div', 'section', 'article', 'aside', 'main'];
                    const containerType = containerTypes[RandomUtils.randomInt(0, containerTypes.length - 1)];
                    const className = RandomUtils.randomString(8);
                    
                    wrapper = wrapper.wrap(`<${containerType} class="${className}"></${containerType}>`).parent();
                    
                    // 添加随机属性
                    if (RandomUtils.randomBool(0.4)) {
                        wrapper.attr(`data-${RandomUtils.randomString(6)}`, RandomUtils.randomString(10));
                    }
                }
            }
        });
    }

    // 新增：插入隐藏的装饰性元素
    static insertHiddenElements($, config) {
        const hiddenElements = [
            '<div class="hidden-spacer" style="display: none;"></div>',
            '<span class="invisible-marker" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;"></span>',
            '<div class="structural-placeholder" style="position: absolute; top: -10000px; left: -10000px; width: 1px; height: 1px; opacity: 0; pointer-events: none;"></div>',
            '<aside class="layout-anchor" style="position: absolute; top: -1000px; left: -1000px; width: 1px; height: 1px; opacity: 0; pointer-events: none;"></aside>',
            '<div class="phantom-container" style="position: fixed; top: -100vh; left: -100vw; pointer-events: none; width: 1px; height: 1px; opacity: 0;"></div>',
            '<span class="micro-element" style="font-size: 0; line-height: 0; color: transparent; width: 1px; height: 1px; display: inline-block; opacity: 0;"></span>',
            '<div class="zero-space" style="position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; clip-path: inset(50%); opacity: 0;"></div>',
            '<div class="transparent-block" style="position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; transform: scale(0);"></div>',
            '<span class="invisible-text" style="position: absolute; font-size: 0; line-height: 0; color: transparent; opacity: 0; left: -9999px;"></span>'
        ];
        
        // 在随机位置插入隐藏元素
        $('body *').each((i, el) => {
            const $el = $(el);
            
            // 跳过关键元素
            if ($el.is('script, style, head, meta, link, title, input, textarea, select, button, a, img')) {
                return;
            }
            
            // 根据配置概率插入隐藏元素
            if (RandomUtils.randomBool(config.hiddenElements)) {
                const hiddenEl = hiddenElements[RandomUtils.randomInt(0, hiddenElements.length - 1)];
                
                // 随机选择插入位置
                const position = RandomUtils.randomInt(0, 3);
                switch (position) {
                    case 0: $el.before(hiddenEl); break;
                    case 1: $el.after(hiddenEl); break;
                    case 2: $el.prepend(hiddenEl); break;
                    case 3: $el.append(hiddenEl); break;
                }
            }
        });
    }

    // 新增：添加语义混淆容器
    static addSemanticObfuscation($, config) {
        // 将内容包装在语义化但无意义的容器中
        $('p, h1, h2, h3, h4, h5, h6, span').each((i, el) => {
            const $el = $(el);
            
            // 跳过已经被包装的元素
            if ($el.parent().hasClass('semantic-wrapper')) {
                return;
            }
            
            // 根据配置概率添加语义混淆
            if (RandomUtils.randomBool(config.semanticObfuscation)) {
                const semanticTags = [
                    'header', 'footer', 'nav', 'section', 'article', 'aside', 'main',
                    'figure', 'figcaption', 'details', 'summary', 'mark', 'time'
                ];
                const wrapperTag = semanticTags[RandomUtils.randomInt(0, semanticTags.length - 1)];
                const className = `semantic-wrapper ${RandomUtils.randomString(8)}`;
                
                $el.wrap(`<${wrapperTag} class="${className}"></${wrapperTag}>`);
            }
        });
    }

    // 新增：创建复杂的布局结构
    static createComplexLayout($, config) {
        // 在body中创建复杂的布局结构
        $('body').children().each((i, el) => {
            const $el = $(el);
            
            // 跳过关键元素
            if ($el.is('script, style, head, meta, link, title')) {
                return;
            }
            
            // 根据配置概率创建复杂布局
            if (RandomUtils.randomBool(config.complexLayout)) {
                const layoutStructures = [
                    // 网格布局
                    `<div class="grid-container ${RandomUtils.randomString(8)}">
                        <div class="grid-item ${RandomUtils.randomString(8)}">
                            <div class="grid-cell ${RandomUtils.randomString(8)}"></div>
                        </div>
                    </div>`,
                    
                    // 弹性布局
                    `<div class="flex-container ${RandomUtils.randomString(8)}">
                        <div class="flex-item ${RandomUtils.randomString(8)}">
                            <div class="flex-content ${RandomUtils.randomString(8)}"></div>
                        </div>
                    </div>`,
                    
                    // 卡片布局
                    `<div class="card-wrapper ${RandomUtils.randomString(8)}">
                        <div class="card-header ${RandomUtils.randomString(8)}"></div>
                        <div class="card-body ${RandomUtils.randomString(8)}">
                            <div class="card-content ${RandomUtils.randomString(8)}"></div>
                        </div>
                    </div>`,
                    
                    // 面板布局
                    `<div class="panel-group ${RandomUtils.randomString(8)}">
                        <div class="panel ${RandomUtils.randomString(8)}">
                            <div class="panel-inner ${RandomUtils.randomString(8)}"></div>
                        </div>
                    </div>`
                ];
                
                const layoutHtml = layoutStructures[RandomUtils.randomInt(0, layoutStructures.length - 1)];
                const $layout = $(layoutHtml);
                
                // 将原始内容移动到布局的最内层
                $layout.find('div:last').append($el);
                $el.parent().append($layout);
            }
        });
    }

    // 新增：添加无意义的列表和表格结构
    static addStructuralNoise($, config) {
        $('body').children().each((i, el) => {
            const $el = $(el);
            
            // 跳过关键元素
            if ($el.is('script, style, head, meta, link, title, ul, ol, table')) {
                return;
            }
            
            // 根据配置概率添加结构噪声
            if (RandomUtils.randomBool(config.structuralNoise)) {
                const structureTypes = [
                    // 无序列表结构
                    `<ul class="structure-list ${RandomUtils.randomString(8)}">
                        <li class="structure-item ${RandomUtils.randomString(8)}">
                            <div class="item-content ${RandomUtils.randomString(8)}"></div>
                        </li>
                    </ul>`,
                    
                    // 有序列表结构
                    `<ol class="ordered-structure ${RandomUtils.randomString(8)}">
                        <li class="ordered-item ${RandomUtils.randomString(8)}">
                            <div class="numbered-content ${RandomUtils.randomString(8)}"></div>
                        </li>
                    </ol>`,
                    
                    // 表格结构
                    `<table class="layout-table ${RandomUtils.randomString(8)}">
                        <tbody>
                            <tr class="layout-row ${RandomUtils.randomString(8)}">
                                <td class="layout-cell ${RandomUtils.randomString(8)}">
                                    <div class="cell-content ${RandomUtils.randomString(8)}"></div>
                                </td>
                            </tr>
                        </tbody>
                    </table>`,
                    
                    // 定义列表结构
                    `<dl class="definition-list ${RandomUtils.randomString(8)}">
                        <dt class="definition-term ${RandomUtils.randomString(8)}"></dt>
                        <dd class="definition-desc ${RandomUtils.randomString(8)}">
                            <div class="desc-content ${RandomUtils.randomString(8)}"></div>
                        </dd>
                    </dl>`
                ];
                
                const structureHtml = structureTypes[RandomUtils.randomInt(0, structureTypes.length - 1)];
                const $structure = $(structureHtml);
                
                // 将原始内容移动到结构的最内层
                $structure.find('div:last').append($el);
                $el.parent().append($structure);
            }
        });
    }

    // 增强：添加更多文本节点包装
    static addTextNodeWrappers($, config) {
        $('p, h1, h2, h3, h4, h5, h6, span, div').each((i, el) => {
            const $el = $(el);
            const textContent = $el.text().trim();
            
            // 对中等长度的文本进行包装
            if (textContent.length > 30 && textContent.length < 200 && RandomUtils.randomBool(config.textNodeWrappers)) {
                const directTextNodes = $el.contents().filter(function() {
                    return this.nodeType === 3 && this.nodeValue.trim().length > 10;
                });
                
                // 包装多个文本节点
                directTextNodes.each((i, node) => {
                    if (RandomUtils.randomBool(0.3)) {
                        const wrapperTags = ['span', 'em', 'strong', 'mark', 'small'];
                        const wrapperTag = wrapperTags[RandomUtils.randomInt(0, wrapperTags.length - 1)];
                        const className = RandomUtils.randomString(8);
                        
                        $(node).wrap(`<${wrapperTag} class="${className}"></${wrapperTag}>`);
                    }
                });
            }
        });
    }

    // 增强：添加更多容器级别的包装
    static addContainerWrappers($, config) {
        $('body section, body div, body article, body aside').each((i, el) => {
            const $el = $(el);
            
            // 跳过已经被高度包装的元素
            if ($el.parents('div').length > 5) {
                return;
            }
            
            // 根据配置概率添加容器包装
            if (RandomUtils.randomBool(config.containerWrappers)) {
                const containerTypes = [
                    { tag: 'div', class: 'container-wrapper' },
                    { tag: 'section', class: 'section-wrapper' },
                    { tag: 'article', class: 'article-wrapper' },
                    { tag: 'aside', class: 'aside-wrapper' },
                    { tag: 'main', class: 'main-wrapper' },
                    { tag: 'header', class: 'header-wrapper' },
                    { tag: 'footer', class: 'footer-wrapper' }
                ];
                
                const container = containerTypes[RandomUtils.randomInt(0, containerTypes.length - 1)];
                const className = `${container.class} ${RandomUtils.randomString(8)}`;
                
                $el.wrap(`<${container.tag} class="${className}"></${container.tag}>`);
                
                // 添加中间层
                if (RandomUtils.randomBool(0.4)) {
                    const middleClassName = RandomUtils.randomString(10);
                    $el.wrap(`<div class="middle-layer ${middleClassName}"></div>`);
                }
            }
        });
    }

    // 新增：HTML属性混淆（减少频率）
    static obfuscateHtmlAttributes($) {
        $('*').each((i, el) => {
            const $el = $(el);
            
            // 添加随机的data-*属性（降低概率）
            if (RandomUtils.randomBool(0.2)) { // 从0.4降低到0.2
                const attrName = `data-${RandomUtils.randomString(8)}`;
                const attrValue = RandomUtils.randomString(12);
                $el.attr(attrName, attrValue);
            }
            
            // 添加随机的aria-*属性（降低概率）
            if (RandomUtils.randomBool(0.1)) { // 从0.2降低到0.1
                const ariaAttrs = ['aria-label', 'aria-hidden', 'aria-expanded', 'aria-controls'];
                const attrName = ariaAttrs[RandomUtils.randomInt(0, ariaAttrs.length - 1)];
                const attrValue = RandomUtils.randomBool() ? 'true' : 'false';
                $el.attr(attrName, attrValue);
            }
            
            // 添加随机的role属性（降低概率）
            if (RandomUtils.randomBool(0.08)) { // 从0.15降低到0.08
                const roles = ['button', 'link', 'generic', 'presentation', 'none'];
                const role = roles[RandomUtils.randomInt(0, roles.length - 1)];
                $el.attr('role', role);
            }
        });
    }

    // 新增：HTML标签混淆（大幅减少）
    static obfuscateHtmlTags($) {
        // 将一些div替换为语义等价的标签（降低概率）
        $('div').each((i, el) => {
            const $el = $(el);
            // 只对没有重要类名的div进行替换
            const hasImportantClass = $el.attr('class') && (
                $el.attr('class').includes('container') ||
                $el.attr('class').includes('flex') ||
                $el.attr('class').includes('grid')
            );
            
            if (!hasImportantClass && RandomUtils.randomBool(0.1)) { // 从0.3降低到0.1
                const equivalentTags = ['section', 'article', 'aside'];
                const newTag = equivalentTags[RandomUtils.randomInt(0, equivalentTags.length - 1)];
                $el.get(0).tagName = newTag;
            }
        });

        // 大幅减少span标签替换，避免影响文本显示
        $('span').each((i, el) => {
            const $el = $(el);
            const textContent = $el.text().trim();
            
            // 只对空的或很短的span进行替换，避免影响正常文本
            if (textContent.length === 0 || (textContent.length < 5 && RandomUtils.randomBool(0.05))) {
                const equivalentTags = ['em', 'small'];
                const newTag = equivalentTags[RandomUtils.randomInt(0, equivalentTags.length - 1)];
                $el.get(0).tagName = newTag;
            }
        });
    }

    // 新增：DOM结构打乱（更加保守）
    static shuffleDomStructure($) {
        // 不再对所有容器进行打乱，只对特定的、安全的容器进行处理
        $('body > section, body > div').each((i, container) => {
            const $container = $(container);
            const children = $container.children().not('script, style, header, footer, nav').get();
            
            // 只对有多个子元素且没有重要结构的容器进行打乱
            if (children.length > 2 && children.length < 6 && RandomUtils.randomBool(0.2)) { // 降低概率
                const shuffledChildren = shuffle(children);
                children.forEach(child => $container.append(child));
            }
        });
    }

    // 新增：添加虚假注释（修复嵌套问题）
    static addFakeComments($) {
        // 修复：将注释内容改为纯文本，避免嵌套注释
        const fakeComments = [
            'Generated by Advanced HTML Compiler',
            'Optimized for SEO',
            'Mobile Responsive Design',
            'Cross-browser Compatibility',
            'Performance Optimized',
            'Security Enhanced',
            'Copyright Protection',
            'Auto-generated CSS',
            'Dynamic Content Loading',
            'Progressive Web App Ready'
        ];

        // 在head中添加虚假注释
        $('head').prepend(`<!-- ${fakeComments[RandomUtils.randomInt(0, fakeComments.length - 1)]} -->`);
        
        // 在body中随机位置添加虚假注释（降低概率）
        $('body').children().each((i, el) => {
            if (RandomUtils.randomBool(0.15)) { // 从0.3降低到0.15
                const comment = fakeComments[RandomUtils.randomInt(0, fakeComments.length - 1)];
                $(el).before(`<!-- ${comment} -->`);
            }
        });
    }

    // 修复：HTML实体编码（避免对注释进行编码）
    static applyHtmlEntityEncoding(html) {
        // 大幅减少HTML实体编码，只对特殊情况进行编码
        // 避免在脚本标签、样式标签和注释内进行编码，防止破坏结构
        
        let result = html;
        
        // 只对普通文本内容进行非常有限的编码
        // 避免对引号和注释进行编码，防止破坏HTML属性和JavaScript
        result = result.replace(/>([^<]*)</g, (match, content) => {
            // 跳过脚本和样式内容
            if (content.includes('function') || content.includes('var ') || content.includes('=') || content.includes('{')) {
                return match;
            }
            
            // 跳过注释内容（检查是否在注释中）
            if (content.trim().startsWith('!--') || content.includes('--')) {
                return match;
            }
            
            let encodedContent = content;
            
            // 只随机编码一些安全的字符，避免编码引号和注释相关字符
            if (RandomUtils.randomBool(0.05)) { // 进一步降低编码概率
                // 只编码极少数不会破坏结构的字符
                encodedContent = encodedContent.replace(/&(?![a-zA-Z0-9#]{1,7};)/g, '&amp;');
            }
            
            return `>${encodedContent}<`;
        });

        // 确保HTML注释不被破坏
        result = result.replace(/<!--\s*([^>]*)\s*--&gt;/g, '<!-- $1 -->');
        result = result.replace(/<!--\s*([^>]*)\s*--&amp;gt;/g, '<!-- $1 -->');

        return result;
    }

    // 新增：添加随机空白字符（保持适度）
    static addRandomWhitespace(html) {
        const whitespaceChars = [' ', '\t'];
        let result = html;
        
        // 在标签之间添加随机空白字符（降低概率）
        result = result.replace(/>\s*</g, (match) => {
            if (RandomUtils.randomBool(0.2)) { // 从0.4降低到0.2
                const extraWhitespace = whitespaceChars[RandomUtils.randomInt(0, whitespaceChars.length - 1)];
                return `>${extraWhitespace}<`;
            }
            return match;
        });

        return result;
    }

    // 检测是否为Google Analytics或其他第三方分析脚本
    static isAnalyticsScript(scriptContent, scriptSrc) {
        // 检查外部脚本URL
        if (scriptSrc) {
            const analyticsDomains = [
                'google-analytics.com',
                'googletagmanager.com',
                'gtag',
                'ga.js',
                'analytics.js',
                'gtm.js',
                'facebook.net',
                'connect.facebook.net',
                'mixpanel.com',
                'amplitude.com',
                'baidu.com',
                'hm.baidu.com',
                'mc.yandex.ru',
                'matomo.org',
                'piwik.org'
            ];
            
            if (analyticsDomains.some(domain => scriptSrc.includes(domain))) {
                return true;
            }
        }
        
        // 检查脚本内容
        if (scriptContent) {
            const analyticsKeywords = [
                // Google Analytics
                'gtag(', 'ga(', 'GoogleAnalyticsObject', 'dataLayer',
                'google-analytics.com', 'googletagmanager.com',
                '_gaq', '_gat', 'goog_report_conversion',
                
                // Facebook Pixel
                'fbq(', '_fbq', 'facebook.net',
                
                // 其他分析工具
                'mixpanel.', 'amplitude.', '_hmt', 'yaCounter', '_paq',
                
                // 常见分析配置
                'UA-', 'GTM-', 'G-', 'AW-', // Google Analytics/Tag Manager IDs
                'track(', 'pageview', 'event', 'conversion'
            ];
            
            // 检查是否包含任何分析工具的特征
            const hasAnalyticsCode = analyticsKeywords.some(keyword => 
                scriptContent.includes(keyword)
            );
            
            if (hasAnalyticsCode) {
                return true;
            }
        }
        
        return false;
    }
}

module.exports = HtmlObfuscator;