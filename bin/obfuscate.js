#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const ObfuscationEngine = require('../lib/obfuscation-engine');

// 解析命令行参数
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        targetDir: null,
        keywordObfuscationRate: 0.4, // 默认40%概率混淆关键词本身（60%不混淆）
        enableKeywordObfuscation: false,
        sentenceObfuscationRate: 0.6, // 默认60%概率混淆句子
        enableSentenceObfuscation: false,
        enhancedHtmlObfuscation: true, // 默认启用增强HTML混淆
        protectThirdParty: true, // 默认启用第三方保护
        enableCssObfuscation: true, // 默认启用CSS混淆
        structureObfuscationLevel: 'medium' // 新增：结构混淆级别 (low, medium, high, extreme)
    };

    if (args.length === 0) {
        showUsage();
        process.exit(1);
    }

    // 解析为绝对路径
    const targetDir = path.resolve(args[0]);
    if (!fs.existsSync(targetDir)) {
        console.error('Error: Target directory is required');
        showUsage();
        process.exit(1);
    }

    // 初始化输出目录和输出数量
    let outputDir = '.';
    let outCount = 1;

    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        const argNext = args[i + 1];

        if (arg === '--help' || arg === '-h') {
            showUsage();
            process.exit(0);
        } else if (arg === '--keyword-rate' || arg === '-k') {
            if (i + 1 >= args.length) {
                console.error('Error: --keyword-rate requires a value');
                process.exit(1);
            }
            const rate = parseFloat(argNext);
            if (isNaN(rate) || rate < 0 || rate > 1) {
                console.error('Error: --keyword-rate must be a number between 0 and 1');
                process.exit(1);
            }
            options.keywordObfuscationRate = rate;
            options.enableKeywordObfuscation = true; // 使用 -k 参数时自动启用关键词混淆
            i++; // 跳过下一个参数
        } else if (arg === '--sentence-rate' || arg === '-s') {
            if (i + 1 >= args.length) {
                console.error('Error: --sentence-rate requires a value');
                process.exit(1);
            }
            const rate = parseFloat(argNext);
            if (isNaN(rate) || rate < 0 || rate > 1) {
                console.error('Error: --sentence-rate must be a number between 0 and 1');
                process.exit(1);
            }
            options.sentenceObfuscationRate = rate;
            options.enableSentenceObfuscation = true; // 使用 -s 参数时自动启用句子混淆
            i++; // 跳过下一个参数
        } else if (arg === '--no-keyword') {
            options.enableKeywordObfuscation = false;
        } else if (arg === '--no-sentence') {
            options.enableSentenceObfuscation = false;
        } else if (arg === '--enhanced-html') {
            options.enhancedHtmlObfuscation = true;
        } else if (arg === '--no-enhanced-html') {
            options.enhancedHtmlObfuscation = false;
        } else if (arg === '--protect-third-party') {
            options.protectThirdParty = true;
        } else if (arg === '--no-protect-third-party') {
            options.protectThirdParty = false;
        } else if (arg === '--no-css') {
            options.enableCssObfuscation = false;
        } else if (arg === '--minimal') {
            // 最小混淆模式：只混淆JavaScript，保持HTML和CSS完全不变
            options.enableCssObfuscation = false;
            options.enhancedHtmlObfuscation = false;
            options.enableKeywordObfuscation = false;
            options.enableSentenceObfuscation = false;
        } else if (arg === '--preserve-format') {
            // 保持格式模式：完全不修改HTML格式，只混淆JavaScript
            options.enableCssObfuscation = false;
            options.enhancedHtmlObfuscation = false;
            options.enableKeywordObfuscation = false;
            options.enableSentenceObfuscation = false;
            options.preserveFormat = true;
        } else if (arg === '--structure-level') {
            if (i + 1 >= args.length) {
                console.error('Error: --structure-level requires a value (low, medium, high, extreme)');
                process.exit(1);
            }
            const level = argNext.toLowerCase();
            if (!['low', 'medium', 'high', 'extreme'].includes(level)) {
                console.error('Error: --structure-level must be one of: low, medium, high, extreme');
                process.exit(1);
            }
            options.structureObfuscationLevel = level;
            i++; // 跳过下一个参数
        } else if (arg.startsWith('--')) {
            console.error(`Error: Unknown option ${arg}`);
            process.exit(1);
        } else if (argNext) {
            if (arg === '-o') {
                outputDir = argNext;
                i++; // 跳过下一个参数
            } else if (arg === '-n') {
                outCount = +argNext;
                if (isNaN(outCount) || outCount < 1 || outCount > 50) {
                    console.error('Error: --output-count must be a number between 1 and 50');
                    process.exit(1);
                }
                i++; // 跳过下一个参数
            }
        }
    }

    options.targetDir = targetDir;
    options.outputDir = outputDir;
    options.outCount = outCount;

    return options;
}

function showUsage() {
    console.log(`
Usage: obfuscate <target-directory> [options]

Options:
  -h, --help                 显示帮助信息
  -k, --keyword-rate <rate>  启用关键词混淆并设置混淆概率 (0.0-1.0)
                             0.4 表示40%概率混淆关键词本身，60%保持不变
  -s, --sentence-rate <rate> 启用句子混淆并设置混淆概率 (0.0-1.0)
                             0.6 表示60%概率对句子进行span和不可见字符混淆
  --no-keyword               明确禁用关键词混淆功能
  --no-sentence              明确禁用句子混淆功能
  --enhanced-html            启用增强HTML混淆 (默认启用)
  --no-enhanced-html         禁用增强HTML混淆
  --protect-third-party      启用第三方框架保护 (默认启用)
  --no-protect-third-party   禁用第三方框架保护，混淆所有类名和ID
  --no-css                   禁用CSS混淆，保持所有样式和类名不变
  --minimal                  最小混淆模式，只混淆JavaScript，保持HTML和CSS完全不变
  --preserve-format          保持格式模式，完全不修改HTML格式，只混淆JavaScript
  --structure-level <level>  设置结构混淆级别 (low, medium, high, extreme)
  -o <output-directory>      指定输出目录 (默认: 目标目录上级目录)
  -n <output-count>          指定输出数量 (默认: 1， 最大: 10)

混淆功能控制:
  • 默认情况下，关键词和句子混淆都是关闭的，但增强HTML混淆和第三方保护是启用的
  • 使用 -k 参数会自动启用关键词混淆
  • 使用 -s 参数会自动启用句子混淆
  • 使用 --no-keyword 或 --no-sentence 明确禁用相应功能
  • 使用 --no-enhanced-html 可以禁用增强HTML混淆，只进行基础混淆
  • 使用 --no-protect-third-party 可以禁用第三方保护，混淆所有类名和ID

增强HTML混淆功能包括:
  • CSS类名和ID混淆 (智能识别并保护第三方框架)
  • HTML结构混淆 (添加无意义的嵌套元素)
  • HTML属性混淆 (添加随机属性)
  • HTML标签混淆 (语义等价标签替换)
  • DOM结构打乱 (重新排列元素顺序)
  • 虚假注释添加 (混淆代码意图)
  • HTML实体编码 (字符编码混淆)
  • 随机空白字符 (格式混淆)

HTML结构混淆级别:
  • low: 基础结构混淆，添加少量包装容器
  • medium: 中等结构混淆，添加多层嵌套和隐藏元素 (默认)
  • high: 高级结构混淆，创建复杂布局结构和语义混淆
  • extreme: 极端结构混淆，大量结构噪声和深度嵌套

第三方框架保护功能:
  • 自动识别Bootstrap、Tailwind CSS、jQuery UI等主流框架
  • 保护Font Awesome图标类名不被混淆
  • 保护Google Analytics、Facebook Pixel等分析工具
  • 保护WordPress、WooCommerce等CMS平台类名
  • 保护电商平台(Stripe、PayPal)的关键ID和类名
  • 保护无障碍相关的类名(sr-only等)

Examples:
  obfuscate ./website                    # 只进行代码和增强HTML混淆，保护第三方框架
  obfuscate ./website -k 0.6             # 启用关键词混淆，60%概率处理
  obfuscate ./website -s 0.8             # 启用句子混淆，80%概率处理
  obfuscate ./website -k 0.2 -s 0.4      # 同时启用两种混淆
  obfuscate ./website --no-enhanced-html # 禁用增强HTML混淆，只进行基础混淆
  obfuscate ./website --no-protect-third-party  # 禁用第三方保护，混淆所有类名
  obfuscate ./website --no-css           # 禁用CSS混淆，保持所有样式不变
  obfuscate ./website --minimal          # 最小混淆，只混淆JavaScript，HTML和CSS完全不变
  obfuscate ./website --preserve-format # 保持格式，完全不修改HTML结构和格式
  obfuscate ./website --structure-level low     # 使用低级别结构混淆
  obfuscate ./website --structure-level high    # 使用高级别结构混淆
  obfuscate ./website --structure-level extreme # 使用极端级别结构混淆
  obfuscate ./website -k 0.5 --no-sentence      # 只使用关键词混淆
  obfuscate ./website -s 0.7 --no-keyword       # 只使用句子混淆
`);
}

const options = parseArgs();
const engine = new ObfuscationEngine(options);

engine.run().catch(err => {
    console.error('Obfuscation failed:', err);
    process.exit(1);
});