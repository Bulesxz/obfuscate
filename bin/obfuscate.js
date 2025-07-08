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
        enableKeywordObfuscation: true,
        sentenceObfuscationRate: 0.6, // 默认60%概率混淆句子
        enableSentenceObfuscation: true
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
            i++; // 跳过下一个参数
        } else if (arg === '--no-keyword') {
            options.enableKeywordObfuscation = false;
        } else if (arg === '--no-sentence') {
            options.enableSentenceObfuscation = false;
        } else if (arg.startsWith('--')) {
            console.error(`Error: Unknown option ${arg}`);
            process.exit(1);
        } else if (argNext) {
            if (arg === '-o') {
                outputDir = argNext;
                i++; // 跳过下一个参数
            } else if (arg === '-n') {
                outCount = +argNext;
                if (isNaN(outCount) || outCount < 1 || outCount > 10) {
                    console.error('Error: --output-count must be a number between 1 and 10');
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
  -k, --keyword-rate <rate>  关键词混淆概率 (0.0-1.0，默认: 0.4)
                             0.4 表示40%概率混淆关键词本身，60%保持不变
  -s, --sentence-rate <rate> 句子混淆概率 (0.0-1.0，默认: 0.6)
                             0.6 表示60%概率对句子进行span和不可见字符混淆
  --no-keyword               禁用关键词混淆功能
  --no-sentence              禁用句子混淆功能
  -o <output-directory>      指定输出目录 (默认: 目标目录上级目录)
  -n <output-count>          指定输出数量 (默认: 1， 最大: 10)

Examples:
  obfuscate ./website                    # 使用默认设置混淆网站
  obfuscate ./website -k 0.6           # 60%概率混淆关键词本身
  obfuscate ./website -s 0.8           # 80%概率混淆句子
  obfuscate ./website -k 0.2 -s 0.4    # 20%概率混淆关键词，40%概率混淆句子
  obfuscate ./website --no-keyword     # 只使用句子混淆，禁用关键词混淆
  obfuscate ./website --no-sentence    # 只使用关键词混淆，禁用句子混淆
`);
}

const options = parseArgs();
const engine = new ObfuscationEngine(options);

engine.run().catch(err => {
    console.error('Obfuscation failed:', err);
    process.exit(1);
});